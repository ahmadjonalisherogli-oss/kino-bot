"""Middleware to register and update Telegram users in PostgreSQL."""
from typing import Any, Awaitable, Callable
from aiogram import BaseMiddleware
from aiogram.types import CallbackQuery, Message, TelegramObject
from bot.services.user_service import UserService


class UserTrackingMiddleware(BaseMiddleware):
    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        tg_user = None
        if isinstance(event, (Message, CallbackQuery)) and event.from_user:
            tg_user = event.from_user

        if tg_user and not tg_user.is_bot:
            db_user = await UserService.upsert_user(
                telegram_id=tg_user.id,
                username=tg_user.username,
                first_name=tg_user.first_name,
                last_name=tg_user.last_name,
                language_code=tg_user.language_code or "uz",
            )
            if db_user.is_blocked:
                if isinstance(event, Message):
                    await event.answer("⛔ Sizning hisobingiz administrator tomonidan cheklangan.")
                elif isinstance(event, CallbackQuery):
                    await event.answer("⛔ Kirish cheklangan.", show_alert=True)
                return None
            data["db_user"] = db_user

        return await handler(event, data)
