"""Telegram Users, Admin permissions, and Broadcast Announcements."""
from django.db import models


class User(models.Model):
    telegram_id = models.BigIntegerField(unique=True, db_index=True)
    username = models.CharField(max_length=150, blank=True, null=True, db_index=True)
    first_name = models.CharField(max_length=150, blank=True, null=True)
    last_name = models.CharField(max_length=150, blank=True, null=True)
    language_code = models.CharField(max_length=16, default="uz")
    is_blocked = models.BooleanField(default=False, db_index=True)
    is_bot_banned = models.BooleanField(
        default=False,
        help_text="True if user blocked the Telegram bot during broadcast delivery.",
    )
    last_active_at = models.DateTimeField(auto_now=True, db_index=True)
    joined_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-joined_at"]
        indexes = [models.Index(fields=["last_active_at"], name="idx_user_last_active")]

    @property
    def full_name(self) -> str:
        parts = [p for p in (self.first_name, self.last_name) if p]
        return " ".join(parts) or (f"@{self.username}" if self.username else str(self.telegram_id))

    def __str__(self) -> str:
        return f"{self.full_name} ({self.telegram_id})"


class Admin(models.Model):
    class Role(models.TextChoices):
        SUPERADMIN = "superadmin", "Bosh Administrator"
        MODERATOR = "moderator", "Kontent Moderator"
        CHANNEL_MANAGER = "channel_manager", "Kanal Menejeri"

    telegram_id = models.BigIntegerField(unique=True, db_index=True)
    username = models.CharField(max_length=150, blank=True, null=True)
    full_name = models.CharField(max_length=200)
    role = models.CharField(max_length=24, choices=Role.choices, default=Role.MODERATOR)
    can_manage_channels = models.BooleanField(default=True)
    can_broadcast = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.full_name} [{self.get_role_display()}]"


class BroadcastAnnouncement(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Qoralama"
        QUEUED = "queued", "Navbatda"
        SENDING = "sending", "Yuborilmoqda"
        COMPLETED = "completed", "Yakunlandi"

    title = models.CharField(max_length=200)
    message_text = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    sent_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)
    created_by = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.title} ({self.status})"
