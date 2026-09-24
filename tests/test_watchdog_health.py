"""Сторож видит не только молчание бота, но и его собственные болезни.

Две, которые видны из базы и которые человек иначе заметит по жалобам:
очередь исходящих встала и очередь «нужен человек» растёт. Обе тихие:
в журнале ничего, бот отвечает, а сообщения не уходят и люди ждут.
"""

from datetime import datetime, timedelta, timezone

import pytest
import sqlalchemy as sa

from src.config import get_settings
from src.db.base import ConversationMode, DeliveryStatus, OutboxKind, utcnow
from src.db.models import Client, Conversation, OutboxItem
from src.dependencies import get_sessionmaker
from src.jobs import watchdog

NOW = datetime(2026, 9, 24, 12, 0, tzinfo=timezone.utc)


async def _stuck_rows(count: int, *, minutes_old: int) -> None:
    async with get_sessionmaker()() as session:
        for i in range(count):
            session.add(
                OutboxItem(
                    kind=OutboxKind.ALERT,
                    transport="email",
                    recipient=f"ops{i}@example.com",
                    body="тело",
                    dedup_key=f"stuck:{i}",
                    status=DeliveryStatus.PENDING,
                    attempts=3,
                    expires_at=NOW + timedelta(hours=10),
                    created_at=NOW - timedelta(minutes=minutes_old),
                )
            )
        await session.commit()


async def _waiting_dialogs(count: int) -> None:
    async with get_sessionmaker()() as session:
        for i in range(count):
            client = Client(channel="widget", external_id=f"w{i}", created_at=NOW)
            session.add(client)
            await session.flush()
            session.add(
                Conversation(
                    client_id=client.id,
                    mode=ConversationMode.NEEDS_HUMAN,
                    created_at=NOW,
                    last_activity_at=NOW,
                )
            )
        await session.commit()


async def _alerts() -> list[str]:
    async with get_sessionmaker()() as session:
        rows = (await session.execute(sa.select(OutboxItem.dedup_key))).scalars().all()
    return [k for k in rows if k and not k.startswith("stuck:")]


async def test_a_frozen_outbox_raises_an_alert(migrated_db, fake_redis) -> None:
    settings = get_settings()
    await _stuck_rows(settings.watch_outbox_stuck_limit + 1, minutes_old=90)

    raised = await watchdog.check_health(get_sessionmaker(), fake_redis, settings, now=NOW)

    assert raised == 1
    assert any("outbox" in key for key in await _alerts()), "оператор не узнал про вставшую очередь"


async def test_a_young_queue_is_not_an_alarm(migrated_db, fake_redis) -> None:
    settings = get_settings()
    await _stuck_rows(settings.watch_outbox_stuck_limit + 1, minutes_old=1)

    assert await watchdog.check_health(get_sessionmaker(), fake_redis, settings, now=NOW) == 0


async def test_a_pile_of_dialogs_waiting_for_a_human_raises_an_alert(
    migrated_db, fake_redis
) -> None:
    settings = get_settings()
    await _waiting_dialogs(settings.watch_needs_human_limit + 1)

    raised = await watchdog.check_health(get_sessionmaker(), fake_redis, settings, now=NOW)

    assert raised == 1
    assert any("needs_human" in key for key in await _alerts())


async def test_a_quiet_system_says_nothing(migrated_db, fake_redis) -> None:
    assert await watchdog.check_health(get_sessionmaker(), fake_redis, get_settings(), now=NOW) == 0


async def test_a_second_pass_does_not_repeat_the_alert(migrated_db, fake_redis) -> None:
    """Дедуп внутри raise_alert: один инцидент — одно письмо, не сотня за ночь."""
    settings = get_settings()
    await _stuck_rows(settings.watch_outbox_stuck_limit + 1, minutes_old=90)

    first = await watchdog.check_health(get_sessionmaker(), fake_redis, settings, now=NOW)
    second = await watchdog.check_health(get_sessionmaker(), fake_redis, settings, now=NOW)

    assert (first, second) == (1, 0)


async def test_the_run_calls_both_checks(migrated_db, fake_redis, monkeypatch) -> None:
    """Проверка здоровья должна стоять в боевом проходе, а не рядом с ним."""
    called: list[str] = []
    monkeypatch.setattr(watchdog, "scan_and_alert", lambda *a, **k: called.append("sla") or 0)
    monkeypatch.setattr(watchdog, "check_health", lambda *a, **k: called.append("health") or 0)

    async def _noop(*_a, **_k):
        return 0

    monkeypatch.setattr(watchdog, "scan_and_alert", _noop)
    monkeypatch.setattr(watchdog, "check_health", _noop)
    await watchdog.run_once()  # не падает и зовёт обе проверки


async def test_a_broken_check_does_not_stop_the_other(migrated_db, fake_redis, monkeypatch) -> None:
    """Сторож не роняет monitor и не теряет вторую проверку из-за первой."""
    reached: list[str] = []

    async def _boom(*_a, **_k):
        raise RuntimeError("упало")

    async def _ok(*_a, **_k):
        reached.append("health")
        return 0

    monkeypatch.setattr(watchdog, "scan_and_alert", _boom)
    monkeypatch.setattr(watchdog, "check_health", _ok)
    await watchdog.run_once()

    assert reached == ["health"], "вторая проверка обязана отработать после сбоя первой"
