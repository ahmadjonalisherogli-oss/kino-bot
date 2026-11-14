"""Add source_channel foreign key and catalog constraints to Movie."""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("movies", "0001_initial"),
        ("channels", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="movie",
            name="source_channel",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="movies", to="channels.telegramchannel"),
        ),
        migrations.AddConstraint(
            model_name="movie",
            constraint=models.UniqueConstraint(
                condition=models.Q(("channel_message_id__isnull", False), ("source_channel__isnull", False)),
                fields=("source_channel", "channel_message_id"),
                name="uq_movie_source_channel_message",
            ),
        ),
        migrations.AddIndex(
            model_name="movie",
            index=models.Index(fields=["is_available", "is_archived", "-published_at"], name="idx_movie_catalog_new"),
        ),
        migrations.AddIndex(
            model_name="movie",
            index=models.Index(fields=["is_available", "is_archived", "-views_count"], name="idx_movie_catalog_popular"),
        ),
        migrations.AddIndex(
            model_name="movie",
            index=models.Index(fields=["is_available", "is_archived", "is_trending"], name="idx_movie_trending"),
        ),
    ]
