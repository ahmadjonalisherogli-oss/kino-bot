"""Initial migration for channels app."""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ("movies", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="TelegramChannel",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("channel_id", models.BigIntegerField(db_index=True, unique=True)),
                ("title", models.CharField(max_length=255)),
                ("username", models.CharField(blank=True, max_length=150, null=True)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("sync_enabled", models.BooleanField(db_index=True, default=True)),
                ("auto_publish", models.BooleanField(default=True)),
                ("last_synced_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="SubscriptionChannel",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("channel_id", models.BigIntegerField(db_index=True, unique=True)),
                ("title", models.CharField(max_length=255)),
                ("username", models.CharField(blank=True, max_length=150, null=True)),
                ("invite_link", models.URLField(max_length=500)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("order_priority", models.PositiveIntegerField(default=1)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["order_priority", "id"]},
        ),
        migrations.CreateModel(
            name="ChannelPost",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("message_id", models.BigIntegerField(db_index=True)),
                ("media_group_id", models.CharField(blank=True, db_index=True, max_length=128, null=True)),
                ("file_id", models.CharField(blank=True, max_length=255, null=True)),
                ("file_unique_id", models.CharField(blank=True, db_index=True, max_length=128, null=True)),
                ("raw_caption", models.TextField(blank=True, null=True)),
                ("status", models.CharField(choices=[("synced", "Sinxronlangan"), ("updated", "Yangilangan"), ("duplicate", "Dublikat"), ("unavailable", "O‘chirilgan / Mavjud emas"), ("ignored", "E’tiborsiz qoldirilgan"), ("failed", "Xatolik")], db_index=True, default="synced", max_length=24)),
                ("is_deleted", models.BooleanField(db_index=True, default=False)),
                ("synced_at", models.DateTimeField(auto_now_add=True)),
                ("edited_at", models.DateTimeField(blank=True, null=True)),
                ("last_verified_at", models.DateTimeField(blank=True, null=True)),
                ("channel", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="posts", to="channels.telegramchannel")),
                ("movie", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="channel_posts", to="movies.movie")),
            ],
            options={"ordering": ["-synced_at"]},
        ),
        migrations.CreateModel(
            name="SyncLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("telegram_channel_id", models.BigIntegerField(blank=True, db_index=True, null=True)),
                ("message_id", models.BigIntegerField(blank=True, null=True)),
                ("event_type", models.CharField(choices=[("created", "Yangi kino qo‘shildi"), ("updated", "Post tahrirlandi"), ("duplicate_skipped", "Dublikat o‘tkazib yuborildi"), ("media_group_merged", "Albom (Media Group) birlashtirildi"), ("marked_unavailable", "Mavjud emas deb belgilandi"), ("unauthorized_channel", "Ruxsatsiz kanal rad etildi"), ("error", "Sinxronizatsiya xatosi")], db_index=True, max_length=32)),
                ("details", models.TextField(blank=True)),
                ("success", models.BooleanField(db_index=True, default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("channel", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sync_logs", to="channels.telegramchannel")),
                ("movie", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sync_logs", to="movies.movie")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddConstraint(
            model_name="channelpost",
            constraint=models.UniqueConstraint(fields=("channel", "message_id"), name="uq_channel_post_channel_message"),
        ),
        migrations.AddIndex(
            model_name="channelpost",
            index=models.Index(fields=["channel", "status"], name="idx_channelpost_status"),
        ),
        migrations.AddIndex(
            model_name="channelpost",
            index=models.Index(fields=["file_unique_id"], name="idx_channelpost_fileuniq"),
        ),
        migrations.AddIndex(
            model_name="synclog",
            index=models.Index(fields=["event_type", "-created_at"], name="idx_synclog_event_date"),
        ),
    ]
