"""Tests for mandatory subscription verification and admin/channel authorization."""
from types import SimpleNamespace
from unittest.mock import AsyncMock
from aiogram.enums import ChatMemberStatus
import pytest
from bot.filters.channel_admin import AuthorizedChannelFilter, BotAdminFilter
from bot.services.subscription_service import SubscriptionService
from channels.models import SubscriptionChannel, SyncLog, TelegramChannel
from users.models import Admin


@pytest.mark.asyncio
async def test_subscription_verification_via_get_chat_member():
    await SubscriptionChannel.objects.acreate(
        channel_id=-100555111,
        title="Rasmiy Kanal",
        invite_link="https://t.me/rasmiy_kanal",
        is_active=True,
    )

    bot_mock = SimpleNamespace(
        get_chat_member=AsyncMock(return_value=SimpleNamespace(status=ChatMemberStatus.LEFT))
    )
    missing = await SubscriptionService.get_unsubscribed_channels(bot=bot_mock, redis=None, user_id=1001)
    assert len(missing) == 1

    bot_mock.get_chat_member = AsyncMock(return_value=SimpleNamespace(status=ChatMemberStatus.MEMBER))
    missing_after = await SubscriptionService.get_unsubscribed_channels(bot=bot_mock, redis=None, user_id=1001)
    assert len(missing_after) == 0


@pytest.mark.asyncio
async def test_unauthorized_channel_is_rejected_and_logged():
    flt = AuthorizedChannelFilter()
    msg = SimpleNamespace(chat=SimpleNamespace(id=-100999000, title="Begona Kanal"), message_id=12)
    allowed = await flt(msg)
    assert allowed is False
    assert await SyncLog.objects.filter(
        telegram_channel_id=-100999000,
        event_type=SyncLog.EventType.UNAUTHORIZED_CHANNEL,
    ).aexists()

    await TelegramChannel.objects.acreate(
        channel_id=-100888000,
        title="Ruxsatli Kanal",
        is_active=True,
        sync_enabled=True,
    )
    ok_msg = SimpleNamespace(chat=SimpleNamespace(id=-100888000, title="Ruxsatli Kanal"), message_id=13)
    assert await flt(ok_msg) is True


@pytest.mark.asyncio
async def test_bot_admin_permission_filter():
    await Admin.objects.acreate(
        telegram_id=555777,
        full_name="Super Admin",
        role=Admin.Role.SUPERADMIN,
        is_active=True,
    )
    flt = BotAdminFilter()
    assert await flt(SimpleNamespace(from_user=SimpleNamespace(id=555777))) is True
    assert await flt(SimpleNamespace(from_user=SimpleNamespace(id=999111))) is False
