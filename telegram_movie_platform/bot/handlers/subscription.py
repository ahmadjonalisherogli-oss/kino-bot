"""Mandatory channel subscription verification callback handler."""
from aiogram import Bot, F, Router
from aiogram.types import CallbackQuery
from redis.asyncio import Redis
from bot.keyboards.inline import build_subscription_keyboard
from bot.keyboards.reply import build_main_menu_keyboard
from bot.services.subscription_service import SubscriptionService

router = Router(name="subscription")


@router.callback_query(F.data == "sub:check")
async def handle_check_subscription(callback: CallbackQuery, bot: Bot, redis: Redis) -> None:
    missing = await SubscriptionService.get_unsubscribed_channels(
        bot=bot,
        redis=redis,
        user_id=callback.from_user.id,
        force_refresh=True,
    )
    if missing:
        await callback.answer("❌ Hali barcha kanallarga obuna bo‘lmadingiz!", show_alert=True)
        if callback.message:
            await callback.message.edit_reply_markup(reply_markup=build_subscription_keyboard(missing))
        return

    await callback.answer("✅ Obuna tasdiqlandi!", show_alert=False)
    if callback.message:
        await callback.message.delete()
        await callback.message.answer(
            "✅ <b>Obuna tasdiqlandi!</b> Endi barcha filmlardan foydalanishingiz mumkin.",
            reply_markup=build_main_menu_keyboard(),
            parse_mode="HTML",
        )
