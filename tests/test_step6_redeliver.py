"""Шаг 6: redeliver_pending — повтор доставки из outbox.

🔴 Фильтр очереди в SQL: истёкшие строки не занимают выборку. Ответ бота
попадает в историю только когда доставлен повтором, ровно один раз.
"""

from __future__ import annotations

import hashlib
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime, timedelta

import pytest
import sqlalchemy as sa

from src.channels.outbox import RedeliverReport, redeliver_pending
from src.db.base import DeliveryStatus, MessageRole, OutboxKind, utcnow
from src.db.models import Conversation, Message, OutboxItem
from src.dependencies import close_resources, get_sessionmaker
from tests.engine_fakes import EXTERNAL_ID, load_messages, seed_conversation
from tests.telegram_fakes import FakeTransport

TRANSPORT = "telegram"


def _dedup(conversation_id: uuid.UUID | None, body: str) -> str:
    digest = hashlib.sha256(body.encode("utf-8")).hexdigest()[:16]
    return f"reply:{conversation_id or '-'}:{digest}"


@dataclass
class RedeliverEnv:
    sessionmaker: object

    async def add(
        self,
        *,
        body: str = "Ответ бота.",
        dedup_key: str | None = None,
        transport: str = TRANSPORT,
        kind: OutboxKind = OutboxKind.REPLY,
        status: DeliveryStatus = DeliveryStatus.PENDING,
        attempts: int = 0,
        created_at: datetime | None = None,
        expires_at: datetime | None = None,
    ) -> int:
        now = utcnow()
        item = OutboxItem(
            kind=kind,
            transport=transport,
            recipient=EXTERNAL_ID,
            body=body,
            dedup_key=dedup_key,
            status=status,
            attempts=attempts,
            created_at=created_at or now,
            expires_at=expires_at or (now + timedelta(hours=24)),
        )
        async with self.sessionmaker() as session:
            session.add(item)
            await session.commit()
            return item.id

    async def row(self, item_id: int) -> OutboxItem:
        async with self.sessionmaker() as session:
            return await session.get_one(OutboxItem, item_id)

    async def rows(self) -> list[OutboxItem]:
        async with self.sessionmaker() as session:
            return list((await session.execute(sa.select(OutboxItem).order_by(OutboxItem.id))).scalars().all())

    async def run(self, transport: FakeTransport | None, **kwargs) -> RedeliverReport:
        transports = {} if transport is None else {TRANSPORT: transport}
        return await redeliver_pending(self.sessionmaker, transports, **kwargs)


@pytest.fixture
async def env(migrated_db, fake_redis) -> AsyncIterator[RedeliverEnv]:
    try:
        yield RedeliverEnv(sessionmaker=get_sessionmaker())
    finally:
        await close_resources()


async def test_pending_row_is_delivered_and_recorded(env: RedeliverEnv) -> None:
    conversation_id = await seed_conversation(env.sessionmaker)
    async with env.sessionmaker() as session:
        before = (await session.get_one(Conversation, conversation_id)).last_activity_at
    item_id = await env.add(body="Свободные есть.", dedup_key=_dedup(conversation_id, "Свободные есть."))

    transport = FakeTransport()
    report = await env.run(transport)

    assert isinstance(report, RedeliverReport)
    assert (report.delivered, report.failed, report.expired, report.skipped) == (1, 0, 0, 0)
    assert transport.sent == [(EXTERNAL_ID, "Свободные есть.")]

    row = await env.row(item_id)
    assert row.status is DeliveryStatus.SENT
    assert row.attempts == 1
    assert row.sent_at is not None

    messages = await load_messages(env.sessionmaker, conversation_id)
    assert len(messages) == 1
    bot = messages[0]
    assert bot.role is MessageRole.ASSISTANT
    assert bot.content == "Свободные есть."
    assert bot.sent_by_us is True
    async with env.sessionmaker() as session:
        after = (await session.get_one(Conversation, conversation_id)).last_activity_at
    assert after >= before


