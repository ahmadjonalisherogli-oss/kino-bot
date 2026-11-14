"""Analytics REST API and Admin Dashboard views."""
from datetime import timedelta
from django.contrib.admin.views.decorators import staff_member_required
from django.db.models import Sum
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.generic import TemplateView
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from channels.models import SyncLog, TelegramChannel
from movies.models import Movie, MovieView
from users.models import User


class PlatformStatsAPIView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        now = timezone.now()
        return Response({
            "total_movies": Movie.objects.filter(is_archived=False).count(),
            "available_movies": Movie.objects.filter(is_available=True, is_archived=False).count(),
            "total_users": User.objects.count(),
            "daily_active_users": User.objects.filter(last_active_at__gte=now - timedelta(hours=24)).count(),
            "total_views": Movie.objects.aggregate(total=Sum("views_count"))["total"] or 0,
            "views_last_24h": MovieView.objects.filter(viewed_at__gte=now - timedelta(hours=24)).count(),
            "connected_channels": TelegramChannel.objects.filter(is_active=True).count(),
            "recent_syncs": list(
                SyncLog.objects.values(
                    "id", "event_type", "telegram_channel_id", "message_id", "success", "details", "created_at"
                )[:15]
            ),
            "popular_movies": list(
                Movie.objects.filter(is_available=True, is_archived=False)
                .order_by("-views_count")
                .values("id", "movie_code", "title", "release_year", "views_count", "rating")[:10]
            ),
        })


@method_decorator(staff_member_required, name="dispatch")
class AdminAnalyticsDashboardView(TemplateView):
    template_name = "admin/analytics_dashboard.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        now = timezone.now()
        ctx.update({
            "total_movies": Movie.objects.filter(is_archived=False).count(),
            "total_users": User.objects.count(),
            "dau": User.objects.filter(last_active_at__gte=now - timedelta(hours=24)).count(),
            "total_views": Movie.objects.aggregate(total=Sum("views_count"))["total"] or 0,
            "popular_movies": Movie.objects.filter(is_available=True, is_archived=False).order_by("-views_count")[:8],
            "recent_movies": Movie.objects.filter(is_archived=False).order_by("-published_at")[:8],
            "recent_logs": SyncLog.objects.select_related("channel", "movie").order_by("-created_at")[:12],
        })
        return ctx
