"""Bot configuration and Django ORM initialization for async Aiogram workers."""
import os
import sys
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


def bootstrap_django() -> None:
    """Initialize Django ORM cleanly inside the standalone Aiogram process."""
    root_dir = Path(__file__).resolve().parent.parent
    backend_dir = root_dir / "backend"
    for p in (str(root_dir), str(backend_dir)):
        if p not in sys.path:
            sys.path.insert(0, p)

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    import django

    django.setup()


class BotConfig(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    bot_token: str = ""
    bot_username: str = "cinema_bot"
    telegram_admin_ids: str = ""
    redis_url: str = "redis://localhost:6379/0"
    log_level: str = "INFO"
    json_logs: bool = False
    rate_limit_requests: int = 30
    rate_limit_window_seconds: int = 60

    @property
    def admin_id_set(self) -> set[int]:
        ids: set[int] = set()
        for raw in self.telegram_admin_ids.split(","):
            raw = raw.strip()
            if raw.isdigit() or (raw.startswith("-") and raw[1:].isdigit()):
                ids.add(int(raw))
        return ids


settings = BotConfig()