async def test_expired_row_is_failed_without_delivery(env: RedeliverEnv) -> None:
    conversation_id = await seed_conversation(env.sessionmaker)
    now = utcnow()
    item_id = await env.add(
        dedup_key=_dedup(conversation_id, "Ответ бота."),
        created_at=now - timedelta(days=2),
        expires_at=now - timedelta(hours=1),
    )
    transport = FakeTransport()
    report = await env.run(transport)

    assert report.expired == 1
    assert report.delivered == 0
    assert transport.sent == []
    row = await env.row(item_id)
    assert row.status is DeliveryStatus.FAILED
    assert row.last_error == "expired"
    assert await load_messages(env.sessionmaker, conversation_id) == []


async def test_expired_rows_do_not_block_live_one_in_batch(env: RedeliverEnv) -> None:
    """60 истёкших старше живой при batch=50: живая доставляется за один вызов.
    Фильтр в Python после выборки взял бы 50 истёкших и до живой не дошёл."""
    conversation_id = await seed_conversation(env.sessionmaker)
    now = utcnow()
    for i in range(60):
        await env.add(
            body=f"старое {i}",
            dedup_key=_dedup(conversation_id, f"старое {i}"),
            created_at=now - timedelta(days=2, minutes=i),
            expires_at=now - timedelta(days=1),
        )
    live_id = await env.add(body="живая", dedup_key=_dedup(conversation_id, "живая"), created_at=now)

    transport = FakeTransport()
    report = await env.run(transport, batch=50)

    assert report.delivered == 1
    assert report.expired == 60
    assert transport.sent == [(EXTERNAL_ID, "живая")]
    assert (await env.row(live_id)).status is DeliveryStatus.SENT
    statuses = {r.status for r in await env.rows() if r.id != live_id}
    assert statuses == {DeliveryStatus.FAILED}


async def test_unknown_transport_is_skipped(env: RedeliverEnv) -> None:
    item_id = await env.add(transport="whatsapp")
    report = await env.run(FakeTransport())
    assert report.skipped == 1
    assert report.delivered == 0
    row = await env.row(item_id)
    assert row.status is DeliveryStatus.PENDING
    assert row.attempts == 0


async def test_failure_increments_attempts_and_stays_pending(env: RedeliverEnv) -> None:
    item_id = await env.add(attempts=1)
    report = await env.run(FakeTransport(ok=False, error="boom"))
    assert report.failed == 1
    row = await env.row(item_id)
    assert row.status is DeliveryStatus.PENDING
    assert row.attempts == 2
    assert row.last_error == "boom"
    assert row.last_attempt_at is not None
    assert row.sent_at is None


async def test_transport_exception_is_failure_not_crash(env: RedeliverEnv) -> None:
    item_id = await env.add(attempts=0)
    report = await env.run(FakeTransport(raise_exc=True))
    assert report.failed == 1
    row = await env.row(item_id)
    assert row.status is DeliveryStatus.PENDING
    assert row.attempts == 1
    assert row.last_error


async def test_delivered_row_is_not_delivered_twice(env: RedeliverEnv) -> None:
    conversation_id = await seed_conversation(env.sessionmaker)
    await env.add(dedup_key=_dedup(conversation_id, "Ответ бота."))
    transport = FakeTransport()
    await env.run(transport)
    second = await env.run(transport)
    assert second.delivered == 0
    assert len(transport.sent) == 1
    assert len(await load_messages(env.sessionmaker, conversation_id)) == 1


async def test_reply_without_conversation_writes_no_message(env: RedeliverEnv) -> None:
    conversation_id = await seed_conversation(env.sessionmaker)
    await env.add(dedup_key=_dedup(None, "Ответ бота."))
    report = await env.run(FakeTransport())
    assert report.delivered == 1
    assert await load_messages(env.sessionmaker, conversation_id) == []
    async with env.sessionmaker() as session:
        count = (await session.execute(sa.select(sa.func.count()).select_from(Message))).scalar_one()
    assert count == 0


async def test_alert_kind_writes_no_message(env: RedeliverEnv) -> None:
    conversation_id = await seed_conversation(env.sessionmaker)
    await env.add(kind=OutboxKind.ALERT, dedup_key=_dedup(conversation_id, "Ответ бота."))
    report = await env.run(FakeTransport())
    assert report.delivered == 1
    assert await load_messages(env.sessionmaker, conversation_id) == []


