"""
Automatic Telegram Channel Synchronization Handlers (channel_post & edited_channel_post).

Supports:
- Single video posts
- Video document attachments (.mp4, .mkv, .webm, .mov, .avi)
- Media groups (albums) debounced in memory/async task to merge poster + video + caption
- Edited channel posts updating metadata and file_id atomically
"""
import asyncio
import logging
from collections import defaultdict
from aiogram import Router
from aiogram.types import Message
from bot.filters.channel_admin import AuthorizedChannelFilter
from bot.services.sync_service import (
    ChannelSyncService,
    extract_poster_photo_file_id,
    extract_video_payload,
)
from shared.constants import MEDIA_GROUP_DEBOUNCE_SECONDS

logger = logging.getLogger(__name__)
router = Router(name="channel_sync")

_media_group_buffer: dict[str, list[Message]] = defaultdict(list)
_media_group_tasks: dict[str, asyncio.Task] = {}


async def _flush_media_group(media_group_id: str) -> None:
    try:
        await asyncio.sleep(MEDIA_GROUP_DEBOUNCE_SECONDS)
        messages = _media_group_buffer.pop(media_group_id, [])
        if messages:
            results = await ChannelSyncService.sync_media_group(messages)
            logger.info("Synchronized media_group=%s results=%s", media_group_id, results)
    except Exception:
        logger.exception("Failed flushing media_group=%s", media_group_id)
    finally:
        _media_group_tasks.pop(media_group_id, None)


@router.channel_post(AuthorizedChannelFilter())
async def handle_new_channel_post(message: Message) -> None:
    if message.media_group_id:
        mg_id = message.media_group_id
        _media_group_buffer[mg_id].append(message)
        if mg_id not in _media_group_tasks:
            _media_group_tasks[mg_id] = asyncio.create_task(_flush_media_group(mg_id))
        return

    media = extract_video_payload(message)
    poster_id = extract_poster_photo_file_id(message)
    result = await ChannelSyncService.sync_single_post(
        channel_id=message.chat.id,
        message_id=message.message_id,
        caption=message.caption or message.text,
        media=media,
        poster_file_id=poster_id,
        published_dt=message.date,
    )
    logger.info(
        "channel_post processed channel=%s msg=%s result=%s",
        message.chat.id,
        message.message_id,
        result,
    )


@router.edited_channel_post(AuthorizedChannelFilter())
async def handle_edited_channel_post(message: Message) -> None:
    media = extract_video_payload(message)
    result = await ChannelSyncService.sync_edited_post(
        channel_id=message.chat.id,
        message_id=message.message_id,
        caption=message.caption or message.text,
        media=media,
    )
    logger.info(
        "edited_channel_post processed channel=%s msg=%s result=%s",
        message.chat.id,
        message.message_id,
        result,
    )
