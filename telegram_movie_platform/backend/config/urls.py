"""Root URL configuration for Telegram Cinema Platform."""
from django.contrib import admin
from django.urls import include, path
from analytics.views import AdminAnalyticsDashboardView

admin.site.site_header = "Telegram Cinema Platform — Boshqaruv"
admin.site.site_title = "Kino Bot Admin"
admin.site.index_title = "Katalog va Sinxronizatsiya Boshqaruvi"

urlpatterns = [
    path("admin/analytics-dashboard/", AdminAnalyticsDashboardView.as_view(), name="admin-analytics-dashboard"),
    path("admin/", admin.site.urls),
    path("api/movies/", include("movies.urls")),
    path("api/analytics/", include("analytics.urls")),
]
