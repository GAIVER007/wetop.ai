"""Шаг 1: время ставит приложение, а не база.

server_default = время начала транзакции: две записи в одной транзакции
получают одинаковые метки, и расчёт «за сколько ответили» врёт. Ошибка
тихая, поэтому проверяется и по метаданным, и по живой записи.
"""

import time
from datetime import UTC, datetime

from sqlalchemy import DateTime

from src.db import models  # noqa: F401  — регистрирует таблицы в Base.metadata
from src.db.base import Base, MessageRole, utcnow
from src.db.models import Client, Conversation, Message
from src.dependencies import get_sessionmaker


def _as_utc(value: datetime) -> datetime:
    """sqlite отдаёт naive datetime; значение в нём — UTC, дописываем зону."""
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def test_no_datetime_column_has_server_default() -> None:
    offenders = []
    checked = 0
    for table in Base.metadata.tables.values():
        for column in table.columns:
            if isinstance(column.type, DateTime):
                checked += 1
                if column.server_default is not None:
                    offenders.append(f"{table.name}.{column.name}")
    assert checked > 0, "в моделях не нашлось ни одной колонки DateTime"
    assert not offenders, f"server_default у временных колонок: {offenders}"


async def test_two_messages_in_one_transaction_get_different_timestamps(db_session) -> None:
    now = utcnow()
    client = Client(channel="telegram", external_id="ts-1", created_at=now)
    db_session.add(client)
    await db_session.flush()
    conversation = Conversation(client_id=client.id, created_at=now, last_activity_at=now)
    db_session.add(conversation)
    await db_session.flush()

    t1 = utcnow()
    m1 = Message(
        conversation_id=conversation.id,
        role=MessageRole("user"),
        content="первое",
        created_at=t1,
    )
    time.sleep(0.002)
    t2 = utcnow()
    m2 = Message(
        conversation_id=conversation.id,
        role=MessageRole("assistant"),
        content="второе",
        created_at=t2,
    )
    db_session.add_all([m1, m2])
    await db_session.commit()
    m1_id, m2_id = m1.id, m2.id

    assert t1 != t2

    async with get_sessionmaker()() as fresh:
        stored1 = await fresh.get(Message, m1_id)
        stored2 = await fresh.get(Message, m2_id)

    assert stored1 is not None and stored2 is not None
    assert _as_utc(stored1.created_at) == t1
    assert _as_utc(stored2.created_at) == t2
    assert _as_utc(stored1.created_at) != _as_utc(stored2.created_at)
