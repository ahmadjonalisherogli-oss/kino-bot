# Telegram Movie Streaming Platform (O‘zbekcha Kino Bot)

Production-ready **Aiogram 3.x + Django 5 + DRF + PostgreSQL + Redis + Celery + Docker** movie streaming platform with **automatic Telegram channel-to-bot synchronization**.

---

## 1. Architecture & Automatic Sync Workflow

```
[Admin publishes video/album in Telegram Channel]
                     │
                     ▼ (channel_post / edited_channel_post)
        [Aiogram 3.x Bot Sync Handler]
          ├─ AuthorizedChannelFilter (verifies TelegramChannel table)
          ├─ Media Group Debouncer (merges poster photo + video + caption)
          ├─ extract_video_payload() -> video OR video document file_id & file_unique_id
          └─ parse_movie_caption() -> Title, Year, Genres, Language, Rating, Code, Description
                     │
                     ▼ (transaction.atomic + select_for_update)
          [PostgreSQL Database]
          ├─ Duplicate prevention: (channel_id, message_id) & file_unique_id
          ├─ Creates/updates Movie, Genre, Language, ChannelPost, SyncLog
          └─ Immediately searchable & streamable in Bot via stored telegram_file_id
```

### Handling Deleted Channel Posts (Telegram Bot API Limitation)
The Telegram Bot API **does not dispatch** `deleted_channel_post` events to bots over webhooks or `getUpdates`. To handle deletions reliably:
1. Configure a private verification log channel in `.env` (`VERIFICATION_CHAT_ID=-100...`) where the bot is admin.
2. Celery Beat runs `channels.tasks.verify_channel_posts_availability` every 30 minutes, probing active `ChannelPost` records with `copy_message` + immediate `delete_message`.
3. If Telegram returns `Bad Request: message to copy not found`, the `ChannelPost` is marked `is_deleted=True`, the `Movie` is marked `is_available=False`, and `SyncLog` records `MARKED_UNAVAILABLE`.

---

## 2. Telegram Bot & Channel Setup

### Step 1: Create Bot Token via `@BotFather`
1. Open `@BotFather` in Telegram and run `/newbot`.
2. Copy the bot token into `.env` as `BOT_TOKEN=...` and set `BOT_USERNAME=...`.

### Step 2: Connect Movie Channel & Make Bot Administrator
1. Create or open your Telegram movie channel (public or private).
2. Go to **Channel Settings → Administrators → Add Administrator**.
3. Search for your bot by username and grant permissions:
   - **Post Messages** (required for channel access/verification)
   - **Edit Messages**
   - **Delete Messages** (optional, needed only on `VERIFICATION_CHAT_ID`)
4. Obtain your channel numeric ID (e.g. `-1001234567890`) by forwarding a channel message to `@userinfobot` or `@RawDataBot`.
5. Register the channel in **Django Admin → Channels → Telegram Channels** (`is_active=True`, `sync_enabled=True`).

### Step 3: Recommended Caption Format in Channel
```text
🎬 Movie: Interstellar
📅 Year: 2014
🎭 Genre: Sci-Fi, Drama
🌍 Language: Uzbek
⭐ Rating: 8.7
⏱ Duration: 2h 49m
🆔 Code: KINO-1042
📝 Description: Kosmik sayohat haqidagi ilmiy-fantastik drama.
```
*Missing fields are left blank (`None`)—never fabricated—and flagged with `needs_metadata_review=True` for editing in Django Admin.*

---

## 3. Running with Docker Compose

```bash
cp .env.example .env
# Edit .env with your real BOT_TOKEN, DJANGO_SECRET_KEY, and POSTGRES_PASSWORD
docker compose up -d --build
docker compose exec backend python backend/manage.py createsuperuser
```

Services started:
- `postgres` (PostgreSQL 16 + `pg_trgm`)
- `redis` (Redis 7 AOF for FSM, rate limiting, subscription cache, Celery broker)
- `backend` (Django 5 + Gunicorn on internal port 8000)
- `bot` (Aiogram 3.x async worker)
- `celery_worker` & `celery_beat`
- `nginx` (Reverse proxy on port 80/443)

---

## 4. Complete Ubuntu 24.04 VPS Bare-Metal Deployment Guide

