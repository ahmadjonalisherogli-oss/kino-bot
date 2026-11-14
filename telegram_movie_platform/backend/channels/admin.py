"""Django Admin for Channels, Mandatory Subscriptions, and Sync Logs."""
from django.contrib import admin
from .models import ChannelPost, SubscriptionChannel, SyncLog, TelegramChannel


@admin.register(TelegramChannel)
class TelegramChannelAdmin(admin.ModelAdmin):
    list_display = ("title", "channel_id", "username", "is_active", "sync_enabled", "auto_publish", "last_synced_at")
    list_filter = ("is_active", "sync_enabled", "auto_publish")
    search_fields = ("title", "username", "channel_id")


@admin.register(ChannelPost)
class ChannelPostAdmin(admin.ModelAdmin):
    list_display = ("channel", "message_id", "movie", "status", "is_deleted", "synced_at", "edited_at")
    list_filter = ("status", "is_deleted", "channel")
    search_fields = ("message_id", "file_id", "file_unique_id", "movie__title", "movie__movie_code")
    readonly_fields = ("synced_at", "edited_at", "last_verified_at")


@admin.register(SubscriptionChannel)
class SubscriptionChannelAdmin(admin.ModelAdmin):
    list_display = ("title", "channel_id", "username", "is_active", "order_priority")
    list_filter = ("is_active",)
    search_fields = ("title", "username", "channel_id")


@admin.register(SyncLog)
class SyncLogAdmin(admin.ModelAdmin):
    list_display = ("event_type", "telegram_channel_id", "message_id", "movie", "success", "created_at")
    list_filter = ("event_type", "success", "created_at")
    search_fields = ("telegram_channel_id", "message_id", "details", "movie__title")
    readonly_fields = ("created_at",)
