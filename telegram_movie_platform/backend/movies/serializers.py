"""DRF serializers for Movies API."""
from rest_framework import serializers
from .models import Genre, Language, Movie


class GenreSerializer(serializers.ModelSerializer):
    class Meta:
        model = Genre
        fields = ("id", "name", "slug", "description")


class LanguageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Language
        fields = ("id", "name", "code")


class MovieSerializer(serializers.ModelSerializer):
    genres = GenreSerializer(many=True, read_only=True)
    genre_ids = serializers.PrimaryKeyRelatedField(
        queryset=Genre.objects.all(), source="genres", many=True, write_only=True, required=False
    )
    language = LanguageSerializer(read_only=True)
    language_id = serializers.PrimaryKeyRelatedField(
        queryset=Language.objects.all(), source="language", write_only=True, required=False, allow_null=True
    )

    class Meta:
        model = Movie
        fields = (
            "id",
            "movie_code",
            "title",
            "description",
            "release_year",
            "genres",
            "genre_ids",
            "language",
            "language_id",
            "duration_seconds",
            "duration_display",
            "rating",
            "poster_file_id",
            "telegram_file_id",
            "telegram_file_unique_id",
            "is_document_video",
            "source_channel",
            "channel_message_id",
            "views_count",
            "is_trending",
            "is_available",
            "is_archived",
            "needs_metadata_review",
            "published_at",
            "created_at",
            "updated_at",
        )
