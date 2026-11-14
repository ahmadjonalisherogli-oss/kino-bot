"""Movies domain models: Genre, Language, Movie, Favorite, MovieView."""
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.text import slugify


class Genre(models.Model):
    name = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=96, unique=True, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["slug"], name="idx_genre_slug")]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name) or self.name.lower().replace(" ", "-")
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class Language(models.Model):
    name = models.CharField(max_length=80, unique=True)
    code = models.CharField(max_length=16, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["code"], name="idx_language_code")]

    def __str__(self) -> str:
        return f"{self.name} ({self.code})"


class Movie(models.Model):
    class SyncOrigin(models.TextChoices):
        CHANNEL_SYNC = "channel_sync", "Telegram Kanal Sinxronizatsiyasi"
        MANUAL_ADMIN = "manual_admin", "Admin Panel (Qo‘lda)"

    movie_code = models.CharField(max_length=32, unique=True, db_index=True)
    title = models.CharField(max_length=255, db_index=True)
    description = models.TextField(blank=True, null=True)
    release_year = models.PositiveIntegerField(
        blank=True,
        null=True,
        db_index=True,
        validators=[MinValueValidator(1888), MaxValueValidator(2100)],
    )
    genres = models.ManyToManyField(Genre, related_name="movies", blank=True)
    language = models.ForeignKey(
        Language,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="movies",
    )
    duration_seconds = models.PositiveIntegerField(blank=True, null=True)
    duration_display = models.CharField(max_length=40, blank=True, null=True)
    rating = models.DecimalField(
        max_digits=3,
        decimal_places=1,
        blank=True,
        null=True,
        db_index=True,
        validators=[MinValueValidator(0.0), MaxValueValidator(10.0)],
    )

    # Poster storage: supports both Telegram photo file_id and optional uploaded image
    poster_image = models.ImageField(upload_to="posters/", blank=True, null=True)
    poster_file_id = models.CharField(max_length=255, blank=True, null=True)

    # Telegram video payload extracted automatically during channel sync
    telegram_file_id = models.CharField(max_length=255, blank=True, null=True)
    telegram_file_unique_id = models.CharField(
        max_length=128,
        unique=True,
        blank=True,
        null=True,
        help_text="Global Telegram file_unique_id to prevent duplicate movie uploads.",
    )
    is_document_video = models.BooleanField(
        default=False,
        help_text="True when the source media was posted as a video document attachment.",
    )
    mime_type = models.CharField(max_length=80, blank=True, null=True)
    file_size_bytes = models.BigIntegerField(blank=True, null=True)

    # Source Telegram channel linkage
    source_channel = models.ForeignKey(
        "channels.TelegramChannel",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="movies",
    )
    channel_message_id = models.BigIntegerField(blank=True, null=True, db_index=True)
    media_group_id = models.CharField(max_length=128, blank=True, null=True, db_index=True)

    # State & counters
    origin = models.CharField(max_length=20, choices=SyncOrigin.choices, default=SyncOrigin.CHANNEL_SYNC)
    views_count = models.PositiveBigIntegerField(default=0, db_index=True)
    is_trending = models.BooleanField(default=False, db_index=True)
    is_available = models.BooleanField(default=True, db_index=True)
    is_archived = models.BooleanField(default=False, db_index=True)
    needs_metadata_review = models.BooleanField(default=False, db_index=True)

    published_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-published_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["source_channel", "channel_message_id"],
                condition=models.Q(source_channel__isnull=False, channel_message_id__isnull=False),
                name="uq_movie_source_channel_message",
            ),
        ]
        indexes = [
            models.Index(fields=["is_available", "is_archived", "-published_at"], name="idx_movie_catalog_new"),
            models.Index(fields=["is_available", "is_archived", "-views_count"], name="idx_movie_catalog_popular"),
            models.Index(fields=["is_available", "is_archived", "is_trending"], name="idx_movie_trending"),
        ]

    @property
    def formatted_duration(self) -> str:
        if self.duration_display:
            return self.duration_display
        if self.duration_seconds:
            hours, rem = divmod(self.duration_seconds, 3600)
            minutes = rem // 60
            return f"{hours} soat {minutes} daq" if hours else f"{minutes} daqiqa"
        return "Ko‘rsatilmagan"

    def __str__(self) -> str:
        year = f" ({self.release_year})" if self.release_year else ""
        return f"[{self.movie_code}] {self.title}{year}"


class Favorite(models.Model):
    user = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name="favorites")
    movie = models.ForeignKey(Movie, on_delete=models.CASCADE, related_name="favorited_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "movie"], name="uq_user_favorite_movie"),
        ]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.user_id} ❤️ {self.movie_id}"


class MovieView(models.Model):
    user = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name="movie_views")
    movie = models.ForeignKey(Movie, on_delete=models.CASCADE, related_name="views")
    viewed_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-viewed_at"]
        indexes = [
            models.Index(fields=["movie", "viewed_at"], name="idx_movieview_movie_date"),
            models.Index(fields=["user", "viewed_at"], name="idx_movieview_user_date"),
        ]

    def __str__(self) -> str:
        return f"View(user={self.user_id}, movie={self.movie_id})"
