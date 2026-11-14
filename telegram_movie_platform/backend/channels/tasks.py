"""Celery background tasks for broadcasts and channel post availability verification."""
import asyncio
import logging
import os
from datetime import timedelta
from aiogram import Bot
from aiogram.exceptions import TelegramBadRequest, TelegramForbiddenError, TelegramRetryAfter
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_broadcast_announcement(self, announcement_id: int) -> dict:
    """Deliver a queued BroadcastAnnouncement to all active, non-blocked bot users."""
    from users.models import BroadcastAnnouncement, User

    token = os.getenv("BOT_TOKEN", "")
    if not token:
        logger.error("BOT_TOKEN is not configured; cannot deliver broadcast %s", announcement_id)
        return {"status": "error", "reason": "missing_bot_token"}

    announcement = BroadcastAnnouncement.objects.filter(id=announcement_id).first()
    if not announcement:
        return {"status": "not_found"}

    announcement.status = BroadcastAnnouncement.Status.SENDING
    announcement.save(update_fields=["status"])

    user_ids = list(
        User.objects.filter(is_blocked=False, is_bot_banned=False).values_list("telegram_id", flat=True)
    )

    async def _deliver() -> tuple[int, int, list[int]]:
        bot = Bot(token=token)
        sent = 0
        failed = 0
        banned_ids: list[int] = []
        try:
            for tg_id in user_ids:
                try:
                    await bot.send_message(chat_id=tg_id, text=announcement.message_text)
                    sent += 1
                    await asyncio.sleep(0.04)  # Stay comfortably under Telegram 30 msg/sec limit
                except TelegramRetryAfter as exc:
                    await asyncio.sleep(exc.retry_after + 0.5)
                    try:
                        await bot.send_message(chat_id=tg_id, text=announcement.message_text)
                        sent += 1
                    except Exception:
                        failed += 1
                except TelegramForbiddenError:
                    failed += 1
                    banned_ids.append(tg_id)
                except Exception:
                    failed += 1
        finally:
            await bot.session.close()
        return sent, failed, banned_ids

    sent_count, failed_count, banned_ids = asyncio.run(_deliver())
    if banned_ids:
        User.objects.filter(telegram_id__in=banned_ids).update(is_bot_banned=True)

    announcement.sent_count = sent_count
    announcement.failed_count = failed_count
    announcement.status = BroadcastAnnouncement.Status.COMPLETED
    announcement.completed_at = timezone.now()
    announcement.save(update_fields=["sent_count", "failed_count", "status", "completed_at"])
    return {"status": "completed", "sent": sent_count, "failed": failed_count}


@shared_task
def verify_channel_posts_availability(batch_size: int = 50) -> dict:
    """
    Safe alternative for detecting deleted Telegram channel posts.

    NOTE: The Telegram Bot API does NOT send webhook/polling updates when a channel post
    is deleted. When VERIFICATION_CHAT_ID (a private admin log channel) is configured,
    this task periodically probes recent ChannelPosts via copy_message + immediate delete_message.
    If Telegram responds with 'message to copy not found', the post and associated Movie
    are marked unavailable and logged in SyncLog.
    """
    from channels.models import ChannelPost, SyncLog

    token = os.getenv("BOT_TOKEN", "")
    verification_chat_id = os.getenv("VERIFICATION_CHAT_ID", "")
    if not token or not verification_chat_id:
        return {"status": "skipped", "reason": "BOT_TOKEN or VERIFICATION_CHAT_ID not configured"}

    cutoff = timezone.now() - timedelta(hours=6)
    posts = list(
        ChannelPost.objects.select_related("channel", "movie")
        .filter(is_deleted=False, channel__is_active=True, movie__isnull=False)
        .exclude(last_verified_at__gt=cutoff)[:batch_size]
    )

    async def _probe() -> tuple[int, int]:
        bot = Bot(token=token)
        checked = 0
        unavailable = 0
        try:
            for post in posts:
                checked += 1
                try:
                    copied = await bot.copy_message(
                        chat_id=int(verification_chat_id),
                        from_chat_id=post.channel.channel_id,
                        message_id=post.message_id,
                    )
                    await bot.delete_message(chat_id=int(verification_chat_id), message_id=copied.message_id)
                    post.last_verified_at = timezone.now()
                    post.save(update_fields=["last_verified_at"])
                except TelegramBadRequest as exc:
                    err_text = str(exc).lower()
                    if "not found" in err_text or "message_id_invalid" in err_text:
                        post.is_deleted = True
                        post.status = ChannelPost.PostStatus.UNAVAILABLE
                        post.last_verified_at = timezone.now()
                        post.save(update_fields=["is_deleted", "status", "last_verified_at"])
                        if post.movie:
                            post.movie.is_available = False
                            post.movie.save(update_fields=["is_available", "updated_at"])
                        SyncLog.objects.create(
                            channel=post.channel,
                            telegram_channel_id=post.channel.channel_id,
                            message_id=post.message_id,
                            movie=post.movie,
                            event_type=SyncLog.EventType.MARKED_UNAVAILABLE,
                            details="Manba kanal posti o‘chirilgani aniqlandi (verify_channel_posts_availability).",
                            success=True,
                        )
                        unavailable += 1
        finally:
            await bot.session.close()
        return checked, unavailable

    checked_count, marked_count = asyncio.run(_probe())
    return {"checked": checked_count, "marked_unavailable": marked_count}
