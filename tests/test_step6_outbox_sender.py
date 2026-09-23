"""Шаг 6: OutboxSender — строка в outbox пишется ДО попытки доставки.

Успех — sent; отказ — строка остаётся pending, её добьёт повтор. Отправитель
открывает свою сессию: сессия движка занята его ходом.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass, field

import pytest
import sqlalchemy as sa

from src.channels.outbox import OutboxSender
from src.db.base import DeliveryStatus, OutboxKind
from src.db.models import OutboxItem
from src.dependencies import close_resources, get_sessionmaker
from tests.engine_fakes import CHANNEL, EXTERNAL_ID, seed_conversation
from tests.telegram_fakes import FakeTransport

RETRY_HOURS = 24


@dataclass
class OutboxEnv:
    sessionmaker: object

    def sender(self, transport: FakeTransport | None, *, channel: str = CHANNEL) -> OutboxSender:
        transports = {} if transport is None else {channel: transport}
        return OutboxSender(self.sessionmaker, transports, retry_window_hours=RETRY_HOURS)

    async def rows(self) -> list[OutboxItem]:
        async with self.sessionmaker() as session:
            return list((await session.execute(sa.select(OutboxItem).order_by(OutboxItem.id))).scalars().all())


@pytest.fixture
async def env(migrated_db, fake_redis) -> AsyncIterator[OutboxEnv]:
    try:
        yield OutboxEnv(sessionmaker=get_sessionmaker())
    finally:
        await close_resources()


async def test_success_marks_row_sent(env: OutboxEnv) -> None:
    conversation_id = await seed_conversation(env.sessionmaker)
    transport = FakeTransport()
    result = await env.sender(transport).send(channel=CHANNEL, external_id=EXTERNAL_ID, text="Свободные есть.")

    assert result.ok is True
    assert result.external_message_id == "1"
    assert transport.sent == [(EXTERNAL_ID, "Свободные есть.")]

    rows = await env.rows()
    assert len(rows) == 1
    row = rows[0]
    assert row.status is DeliveryStatus.SENT
    assert row.kind is OutboxKind.REPLY
    assert row.transport == CHANNEL
    assert row.recipient == EXTERNAL_ID
    assert row.body == "Свободные есть."
    assert row.attempts == 1
    assert row.sent_at is not None
    assert row.last_error is None
    prefix = f"reply:{conversation_id}:"
    assert row.dedup_key.startswith(prefix)
    assert len(row.dedup_key) == len(prefix) + 16
    assert row.expires_at > row.created_at


async def test_failure_keeps_row_pending(env: OutboxEnv) -> None:
    await seed_conversation(env.sessionmaker)
    transport = FakeTransport(ok=False, error="boom")
    result = await env.sender(transport).send(channel=CHANNEL, external_id=EXTERNAL_ID, text="Свободные есть.")

    assert result.ok is False
    assert result.error == "boom"
    assert transport.sent == []

    rows = await env.rows()
    assert len(rows) == 1
    row = rows[0]
    assert row.status is DeliveryStatus.PENDING
    assert row.attempts == 1
    assert row.last_error == "boom"
    assert row.last_attempt_at is not None
    assert row.sent_at is None


async def test_no_transport_writes_nothing(env: OutboxEnv) -> None:
    await seed_conversation(env.sessionmaker)
    result = await env.sender(None).send(channel=CHANNEL, external_id=EXTERNAL_ID, text="текст")
    assert result.ok is False
    assert result.error == "no_transport"
    assert await env.rows() == []

    other = await env.sender(FakeTransport(), channel="whatsapp").send(channel=CHANNEL, external_id=EXTERNAL_ID, text="т")
    assert other.ok is False
    assert other.error == "no_transport"
    assert await env.rows() == []


async def test_transport_exception_is_failure(env: OutboxEnv) -> None:
    await seed_conversation(env.sessionmaker)
    result = await env.sender(FakeTransport(raise_exc=True)).send(channel=CHANNEL, external_id=EXTERNAL_ID, text="т")
    assert result.ok is False
    assert result.error == "transport_exception"
    rows = await env.rows()
    assert len(rows) == 1
    assert rows[0].status is DeliveryStatus.PENDING
    assert rows[0].attempts == 1
    assert rows[0].last_error == "transport_exception"


async def test_unknown_client_gets_dash_in_dedup_key(env: OutboxEnv) -> None:
    result = await env.sender(FakeTransport()).send(channel=CHANNEL, external_id="9999", text="т")
    assert result.ok is True
    rows = await env.rows()
    assert len(rows) == 1
    assert rows[0].dedup_key.startswith("reply:-:")
    assert rows[0].recipient == "9999"


async def test_recipient_is_always_string(env: OutboxEnv) -> None:
    """Внешние идентификаторы — строкой: даже если канал прислал число."""
    transport = FakeTransport()
    result = await env.sender(transport).send(channel=CHANNEL, external_id=12345, text="т")  # type: ignore[arg-type]
    assert result.ok is True
    rows = await env.rows()
    assert rows[0].recipient == "12345"
    assert transport.sent == [("12345", "т")]


async def test_two_sends_two_rows(env: OutboxEnv) -> None:
    """Каждая отправка — своя строка: outbox — журнал доставки, не кэш."""
    sender = env.sender(FakeTransport())
    await sender.send(channel=CHANNEL, external_id=EXTERNAL_ID, text="раз")
    await sender.send(channel=CHANNEL, external_id=EXTERNAL_ID, text="два")
    rows = await env.rows()
    assert [r.body for r in rows] == ["раз", "два"]
    assert rows[0].dedup_key != rows[1].dedup_key


@dataclass
class InspectingTransport:
    """Транспорт, который во время доставки читает outbox своей сессией.

    Так проверяется порядок: строка должна быть в базе ДО попытки. Если
    запись перенести после доставки, seen окажется пустым.
    """

    sessionmaker: object
    seen: list[tuple[str, DeliveryStatus]] = field(default_factory=list)

    async def deliver(self, recipient: str, text: str):
        from src.channels.sender import SendResult

        async with self.sessionmaker() as session:  # type: ignore[operator]
            rows = list((await session.execute(sa.select(OutboxItem))).scalars().all())
        self.seen = [(row.body, row.status) for row in rows]
        return SendResult(ok=True, external_message_id="1")


async def test_row_is_written_before_attempt(env: OutboxEnv) -> None:
    """🔴 Строка пишется ДО попытки: упади процесс на попытке — повтор её добьёт."""
    await seed_conversation(env.sessionmaker)
    transport = InspectingTransport(sessionmaker=env.sessionmaker)
    result = await env.sender(transport).send(  # type: ignore[arg-type]
        channel=CHANNEL, external_id=EXTERNAL_ID, text="Свободные есть."
    )

    assert result.ok is True
    assert transport.seen == [("Свободные есть.", DeliveryStatus.PENDING)], (
        "на момент доставки строка уже должна лежать в outbox со статусом pending"
    )
