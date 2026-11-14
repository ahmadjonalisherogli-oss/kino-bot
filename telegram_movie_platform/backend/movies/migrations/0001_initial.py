"""Initial migration for movies app."""
import django.core.validators
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Genre",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=80, unique=True)),
                ("slug", models.SlugField(blank=True, max_length=96, unique=True)),
                ("description", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="Language",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=80, unique=True)),
                ("code", models.CharField(max_length=16, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="Movie",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("movie_code", models.CharField(db_index=True, max_length=32, unique=True)),
                ("title", models.CharField(db_index=True, max_length=255)),
                ("description", models.TextField(blank=True, null=True)),
                ("release_year", models.PositiveIntegerField(blank=True, db_index=True, null=True, validators=[django.core.validators.MinValueValidator(1888), django.core.validators.MaxValueValidator(2100)])),
                ("duration_seconds", models.PositiveIntegerField(blank=True, null=True)),
                ("duration_display", models.CharField(blank=True, max_length=40, null=True)),
                ("rating", models.DecimalField(blank=True, db_index=True, decimal_places=1, max_digits=3, null=True, validators=[django.core.validators.MinValueValidator(0.0), django.core.validators.MaxValueValidator(10.0)])),
                ("poster_image", models.ImageField(blank=True, null=True, upload_to="posters/")),
                ("poster_file_id", models.CharField(blank=True, max_length=255, null=True)),
                ("telegram_file_id", models.CharField(blank=True, max_length=255, null=True)),
                ("telegram_file_unique_id", models.CharField(blank=True, max_length=128, null=True, unique=True)),
                ("is_document_video", models.BooleanField(default=False)),
                ("mime_type", models.CharField(blank=True, max_length=80, null=True)),
                ("file_size_bytes", models.BigIntegerField(blank=True, null=True)),
                ("channel_message_id", models.BigIntegerField(blank=True, db_index=True, null=True)),
                ("media_group_id", models.CharField(blank=True, db_index=True, max_length=128, null=True)),
                ("origin", models.CharField(choices=[("channel_sync", "Telegram Kanal Sinxronizatsiyasi"), ("manual_admin", "Admin Panel (Qo‘lda)")], default="channel_sync", max_length=20)),
                ("views_count", models.PositiveBigIntegerField(db_index=True, default=0)),
                ("is_trending", models.BooleanField(db_index=True, default=False)),
                ("is_available", models.BooleanField(db_index=True, default=True)),
                ("is_archived", models.BooleanField(db_index=True, default=False)),
                ("needs_metadata_review", models.BooleanField(db_index=True, default=False)),
                ("published_at", models.DateTimeField(db_index=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("genres", models.ManyToManyField(blank=True, related_name="movies", to="movies.genre")),
                ("language", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="movies", to="movies.language")),
            ],
            options={"ordering": ["-published_at", "-id"]},
        ),
        migrations.CreateModel(
            name="Favorite",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("movie", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="favorited_by", to="movies.movie")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="favorites", to="users.user")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="MovieView",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("viewed_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("movie", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="views", to="movies.movie")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="movie_views", to="users.user")),
            ],
            options={"ordering": ["-viewed_at"]},
        ),
        migrations.AddIndex(model_name="genre", index=models.Index(fields=["slug"], name="idx_genre_slug")),
        migrations.AddIndex(model_name="language", index=models.Index(fields=["code"], name="idx_language_code")),
        migrations.AddConstraint(
            model_name="favorite",
            constraint=models.UniqueConstraint(fields=("user", "movie"), name="uq_user_favorite_movie"),
        ),
        migrations.AddIndex(
            model_name="movieview",
            index=models.Index(fields=["movie", "viewed_at"], name="idx_movieview_movie_date"),
        ),
        migrations.AddIndex(
            model_name="movieview",
            index=models.Index(fields=["user", "viewed_at"], name="idx_movieview_user_date"),
        ),
    ]
