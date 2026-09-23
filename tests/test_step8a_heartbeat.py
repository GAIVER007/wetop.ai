"""Шаг 8а: раз в сутки в оба канала уходит тестовое сообщение.

Молчание канала неотличимо от покоя: пока алертов нет, вы не знаете,
работает ли доставка. Heartbeat превращает это в проверяемый факт.
Час передаётся явно: тест не должен зависеть от времени суток.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import datetime, timedelta, timezone

import pytest

from src import dependencies
from src.dependencies import close_resources, get_sessionmaker
from src.jobs import heartbeat
from tests.alert_fakes import alert_rows, alert_settings

HOUR = 9
AT_HOUR = datetime(2026, 9, 23, HOUR, 5, tzinfo=timezone.utc)
OTHER_HOUR = datetime(2026, 9, 23, HOUR + 3, 5, tzinfo=timezone.utc)


@pytest.fixture
async def sessionmaker(migrated_db) -> AsyncIterator:
    try:
        yield get_sessionmaker()
    finally:
        await close_resources()


def _wire(monkeypatch, *, sessionmaker, redis, settings) -> None:
    """Подмена там, где задача РЕАЛЬНО берёт имя: heartbeat зовёт
    dependencies.get_redis() через модуль, а get_settings импортирован в него.
    Подмена на самом heartbeat с raising=False создала бы новый атрибут,
    задача его не увидела бы, и тест был бы зелёным по ложной причине."""
    monkeypatch.setattr(dependencies, "get_sessionmaker", lambda: sessionmaker)
    monkeypatch.setattr(dependencies, "get_redis", lambda: redis)
    monkeypatch.setattr(heartbeat, "get_settings", lambda: settings)


@pytest.fixture
def wired(sessionmaker, fake_redis, monkeypatch):
    """Задача берёт ресурсы сама: подменяем их на тестовые."""
    settings = alert_settings(
        monkeypatch, ALERT_HEARTBEAT_ENABLED="true", ALERT_HEARTBEAT_HOUR=str(HOUR)
    )
    _wire(monkeypatch, sessionmaker=sessionmaker, redis=fake_redis, settings=settings)
    return settings


async def test_at_the_hour_the_alert_goes_out(wired, sessionmaker) -> None:
    await heartbeat.run_once(now=AT_HOUR)

    rows = await alert_rows(sessionmaker)
    assert len(rows) == 2, "проверка канала уходит обоими каналами"
    assert "2026-09-23" in (rows[0].dedup_key or "")
    assert "тестовое" in rows[0].body


async def test_second_call_the_same_day_does_nothing(wired, sessionmaker) -> None:
    """Иначе тестовое сообщение уходило бы каждую минуту этого часа."""
    await heartbeat.run_once(now=AT_HOUR)
    await heartbeat.run_once(now=AT_HOUR + timedelta(minutes=10))

    assert len(await alert_rows(sessionmaker)) == 2


async def test_next_day_goes_out_again(wired, sessionmaker) -> None:
    await heartbeat.run_once(now=AT_HOUR)
    await heartbeat.run_once(now=AT_HOUR + timedelta(days=1))

    assert len(await alert_rows(sessionmaker)) == 4


async def test_wrong_hour_does_nothing(wired, sessionmaker) -> None:
    await heartbeat.run_once(now=OTHER_HOUR)
    assert await alert_rows(sessionmaker) == []


async def test_disabled_by_setting_does_nothing(
    sessionmaker, fake_redis, monkeypatch
) -> None:
    settings = alert_settings(
        monkeypatch, ALERT_HEARTBEAT_ENABLED="false", ALERT_HEARTBEAT_HOUR=str(HOUR)
    )
    _wire(monkeypatch, sessionmaker=sessionmaker, redis=fake_redis, settings=settings)

    await heartbeat.run_once(now=AT_HOUR)
    assert await alert_rows(sessionmaker) == []


async def test_heartbeat_is_forced_past_dedup(wired, sessionmaker, fake_redis) -> None:
    """🔴 force=True: проверка канала не должна глушиться дедупом, иначе
    проверяющий механизм сам себя и выключит."""
    date = AT_HOUR.strftime("%Y-%m-%d")
    await fake_redis.set(f"alert:seen:heartbeat:{date}", "1")

    await heartbeat.run_once(now=AT_HOUR)

    assert len(await alert_rows(sessionmaker)) == 2


async def test_broken_redis_does_not_raise(wired, sessionmaker, monkeypatch) -> None:
    """Фоновая задача не роняет процесс monitor.

    Отметка дня не поставилась — проверка в этот проход не уходит; главное,
    что исключение не вышло наружу и monitor остался жив.
    """

    class BrokenRedis:
        async def set(self, *args, **kwargs):
            raise RuntimeError("redis недоступен")

        async def get(self, *args, **kwargs):
            raise RuntimeError("redis недоступен")

        async def incr(self, *args, **kwargs):
            raise RuntimeError("redis недоступен")

    monkeypatch.setattr(dependencies, "get_redis", lambda: BrokenRedis())

    await heartbeat.run_once(now=AT_HOUR)

    assert await alert_rows(sessionmaker) == [], "на сломанном Redis строк быть не должно"
