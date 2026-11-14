"""Unit tests for structured movie caption parser."""
from shared.caption_parser import parse_movie_caption


def test_parse_full_structured_caption():
    caption = (
        "🎬 Movie: Interstellar\n"
        "📅 Year: 2014\n"
        "🎭 Genre: Sci-Fi, Drama\n"
        "🌍 Language: Uzbek\n"
        "⭐ Rating: 8.7\n"
        "⏱ Duration: 2h 49m\n"
        "🆔 Code: KINO-2014\n"
        "📝 Description: A team of explorers travel through a wormhole in space."
    )
    parsed = parse_movie_caption(caption)
    assert parsed.title == "Interstellar"
    assert parsed.release_year == 2014
    assert parsed.genres == ["Sci-Fi", "Drama"]
    assert parsed.language == "Uzbek"
    assert parsed.rating == 8.7
    assert parsed.duration_text == "2h 49m"
    assert parsed.movie_code == "KINO-2014"
    assert parsed.description == "A team of explorers travel through a wormhole in space."
    assert parsed.is_complete is True


def test_parse_uzbek_caption_does_not_invent_missing_fields():
    caption = "🎬 Kino: Samarqand Osmoni\n📅 Yil: 2023"
    parsed = parse_movie_caption(caption)
    assert parsed.title == "Samarqand Osmoni"
    assert parsed.release_year == 2023
    assert parsed.genres == []
    assert parsed.language is None
    assert parsed.rating is None
    assert parsed.is_complete is False


def test_parse_empty_caption_returns_empty_fields():
    parsed = parse_movie_caption("")
    assert parsed.title is None
    assert parsed.release_year is None
    assert parsed.is_complete is False
