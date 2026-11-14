"""Pytest fixtures configuring Django ORM against an isolated SQLite test database."""
import os
import sys
from pathlib import Path
import pytest

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
for p in (str(ROOT_DIR), str(BACKEND_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ.pop("DATABASE_URL", None)


def pytest_configure():
    import django
    from django.conf import settings

    settings.DATABASES["default"] = {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
    django.setup()
    from django.core.management import call_command

    call_command("migrate", verbosity=0)


@pytest.fixture(autouse=True)
def _clean_db(db):
    yield
