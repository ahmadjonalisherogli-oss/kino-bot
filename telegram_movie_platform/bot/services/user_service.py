"""User registration and personal statistics service."""
from asgiref.sync import sync_to_async
from django.utils import timezone


class UserService:
    @staticmethod
    @sync_to_async
    def upsert_user(
        telegram_id: int,
        username: str | None = None,
        first_name: str | None = None,
        last_name: str | None = None,
        language_code: str = "uz",
    ):
        from users.models import User

        user, created = User.objects.get_or_create(
            telegram_id=telegram_id,
            defaults={
                "username": username,
                "first_name": first_name,
                "last_name": last_name,
                "language_code": language_code,
            },
        )
        if not created:
            changed = []
            if user.username != username:
                user.username = username
                changed.append("username")
            if user.first_name != first_name:
                user.first_name = first_name
                changed.append("first_name")
            if user.last_name != last_name:
                user.last_name = last_name
                changed.append("last_name")
            if user.is_bot_banned:
                user.is_bot_banned = False
                changed.append("is_bot_banned")
            user.last_active_at = timezone.now()
            changed.append("last_active_at")
            user.save(update_fields=changed)
        return user

    @staticmethod
    @sync_to_async
    def get_user_stats(telegram_id: int) -> dict:
        from movies.models import Favorite, Movie, MovieView
        from users.models import User

        user = User.objects.filter(telegram_id=telegram_id).first()
        if not user:
            return {"views_count": 0, "favorites_count": 0, "catalog_total": 0, "joined_at": None}

        return {
            "views_count": MovieView.objects.filter(user=user).count(),
            "favorites_count": Favorite.objects.filter(user=user).count(),
            "catalog_total": Movie.objects.filter(is_available=True, is_archived=False).count(),
            "joined_at": user.joined_at,
        }