### A. System Packages, PostgreSQL & Redis
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3.12 python3.12-venv python3-dev build-essential libpq-dev \
    postgresql postgresql-contrib redis-server nginx certbot python3-certbot-nginx git

sudo -u postgres psql <<'SQL'
CREATE DATABASE telegram_cinema;
CREATE USER cinema_user WITH PASSWORD 'STRONG_POSTGRES_PASSWORD';
ALTER ROLE cinema_user SET client_encoding TO 'utf8';
ALTER ROLE cinema_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE cinema_user SET timezone TO 'Asia/Tashkent';
GRANT ALL PRIVILEGES ON DATABASE telegram_cinema TO cinema_user;
\c telegram_cinema
CREATE EXTENSION IF NOT EXISTS pg_trgm;
SQL

sudo systemctl enable --now postgresql redis-server
```

### B. Application Setup & Migrations
```bash
sudo mkdir -p /opt/telegram_movie_platform && sudo chown $USER:$USER /opt/telegram_movie_platform
cd /opt/telegram_movie_platform
python3.12 -m venv venv
source venv/bin/activate
pip install --upgrade pip && pip install -r requirements.txt

cp .env.example .env
# Configure DATABASE_URL=postgresql://cinema_user:STRONG_POSTGRES_PASSWORD@127.0.0.1:5432/telegram_cinema
# Configure REDIS_URL=redis://127.0.0.1:6379/0

PYTHONPATH=/opt/telegram_movie_platform:/opt/telegram_movie_platform/backend \
  python backend/manage.py migrate
PYTHONPATH=/opt/telegram_movie_platform:/opt/telegram_movie_platform/backend \
  python backend/manage.py collectstatic --noinput
PYTHONPATH=/opt/telegram_movie_platform:/opt/telegram_movie_platform/backend \
  python backend/manage.py createsuperuser
```

### C. Systemd Services

**`/etc/systemd/system/cinema-backend.service`**
```ini
[Unit]
Description=Telegram Cinema Django Gunicorn Backend
After=network.target postgresql.service redis-server.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/telegram_movie_platform/backend
EnvironmentFile=/opt/telegram_movie_platform/.env
Environment="PYTHONPATH=/opt/telegram_movie_platform:/opt/telegram_movie_platform/backend"
ExecStart=/opt/telegram_movie_platform/venv/bin/gunicorn config.wsgi:application \
  --bind 127.0.0.1:8000 --workers 4 --timeout 60
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**`/etc/systemd/system/cinema-bot.service`**
```ini
[Unit]
Description=Telegram Cinema Aiogram 3 Bot
After=network.target postgresql.service redis-server.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/telegram_movie_platform
EnvironmentFile=/opt/telegram_movie_platform/.env
Environment="PYTHONPATH=/opt/telegram_movie_platform:/opt/telegram_movie_platform/backend"
ExecStart=/opt/telegram_movie_platform/venv/bin/python -m bot.main
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**`/etc/systemd/system/cinema-celery.service`**
```ini
[Unit]
Description=Telegram Cinema Celery Worker & Beat
After=network.target redis-server.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/telegram_movie_platform/backend
EnvironmentFile=/opt/telegram_movie_platform/.env
Environment="PYTHONPATH=/opt/telegram_movie_platform:/opt/telegram_movie_platform/backend"
ExecStart=/opt/telegram_movie_platform/venv/bin/celery -A config worker -B --loglevel=info --concurrency=4
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable all services:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now cinema-backend cinema-bot cinema-celery
```

### D. Nginx & SSL (Let's Encrypt)
```nginx
server {
    listen 80;
    server_name cinema.example.com;

    location /static/ {
        alias /opt/telegram_movie_platform/backend/staticfiles/;
    }
    location /media/ {
        alias /opt/telegram_movie_platform/backend/media/;
    }
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/cinema /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d cinema.example.com
```

### E. Logging & Automated Daily PostgreSQL Backups
- View logs: `journalctl -u cinema-bot -u cinema-backend -f`
- Daily backup cron (`crontab -e`):
```cron
0 3 * * * pg_dump -U cinema_user -Fc telegram_cinema > /var/backups/cinema_$(date +\%F).dump && find /var/backups -name "cinema_*.dump" -mtime +14 -delete
```

---

## 5. Running Tests
```bash
pytest -v
```
