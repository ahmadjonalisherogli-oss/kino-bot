"""Models for connected Telegram channels, channel posts, mandatory subscriptions, and sync logs."""
from django.db import models


class TelegramChannel(models.Model):
    channel_id = models.BigIntegerField(
        unique=True,
        db_index=True,
        help_text="Telegram numeric channel ID (e.g. -1001234567890).",
    )
    title = models.CharField(max_length=255)
    username = models.CharField(max_length=150, blank=True, null=True)
    is_active = models.BooleanField(default=True, db_index=True)
    sync_enabled = models.BooleanField(default=True, db_index=True)
    auto_publish = models.BooleanField(
        default=True,
        help_text="Automatically make synchronized movies visible in the bot catalog.",
    )
    last_synced_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        handle = f"@{self.username}" if self.username else str(self.channel_id)
        return f"{self.title} ({handle})"


class ChannelPost(models.Model):
    class PostStatus(models.TextChoices):
        SYNCED = "synced", "Sinxronlangan"
        UPDATED = "updated", "Yangilangan"
        DUPLICATE = "duplicate", "Dublikat"
        UNAVAILABLE = "unavailable", "O‘chirilgan / Mavjud emas"
        IGNORED = "ignored", "E’tiborsiz qoldirilgan"
        FAILED = "failed", "Xatolik"

    channel = models.ForeignKey(TelegramChannel, on_delete=models.CASCADE, related_name="posts")
    message_id = models.BigIntegerField(db_index=True)
    media_group_id = models.CharField(max_length=128, blank=True, null=True, db_index=True)
    file_id = models.CharField(max_length=255, blank=True, null=True)
    file_unique_id = models.CharField(max_length=128, blank=True, null=True, db_index=True)
    raw_caption = models.TextField(blank=True, null=True)
    movie = models.ForeignKey(
        "movies.Movie",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="channel_posts",
    )
    status = models.CharField(max_length=24, choices=PostStatus.choices, default=PostStatus.SYNCED, db_index=True)
    is_deleted = models.BooleanField(default=False, db_index=True)
    synced_at = models.DateTimeField(auto_now_add=True)
    edited_at = models.DateTimeField(blank=True, null=True)
    last_verified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["-synced_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["channel", "message_id"],
                name="uq_channel_post_channel_message",
            ),
        ]
        indexes = [
            models.Index(fields=["channel", "status"], name="idx_channelpost_status"),
            models.Index(fields=["file_unique_id"], name="idx_channelpost_fileuniq"),
        ]

    def __str__(self) -> str:
        return f"ChannelPost({self.channel_id}:{self.message_id}) [{self.status}]"


class SubscriptionChannel(models.Model):
    channel_id = models.BigIntegerField(unique=True, db_index=True)
    title = models.CharField(max_length=255)
    username = models.CharField(max_length=150, blank=True, null=True)
    invite_link = models.URLField(max_length=500, help_text="Public t.me/username or private invite link.")
    is_active = models.BooleanField(default=True, db_index=True)
    order_priority = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order_priority", "id"]

    def __str__(self) -> str:
        return f"{self.title} ({self.channel_id})"


class SyncLog(models.Model):
    class EventType(models.TextChoices):
        CREATED = "created", "Yangi kino qo‘shildi"
        UPDATED = "updated", "Post tahrirlandi"
        DUPLICATE_SKIPPED = "duplicate_skipped", "Dublikat o‘tkazib yuborildi"
        MEDIA_GROUP_MERGED = "media_group_merged", "Albom (Media Group) birlashtirildi"
        MARKED_UNAVAILABLE = "marked_unavailable", "Mavjud emas deb belgilandi"
        UNAUTHORIZED_CHANNEL = "unauthorized_channel", "Ruxsatsiz kanal rad etildi"
        ERROR = "error", "Sinxronizatsiya xatosi"

    channel = models.ForeignKey(
        TelegramChannel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sync_logs",
    )
    telegram_channel_id = models.BigIntegerField(blank=True, null=True, db_index=True)
    message_id = models.BigIntegerField(blank=True, null=True)
    movie = models.ForeignKey(
        "movies.Movie",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sync_logs",
    )
    event_type = models.CharField(max_length=32, choices=EventType.choices, db_index=True)
    details = models.TextField(blank=True)
    success = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["event_type", "-created_at"], name="idx_synclog_event_date"),
        ]

    def __str__(self) -> str:
        return f"[{self.event_type}] ch={self.telegram_channel_id} msg={self.message_id}"
