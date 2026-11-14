"""Mandatory channel subscription check service with Redis caching."""
import logging
from aiogram import Bot
from aiogram.enums import ChatMemberStatus
from aiogram.exceptions import TelegramAPIError
from asgiref.sync import sync_to_async
from redis.asyncio import Redis
from shared.constants import SUBSCRIPTION_CACHE_TTL_SECONDS

logger = logging.getLogger(__name__)

ALLOWED_MEMBER_STATUSES = {
    ChatMemberStatus.MEMBER,
    ChatMemberStatus.ADMINISTRATOR,
    ChatMemberStatus.CREATOR,
}


class SubscriptionService:
    @staticmethod
    @sync_to_async
    def get_active_channels() -> list:
        from channels.models import SubscriptionChannel

        return list(SubscriptionChannel.objects.filter(is_active=True).order_by("order_priority", "id"))

    @classmethod
    async def get_unsubscribed_channels(
        cls,
        bot: Bot,
        redis: Redis | None,
        user_id: int,
        force_refresh: bool = False,
    ) -> list:
        channels = await cls.get_active_channels()
        if not channels:
            return []

        cache_key = f"sub:verified:{user_id}"
        if redis is not None and not force_refresh:
            cached = await redis.get(cache_key)
            if cached == b"1" or cached == "1":
                return []

        missing: list = []
        for channel in channels:
            try:
                member = await bot.get_chat_member(chat_id=channel.channel_id, user_id=user_id)
                if member.status not in ALLOWED_MEMBER_STATUSES:
                    missing.append(channel)
            except TelegramAPIError as exc:
                logger.warning(
                    "get_chat_member failed for channel=%s user=%s: %s",
                    channel.channel_id,
                    user_id,
                    exc,
                )
                missing.append(channel)

        if redis is not None:
            if not missing:
                await redis.set(cache_key, "1", ex=SUBSCRIPTION_CACHE_TTL_SECONDS)
            else:
                await redis.delete(cache_key)

        return missing
