"""Analytics snapshot model for fast historical dashboard queries."""
from django.db import models


class DailyAnalyticsSnapshot(models.Model):
    date = models.DateField(unique=True, db_index=True)
    total_movies = models.PositiveIntegerField(default=0)
    total_users = models.PositiveIntegerField(default=0)
    daily_active_users = models.PositiveIntegerField(default=0)
    total_views = models.PositiveBigIntegerField(default=0)
    views_today = models.PositiveIntegerField(default=0)
    synced_posts_today = models.PositiveIntegerField(default=0)
    computed_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self) -> str:
        return f"Metrics {self.date}: {self.daily_active_users} DAU, {self.views_today} views"
