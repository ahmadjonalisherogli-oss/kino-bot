"""Celery application configuration."""
import os
import sys
from pathlib import Path
from celery import Celery

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("telegram_cinema")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
