"""Movie catalog, search, favorites, and playback tracking service."""
import math
from asgiref.sync import sync_to_async
from django.db import transaction
from django.db.models import F, Q
from shared.constants import DEFAULT_PAGE_SIZE


class MovieService:
    @staticmethod
    @sync_to_async
    def get_catalog_page(scope: str = "all", page: int = 1, page_size: int = DEFAULT_PAGE_SIZE, user_telegram_id: int | None = None):
        from movies.models import Favorite, Movie

        qs = (
            Movie.objects.select_related("language")
            .prefetch_related("genres")
            .filter(is_available=True, is_archived=False)
        )

        if scope == "trending":
            qs = qs.order_by("-is_trending", "-views_count", "-published_at")
        elif scope == "new":
            qs = qs.order_by("-published_at", "-id")
        elif scope == "popular":
            qs = qs.order_by("-views_count", "-rating", "-published_at")
        elif scope == "favorites" and user_telegram_id is not None:
            fav_ids = Favorite.objects.filter(user__telegram_id=user_telegram_id).values_list("movie_id", flat=True)
            qs = qs.filter(id__in=fav_ids).order_by("-published_at")
        elif scope.startswith("genre_"):
            genre_id = int(scope.split("_", 1)[1])
            qs = qs.filter(genres__id=genre_id).distinct().order_by("-published_at")
        elif scope.startswith("lang_"):
            lang_id = int(scope.split("_", 1)[1])
            qs = qs.filter(language_id=lang_id).order_by("-published_at")
        else:
            qs = qs.order_by("-published_at", "-id")

        total_count = qs.count()
        total_pages = max(1, math.ceil(total_count / page_size))
        safe_page = max(1, min(page, total_pages))
        offset = (safe_page - 1) * page_size
        items = list(qs[offset : offset + page_size])
        return items, safe_page, total_pages, total_count

    @staticmethod
    @sync_to_async
    def search_movies(query: str, page: int = 1, page_size: int = DEFAULT_PAGE_SIZE):
        from movies.models import Movie

        q = query.strip()
        qs = (
            Movie.objects.select_related("language")
            .prefetch_related("genres")
            .filter(is_available=True, is_archived=False)
        )

        if q.isdigit():
            num = int(q)
            if 1888 <= num <= 2100:
                qs = qs.filter(Q(release_year=num) | Q(id=num) | Q(movie_code__icontains=q))
            else:
                qs = qs.filter(Q(id=num) | Q(movie_code__icontains=q) | Q(title__icontains=q))
        else:
            qs = qs.filter(
                Q(title__icontains=q)
                | Q(movie_code__icontains=q)
                | Q(description__icontains=q)
                | Q(genres__name__icontains=q)
                | Q(language__name__icontains=q)
            ).distinct()

        qs = qs.order_by("-views_count", "-published_at")
        total_count = qs.count()
        total_pages = max(1, math.ceil(total_count / page_size))
        safe_page = max(1, min(page, total_pages))
        offset = (safe_page - 1) * page_size
        return list(qs[offset : offset + page_size]), safe_page, total_pages, total_count

    @staticmethod
    @sync_to_async
    def get_movie_detail(movie_id: int, user_telegram_id: int | None = None):
        from movies.models import Favorite, Movie

        movie = (
            Movie.objects.select_related("language", "source_channel")
            .prefetch_related("genres")
            .filter(id=movie_id, is_available=True, is_archived=False)
            .first()
        )
        if not movie:
            return None, False

        is_fav = False
        if user_telegram_id is not None:
            is_fav = Favorite.objects.filter(user__telegram_id=user_telegram_id, movie=movie).exists()
        return movie, is_fav

    @staticmethod
    @sync_to_async
    def toggle_favorite(movie_id: int, user_telegram_id: int) -> bool:
        from movies.models import Favorite, Movie
        from users.models import User

        user = User.objects.get(telegram_id=user_telegram_id)
        movie = Movie.objects.get(id=movie_id)
        existing = Favorite.objects.filter(user=user, movie=movie).first()
        if existing:
            existing.delete()
            return False
        Favorite.objects.create(user=user, movie=movie)
        return True

    @staticmethod
    @sync_to_async
    def record_watch(movie_id: int, user_telegram_id: int):
        from movies.models import Movie, MovieView
        from users.models import User

        with transaction.atomic():
            movie = Movie.objects.select_for_update().filter(id=movie_id, is_available=True).first()
            if not movie:
                return None
            user = User.objects.filter(telegram_id=user_telegram_id).first()
            if user:
                MovieView.objects.create(user=user, movie=movie)
            Movie.objects.filter(id=movie.id).update(views_count=F("views_count") + 1)
            movie.refresh_from_db()
            return movie

    @staticmethod
    @sync_to_async
    def list_genres():
        from movies.models import Genre

        return list(Genre.objects.filter(movies__is_available=True, movies__is_archived=False).distinct().order_by("name"))

    @staticmethod
    @sync_to_async
    def list_languages():
        from movies.models import Language

        return list(Language.objects.filter(movies__is_available=True, movies__is_archived=False).distinct().order_by("name"))
