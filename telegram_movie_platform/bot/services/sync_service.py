"""
Automatic Telegram Channel-to-Bot Synchronization Service.

Handles:
- Extracting video & supported video document file_id / file_unique_id / poster file_id
- Parsing structured captions without fabricating missing metadata
- Preventing duplicate processing via (channel_id, message_id) and file_unique_id
- Merging media groups (albums) containing poster + video + caption
- Updating existing Movie records on edited_channel_post
- Recording structured SyncLog entries inside atomic database transactions
"""
from dataclasses import dataclass
from datetime import datetime, timezone as dt_timezone
import logging
from pathlib import Path
from typing import Any, Optional
from aiogram.types import Message
from asgiref.sync import sync_to_async
from django.db import transaction
from django.utils import timezone
from shared.caption_parser import parse_movie_caption
from shared.constants import SUPPORTED_VIDEO_EXTENSIONS, SUPPORTED_VIDEO_MIME_TYPES

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class ExtractedMedia:
    file_id: str
    file_unique_id: str
    is_document: bool
    mime_type: Optional[str] = None
    file_size: Optional[int] = None
    duration_seconds: Optional[int] = None
    file_name: Optional[str] = None
    thumbnail_file_id: Optional[str] = None


def extract_video_payload(message: Message) -> Optional[ExtractedMedia]:
    """Extract Telegram file_id and file_unique_id from video or video-document messages."""
    if message.video:
        thumb_id = message.video.thumbnail.file_id if message.video.thumbnail else None
        return ExtractedMedia(
            file_id=message.video.file_id,
            file_unique_id=message.video.file_unique_id,
            is_document=False,
            mime_type=message.video.mime_type or "video/mp4",
            file_size=message.video.file_size,
            duration_seconds=message.video.duration,
            file_name=message.video.file_name,
            thumbnail_file_id=thumb_id,
        )

    if message.document:
        doc = message.document
        mime = (doc.mime_type or "").lower()
        ext = Path(doc.file_name or "").suffix.lower()
        if mime in SUPPORTED_VIDEO_MIME_TYPES or mime.startswith("video/") or ext in SUPPORTED_VIDEO_EXTENSIONS:
            thumb_id = doc.thumbnail.file_id if doc.thumbnail else None
            return ExtractedMedia(
                file_id=doc.file_id,
                file_unique_id=doc.file_unique_id,
                is_document=True,
                mime_type=doc.mime_type,
                file_size=doc.file_size,
                duration_seconds=None,
                file_name=doc.file_name,
                thumbnail_file_id=thumb_id,
            )

    return None


def extract_poster_photo_file_id(message: Message) -> Optional[str]:
    if message.photo:
        return message.photo[-1].file_id
    return None


def _generate_next_movie_code() -> str:
    from movies.models import Movie

    last_id = Movie.objects.order_by("-id").values_list("id", flat=True).first() or 0
    candidate = f"KINO-{1000 + last_id + 1}"
    while Movie.objects.filter(movie_code=candidate).exists():
        last_id += 1
        candidate = f"KINO-{1000 + last_id + 1}"
    return candidate


