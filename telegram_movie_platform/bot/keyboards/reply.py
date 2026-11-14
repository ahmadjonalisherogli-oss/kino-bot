"""Uzbek ReplyKeyboards for main bot navigation."""
from aiogram.types import KeyboardButton, ReplyKeyboardMarkup
from shared.constants import (
    BTN_ALL_MOVIES,
    BTN_FAVORITES,
    BTN_GENRES,
    BTN_LANGUAGES,
    BTN_MY_STATS,
    BTN_NEW_MOVIES,
    BTN_POPULAR_MOVIES,
    BTN_SEARCH_MOVIE,
    BTN_TRENDING_MOVIES,
)


def build_main_menu_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=BTN_ALL_MOVIES), KeyboardButton(text=BTN_TRENDING_MOVIES)],
            [KeyboardButton(text=BTN_NEW_MOVIES), KeyboardButton(text=BTN_POPULAR_MOVIES)],
            [KeyboardButton(text=BTN_SEARCH_MOVIE)],
            [KeyboardButton(text=BTN_GENRES), KeyboardButton(text=BTN_LANGUAGES)],
            [KeyboardButton(text=BTN_FAVORITES), KeyboardButton(text=BTN_MY_STATS)],
        ],
        resize_keyboard=True,
        input_field_placeholder="Kino nomi, kodi yoki menyudan tanlang...",
    )


def build_search_cancel_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="⬅️ Asosiy menyuga qaytish")]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )
