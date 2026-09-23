"""Шаг 8а: предел на ВИД события — второй рубеж поверх дедупа.

🔴 Одного дедупа мало. Ключ вида 'llm_down:{диалог}' у каждого диалога свой,
дедуп его не схлопывает — и массовый отказ модели даёт шторм: на живом
прогоне 334 сообщения за две минуты. Второй рубеж считает по ВИДУ события.

⚠️ Одно сообщение о том, что поток подавлен, обязательно: молчаливое
подавление неотличимо от «всё спокойно», и инцидент находят по пропавшим
лидам, а не по алерту.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator

import pytest

from src.alerts.dedup import flood_check
from src.alerts.raise_alert import raise_alert
from src.dependencies import close_resources, get_sessionmaker
from tests.alert_fakes import alert_rows, alert_settings

LIMIT = 10


@pytest.fixture
async def sessionmaker(migrated_db) -> AsyncIterator:
    try:
        yield get_sessionmaker()
    finally:
        await close_resources()


async def _raise(sessionmaker, redis, settings, *, event_type: str, key: str, body: str = "тело"):
    return await raise_alert(
        sessionmaker, redis, settings, event_type=event_type, body=body, dedup_key=key
    )


async def test_alerts_up_to_the_limit_pass(sessionmaker, fake_redis, monkeypatch) -> None:
    settings = alert_settings(monkeypatch, ALERT_RATE_LIMIT_PER_HOUR=str(LIMIT))

    for n in range(LIMIT):
        result = await _raise(
            sessionmaker, fake_redis, settings, event_type="llm_down", key=f"llm_down:{n}"
        )
        assert result.suppressed is False, n
        assert result.sent_rows == 2, n

    assert len(await alert_rows(sessionmaker)) == LIMIT * 2


async def test_first_over_the_limit_says_it_is_suppressed(sessionmaker, fake_redis, monkeypatch) -> None:
    settings = alert_settings(monkeypatch, ALERT_RATE_LIMIT_PER_HOUR=str(LIMIT))
    for n in range(LIMIT):
        await _raise(sessionmaker, fake_redis, settings, event_type="llm_down", key=f"llm_down:{n}")

    over = await _raise(
        sessionmaker, fake_redis, settings, event_type="llm_down", key=f"llm_down:{LIMIT}"
    )

    assert over.sent_rows == 2
    rows = await alert_rows(sessionmaker)
    assert len(rows) == (LIMIT + 1) * 2
    body = rows[-1].body
    assert "подавлен" in body, body
    assert "llm_down" in body, body


async def test_further_alerts_of_the_same_type_write_nothing(sessionmaker, fake_redis, monkeypatch) -> None:
    settings = alert_settings(monkeypatch, ALERT_RATE_LIMIT_PER_HOUR=str(LIMIT))
    for n in range(LIMIT + 1):
        await _raise(sessionmaker, fake_redis, settings, event_type="llm_down", key=f"llm_down:{n}")
    before = len(await alert_rows(sessionmaker))

    for n in (LIMIT + 1, LIMIT + 2):
        result = await _raise(
            sessionmaker, fake_redis, settings, event_type="llm_down", key=f"llm_down:{n}"
        )
        assert result.suppressed is True, n
        assert result.sent_rows == 0, n

    assert len(await alert_rows(sessionmaker)) == before


async def test_another_event_type_is_not_touched(sessionmaker, fake_redis, monkeypatch) -> None:
    """Предел считается по виду: захлебнувшийся llm_down не должен глушить
    горячий лид — иначе шторм одного вида съедает алерты всех остальных."""
    settings = alert_settings(monkeypatch, ALERT_RATE_LIMIT_PER_HOUR=str(LIMIT))
    for n in range(LIMIT + 5):
        await _raise(sessionmaker, fake_redis, settings, event_type="llm_down", key=f"llm_down:{n}")

    hot = await _raise(
        sessionmaker, fake_redis, settings, event_type="hot_lead", key="hotlead:abc"
    )
    assert hot.suppressed is False
    assert hot.sent_rows == 2


async def test_kit_incident_334_alerts(sessionmaker, fake_redis, monkeypatch) -> None:
    """🔴 Сценарий кита: 334 отказа модели в разных диалогах за две минуты.

    Ключи все разные, дедуп молчит — ловит только предел на вид события.
    Строк должно быть не больше (limit + 1) * 2: предел плюс одно сообщение
    «поток подавлен», и каждое из них двумя строками.
    """
    settings = alert_settings(monkeypatch, ALERT_RATE_LIMIT_PER_HOUR=str(LIMIT))

    for _ in range(334):
        await _raise(
            sessionmaker,
            fake_redis,
            settings,
            event_type="llm_down",
            key=f"llm_down:{uuid.uuid4()}",
        )

    rows = await alert_rows(sessionmaker)
    assert len(rows) <= (LIMIT + 1) * 2, f"шторм прорвался: {len(rows)} строк"
    assert len(rows) == (LIMIT + 1) * 2
    assert "подавлен" in rows[-1].body


async def test_flood_check_counts_and_marks_the_first_suppressed(fake_redis) -> None:
    verdicts = [await flood_check(fake_redis, "sla", limit=3) for _ in range(5)]

    assert [v.allowed for v in verdicts] == [True, True, True, False, False]
    assert [v.count for v in verdicts] == [1, 2, 3, 4, 5]
    # first_suppressed ровно один раз: на нём выпускается сообщение о потоке.
    assert [v.first_suppressed for v in verdicts] == [False, False, False, True, False]


async def test_flood_window_has_a_ttl(fake_redis) -> None:
    """Счётчик живёт час и сам обнуляется: без TTL предел сработал бы один раз
    за всю жизнь Redis и алерты замолчали бы навсегда."""
    await flood_check(fake_redis, "sla", limit=3, window_seconds=3600)
    ttl = await fake_redis.ttl("alerts:flood:sla")
    assert 0 < ttl <= 3600


async def test_counter_without_ttl_gets_its_window_back(fake_redis) -> None:
    """🔴 Счётчик без TTL — это подавление НАВСЕГДА, молча.

    INCR и EXPIRE двумя операциями: обрыв между ними (или ключ, заведённый
    любым другим путём) оставляет счётчик вечным, и после предела алерты
    этого вида замолкают до тех пор, пока кто-нибудь не зайдёт в Redis руками.
    """
    key = "alerts:flood:llm_down"
    await fake_redis.set(key, "50")
    assert await fake_redis.ttl(key) < 0, "ключ должен быть без окна"

    verdict = await flood_check(fake_redis, "llm_down", limit=LIMIT, window_seconds=3600)

    assert verdict.allowed is False
    assert 0 < await fake_redis.ttl(key) <= 3600, "окно счётчику не вернули"
