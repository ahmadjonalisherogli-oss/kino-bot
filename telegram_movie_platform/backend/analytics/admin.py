"""Django Admin for DailyAnalyticsSnapshot."""
from django.contrib import admin
from .models import DailyAnalyticsSnapshot


@admin.register(DailyAnalyticsSnapshot)
class DailyAnalyticsSnapshotAdmin(admin.ModelAdmin):
    list_display = (
        "date",
        "total_movies",
        "total_users",
        "daily_active_users",
        "views_today",
        "total_views",
        "synced_posts_today",
    )
    readonly_fields = ("computed_at",)
