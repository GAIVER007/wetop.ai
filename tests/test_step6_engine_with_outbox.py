"""Шаг 6: движок с OutboxSender. Отказ канала — ответа нет в истории,
строка в outbox pending; повтор доставил — ответ в истории ровно один раз.

Движок из engine_fakes, модель по сценарию, транспорт в память: сети нет.
"""

from __future__ import annotations

import sqlalchemy as sa

from src.channels.outbox import OutboxSender, redeliver_pending
from src.db.base import DeliveryStatus, MessageRole
from src.db.models import OutboxItem
from tests.engine_fakes import (  # noqa: F401 — фикстура engine_env
    CHANNEL,
    ScriptedLlm,
    engine_env,
    incoming,
    load_messages,
    reply,
    roles,
)
from tests.telegram_fakes import FakeTransport


def _sender(engine_env, transport: FakeTransport) -> OutboxSender:
    return OutboxSender(engine_env.sessionmaker, {CHANNEL: transport}, retry_window_hours=24)


async def _outbox(engine_env) -> list[OutboxItem]:
    async with engine_env.sessionmaker() as session:
        return list((await session.execute(sa.select(OutboxItem).order_by(OutboxItem.id))).scalars().all())


async def test_failed_delivery_then_redeliver_records_reply_once(engine_env) -> None:
    broken = FakeTransport(ok=False, error="boom")
    engine = engine_env.engine(sender=_sender(engine_env, broken), llm=ScriptedLlm([reply("Свободные есть.")]))
    outcome = await engine.process_message(incoming("Есть места на выходные?"))

    assert outcome.status == "send_failed"
    assert outcome.conversation_id is not None
    assert roles(await load_messages(engine_env.sessionmaker, outcome.conversation_id)) == ["user"]

    rows = await _outbox(engine_env)
    assert len(rows) == 1
    assert rows[0].status is DeliveryStatus.PENDING
    assert rows[0].attempts == 1
    assert rows[0].dedup_key.startswith(f"reply:{outcome.conversation_id}:")
    assert rows[0].body.startswith("Свободные есть.")

    working = FakeTransport()
    report = await redeliver_pending(engine_env.sessionmaker, {CHANNEL: working})
    assert report.delivered == 1
    assert working.sent == [("1001", rows[0].body)]

    messages = await load_messages(engine_env.sessionmaker, outcome.conversation_id)
    assert roles(messages) == ["user", "assistant"]
    bot = messages[-1]
    assert bot.role is MessageRole.ASSISTANT
    assert bot.content == rows[0].body
    assert bot.sent_by_us is True

    # Второй повтор ничего не доставляет и историю не дублирует.
    again = await redeliver_pending(engine_env.sessionmaker, {CHANNEL: working})
    assert again.delivered == 0
    assert roles(await load_messages(engine_env.sessionmaker, outcome.conversation_id)) == ["user", "assistant"]
    assert (await _outbox(engine_env))[0].status is DeliveryStatus.SENT


async def test_immediate_delivery_records_reply_once_and_redeliver_is_noop(engine_env) -> None:
    transport = FakeTransport()
    engine = engine_env.engine(sender=_sender(engine_env, transport), llm=ScriptedLlm([reply("Есть студия.")]))
    outcome = await engine.process_message(incoming("Есть места?"))

    assert outcome.status == "replied"
    assert len(transport.sent) == 1
    messages = await load_messages(engine_env.sessionmaker, outcome.conversation_id)
    assert roles(messages) == ["user", "assistant"]
    assert messages[-1].sent_by_us is True
    assert messages[-1].content == transport.sent[0][1]

    rows = await _outbox(engine_env)
    assert len(rows) == 1
    assert rows[0].status is DeliveryStatus.SENT

    report = await redeliver_pending(engine_env.sessionmaker, {CHANNEL: transport})
    assert report.delivered == 0
    assert len(transport.sent) == 1
    assert roles(await load_messages(engine_env.sessionmaker, outcome.conversation_id)) == ["user", "assistant"]


async def test_no_transport_for_channel_is_send_failed(engine_env) -> None:
    sender = OutboxSender(engine_env.sessionmaker, {}, retry_window_hours=24)
    engine = engine_env.engine(sender=sender, llm=ScriptedLlm([reply("Ответ.")]))
    outcome = await engine.process_message(incoming("Есть места?"))
    assert outcome.status == "send_failed"
    assert await _outbox(engine_env) == []
    assert roles(await load_messages(engine_env.sessionmaker, outcome.conversation_id)) == ["user"]
