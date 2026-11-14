"""Channel authorization and bot admin permission filters."""
from aiogram.filters import BaseFilter
from aiogram.types import Message
from asgiref.sync import sync_to_async
from bot.config import settings


class AuthorizedChannelFilter(BaseFilter):
    """Allows channel_post updates only from registered, active, sync-enabled TelegramChannels."""

    async def __call__(self, message: Message) -> bool:
        from channels.models import SyncLog, TelegramChannel

        chat_id = message.chat.id
        channel = await sync_to_async(
            lambda: TelegramChannel.objects.filter(
                channel_id=chat_id, is_active=True, sync_enabled=True
            ).first()
        )()
        if channel is not None:
            return True

        await sync_to_async(SyncLog.objects.create)(
            telegram_channel_id=chat_id,
            message_id=message.message_id,
            event_type=SyncLog.EventType.UNAUTHORIZED_CHANNEL,
            details=f"Ruxsatsiz kanaldan post keldi: {message.chat.title or chat_id}",
            success=False,
        )
        return False


class BotAdminFilter(BaseFilter):
    """Validates whether the Telegram user is a configured platform administrator."""

    async def __call__(self, message: Message) -> bool:
        from users.models import Admin

        if not message.from_user:
            return False
        user_id = message.from_user.id
        if user_id in settings.admin_id_set:
            return True
        return await sync_to_async(
            lambda: Admin.objects.filter(telegram_id=user_id, is_active=True).exists()
        )()
