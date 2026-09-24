"""Два решения, которые принимает владелец, а не код.

Первое: сколько времени сторож ещё считает молчание нарушением срока.
Число в коде прячет политику: после простоя дольше этого окна клиенты,
которым не ответили, исчезают из виду молча.

Второе: личный адрес владельца для алертов. Образец настроек его обещает,
и обещание должно работать: группа дежурных спит, владелец — нет.
"""

from datetime import datetime, timedelta, timezone

import pytest
import sqlalchemy as sa

from src.alerts.raise_alert import raise_alert
from src.config import Settings, get_settings
from src.db.base import MessageRole, utcnow
from src.db.models import Client, Conversation, Message, OutboxItem
from src.dependencies import get_sessionmaker
from src.sla_alerts import find_stale


def test_watchdog_lookback_is_a_setting_not_a_constant() -> None:
    assert "sla_lookback_hours" in Settings.model_fields, (
        "срок, после которого сторож перестаёт видеть диалог, — решение владельца"
    )


async def _ask(session, minutes_ago: int, now: datetime) -> Conversation:
    client = Client(channel="demo", external_id=f"c{minutes_ago}", created_at=now)
    session.add(client)
    await session.flush()
    conv = Conversation(client_id=client.id, created_at=now, last_activity_at=now)
    session.add(conv)
    await session.flush()
    session.add(
        Message(
            conversation_id=conv.id,
            role=MessageRole.USER,
            content="есть места?",
            created_at=now - timedelta(minutes=minutes_ago),
        )
    )
    await session.commit()
    return conv


async def test_lookback_setting_changes_what_the_watchdog_sees(
    migrated_db, monkeypatch: pytest.MonkeyPatch
) -> None:
    now = datetime(2026, 9, 23, 12, 0, tzinfo=timezone.utc)
    sessionmaker = get_sessionmaker()
    async with sessionmaker() as session:
        old = await _ask(session, minutes_ago=48 * 60, now=now)

    monkeypatch.setenv("SLA_LOOKBACK_HOURS", "72")
    get_settings.cache_clear()
    async with sessionmaker() as session:
        found = await find_stale(
            session, sla_seconds=300, now=now, lookback_hours=get_settings().sla_lookback_hours
        )
    assert [t.conversation_id for t in found] == [old.id], (
        "с окном в трое суток вчерашний неотвеченный клиент обязан быть виден"
    )

    async with sessionmaker() as session:
        found = await find_stale(session, sla_seconds=300, now=now, lookback_hours=24)
    assert found == [], "с окном в сутки он выпадает — это и есть политика, которой управляет владелец"


async def test_personal_chat_gets_its_own_alert_row(
    migrated_db, fake_redis, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("ALERT_TELEGRAM_CHAT_ID", "-100500")
    monkeypatch.setenv("ALERT_TELEGRAM_CHAT_ID_PERSONAL", "770077")
    monkeypatch.setenv("ALERT_EMAIL_TO", "")
    get_settings.cache_clear()
    settings = get_settings()

    await raise_alert(
        get_sessionmaker(),
        fake_redis,
        settings,
        event_type="sla",
        body="Клиент ждёт ответа 10 мин",
        dedup_key="sla:личный-адрес",
    )

    async with get_sessionmaker()() as session:
        rows = (await session.execute(sa.select(OutboxItem))).scalars().all()
    recipients = {r.recipient for r in rows if r.transport == "alert_messenger"}
    assert recipients == {"-100500", "770077"}, (
        "личный адрес владельца обещан в образце настроек и обязан получать алерт"
    )
    assert len({r.dedup_key for r in rows}) == len(rows), "ключи строк не должны совпадать"
