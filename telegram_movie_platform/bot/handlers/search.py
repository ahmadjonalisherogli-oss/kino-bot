"""Interactive movie search by title, ID, movie code, year, genre, or language."""
from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message
from bot.keyboards.inline import build_movies_list_keyboard
from bot.keyboards.reply import build_main_menu_keyboard, build_search_cancel_keyboard
from bot.services.movie_service import MovieService
from bot.states.search import SearchStates
from shared.constants import BTN_SEARCH_MOVIE, MAIN_MENU_BUTTONS

router = Router(name="search")


@router.message(F.text == BTN_SEARCH_MOVIE)
async def start_search(message: Message, state: FSMContext) -> None:
    await state.set_state(SearchStates.waiting_for_query)
    await message.answer(
        "🔎 <b>Kino qidirish</b>\n\n"
        "Film nomi, kino kodi (masalan: <code>KINO-1042</code>), ID raqami, "
        "chiqarilgan yili, janri yoki tilini yuboring:",
        reply_markup=build_search_cancel_keyboard(),
        parse_mode="HTML",
    )


async def _render_search_results(target: Message, query: str, page: int = 1, edit: bool = False) -> None:
    movies, safe_page, total_pages, total_count = await MovieService.search_movies(query=query, page=page)
    if not movies:
        msg = f"😔 «<b>{query}</b>» so‘rovi bo‘yicha kino topilmadi. Boshqa so‘z bilan urinib ko‘ring."
        if edit:
            await target.edit_text(msg, parse_mode="HTML")
        else:
            await target.answer(msg, reply_markup=build_main_menu_keyboard(), parse_mode="HTML")
        return

    text = (
        f"🔎 <b>Qidiruv natijalari:</b> «{query}»\n"
        f"Topildi: <b>{total_count}</b> ta · Sahifa: {safe_page}/{total_pages}"
    )
    kb = build_movies_list_keyboard(movies, safe_page, total_pages, f"search_{query[:24]}")
    if edit:
        await target.edit_text(text, reply_markup=kb, parse_mode="HTML")
    else:
        await target.answer(text, reply_markup=kb, parse_mode="HTML")


@router.message(SearchStates.waiting_for_query, F.text)
async def process_search_query(message: Message, state: FSMContext) -> None:
    query = message.text.strip()
    if query in MAIN_MENU_BUTTONS:
        await state.clear()
        return

    await state.clear()
    await _render_search_results(message, query=query, page=1)


@router.callback_query(F.data.startswith("catalog:search_"))
async def paginate_search_results(callback: CallbackQuery) -> None:
    # format: catalog:search_<query>:<page>
    parts = callback.data.split(":", 2)
    if len(parts) != 3:
        await callback.answer()
        return
    query = parts[1].replace("search_", "", 1)
    page = int(parts[2]) if parts[2].isdigit() else 1
    if callback.message:
        await _render_search_results(callback.message, query=query, page=page, edit=True)
    await callback.answer()
