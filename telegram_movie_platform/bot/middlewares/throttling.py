"""Redis-backed sliding-window rate-limiting middleware."""
import time
from typing import Any, Awaitable, Callable
from aiogram import BaseMiddleware
from aiogram.types import CallbackQuery, Message, TelegramObject
from redis.asyncio import Redis


class ThrottlingMiddleware(BaseMiddleware):
    def __init__(self, redis: Redis, max_requests: int = 30, window_seconds: int = 60) -> None:
        self.redis = redis
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        user = getattr(event, "from_user", None)
        if user is None:
            return await handler(event, data)

        key = f"rl:tg:{user.id}"
        now = int(time.time())
        pipe = self.redis.pipeline()
        pipe.zremrangebyscore(key, 0, now - self.window_seconds)
        pipe.zadd(key, {f"{now}:{time.monotonic_ns()}": now})
        pipe.zcard(key)
        pipe.expire(key, self.window_seconds)
        _, _, request_count, _ = await pipe.execute()

        if request_count > self.max_requests:
            if isinstance(event, CallbackQuery):
                await event.answer("⏳ Juda ko‘p so‘rov yuborildi. Biroz kuting.", show_alert=True)
            elif isinstance(event, Message):
                await event.answer("⏳ Iltimos, so‘rovlarni biroz sekinroq yuboring.")
            return None

        return await handler(event, data)
