"""URL routing for Movies REST API."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import GenreViewSet, LanguageViewSet, MovieViewSet

router = DefaultRouter()
router.register("catalog", MovieViewSet, basename="movie")
router.register("genres", GenreViewSet, basename="genre")
router.register("languages", LanguageViewSet, basename="language")

urlpatterns = [
    path("", include(router.urls)),
]