async def test_only_pending_rows_are_touched(env: RedeliverEnv) -> None:
    sent_id = await env.add(status=DeliveryStatus.SENT, attempts=1)
    failed_id = await env.add(status=DeliveryStatus.FAILED, attempts=3)
    transport = FakeTransport()
    report = await env.run(transport)
    assert (report.delivered, report.failed, report.expired, report.skipped) == (0, 0, 0, 0)
    assert transport.sent == []
    assert (await env.row(sent_id)).attempts == 1
    assert (await env.row(failed_id)).attempts == 3


async def test_explicit_now_is_respected(env: RedeliverEnv) -> None:
    """now передаётся снаружи: строка, живая сейчас, истекает по часам теста."""
    now = utcnow()
    item_id = await env.add(expires_at=now + timedelta(hours=1))
    report = await env.run(FakeTransport(), now=now + timedelta(hours=2))
    assert report.expired == 1
    assert (await env.row(item_id)).status is DeliveryStatus.FAILED


async def test_empty_outbox_is_fine(env: RedeliverEnv) -> None:
    report = await env.run(None)
    assert (report.delivered, report.failed, report.expired, report.skipped) == (0, 0, 0, 0)


async def test_row_with_attempt_in_flight_is_not_taken(env: RedeliverEnv) -> None:
    """Строка, по которой попытка идёт прямо сейчас (захвачена, исход не записан),
    проходом не берётся: иначе клиент получит один ответ дважды."""
    conversation_id = await seed_conversation(env.sessionmaker)
    now = utcnow()
    item_id = await env.add(dedup_key=_dedup(conversation_id, "Ответ бота."), attempts=1)
    async with env.sessionmaker() as session:
        row = await session.get_one(OutboxItem, item_id)
        row.last_attempt_at = now  # захват: попытка началась, исхода ещё нет
        row.last_error = None
        await session.commit()

    transport = FakeTransport()
    report = await env.run(transport, now=now)

    assert transport.sent == []
    assert report.delivered == 0
    assert (await env.row(item_id)).attempts == 1
    assert await load_messages(env.sessionmaker, conversation_id) == []

    # Прошло больше окна — строка снова живая: процесс мог упасть на попытке.
    later = now + timedelta(seconds=120)
    report = await env.run(transport, now=later)
    assert report.delivered == 1
    assert (await env.row(item_id)).attempts == 2


async def test_redeliver_during_immediate_attempt_delivers_once(env: RedeliverEnv) -> None:
    """🔴 Проход повтора идёт параллельно немедленной попытке OutboxSender:
    клиент должен получить строку один раз, и вторая реплика в историю не попасть."""
    import asyncio

    from src.channels.outbox import OutboxSender
    from src.channels.sender import SendResult

    conversation_id = await seed_conversation(env.sessionmaker)
    started, release = asyncio.Event(), asyncio.Event()

    class SlowTransport:
        """Держит попытку открытой: ровно то окно, в котором работает monitor."""

        def __init__(self) -> None:
            self.sent: list[tuple[str, str]] = []

        async def deliver(self, recipient: str, text: str) -> SendResult:
            self.sent.append((str(recipient), text))
            started.set()
            await release.wait()
            return SendResult(ok=True, external_message_id="1")

    slow = SlowTransport()
    sender = OutboxSender(env.sessionmaker, {TRANSPORT: slow}, retry_window_hours=24)
    send_task = asyncio.create_task(
        sender.send(channel=TRANSPORT, external_id=EXTERNAL_ID, text="Свободные есть.")
    )
    await asyncio.wait_for(started.wait(), timeout=5)

    # Транспорт monitor'а — свой: если строку всё-таки возьмут, это видно сразу.
    monitor_transport = FakeTransport()
    report = await env.run(monitor_transport)
    assert monitor_transport.sent == [], "строку с идущей попыткой повтор брать не должен"
    assert report.delivered == 0

    release.set()
    result = await asyncio.wait_for(send_task, timeout=5)
    assert result.ok is True
    assert slow.sent == [(EXTERNAL_ID, "Свободные есть.")]
    rows = await env.rows()
    assert len(rows) == 1
    assert rows[0].status is DeliveryStatus.SENT
    assert rows[0].attempts == 1
    # Историю пишет движок по SendResult ok; повтор второй реплики не добавляет.
    assert await load_messages(env.sessionmaker, conversation_id) == []
