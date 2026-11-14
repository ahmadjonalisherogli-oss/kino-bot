"""
Structured Telegram channel caption parser.

Parses structured movie metadata in English or Uzbek without inventing missing fields.
Any missing attribute remains None so administrators can review/complete it in Django Admin.
"""
from dataclasses import dataclass, field
import re
from typing import Optional


@dataclass(slots=True)
class ParsedMovieMetadata:
    title: Optional[str] = None
    release_year: Optional[int] = None
    genres: list[str] = field(default_factory=list)
    language: Optional[str] = None
    rating: Optional[float] = None
    duration_text: Optional[str] = None
    movie_code: Optional[str] = None
    description: Optional[str] = None

    @property
    def is_complete(self) -> bool:
        return bool(self.title and self.release_year and self.genres and self.language)


_KEY_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("title", re.compile(r"^(?:🎬|🎥|🎞️?)?\s*(?:movie|kino|film|title|nomi)\s*[:\-]\s*(.+)$", re.IGNORECASE)),
    ("year", re.compile(r"^(?:📅|🗓️?)?\s*(?:year|yil|yili|release)\s*[:\-]\s*(\d{4})\b", re.IGNORECASE)),
    ("genres", re.compile(r"^(?:🎭|🏷️?)?\s*(?:genre|genres|janr|janri|janrlar)\s*[:\-]\s*(.+)$", re.IGNORECASE)),
    ("language", re.compile(r"^(?:🌍|🌐|🗣️?)?\s*(?:language|lang|til|tili)\s*[:\-]\s*(.+)$", re.IGNORECASE)),
    ("rating", re.compile(r"^(?:⭐|🌟|💯)?\s*(?:rating|imdb|reyting|baho)\s*[:\-]\s*([0-9]+(?:[.,][0-9]+)?)", re.IGNORECASE)),
    ("duration", re.compile(r"^(?:⏱️?|⏳|🕒)?\s*(?:duration|length|davomiyligi|vaqti)\s*[:\-]\s*(.+)$", re.IGNORECASE)),
    ("code", re.compile(r"^(?:🆔|🔢|#)?\s*(?:code|kod|id|kino\s*kodi)\s*[:\-]\s*([A-Za-z0-9_\-]+)", re.IGNORECASE)),
    ("description", re.compile(r"^(?:📝|📄|ℹ️?)?\s*(?:description|desc|tavsif|haqida|izoh)\s*[:\-]\s*(.+)$", re.IGNORECASE)),
]


def parse_movie_caption(caption: Optional[str]) -> ParsedMovieMetadata:
    """
    Parse a Telegram post caption into structured movie fields.

    Example supported caption:
        🎬 Movie: Interstellar
        📅 Year: 2014
        🎭 Genre: Sci-Fi, Drama
        🌍 Language: Uzbek
        ⭐ Rating: 8.7
        ⏱ Duration: 2h 49m
        🆔 Code: KINO-1042
        📝 Description: A team of explorers travel through a wormhole in space.
    """
    result = ParsedMovieMetadata()
    if not caption or not caption.strip():
        return result

    unmatched_lines: list[str] = []
    explicit_desc_lines: list[str] = []
    in_description_block = False

    for raw_line in caption.splitlines():
        line = raw_line.strip()
        if not line:
            if in_description_block and explicit_desc_lines:
                explicit_desc_lines.append("")
            continue

        matched = False
        for field_name, pattern in _KEY_PATTERNS:
            m = pattern.match(line)
            if not m:
                continue
            value = m.group(1).strip()
            in_description_block = False
            if field_name == "title" and not result.title:
                result.title = value
            elif field_name == "year" and result.release_year is None:
                year_val = int(value)
                if 1888 <= year_val <= 2100:
                    result.release_year = year_val
            elif field_name == "genres":
                parts = [g.strip().lstrip("#") for g in re.split(r"[,/|]+", value) if g.strip()]
                for part in parts:
                    if part not in result.genres:
                        result.genres.append(part)
            elif field_name == "language" and not result.language:
                result.language = value
            elif field_name == "rating" and result.rating is None:
                try:
                    rating_val = float(value.replace(",", "."))
                    if 0.0 <= rating_val <= 10.0:
                        result.rating = round(rating_val, 1)
                except ValueError:
                    pass
            elif field_name == "duration" and not result.duration_text:
                result.duration_text = value
            elif field_name == "code" and not result.movie_code:
                result.movie_code = value.upper()
            elif field_name == "description":
                explicit_desc_lines.append(value)
                in_description_block = True
            matched = True
            break

        if not matched:
            if in_description_block:
                explicit_desc_lines.append(line)
            else:
                # Ignore pure bot promo hashtags/links at the bottom unless meaningful prose
                if not line.startswith("@") and not line.startswith("https://t.me/"):
                    unmatched_lines.append(line)

    # If no explicit title line was given, use the first clean non-tag line as title
    if not result.title and unmatched_lines:
        candidate = unmatched_lines.pop(0)
        # Strip leading movie emoji if present without label
        candidate_clean = re.sub(r"^[🎬🎥🎞️\s]+", "", candidate).strip()
        if candidate_clean:
            result.title = candidate_clean

    if explicit_desc_lines:
        result.description = "\n".join(explicit_desc_lines).strip()
    elif unmatched_lines:
        # Remaining unmatched prose becomes description
        cleaned_desc = "\n".join(
            ln for ln in unmatched_lines if not re.fullmatch(r"(?:#\w+\s*)+", ln)
        ).strip()
        if cleaned_desc:
            result.description = cleaned_desc

    return result
