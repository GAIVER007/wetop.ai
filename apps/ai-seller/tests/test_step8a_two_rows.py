"""Шаг 8а: один алерт — ДВЕ строки outbox, почта и мессенджер.

🔴 Почта основная, мессенджер дубль, а не замена: на боевом проекте адрес
мессенджера был заблокирован, и один канал означал молчание ровно тогда,
когда алерт нужнее всего. Провал одной строки не отменяет другую.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest

from src.alerts.raise_alert import raise_alert
from src.db.base import DeliveryStatus, OutboxKind
from src.dependencies import close_resources, get_sessionmaker
from tests.alert_fakes import TEST_CHAT_ID, TEST_EMAIL, alert_rows, alert_settings

EMAIL = "email"
MESSENGER = "alert_messenger"


@pytest.fixture
async def sessionmaker(migrated_db) -> AsyncIterator:
    try:
        yield get_sessionmaker()
    finally:
        await close_resources()


async def test_one_alert_becomes_two_rows(sessionmaker, fake_redis, monkeypatch) -> None:
    settings = alert_settings(monkeypatch)

    result = await raise_alert(
        sessionmaker,
        fake_redis,
        settings,
        event_type="sla",
        body="Клиент ждёт ответа 10 мин",
        dedup_key="sla:abc:1",
    )

    assert result.sent_rows == 2
    assert result.silenced is False
    assert result.suppressed is False

    rows = await alert_rows(sessionmaker)
    assert len(rows) == 2
    assert [row.transport for row in rows] == [EMAIL, MESSENGER]
    assert all(row.kind is OutboxKind.ALERT for row in rows)
    assert all(row.status is DeliveryStatus.PENDING for row in rows)
    assert all(row.body == "Клиент ждёт ответа 10 мин" for row in rows)
    assert {row.recipient for row in rows} == {TEST_EMAIL, TEST_CHAT_ID}
    # Окно повторов берётся из настроек: сутки строка добивается.
    assert all(row.expires_at > row.created_at for row in rows)


async def test_dedup_keys_of_the_two_rows_differ(sessionmaker, fake_redis, monkeypatch) -> None:
    """🔴 Ключи строк различаются: одинаковый ключ схлопнул бы вторую строку
    дедупом самой outbox, и дубль в мессенджер никогда бы не ушёл."""
    settings = alert_settings(monkeypatch)
    await raise_alert(
        sessionmaker, fake_redis, settings,
        event_type="sla", body="тело", dedup_key="sla:abc:1",
    )

    rows = await alert_rows(sessionmaker)
    keys = [row.dedup_key for row in rows]
    assert len(set(keys)) == 2, keys
    assert all(key.startswith("sla:abc:1") for key in keys), keys


async def test_every_email_address_gets_its_own_row(sessionmaker, fake_redis, monkeypatch) -> None:
    settings = alert_settings(
        monkeypatch, ALERT_EMAIL_TO="one@example.test, two@example.test ,"
    )
    assert settings.alert_email_to_list == ["one@example.test", "two@example.test"]

    result = await raise_alert(
        sessionmaker, fake_redis, settings,
        event_type="hot_lead", body="Новая заявка", dedup_key="hotlead:abc",
    )

    assert result.sent_rows == 3
    rows = await alert_rows(sessionmaker)
    emails = [row.recipient for row in rows if row.transport == EMAIL]
    assert emails == ["one@example.test", "two@example.test"]
    assert [row.recipient for row in rows if row.transport == MESSENGER] == [TEST_CHAT_ID]


async def test_empty_recipients_still_produce_two_rows(sessionmaker, fake_redis, monkeypatch) -> None:
    """Получатели не заполнены — строки всё равно есть, с '-'.
    Событие не должно теряться из-за незаполненной настройки."""
    settings = alert_settings(monkeypatch, ALERT_EMAIL_TO="", ALERT_TELEGRAM_CHAT_ID="")

    result = await raise_alert(
        sessionmaker, fake_redis, settings,
        event_type="llm_down", body="Модель недоступна", dedup_key="llm_down:abc",
    )

    assert result.sent_rows == 2
    rows = await alert_rows(sessionmaker)
    assert [row.transport for row in rows] == [EMAIL, MESSENGER]
    assert [row.recipient for row in rows] == ["-", "-"]


async def test_broken_database_does_not_raise(sessionmaker, fake_redis, monkeypatch) -> None:
    """Сбой записи алерта не подменяет собой исход операции, ради которой
    алерт выпускали: наружу ничего не поднимается, строк ноль."""
    settings = alert_settings(monkeypatch)

    def broken():
        raise RuntimeError("база недоступна")

    result = await raise_alert(
        broken, fake_redis, settings,
        event_type="sla", body="тело", dedup_key="sla:abc:2",
    )
    assert result.sent_rows == 0
