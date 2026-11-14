"""Movie detail card, favorite toggle, and instant file_id video playback handlers."""
import asyncio
import logging
from aiogram import Bot, F, Router
from aiogram.exceptions import TelegramAPIError, TelegramRetryAfter
from aiogram.types import CallbackQuery, Message
from bot.keyboards.inline import build_movie_detail_keyboard
from bot.services.movie_service import MovieService

logger = logging.getLogger(__name__)
router = Router(name="movie_detail")


def format_movie_caption(movie) -> str:
    genres_text = ", ".join(g.name for g in movie.genres.all()) or "Ko‘rsatilmagan"
    lang_text = movie.language.name if movie.language else "Ko‘rsatilmagan"
    year_text = str(movie.release_year) if movie.release_year else "Ko‘rsatilmagan"
    rating_text = f"{movie.rating}/10" if movie.rating is not None else "Ko‘rsatilmagan"
    desc_text = f"\n\n📝 {movie.description}" if movie.description else ""

    return (
        f"🎬 <b>{movie.title}</b>\n"
        f"🆔 Kod: <code>{movie.movie_code}</code> · ID: <code>{movie.id}</code>\n"
        f"📅 Yil: {year_text}\n"
        f"🎭 Janr: {genres_text}\n"
        f"🌍 Til: {lang_text}\n"
        f"⏱ Davomiyligi: {movie.formatted_duration}\n"
        f"⭐ Reyting: {rating_text}\n"
        f"👁 Ko‘rishlar: {movie.views_count}"
        f"{desc_text}"
    )


async def send_movie_card(
    target: Message,
    movie_id: int,
    user_id: int,
    back_scope: str = "all",
    back_page: int = 1,
) -> None:
    movie, is_fav = await MovieService.get_movie_detail(movie_id, user_id)
    if not movie:
        await target.answer("😔 Kechirasiz, ushbu kino hozircha mavjud emas.")
        return

    caption = format_movie_caption(movie)
    kb = build_movie_detail_keyboard(movie.id, is_fav, back_scope, back_page)
    if movie.poster_file_id:
        await target.answer_photo(
            photo=movie.poster_file_id,
            caption=caption,
            reply_markup=kb,
            parse_mode="HTML",
        )
    else:
        await target.answer(caption, reply_markup=kb, parse_mode="HTML")


@router.callback_query(F.data.startswith("movie:view:"))
async def handle_movie_view(callback: CallbackQuery) -> None:
    parts = callback.data.split(":")
    movie_id = int(parts[2])
    back_scope = parts[3] if len(parts) > 3 else "all"
    back_page = int(parts[4]) if len(parts) > 4 and parts[4].isdigit() else 1

    if callback.message:
        await send_movie_card(callback.message, movie_id, callback.from_user.id, back_scope, back_page)
    await callback.answer()


@router.callback_query(F.data.startswith("movie:fav:"))
async def handle_toggle_favorite(callback: CallbackQuery) -> None:
    parts = callback.data.split(":")
    movie_id = int(parts[2])
    back_scope = parts[3] if len(parts) > 3 else "all"
    back_page = int(parts[4]) if len(parts) > 4 and parts[4].isdigit() else 1

    is_fav = await MovieService.toggle_favorite(movie_id, callback.from_user.id)
    kb = build_movie_detail_keyboard(movie_id, is_fav, back_scope, back_page)
    if callback.message:
        await callback.message.edit_reply_markup(reply_markup=kb)
    await callback.answer("❤️ Sevimlilarga qo‘shildi" if is_fav else "💔 Sevimlilardan o‘chirildi")


@router.callback_query(F.data.startswith("movie:watch:"))
async def handle_watch_movie(callback: CallbackQuery, bot: Bot) -> None:
    movie_id = int(callback.data.split(":")[2])
    movie = await MovieService.record_watch(movie_id, callback.from_user.id)
    if not movie or not movie.telegram_file_id:
        await callback.answer("😔 Film fayli topilmadi yoki vaqtincha o‘chirilgan.", show_alert=True)
        return

    await callback.answer("🎬 Film yuborilmoqda...")
    caption = f"🎬 <b>{movie.title}</b> ({movie.movie_code})\nYoqimli tomosha!"
    chat_id = callback.from_user.id

    for attempt in range(2):
        try:
            if movie.is_document_video:
                await bot.send_document(
                    chat_id=chat_id,
                    document=movie.telegram_file_id,
                    caption=caption,
                    parse_mode="HTML",
                )
            else:
                await bot.send_video(
                    chat_id=chat_id,
                    video=movie.telegram_file_id,
                    caption=caption,
                    supports_streaming=True,
                    parse_mode="HTML",
                )
            break
        except TelegramRetryAfter as exc:
            if attempt == 0:
                await asyncio.sleep(exc.retry_after)
                continue
            logger.error("RetryAfter persisted while sending movie %s", movie_id)
        except TelegramAPIError as exc:
            logger.exception("Failed to deliver movie %s via file_id: %s", movie_id, exc)
            if callback.message:
                await callback.message.answer("❌ Filmni yuborishda Telegram API xatoligi yuz berdi.")
            break
