"""Шаг 8а: окно молчания на ключ алерта.

🔴 Без дедупа один инцидент даёт сотни писем за ночь, и владелец
перестаёт их читать ровно к тому моменту, когда придёт важное.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest

from src.alerts.dedup import silenced, window_for
from src.alerts.raise_alert import raise_alert
from src.dependencies import close_resources, get_sessionmaker
from tests.alert_fakes import alert_rows, alert_settings


@pytest.fixture
async def sessionmaker(migrated_db) -> AsyncIterator:
    try:
        yield get_sessionmaker()
    finally:
        await close_resources()


async def test_second_alert_with_same_key_is_silenced(sessionmaker, fake_redis, monkeypatch) -> None:
    settings = alert_settings(monkeypatch)
    first = await raise_alert(
        sessionmaker, fake_redis, settings,
        event_type="sla", body="тело", dedup_key="sla:abc:1",
    )
    second = await raise_alert(
        sessionmaker, fake_redis, settings,
        event_type="sla", body="тело", dedup_key="sla:abc:1",
    )

    assert first.silenced is False and first.sent_rows == 2
    assert second.silenced is True and second.sent_rows == 0
    assert len(await alert_rows(sessionmaker)) == 2


async def test_different_keys_are_not_silenced(sessionmaker, fake_redis, monkeypatch) -> None:
    settings = alert_settings(monkeypatch)
    for suffix in ("1", "2"):
        await raise_alert(
            sessionmaker, fake_redis, settings,
            event_type="sla", body="тело", dedup_key=f"sla:abc:{suffix}",
        )
    assert len(await alert_rows(sessionmaker)) == 4


async def test_force_writes_even_inside_the_window(sessionmaker, fake_redis, monkeypatch) -> None:
    """force=True для проверки канала: heartbeat не должен глушиться дедупом,
    иначе молчание канала неотличимо от покоя."""
    settings = alert_settings(monkeypatch)
    await raise_alert(
        sessionmaker, fake_redis, settings,
        event_type="heartbeat", body="проверка", dedup_key="heartbeat:2026-09-23", force=True,
    )
    again = await raise_alert(
        sessionmaker, fake_redis, settings,
        event_type="heartbeat", body="проверка", dedup_key="heartbeat:2026-09-23", force=True,
    )

    assert again.silenced is False
    assert again.sent_rows == 2
    assert len(await alert_rows(sessionmaker)) == 4


async def test_window_for_takes_its_number_from_the_right_setting(monkeypatch) -> None:
    """У срока ответа и горячего лида окна разные: минуты против суток."""
    settings = alert_settings(
        monkeypatch, ALERT_DEDUP_SLA_MINUTES="7", ALERT_DEDUP_HOT_LEAD_HOURS="3"
    )
    assert window_for("sla", settings) == 7 * 60
    assert window_for("hot_lead", settings) == 3 * 3600
    # Незнакомый вид не остаётся без окна: разумное умолчание — окно срока.
    assert window_for("llm_down", settings) == 7 * 60


async def test_silenced_marks_the_key_once(fake_redis) -> None:
    assert await silenced(fake_redis, "alert:seen:x", 60) is False
    assert await silenced(fake_redis, "alert:seen:x", 60) is True
    assert await silenced(fake_redis, "alert:seen:y", 60) is False


async def test_window_expires(fake_redis) -> None:
    """Окно кончилось — тот же инцидент снова слышно. Проверяем сроком жизни
    ключа: ждать секунды в тесте нельзя, тест не должен зависеть от часов."""
    await silenced(fake_redis, "alert:seen:z", 600)
    ttl = await fake_redis.ttl("alert:seen:z")
    assert 0 < ttl <= 600


async def test_failed_write_does_not_burn_the_silence_key(
    sessionmaker, fake_redis, monkeypatch
) -> None:
    """🔴 Отметка молчания принадлежит ВЫПУЩЕННОМУ алерту, а не попытке.

    Секундный обрыв базы ставил ключ и возвращал ноль строк: следующий проход
    видел «уже отправляли» и молчал всё окно — для горячего лида это сутки.
    Так теряется ровно тот алерт, ради которого всё и строилось.
    """
    settings = alert_settings(monkeypatch)

    def broken():
        raise RuntimeError("база недоступна")

    first = await raise_alert(
        broken, fake_redis, settings,
        event_type="hot_lead", body="тело", dedup_key="hotlead:abc",
    )
    second = await raise_alert(
        sessionmaker, fake_redis, settings,
        event_type="hot_lead", body="тело", dedup_key="hotlead:abc",
    )

    assert first.sent_rows == 0
    assert second.sent_rows == 2, "инцидент замолчал из-за неудачной попытки"
    assert len(await alert_rows(sessionmaker)) == 2


async def test_suppressed_alert_does_not_burn_the_silence_key(
    sessionmaker, fake_redis, monkeypatch
) -> None:
    """Подавленный потоком алерт не выпускался — и окно молчания на него
    ставить не за что: иначе после конца часа инцидент так и не прозвучит."""
    settings = alert_settings(monkeypatch, ALERT_RATE_LIMIT_PER_HOUR="10")
    # Счётчик вида уже за пределом: следующий алерт молча подавляется.
    await fake_redis.set("alerts:flood:llm_down", "50", ex=3600)

    suppressed = await raise_alert(
        sessionmaker, fake_redis, settings,
        event_type="llm_down", body="тело", dedup_key="llm_down:abc",
    )
    # Час кончился, счётчик обнулился — инцидент должен прозвучать.
    await fake_redis.delete("alerts:flood:llm_down")
    after = await raise_alert(
        sessionmaker, fake_redis, settings,
        event_type="llm_down", body="тело", dedup_key="llm_down:abc",
    )

    assert suppressed.suppressed is True and suppressed.sent_rows == 0
    assert after.sent_rows == 2
