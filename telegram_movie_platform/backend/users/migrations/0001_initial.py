"""Initial migration for users app."""
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Admin",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("telegram_id", models.BigIntegerField(db_index=True, unique=True)),
                ("username", models.CharField(blank=True, max_length=150, null=True)),
                ("full_name", models.CharField(max_length=200)),
                ("role", models.CharField(choices=[("superadmin", "Bosh Administrator"), ("moderator", "Kontent Moderator"), ("channel_manager", "Kanal Menejeri")], default="moderator", max_length=24)),
                ("can_manage_channels", models.BooleanField(default=True)),
                ("can_broadcast", models.BooleanField(default=False)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="BroadcastAnnouncement",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=200)),
                ("message_text", models.TextField()),
                ("status", models.CharField(choices=[("draft", "Qoralama"), ("queued", "Navbatda"), ("sending", "Yuborilmoqda"), ("completed", "Yakunlandi")], default="draft", max_length=20)),
                ("sent_count", models.PositiveIntegerField(default=0)),
                ("failed_count", models.PositiveIntegerField(default=0)),
                ("created_by", models.CharField(blank=True, max_length=150)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="User",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("telegram_id", models.BigIntegerField(db_index=True, unique=True)),
                ("username", models.CharField(blank=True, db_index=True, max_length=150, null=True)),
                ("first_name", models.CharField(blank=True, max_length=150, null=True)),
                ("last_name", models.CharField(blank=True, max_length=150, null=True)),
                ("language_code", models.CharField(default="uz", max_length=16)),
                ("is_blocked", models.BooleanField(db_index=True, default=False)),
                ("is_bot_banned", models.BooleanField(default=False)),
                ("last_active_at", models.DateTimeField(auto_now=True, db_index=True)),
                ("joined_at", models.DateTimeField(auto_now_add=True, db_index=True)),
            ],
            options={"ordering": ["-joined_at"]},
        ),
        migrations.AddIndex(
            model_name="user",
            index=models.Index(fields=["last_active_at"], name="idx_user_last_active"),
        ),
    ]