class ChannelSyncService:
    @staticmethod
    @sync_to_async
    def sync_single_post(
        channel_id: int,
        message_id: int,
        caption: Optional[str],
        media: Optional[ExtractedMedia],
        poster_file_id: Optional[str] = None,
        media_group_id: Optional[str] = None,
        published_dt: Optional[datetime] = None,
    ) -> dict[str, Any]:
        from channels.models import ChannelPost, SyncLog, TelegramChannel
        from movies.models import Genre, Language, Movie

        with transaction.atomic():
            channel = TelegramChannel.objects.filter(
                channel_id=channel_id, is_active=True, sync_enabled=True
            ).first()
            if not channel:
                SyncLog.objects.create(
                    telegram_channel_id=channel_id,
                    message_id=message_id,
                    event_type=SyncLog.EventType.UNAUTHORIZED_CHANNEL,
                    details="Ruxsatsiz yoki o‘chirilgan kanal posti rad etildi.",
                    success=False,
                )
                return {"action": "unauthorized"}

            if not media:
                ChannelPost.objects.get_or_create(
                    channel=channel,
                    message_id=message_id,
                    defaults={
                        "media_group_id": media_group_id,
                        "raw_caption": caption,
                        "status": ChannelPost.PostStatus.IGNORED,
                    },
                )
                return {"action": "ignored_non_video"}

            # Duplicate check 1: Exact (channel, message_id)
            existing_post = (
                ChannelPost.objects.select_for_update()
                .filter(channel=channel, message_id=message_id)
                .first()
            )
            if existing_post:
                SyncLog.objects.create(
                    channel=channel,
                    telegram_channel_id=channel_id,
                    message_id=message_id,
                    movie=existing_post.movie,
                    event_type=SyncLog.EventType.DUPLICATE_SKIPPED,
                    details="Xabar ID bo‘yicha dublikat post o‘tkazib yuborildi.",
                    success=True,
                )
                return {"action": "duplicate_message", "movie_id": existing_post.movie_id}

            # Duplicate check 2: Global Telegram file_unique_id
            duplicate_movie = (
                Movie.objects.select_for_update()
                .filter(telegram_file_unique_id=media.file_unique_id)
                .first()
            )
            if duplicate_movie:
                ChannelPost.objects.create(
                    channel=channel,
                    message_id=message_id,
                    media_group_id=media_group_id,
                    file_id=media.file_id,
                    file_unique_id=media.file_unique_id,
                    raw_caption=caption,
                    movie=duplicate_movie,
                    status=ChannelPost.PostStatus.DUPLICATE,
                )
                SyncLog.objects.create(
                    channel=channel,
                    telegram_channel_id=channel_id,
                    message_id=message_id,
                    movie=duplicate_movie,
                    event_type=SyncLog.EventType.DUPLICATE_SKIPPED,
                    details=f"file_unique_id={media.file_unique_id} bo‘yicha dublikat video aniqlandi.",
                    success=True,
                )
                return {"action": "duplicate_file", "movie_id": duplicate_movie.id}

            parsed = parse_movie_caption(caption)
            resolved_title = parsed.title
            needs_review = not parsed.is_complete
            if not resolved_title:
                if media.file_name:
                    resolved_title = Path(media.file_name).stem.replace(".", " ").replace("_", " ").strip()
                else:
                    resolved_title = f"Nomsiz kino #{message_id}"
                needs_review = True

            language_obj = None
            if parsed.language:
                lang_code = parsed.language[:16].lower()
                language_obj, _ = Language.objects.get_or_create(
                    name__iexact=parsed.language,
                    defaults={"name": parsed.language, "code": lang_code},
                )

            movie_code = parsed.movie_code or _generate_next_movie_code()
            if Movie.objects.filter(movie_code=movie_code).exists():
                movie_code = _generate_next_movie_code()

            effective_poster = poster_file_id or media.thumbnail_file_id
            pub_time = published_dt or timezone.now()
            if pub_time.tzinfo is None:
                pub_time = pub_time.replace(tzinfo=dt_timezone.utc)

            movie = Movie.objects.create(
                movie_code=movie_code,
                title=resolved_title[:255],
                description=parsed.description,
                release_year=parsed.release_year,
                language=language_obj,
                duration_seconds=media.duration_seconds,
                duration_display=parsed.duration_text,
                rating=parsed.rating,
                poster_file_id=effective_poster,
                telegram_file_id=media.file_id,
                telegram_file_unique_id=media.file_unique_id,
                is_document_video=media.is_document,
                mime_type=media.mime_type,
                file_size_bytes=media.file_size,
                source_channel=channel,
                channel_message_id=message_id,
                media_group_id=media_group_id,
                origin=Movie.SyncOrigin.CHANNEL_SYNC,
                is_available=channel.auto_publish,
                needs_metadata_review=needs_review,
                published_at=pub_time,
            )

            for genre_name in parsed.genres:
                genre_obj, _ = Genre.objects.get_or_create(name=genre_name[:80])
                movie.genres.add(genre_obj)

            ChannelPost.objects.create(
                channel=channel,
                message_id=message_id,
                media_group_id=media_group_id,
                file_id=media.file_id,
                file_unique_id=media.file_unique_id,
                raw_caption=caption,
                movie=movie,
                status=ChannelPost.PostStatus.SYNCED,
            )

            channel.last_synced_at = timezone.now()
            channel.save(update_fields=["last_synced_at"])

            SyncLog.objects.create(
                channel=channel,
                telegram_channel_id=channel_id,
                message_id=message_id,
                movie=movie,
                event_type=SyncLog.EventType.CREATED,
                details=f"Kino avtomatik qo‘shildi: {movie.title} [{movie.movie_code}]",
                success=True,
            )
            return {"action": "created", "movie_id": movie.id, "movie_code": movie.movie_code}

    @classmethod
    async def sync_media_group(cls, messages: list[Message]) -> list[dict[str, Any]]:
        """
        Merge a Telegram media group (album):
        - Collects shared caption & poster photo file_id from album items
        - Syncs every distinct video item using the merged caption and poster
        """
        if not messages:
            return []

        ordered = sorted(messages, key=lambda m: m.message_id)
        shared_caption = next((m.caption for m in ordered if m.caption), None)
        shared_poster = next(
            (extract_poster_photo_file_id(m) for m in ordered if extract_poster_photo_file_id(m)),
            None,
        )

        results: list[dict[str, Any]] = []
        for msg in ordered:
            media = extract_video_payload(msg)
            if not media:
                continue
            res = await cls.sync_single_post(
                channel_id=msg.chat.id,
                message_id=msg.message_id,
                caption=msg.caption or shared_caption,
                media=media,
                poster_file_id=shared_poster,
                media_group_id=msg.media_group_id,
                published_dt=msg.date,
            )
            results.append(res)

        if results:
            await cls._log_media_group_merge(ordered[0].chat.id, ordered[0].message_id, len(results))
        return results

    @staticmethod
    @sync_to_async
    def _log_media_group_merge(channel_id: int, first_message_id: int, video_count: int) -> None:
        from channels.models import SyncLog, TelegramChannel

        channel = TelegramChannel.objects.filter(channel_id=channel_id).first()
        SyncLog.objects.create(
            channel=channel,
            telegram_channel_id=channel_id,
            message_id=first_message_id,
            event_type=SyncLog.EventType.MEDIA_GROUP_MERGED,
            details=f"Media guruhdan {video_count} ta video sinxronlandi.",
            success=True,
        )

    @staticmethod
    @sync_to_async
    def sync_edited_post(
        channel_id: int,
        message_id: int,
        caption: Optional[str],
        media: Optional[ExtractedMedia] = None,
    ) -> dict[str, Any]:
        from channels.models import ChannelPost, SyncLog, TelegramChannel
        from movies.models import Genre, Language

        with transaction.atomic():
            channel = TelegramChannel.objects.filter(
                channel_id=channel_id, is_active=True, sync_enabled=True
            ).first()
            if not channel:
                return {"action": "unauthorized"}

            post = (
                ChannelPost.objects.select_for_update()
                .select_related("movie")
                .filter(channel=channel, message_id=message_id)
                .first()
            )
            if not post or not post.movie:
                return {"action": "post_not_found"}

            movie = post.movie
            parsed = parse_movie_caption(caption)
            if parsed.title:
                movie.title = parsed.title[:255]
            if parsed.description is not None:
                movie.description = parsed.description
            if parsed.release_year is not None:
                movie.release_year = parsed.release_year
            if parsed.rating is not None:
                movie.rating = parsed.rating
            if parsed.duration_text:
                movie.duration_display = parsed.duration_text
            if parsed.language:
                lang_obj, _ = Language.objects.get_or_create(
                    name__iexact=parsed.language,
                    defaults={"name": parsed.language, "code": parsed.language[:16].lower()},
                )
                movie.language = lang_obj

            if media:
                movie.telegram_file_id = media.file_id
                movie.telegram_file_unique_id = media.file_unique_id
                movie.is_document_video = media.is_document
                movie.mime_type = media.mime_type
                movie.file_size_bytes = media.file_size
                post.file_id = media.file_id
                post.file_unique_id = media.file_unique_id

            movie.needs_metadata_review = not parsed.is_complete
            movie.save()

            if parsed.genres:
                movie.genres.clear()
                for g_name in parsed.genres:
                    g_obj, _ = Genre.objects.get_or_create(name=g_name[:80])
                    movie.genres.add(g_obj)

            post.raw_caption = caption
            post.status = ChannelPost.PostStatus.UPDATED
            post.edited_at = timezone.now()
            post.save()

            SyncLog.objects.create(
                channel=channel,
                telegram_channel_id=channel_id,
                message_id=message_id,
                movie=movie,
                event_type=SyncLog.EventType.UPDATED,
                details=f"Tahrirlangan post yangilandi: {movie.title} [{movie.movie_code}]",
                success=True,
            )
            return {"action": "updated", "movie_id": movie.id}
