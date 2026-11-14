"""Celery analytics aggregation task."""
from datetime import timedelta
from celery import shared_task
from django.db.models import Sum
from django.utils import timezone


@shared_task
def compute_daily_metrics() -> dict:
    from analytics.models import DailyAnalyticsSnapshot
    from channels.models import SyncLog
    from movies.models import Movie, MovieView
    from users.models import User

    today = timezone.localdate()
    start_of_day = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)

    total_movies = Movie.objects.filter(is_archived=False).count()
    total_users = User.objects.count()
    dau = User.objects.filter(last_active_at__gte=timezone.now() - timedelta(hours=24)).count()
    total_views = Movie.objects.aggregate(total=Sum("views_count"))["total"] or 0
    views_today = MovieView.objects.filter(viewed_at__gte=start_of_day).count()
    synced_today = SyncLog.objects.filter(
        created_at__gte=start_of_day,
        event_type=SyncLog.EventType.CREATED,
        success=True,
    ).count()

    snapshot, _ = DailyAnalyticsSnapshot.objects.update_or_create(
        date=today,
        defaults={
            "total_movies": total_movies,
            "total_users": total_users,
            "daily_active_users": dau,
            "total_views": total_views,
            "views_today": views_today,
            "synced_posts_today": synced_today,
        },
    )
    return {"date": str(snapshot.date), "dau": dau, "views_today": views_today}
