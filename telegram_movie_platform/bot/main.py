"""Main Aiogram 3.x Bot entrypoint."""
import asyncio
import logging
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.redis import RedisStorage
from aiogram.types import ErrorEvent
from redis.asyncio import Redis

from bot.config import bootstrap_django, settings
from shared.logging_config import configure_logging


async def main() -> None:
    configure_logging(level=settings.log_level, json_format=settings.json_logs)
    bootstrap_django()

    from bot.handlers import (
        catalog,
        channel_sync,
        movie_detail,
        search,
        start,
        subscription,
        user_stats,
    )
    from bot.middlewares import (
        MandatorySubscriptionMiddleware,
        ThrottlingMiddleware,
        UserTrackingMiddleware,
    )

    if not settings.bot_token:
        raise RuntimeError("BOT_TOKEN environment variable is required to start the bot.")

    redis = Redis.from_url(settings.redis_url, decode_responses=False)
    storage = RedisStorage(redis=redis)
    bot = Bot(
        token=settings.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )

    dp = Dispatcher(storage=storage)
    dp["redis"] = redis

    # Channel synchronization router operates independently of user-facing subscription checks
    dp.include_router(channel_sync.router)

    # User-facing router subtree with auth, rate-limiting, and mandatory subscription middlewares
    user_router_middlewares = [
        UserTrackingMiddleware(),
        ThrottlingMiddleware(
            redis=redis,
            max_requests=settings.rate_limit_requests,
            window_seconds=settings.rate_limit_window_seconds,
        ),
        MandatorySubscriptionMiddleware(redis=redis),
    ]
    for user_router in (
        subscription.router,
        start.router,
        catalog.router,
        search.router,
        movie_detail.router,
        user_stats.router,
    ):
        for mw in user_router_middlewares:
            user_router.message.middleware(mw)
            user_router.callback_query.middleware(mw)
        dp.include_router(user_router)

    @dp.errors()
    async def global_error_handler(event: ErrorEvent) -> bool:
        logging.getLogger("bot.errors").exception(
            "Unhandled bot update error: %s", event.exception
        )
        return True

    allowed_updates = ["message", "callback_query", "channel_post", "edited_channel_post"]
    logging.getLogger("bot.main").info("Starting Telegram Cinema Bot polling...")
    try:
        await dp.start_polling(bot, allowed_updates=allowed_updates)
    finally:
        await redis.aclose()
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
