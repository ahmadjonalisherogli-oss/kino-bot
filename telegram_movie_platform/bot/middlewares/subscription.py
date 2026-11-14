"""Mandatory channel subscription verification middleware with Redis caching."""
from typing import Any, Awaitable, Callable
from aiogram import BaseMiddleware, Bot
from aiogram.types import CallbackQuery, Message, TelegramObject
from redis.asyncio import Redis
from bot.keyboards.inline import build_subscription_keyboard
from bot.services.subscription_service import SubscriptionService


class MandatorySubscriptionMiddleware(BaseMiddleware):
    def __init__(self, redis: Redis) -> None:
        self.redis = redis

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        # Always allow subscription verification callback through
        if isinstance(event, CallbackQuery) and event.data == "sub:check":
            return await handler(event, data)

        tg_user = getattr(event, "from_user", None)
        bot: Bot | None = data.get("bot")
        if tg_user is None or bot is None:
            return await handler(event, data)

        missing_channels = await SubscriptionService.get_unsubscribed_channels(
            bot=bot,
            redis=self.redis,
            user_id=tg_user.id,
        )
        if not missing_channels:
            return await handler(event, data)

        prompt_text = (
            "🔒 <b>Botdan to‘liq foydalanish uchun quyidagi kanallarga obuna bo‘ling:</b>\n\n"
            "Obuna bo‘lgach, «✅ Obunani tekshirish» tugmasini bosing."
        )
        keyboard = build_subscription_keyboard(missing_channels)
        if isinstance(event, CallbackQuery):
            await event.answer("Avval homiy kanallarga obuna bo‘ling!", show_alert=True)
            if event.message:
                await event.message.answer(prompt_text, reply_markup=keyboard, parse_mode="HTML")
        elif isinstance(event, Message):
            await event.answer(prompt_text, reply_markup=keyboard, parse_mode="HTML")
        return None
