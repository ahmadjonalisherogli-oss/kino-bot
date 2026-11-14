"""Application-wide constants and Uzbek UI strings."""

SUPPORTED_VIDEO_MIME_TYPES = frozenset({
    "video/mp4",
    "video/x-matroska",
    "video/webm",
    "video/quicktime",
    "video/x-msvideo",
    "video/mpeg",
    "application/x-matroska",
})

SUPPORTED_VIDEO_EXTENSIONS = frozenset({
    ".mp4",
    ".mkv",
    ".webm",
    ".mov",
    ".avi",
    ".m4v",
})

SUBSCRIPTION_CACHE_TTL_SECONDS = 300
MEDIA_GROUP_DEBOUNCE_SECONDS = 2.5
DEFAULT_PAGE_SIZE = 8

# Main ReplyKeyboard labels (Uzbek)
BTN_ALL_MOVIES = "🎬 Barcha kinolar"
BTN_TRENDING_MOVIES = "🔥 Trenddagi kinolar"
BTN_NEW_MOVIES = "🆕 Yangi kinolar"
BTN_POPULAR_MOVIES = "⭐ Eng mashhur kinolar"
BTN_SEARCH_MOVIE = "🔎 Kino qidirish"
BTN_GENRES = "🎭 Janrlar"
BTN_LANGUAGES = "🌍 Til bo‘yicha"
BTN_FAVORITES = "❤️ Sevimlilar"
BTN_MY_STATS = "📊 Mening statistikam"

MAIN_MENU_BUTTONS = (
    BTN_ALL_MOVIES,
    BTN_TRENDING_MOVIES,
    BTN_NEW_MOVIES,
    BTN_POPULAR_MOVIES,
    BTN_SEARCH_MOVIE,
    BTN_GENRES,
    BTN_LANGUAGES,
    BTN_FAVORITES,
    BTN_MY_STATS,
)
