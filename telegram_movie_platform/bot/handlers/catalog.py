"""Catalog browsing, genres, languages, favorites, and inline pagination handlers."""
from aiogram import F, Router
from aiogram.types import CallbackQuery, Message
from bot.keyboards.inline import (
    build_genres_keyboard,
    build_languages_keyboard,
    build_movies_list_keyboard,
)
from bot.services.movie_service import MovieService
from shared.constants import (
    BTN_ALL_MOVIES,
    BTN_FAVORITES,
    BTN_GENRES,
    BTN_LANGUAGES,
    BTN_NEW_MOVIES,
    BTN_POPULAR_MOVIES,
    BTN_TRENDING_MOVIES,
)

router = Router(name="catalog")

SCOPE_TITLES = {
    "all": "🎬 Barcha kinolar",
    "trending": "🔥 Trenddagi kinolar",
    "new": "🆕 Yangi kinolar",
    "popular": "⭐ Eng mashhur kinolar",
    "favorites": "❤️ Sevimli kinolaringiz",
}


async def _send_catalog_page(target: Message, scope: str, page: int, user_id: int, edit: bool = False) -> None:
    movies, safe_page, total_pages, total_count = await MovieService.get_catalog_page(
        scope=scope,
        page=page,
        user_telegram_id=user_id,
    )
    heading = SCOPE_TITLES.get(scope, "🎬 Kinolar ro‘yxati")
    if not movies:
        empty_text = f"{heading}\n\n😔 Hozircha bu bo‘limda kinolar topilmadi."
        if edit:
            await target.edit_text(empty_text, parse_mode="HTML")
        else:
            await target.answer(empty_text, parse_mode="HTML")
        return

    text = f"<b>{heading}</b>\nJami topildi: <b>{total_count}</b> ta · Sahifa: {safe_page}/{total_pages}"
    kb = build_movies_list_keyboard(movies, safe_page, total_pages, scope)
    if edit:
        await target.edit_text(text, reply_markup=kb, parse_mode="HTML")
    else:
        await target.answer(text, reply_markup=kb, parse_mode="HTML")


@router.message(F.text == BTN_ALL_MOVIES)
async def handle_all_movies(message: Message) -> None:
    await _send_catalog_page(message, "all", 1, message.from_user.id)


@router.message(F.text == BTN_TRENDING_MOVIES)
async def handle_trending_movies(message: Message) -> None:
    await _send_catalog_page(message, "trending", 1, message.from_user.id)


@router.message(F.text == BTN_NEW_MOVIES)
async def handle_new_movies(message: Message) -> None:
    await _send_catalog_page(message, "new", 1, message.from_user.id)


@router.message(F.text == BTN_POPULAR_MOVIES)
async def handle_popular_movies(message: Message) -> None:
    await _send_catalog_page(message, "popular", 1, message.from_user.id)


@router.message(F.text == BTN_FAVORITES)
async def handle_favorites(message: Message) -> None:
    await _send_catalog_page(message, "favorites", 1, message.from_user.id)


@router.message(F.text == BTN_GENRES)
async def handle_genres(message: Message) -> None:
    genres = await MovieService.list_genres()
    if not genres:
        await message.answer("🎭 Hozircha janrlar mavjud emas.")
        return
    await message.answer(
        "🎭 <b>Janrni tanlang:</b>",
        reply_markup=build_genres_keyboard(genres),
        parse_mode="HTML",
    )


@router.message(F.text == BTN_LANGUAGES)
async def handle_languages(message: Message) -> None:
    languages = await MovieService.list_languages()
    if not languages:
        await message.answer("🌍 Hozircha tillar ro‘yxati bo‘sh.")
        return
    await message.answer(
        "🌍 <b>Tilni tanlang:</b>",
        reply_markup=build_languages_keyboard(languages),
        parse_mode="HTML",
    )


@router.callback_query(F.data.startswith("catalog:"))
async def handle_catalog_pagination(callback: CallbackQuery) -> None:
    parts = callback.data.split(":")
    if len(parts) != 3:
        await callback.answer()
        return
    scope = parts[1]
    page = int(parts[2]) if parts[2].isdigit() else 1
    if callback.message:
        await _send_catalog_page(callback.message, scope, page, callback.from_user.id, edit=True)
    await callback.answer()


@router.callback_query(F.data == "noop")
async def handle_noop(callback: CallbackQuery) -> None:
    await callback.answer()
