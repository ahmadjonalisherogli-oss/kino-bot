"""Tests for multi-criteria movie search, catalog pagination, favorites, and playback view tracking."""
from django.utils import timezone
import pytest
from bot.services.movie_service import MovieService
from movies.models import Genre, Language, Movie, MovieView
from users.models import User


@pytest.mark.asyncio
async def test_search_by_title_code_year_genre_and_language():
    uzbek = await Language.objects.acreate(name="Uzbek", code="uz")
    scifi = await Genre.objects.acreate(name="Sci-Fi")
    user = await User.objects.acreate(telegram_id=777001, username="viewer_uz")

    movie = await Movie.objects.acreate(
        movie_code="KINO-505",
        title="Yulduzlararo Sayohat",
        release_year=2024,
        language=uzbek,
        rating=8.9,
        telegram_file_id="BAAC_PLAY_505",
        telegram_file_unique_id="UNIQ_PLAY_505",
        published_at=timezone.now(),
    )
    await movie.genres.aadd(scifi)

    for q in ("Yulduzlararo", "KINO-505", "2024", "Sci-Fi", "Uzbek", str(movie.id)):
        results, page, total_pages, total_count = await MovieService.search_movies(q)
        assert total_count == 1, f"Expected match for query={q}"
        assert results[0].id == movie.id

    # Playback tracking increments Movie.views_count and creates MovieView
    played = await MovieService.record_watch(movie.id, user.telegram_id)
    assert played is not None
    assert played.views_count == 1
    assert await MovieView.objects.filter(movie=movie, user=user).acount() == 1

    # Favorites toggle
    added = await MovieService.toggle_favorite(movie.id, user.telegram_id)
    assert added is True
    removed = await MovieService.toggle_favorite(movie.id, user.telegram_id)
    assert removed is False
