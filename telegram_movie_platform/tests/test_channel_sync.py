"""Tests for automatic channel synchronization, file_id extraction, media groups, and deduplication."""
from types import SimpleNamespace
import pytest
from bot.services.sync_service import (
    ChannelSyncService,
    ExtractedMedia,
    extract_video_payload,
)
from channels.models import ChannelPost, SyncLog, TelegramChannel
from movies.models import Movie


def test_extract_video_payload_from_video_message():
    msg = SimpleNamespace(
        video=SimpleNamespace(
            file_id="BAACAgIAAxkBAAI_video_1",
            file_unique_id="AgAD_uniq_1",
            mime_type="video/mp4",
            file_size=52428800,
            duration=7200,
            file_name="interstellar.mp4",
            thumbnail=SimpleNamespace(file_id="AAMC_thumb_1"),
        ),
        document=None,
    )
    extracted = extract_video_payload(msg)
    assert extracted is not None
    assert extracted.file_id == "BAACAgIAAxkBAAI_video_1"
    assert extracted.file_unique_id == "AgAD_uniq_1"
    assert extracted.is_document is False
    assert extracted.thumbnail_file_id == "AAMC_thumb_1"


def test_extract_video_payload_from_mkv_document():
    msg = SimpleNamespace(
        video=None,
        document=SimpleNamespace(
            file_id="BQACAgIAAxkBAAI_doc_2",
            file_unique_id="AgAD_uniq_doc_2",
            mime_type="video/x-matroska",
            file_size=104857600,
            file_name="movie_hd.mkv",
            thumbnail=None,
        ),
    )
    extracted = extract_video_payload(msg)
    assert extracted is not None
    assert extracted.is_document is True
    assert extracted.file_id == "BQACAgIAAxkBAAI_doc_2"


@pytest.mark.asyncio
async def test_automatic_channel_sync_and_duplicate_detection():
    channel = await TelegramChannel.objects.acreate(
        channel_id=-100999888777,
        title="Asosiy Kino Kanali",
        username="main_cinema",
        is_active=True,
        sync_enabled=True,
    )
    media = ExtractedMedia(
        file_id="BAAC_FILE_1",
        file_unique_id="UNIQ_FILE_1",
        is_document=False,
        duration_seconds=5400,
    )
    caption = "🎬 Movie: Interstellar\n📅 Year: 2014\n🎭 Genre: Sci-Fi, Drama\n🌍 Language: Uzbek\n⭐ Rating: 8.7"

    res1 = await ChannelSyncService.sync_single_post(
        channel_id=channel.channel_id,
        message_id=101,
        caption=caption,
        media=media,
    )
    assert res1["action"] == "created"
    assert await Movie.objects.acount() == 1

    # Same message_id duplicate must be skipped
    res2 = await ChannelSyncService.sync_single_post(
        channel_id=channel.channel_id,
        message_id=101,
        caption=caption,
        media=media,
    )
    assert res2["action"] == "duplicate_message"
    assert await Movie.objects.acount() == 1

    # Different message_id with same file_unique_id must be skipped
    res3 = await ChannelSyncService.sync_single_post(
        channel_id=channel.channel_id,
        message_id=102,
        caption=caption,
        media=media,
    )
    assert res3["action"] == "duplicate_file"
    assert await Movie.objects.acount() == 1
    assert await SyncLog.objects.filter(event_type=SyncLog.EventType.DUPLICATE_SKIPPED).acount() == 2


@pytest.mark.asyncio
async def test_edited_channel_post_updates_movie_and_logs():
    channel = await TelegramChannel.objects.acreate(
        channel_id=-100111222333,
        title="HD Kinolar",
        is_active=True,
        sync_enabled=True,
    )
    media = ExtractedMedia(file_id="BAAC_EDIT_1", file_unique_id="UNIQ_EDIT_1", is_document=False)
    await ChannelSyncService.sync_single_post(
        channel_id=channel.channel_id,
        message_id=55,
        caption="🎬 Movie: Eski Nom\n📅 Year: 2020",
        media=media,
    )

    update_res = await ChannelSyncService.sync_edited_post(
        channel_id=channel.channel_id,
        message_id=55,
        caption="🎬 Movie: Yangilangan Nom\n📅 Year: 2021\n🌍 Language: Uzbek\n🎭 Genre: Action\n⭐ Rating: 8.1",
    )
    assert update_res["action"] == "updated"
    movie = await Movie.objects.aget(id=update_res["movie_id"])
    assert movie.title == "Yangilangan Nom"
    assert movie.release_year == 2021
    assert movie.needs_metadata_review is False
    assert await ChannelPost.objects.filter(message_id=55, status=ChannelPost.PostStatus.UPDATED).aexists()
