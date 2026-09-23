"""Шаг 8а: алерт-строки доходят до своих транспортов.

Два канала бесполезны, если повторная доставка их не знает: строка
останется pending навсегда и будет выглядеть как «алерт в очереди».
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest

from src.channels.outbox import redeliver_pending
from src.db.base import DeliveryStatus
from src.db.models import Message
from src.dependencies import close_resources, get_sessionmaker
from src.jobs.outbox_redeliver import build_transports
from src.monitoring import default_jobs
from tests.alert_fakes import TEST_CHAT_ID, TEST_EMAIL, MessengerApi, alert_rows, alert_settings
from tests.telegram_fakes import FakeTransport

EMAIL = "email"
MESSENGER = "alert_messenger"


@pytest.fixture
async def sessionmaker(migrated_db) -> AsyncIterator:
    try:
        yield get_sessionmaker()
    finally:
        await close_resources()


async def test_build_transports_knows_all_three_channels(monkeypatch) -> None:
    settings = alert_settings(
        monkeypatch,
        SMTP_HOST="smtp.example.test",
        CHANNEL_TELEGRAM_BOT_TOKEN="222:CHANNELBOT",
    )
    api = MessengerApi()

    async with api.client() as http:
        transports = build_transports(settings, http)

    assert set(transports) >= {"telegram", EMAIL, MESSENGER}


async def test_alert_bot_is_not_the_channel_bot(monkeypatch) -> None:
    """🔴 У бота алертов свой токен и свой чат: один бот на две задачи —
    это молчание об упавшем канале вместе с самим каналом."""
    settings = alert_settings(
        monkeypatch,
        CHANNEL_TELEGRAM_BOT_TOKEN="222:CHANNELBOT",
        ALERT_TELEGRAM_BOT_TOKEN="111:ALERTBOT",
    )
    api = MessengerApi()

    async with api.client() as http:
        transports = build_transports(settings, http)

    assert transports["telegram"] is not transports[MESSENGER]


async def test_default_jobs_has_three_tasks() -> None:
    names = [getattr(job, "__module__", "") for job in default_jobs()]
    assert len(names) == 3
    assert any("outbox_redeliver" in name for name in names), names
    assert any("watchdog" in name for name in names), names
    assert any("heartbeat" in name for name in names), names


async def test_pending_alert_is_delivered_by_both_transports(
    sessionmaker, fake_redis, monkeypatch
) -> None:
    from src.alerts.raise_alert import raise_alert

    settings = alert_settings(monkeypatch)
    await raise_alert(
        sessionmaker, fake_redis, settings,
        event_type="sla", body="Клиент ждёт ответа", dedup_key="sla:abc:1",
    )

    email_transport = FakeTransport()
    messenger_transport = FakeTransport()
    report = await redeliver_pending(
        sessionmaker, {EMAIL: email_transport, MESSENGER: messenger_transport}
    )

    assert report.delivered == 2
    assert email_transport.sent == [(TEST_EMAIL, "Клиент ждёт ответа")]
    assert messenger_transport.sent == [(TEST_CHAT_ID, "Клиент ждёт ответа")]
    assert all(row.status is DeliveryStatus.SENT for row in await alert_rows(sessionmaker))


async def test_failed_email_does_not_cancel_the_messenger(
    sessionmaker, fake_redis, monkeypatch
) -> None:
    """🔴 Провал одной строки не отменяет другую — ради этого их и две."""
    from src.alerts.raise_alert import raise_alert

    settings = alert_settings(monkeypatch)
    await raise_alert(
        sessionmaker, fake_redis, settings,
        event_type="sla", body="Клиент ждёт ответа", dedup_key="sla:abc:1",
    )

    messenger_transport = FakeTransport()
    report = await redeliver_pending(
        sessionmaker,
        {EMAIL: FakeTransport(ok=False, error="smtp_timeout"), MESSENGER: messenger_transport},
    )

    assert report.delivered == 1
    assert report.failed == 1
    assert messenger_transport.sent == [(TEST_CHAT_ID, "Клиент ждёт ответа")]
    rows = await alert_rows(sessionmaker)
    statuses = {row.transport: row.status for row in rows}
    assert statuses[MESSENGER] is DeliveryStatus.SENT
    assert statuses[EMAIL] is DeliveryStatus.PENDING


async def test_alert_row_never_lands_in_conversation_history(
    sessionmaker, fake_redis, monkeypatch
) -> None:
    """История — переписка с клиентом. Алерт владельцу туда не пишется:
    иначе модель следующим ходом прочитает его как свою реплику."""
    import sqlalchemy as sa

    from src.alerts.raise_alert import raise_alert

    settings = alert_settings(monkeypatch)
    await raise_alert(
        sessionmaker, fake_redis, settings,
        event_type="sla", body="Клиент ждёт ответа", dedup_key="sla:abc:1",
    )
    await redeliver_pending(
        sessionmaker, {EMAIL: FakeTransport(), MESSENGER: FakeTransport()}
    )

    async with sessionmaker() as session:
        count = (await session.execute(sa.select(sa.func.count()).select_from(Message))).scalar_one()
    assert count == 0
