"""Start, help, and main menu navigation handlers."""
from aiogram import F, Router
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import Message
from bot.handlers.movie_detail import send_movie_card
from bot.keyboards.reply import build_main_menu_keyboard

router = Router(name="start")


@router.message(CommandStart())
async def handle_start(message: Message, state: FSMContext) -> None:
    await state.clear()
    args = message.text.split(maxsplit=1) if message.text else []
    if len(args) > 1 and args[1].startswith("movie_"):
        raw_id = args[1].replace("movie_", "", 1)
        if raw_id.isdigit():
            await send_movie_card(message, int(raw_id), message.from_user.id)
            return

    name = message.from_user.first_name if message.from_user else "Do‘stim"
    await message.answer(
        f"👋 <b>Assalomu alaykum, {name}!</b>\n\n"
        "🎬 <b>Kino Streaming Platformasiga xush kelibsiz.</b>\n"
        "Quyidagi menyudan o‘zingizga yoqqan filmni tanlang yoki qidiruvdan foydalaning:",
        reply_markup=build_main_menu_keyboard(),
        parse_mode="HTML",
    )


@router.message(Command("help"))
async def handle_help(message: Message) -> None:
    await message.answer(
        "ℹ️ <b>Botdan foydalanish bo‘yicha qo‘llanma:</b>\n\n"
        "• 🎬 <b>Barcha kinolar</b> — to‘liq katalog\n"
        "• 🔥 <b>Trenddagi</b> va ⭐ <b>Eng mashhur</b> kinolar\n"
        "• 🔎 <b>Kino qidirish</b> — nomi, ID, kino kodi, yili, janri yoki tili bo‘yicha izlash\n"
        "• ❤️ <b>Sevimlilar</b> — saqlangan filmlar ro‘yxati",
        parse_mode="HTML",
    )


@router.message(F.text == "⬅️ Asosiy menyuga qaytish")
async def handle_back_to_main(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer("🏠 Asosiy menyu:", reply_markup=build_main_menu_keyboard())
