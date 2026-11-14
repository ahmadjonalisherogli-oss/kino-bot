"""Initial migration for analytics app."""
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = []

    operations = [
        migrations.CreateModel(
            name="DailyAnalyticsSnapshot",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("date", models.DateField(db_index=True, unique=True)),
                ("total_movies", models.PositiveIntegerField(default=0)),
                ("total_users", models.PositiveIntegerField(default=0)),
                ("daily_active_users", models.PositiveIntegerField(default=0)),
                ("total_views", models.PositiveBigIntegerField(default=0)),
                ("views_today", models.PositiveIntegerField(default=0)),
                ("synced_posts_today", models.PositiveIntegerField(default=0)),
                ("computed_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["-date"]},
        ),
    ]
