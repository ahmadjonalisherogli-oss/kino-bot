"""Personal user statistics handler."""
from aiogram import F, Router
from aiogram.types import Message
from bot.services.user_service import UserService
from shared.constants import BTN_MY_STATS

router = Router(name="user_stats")


@router.message(F.text == BTN_MY_STATS)
async def handle_my_stats(message: Message) -> None:
    stats = await UserService.get_user_stats(message.from_user.id)
    joined_str = stats["joined_at"].strftime("%Y-%m-%d") if stats["joined_at"] else "—"
    await message.answer(
        "📊 <b>Mening statistikam</b>\n\n"
        f"👁 Tomosha qilingan kinolar: <b>{stats['views_count']}</b> ta\n"
        f"❤️ Sevimli kinolar: <b>{stats['favorites_count']}</b> ta\n"
        f"🎬 Katalogdagi jami kinolar: <b>{stats['catalog_total']}</b> ta\n"
        f"📅 Botga qo‘shilgan sana: <code>{joined_str}</code>",
        parse_mode="HTML",
    )
