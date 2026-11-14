"""DRF ViewSets for Movies, Genres, and Languages."""
from django.db.models import Q
from rest_framework import viewsets
from .models import Genre, Language, Movie
from .serializers import GenreSerializer, LanguageSerializer, MovieSerializer


class GenreViewSet(viewsets.ModelViewSet):
    queryset = Genre.objects.all()
    serializer_class = GenreSerializer
    search_fields = ("name", "slug")


class LanguageViewSet(viewsets.ModelViewSet):
    queryset = Language.objects.all()
    serializer_class = LanguageSerializer
    search_fields = ("name", "code")


class MovieViewSet(viewsets.ModelViewSet):
    queryset = Movie.objects.select_related("language", "source_channel").prefetch_related("genres")
    serializer_class = MovieSerializer
    filterset_fields = ("release_year", "is_available", "is_archived", "is_trending", "language")
    search_fields = ("title", "movie_code", "description")
    ordering_fields = ("published_at", "views_count", "rating", "release_year")

    def get_queryset(self):
        qs = super().get_queryset()
        genre = self.request.query_params.get("genre")
        if genre:
            qs = qs.filter(Q(genres__slug__iexact=genre) | Q(genres__name__iexact=genre)).distinct()
        return qs
