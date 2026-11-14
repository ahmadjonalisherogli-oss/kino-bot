"""Django Admin configuration for Movies domain."""
from django.contrib import admin
from .models import Favorite, Genre, Language, Movie, MovieView


@admin.register(Genre)
class GenreAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "created_at")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Language)
class LanguageAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "created_at")
    search_fields = ("name", "code")


@admin.register(Movie)
class MovieAdmin(admin.ModelAdmin):
    list_display = (
        "movie_code",
        "title",
        "release_year",
        "language",
        "rating",
        "views_count",
        "is_trending",
        "is_available",
        "is_archived",
        "needs_metadata_review",
        "published_at",
    )
    list_filter = (
        "is_available",
        "is_archived",
        "is_trending",
        "needs_metadata_review",
        "language",
        "genres",
        "release_year",
        "origin",
    )
    search_fields = (
        "movie_code",
        "title",
        "description",
        "telegram_file_id",
        "telegram_file_unique_id",
        "channel_message_id",
    )
    filter_horizontal = ("genres",)
    readonly_fields = ("views_count", "created_at", "updated_at")
    actions = ("archive_movies", "restore_movies", "mark_trending", "unmark_trending")

    @admin.action(description="Tanlangan kinolarni arxivlash")
    def archive_movies(self, request, queryset):
        updated = queryset.update(is_archived=True, is_available=False)
        self.message_user(request, f"{updated} ta kino arxivlandi.")

    @admin.action(description="Tanlangan kinolarni tiklash (faollashtirish)")
    def restore_movies(self, request, queryset):
        updated = queryset.update(is_archived=False, is_available=True)
        self.message_user(request, f"{updated} ta kino faollashtirildi.")

    @admin.action(description="Trenddagi kinolar ro‘yxatiga qo‘shish")
    def mark_trending(self, request, queryset):
        updated = queryset.update(is_trending=True)
        self.message_user(request, f"{updated} ta kino trendga qo‘shildi.")

    @admin.action(description="Trenddan olib tashlash")
    def unmark_trending(self, request, queryset):
        updated = queryset.update(is_trending=False)
        self.message_user(request, f"{updated} ta kino trenddan olindi.")


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ("user", "movie", "created_at")
    search_fields = ("user__telegram_id", "user__username", "movie__title", "movie__movie_code")


@admin.register(MovieView)
class MovieViewAdmin(admin.ModelAdmin):
    list_display = ("movie", "user", "viewed_at")
    list_filter = ("viewed_at",)
    search_fields = ("movie__title", "movie__movie_code", "user__telegram_id")
