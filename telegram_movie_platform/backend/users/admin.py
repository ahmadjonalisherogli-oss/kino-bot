"""Django Admin for Users, Bot Admins, and Announcements."""
from django.contrib import admin
from channels.tasks import send_broadcast_announcement
from .models import Admin, BroadcastAnnouncement, User


@admin.register(User)
class BotUserAdmin(admin.ModelAdmin):
    list_display = ("telegram_id", "username", "full_name", "is_blocked", "is_bot_banned", "last_active_at", "joined_at")
    list_filter = ("is_blocked", "is_bot_banned", "joined_at")
    search_fields = ("telegram_id", "username", "first_name", "last_name")
    readonly_fields = ("joined_at", "last_active_at")


@admin.register(Admin)
class BotAdminAdmin(admin.ModelAdmin):
    list_display = ("telegram_id", "full_name", "username", "role", "can_manage_channels", "can_broadcast", "is_active")
    list_filter = ("role", "is_active", "can_manage_channels", "can_broadcast")
    search_fields = ("telegram_id", "username", "full_name")


@admin.register(BroadcastAnnouncement)
class BroadcastAnnouncementAdmin(admin.ModelAdmin):
    list_display = ("title", "status", "sent_count", "failed_count", "created_at", "completed_at")
    list_filter = ("status", "created_at")
    actions = ("dispatch_announcement",)

    @admin.action(description="Tanlangan xabarnomani barcha foydalanuvchilarga yuborish")
    def dispatch_announcement(self, request, queryset):
        count = 0
        for announcement in queryset.filter(status=BroadcastAnnouncement.Status.DRAFT):
            announcement.status = BroadcastAnnouncement.Status.QUEUED
            announcement.save(update_fields=["status"])
            send_broadcast_announcement.delay(announcement.id)
            count += 1
        self.message_user(request, f"{count} ta xabarnoma Celery navbatiga qo‘shildi.")
