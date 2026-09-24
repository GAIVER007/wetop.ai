"""Шаг 8а: в теле алерта нет персональных данных.

🔴 Канал алертов — чужая труба: почтовый сервер, мессенджер, их логи.
Телефон, имя и текст переписки туда не уходят. В алерте только вид события,
канал, время и идентификатор диалога; контакт оператор смотрит в панели.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import datetime, timezone

import pytest

from src.dependencies import close_resources, get_sessionmaker
from src.sla_alerts import scan_and_alert
from tests.alert_fakes import alert_rows, alert_settings, seed_turn

# Вымышленные данные из кита: именно их не должно быть в теле алерта.
PHONE = "+7 701 000 00 00"
PHONE_DIGITS = "+77010000000"
NAME = "Иван Петров"
NOW = datetime(2026, 9, 23, 12, 0, tzinfo=timezone.utc)


@pytest.fixture
async def sessionmaker(migrated_db) -> AsyncIterator:
    try:
        yield get_sessionmaker()
    finally:
        await close_resources()


def _assert_clean(bodies: list[str]) -> None:
    for body in bodies:
        assert PHONE not in body, body
        assert PHONE_DIGITS not in body, body
        assert NAME not in body, body
        assert "Петров" not in body, body


async def test_sla_alert_body_has_no_pii(sessionmaker, fake_redis, monkeypatch) -> None:
    settings = alert_settings(monkeypatch, SLA_SECONDS="300")
    await seed_turn(
        sessionmaker,
        external_id="2001",
        waited_seconds=600,
        now=NOW,
        text=f"Меня зовут {NAME}, мой номер {PHONE}, перезвоните",
    )

    sent = await scan_and_alert(sessionmaker, fake_redis, settings, now=NOW)

    assert sent == 1
    rows = await alert_rows(sessionmaker)
    assert rows, "алерт не выпущен — проверять нечего"
    _assert_clean([row.body for row in rows])


async def test_hot_lead_alert_body_has_no_pii(sessionmaker, fake_redis, monkeypatch) -> None:
    """Алерт горячего лида выпускает lead_writer.write_alert: его тело
    собирается из идентификатора диалога, а не из полей заявки."""
    from src.integrations.lead_writer import write_alert

    settings = alert_settings(monkeypatch)
    conversation_id = await seed_turn(sessionmaker, external_id="2002", now=NOW)

    await write_alert(
        sessionmaker,
        settings,
        body=f"Новая заявка в диалоге {conversation_id}, контакт в панели",
        dedup_key=f"hotlead:{conversation_id}",
    )

    rows = await alert_rows(sessionmaker)
    assert len(rows) == 2, "алерт заявки должен уходить двумя строками"
    _assert_clean([row.body for row in rows])
    assert str(conversation_id) in rows[0].body


async def test_sla_alert_body_has_no_message_text(sessionmaker, fake_redis, monkeypatch) -> None:
    """Текст переписки в алерт не попадает даже без телефона и имени:
    переписка — тоже персональные данные, и её место в панели."""
    settings = alert_settings(monkeypatch, SLA_SECONDS="300")
    secret = "хочу забронировать люкс на годовщину"
    await seed_turn(sessionmaker, external_id="2003", waited_seconds=900, now=NOW, text=secret)

    await scan_and_alert(sessionmaker, fake_redis, settings, now=NOW)

    for row in await alert_rows(sessionmaker):
        assert secret not in row.body, row.body
