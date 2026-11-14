"""Inline keyboards for movie pagination, details, genres, languages, and subscriptions."""
from typing import Iterable
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup


def build_movies_list_keyboard(
    movies: Iterable,
    page: int,
    total_pages: int,
    list_scope: str,
) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    for movie in movies:
        year = f" ({movie.release_year})" if movie.release_year else ""
        rating = f" · ⭐ {movie.rating}" if movie.rating else ""
        rows.append([
            InlineKeyboardButton(
                text=f"🎬 {movie.title}{year}{rating}",
                callback_data=f"movie:view:{movie.id}:{list_scope}:{page}",
            )
        ])

    nav_row: list[InlineKeyboardButton] = []
    if page > 1:
        nav_row.append(
            InlineKeyboardButton(text="⬅️ Oldingi", callback_data=f"catalog:{list_scope}:{page - 1}")
        )
    nav_row.append(
        InlineKeyboardButton(text=f"{page}/{max(total_pages, 1)}", callback_data="noop")
    )
    if page < total_pages:
        nav_row.append(
            InlineKeyboardButton(text="Keyingi ➡️", callback_data=f"catalog:{list_scope}:{page + 1}")
        )
    if nav_row:
        rows.append(nav_row)

    return InlineKeyboardMarkup(inline_keyboard=rows)


def build_movie_detail_keyboard(
    movie_id: int,
    is_favorite: bool,
    back_scope: str = "all",
    back_page: int = 1,
) -> InlineKeyboardMarkup:
    fav_text = "💔 Sevimlilardan o‘chirish" if is_favorite else "❤️ Sevimlilarga qo‘shish"
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🎬 Kinoni ko‘rish", callback_data=f"movie:watch:{movie_id}")],
            [InlineKeyboardButton(text=fav_text, callback_data=f"movie:fav:{movie_id}:{back_scope}:{back_page}")],
            [InlineKeyboardButton(text="⬅️ Ro‘yxatga qaytish", callback_data=f"catalog:{back_scope}:{back_page}")],
        ]
    )


def build_genres_keyboard(genres: Iterable) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    pair: list[InlineKeyboardButton] = []
    for genre in genres:
        pair.append(InlineKeyboardButton(text=f"🎭 {genre.name}", callback_data=f"catalog:genre_{genre.id}:1"))
        if len(pair) == 2:
            rows.append(pair)
            pair = []
    if pair:
        rows.append(pair)
    return InlineKeyboardMarkup(inline_keyboard=rows)


def build_languages_keyboard(languages: Iterable) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    pair: list[InlineKeyboardButton] = []
    for lang in languages:
        pair.append(InlineKeyboardButton(text=f"🌍 {lang.name}", callback_data=f"catalog:lang_{lang.id}:1"))
        if len(pair) == 2:
            rows.append(pair)
            pair = []
    if pair:
        rows.append(pair)
    return InlineKeyboardMarkup(inline_keyboard=rows)


def build_subscription_keyboard(channels: Iterable) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = [
        [InlineKeyboardButton(text=f"📢 {ch.title} — Obuna bo‘lish", url=ch.invite_link)]
        for ch in channels
    ]
    rows.append([
        InlineKeyboardButton(text="✅ Obunani tekshirish", callback_data="sub:check")
    ])
    return InlineKeyboardMarkup(inline_keyboard=rows)
