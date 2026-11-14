"""URL routing for Analytics API."""
from django.urls import path
from .views import PlatformStatsAPIView

urlpatterns = [
    path("summary/", PlatformStatsAPIView.as_view(), name="analytics-summary"),
]
