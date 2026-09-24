"""Шаг 8а: сторож сроков ответа.

Находит диалоги, где приняли и не ответили дольше срока, и выпускает алерт.
🔴 Весь отбор в SQL. Выборка всех диалогов с фильтрацией в Python работает
на демо и ложится на боевой базе — а выглядит при этом здоровой.
🔴 Сторож, а не health-check: он только сообщает, ничего не перезапускает.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Iterator
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import event

from src import dependencies
from src.db.base import ConversationMode
from src.dependencies import close_resources, get_engine, get_sessionmaker
from src.jobs import watchdog
from src.sla_alerts import StaleTurn, find_stale, scan_and_alert
from tests.alert_fakes import alert_rows, alert_settings, seed_turn

NOW = datetime(2026, 9, 23, 12, 0, tzinfo=timezone.utc)
SLA = 300


@pytest.fixture
async def sessionmaker(migrated_db) -> AsyncIterator:
    try:
        yield get_sessionmaker()
    finally:
        await close_resources()


async def _stale(sessionmaker, *, limit: int = 100) -> list[StaleTurn]:
    async with sessionmaker() as session:
        return await find_stale(session, sla_seconds=SLA, now=NOW, limit=limit)


@contextmanager
def _count_selects() -> Iterator[list[str]]:
    """Считает SELECT'ы, ушедшие в базу: по их числу видно, отобрали в SQL
    или вытащили всё и разобрались в Python."""
    statements: list[str] = []
    engine = get_engine().sync_engine

    def _on(conn, cursor, statement, parameters, context, executemany) -> None:
        if statement.lstrip().lower().startswith("select"):
            statements.append(statement)

    event.listen(engine, "before_cursor_execute", _on)
    try:
        yield statements
    finally:
        event.remove(engine, "before_cursor_execute", _on)


async def test_unanswered_client_message_is_found(sessionmaker) -> None:
    conversation_id = await seed_turn(
        sessionmaker, external_id="3001", waited_seconds=600, now=NOW
    )

    found = await _stale(sessionmaker)

    assert [turn.conversation_id for turn in found] == [conversation_id]
    assert found[0].waiting_seconds >= 600
    assert found[0].channel == "telegram"


async def test_fresh_message_is_not_found(sessionmaker) -> None:
    await seed_turn(sessionmaker, external_id="3002", waited_seconds=60, now=NOW)
    assert await _stale(sessionmaker) == []


async def test_answered_conversation_is_not_found(sessionmaker) -> None:
    """Ответ ассистента ПОЗЖЕ вопроса снимает диалог со сторожа."""
    await seed_turn(
        sessionmaker, external_id="3003", waited_seconds=600, now=NOW, answered=True
    )
    assert await _stale(sessionmaker) == []


async def test_owner_takeover_is_not_found(sessionmaker) -> None:
    """Человек вошёл в диалог — сторож молчит: иначе оператор получает алерт
    о диалоге, который прямо сейчас ведёт сам."""
    await seed_turn(
        sessionmaker,
        external_id="3004",
        waited_seconds=600,
        now=NOW,
        mode=ConversationMode.OWNER_TAKEOVER,
    )
    assert await _stale(sessionmaker) == []


async def test_closed_conversation_is_not_found(sessionmaker) -> None:
    await seed_turn(
        sessionmaker, external_id="3005", waited_seconds=600, now=NOW, is_active=False
    )
    assert await _stale(sessionmaker) == []


async def test_limit_is_applied_in_sql(sessionmaker) -> None:
    """🔴 200 просроченных диалогов, limit=10 — возвращается ровно 10.

    Если бы отбор шёл в Python после ограничения выборки, предел пришлось бы
    ставить до фильтрации, и с ростом базы сторож начал бы возвращать пусто,
    оставаясь зелёным на трёх диалогах.
    """
    for n in range(200):
        await seed_turn(
            sessionmaker, external_id=f"4{n:03d}", waited_seconds=600 + n, now=NOW
        )

    with _count_selects() as selects:
        found = await _stale(sessionmaker, limit=10)

    assert len(found) == 10
    assert len({turn.conversation_id for turn in found}) == 10
    # Один SELECT на весь отбор: запрос на диалог — это и есть «выбрали всё,
    # а разбираемся в Python», только дороже.
    assert len(selects) == 1, f"отбор ушёл в {len(selects)} запросов"
    assert "limit" in selects[0].lower(), selects[0]


async def test_scan_and_alert_raises_one_alert(sessionmaker, fake_redis, monkeypatch) -> None:
    settings = alert_settings(monkeypatch, SLA_SECONDS=str(SLA))
    conversation_id = await seed_turn(
        sessionmaker, external_id="3006", waited_seconds=600, now=NOW
    )

    sent = await scan_and_alert(sessionmaker, fake_redis, settings, now=NOW)

    assert sent == 1
    rows = await alert_rows(sessionmaker)
    assert len(rows) == 2
    assert str(conversation_id) in rows[0].body
    assert "telegram" in rows[0].body


async def test_second_pass_inside_the_window_adds_nothing(
    sessionmaker, fake_redis, monkeypatch
) -> None:
    """Проверка кита: алерт не дублируется при повторном проходе.
    Сторож ходит раз в минуту, а окно молчания — десять."""
    settings = alert_settings(monkeypatch, SLA_SECONDS=str(SLA), ALERT_DEDUP_SLA_MINUTES="10")
    await seed_turn(sessionmaker, external_id="3007", waited_seconds=600, now=NOW)

    first = await scan_and_alert(sessionmaker, fake_redis, settings, now=NOW)
    second = await scan_and_alert(
        sessionmaker, fake_redis, settings, now=NOW + timedelta(seconds=60)
    )

    assert first == 1
    assert second == 0
    assert len(await alert_rows(sessionmaker)) == 2


async def test_fresh_violation_is_not_starved_by_old_ones(sessionmaker) -> None:
    """🔴 Стоп-правило: записи с самым старым ключом сортировки не должны
    занимать выборку навсегда.

    Диалог, оставшийся без ответа насовсем (типичный хвост после отказа
    модели), попадал в голову выборки на каждом проходе. Как только таких
    станет больше предела, свежие нарушения срока не увидят никогда,
    а сторож останется зелёным на тесте с одним диалогом.
    """
    for n in range(200):
        await seed_turn(
            sessionmaker, external_id=f"5{n:03d}", waited_seconds=3 * 24 * 3600 + n, now=NOW
        )
    fresh = await seed_turn(sessionmaker, external_id="5999", waited_seconds=600, now=NOW)

    found = await _stale(sessionmaker, limit=10)

    ids = {turn.conversation_id for turn in found}
    assert fresh in ids, "свежий клиент не попал в выборку"


async def test_older_violations_do_not_push_out_the_freshest(sessionmaker) -> None:
    """Просроченных больше предела — свежайший всё равно в выборке:
    порядок от новых к старым, а не наоборот."""
    for n in range(200):
        await seed_turn(
            sessionmaker, external_id=f"8{n:03d}", waited_seconds=3600 + n, now=NOW
        )
    fresh = await seed_turn(sessionmaker, external_id="8999", waited_seconds=310, now=NOW)

    found = await _stale(sessionmaker, limit=10)

    assert len(found) == 10
    assert fresh in {turn.conversation_id for turn in found}


async def test_scan_opens_its_own_session(sessionmaker, fake_redis, monkeypatch) -> None:
    """🔴 Фоновая задача открывает свою сессию: сессия запроса закроется
    вместе с ним, и запись потеряется без единой ошибки в журнале."""
    settings = alert_settings(monkeypatch, SLA_SECONDS=str(SLA))
    await seed_turn(sessionmaker, external_id="3008", waited_seconds=600, now=NOW)
    opened = 0

    def factory():
        nonlocal opened
        opened += 1
        return sessionmaker()

    sent = await scan_and_alert(factory, fake_redis, settings, now=NOW)

    assert sent == 1
    assert opened >= 1, "задача не открыла ни одной своей сессии"


async def test_query_count_does_not_grow_with_the_number_of_conversations(
    sessionmaker,
) -> None:
    """Число запросов не зависит от размера базы: иначе отбор идёт в Python."""
    for n in range(10):
        await seed_turn(sessionmaker, external_id=f"6{n:03d}", waited_seconds=600, now=NOW)
    with _count_selects() as small:
        await _stale(sessionmaker, limit=10)

    for n in range(190):
        await seed_turn(sessionmaker, external_id=f"7{n:03d}", waited_seconds=600, now=NOW)
    with _count_selects() as big:
        await _stale(sessionmaker, limit=10)

    assert len(small) == len(big) == 1, f"{len(small)} и {len(big)} запросов"


async def test_dedup_key_survives_a_pass_on_the_minute_edge(
    sessionmaker, fake_redis, monkeypatch
) -> None:
    """🔴 Ключ строится из настоящего времени вопроса, а не из разности
    «сейчас минус сколько ждут»: разность усечена до секунды, и вопрос,
    попавший в конец 59-й секунды, на соседних проходах давал то ту минуту,
    то следующую — два ключа на один инцидент и второй алерт в окне молчания.
    """
    settings = alert_settings(monkeypatch, SLA_SECONDS=str(SLA), ALERT_DEDUP_SLA_MINUTES="10")
    first_pass = datetime(2026, 9, 23, 12, 0, 0, 700000, tzinfo=timezone.utc)
    asked_at = datetime(2026, 9, 23, 11, 50, 59, 200000, tzinfo=timezone.utc)
    await seed_turn(
        sessionmaker,
        external_id="3009",
        waited_seconds=(first_pass - asked_at).total_seconds(),
        now=first_pass,
    )

    first = await scan_and_alert(sessionmaker, fake_redis, settings, now=first_pass)
    second = await scan_and_alert(
        sessionmaker, fake_redis, settings, now=first_pass + timedelta(seconds=60, milliseconds=-600)
    )

    assert first == 1
    assert second == 0, "повторный проход выпустил второй алерт на тот же инцидент"
    assert len(await alert_rows(sessionmaker)) == 2


# ─── Фоновая задача ───


async def test_run_once_raises_the_alert(sessionmaker, fake_redis, monkeypatch) -> None:
    """Боевая точка входа сторожа: её ставит default_jobs, и ошибка в порядке
    аргументов всплыла бы при старте monitor, а не в наборе."""
    settings = alert_settings(monkeypatch, SLA_SECONDS=str(SLA))
    monkeypatch.setattr(dependencies, "get_sessionmaker", lambda: sessionmaker)
    monkeypatch.setattr(dependencies, "get_redis", lambda: fake_redis)
    monkeypatch.setattr(watchdog, "get_settings", lambda: settings)
    # Без now: задача берёт своё время сама, и посев должен быть от него же.
    await seed_turn(sessionmaker, external_id="3010", waited_seconds=600)

    await watchdog.run_once()

    assert len(await alert_rows(sessionmaker)) == 2


async def test_run_once_does_not_raise(monkeypatch) -> None:
    """Фоновая задача не роняет процесс monitor: упал проход — упал проход."""

    def boom():
        raise RuntimeError("ресурсы недоступны")

    monkeypatch.setattr(dependencies, "get_sessionmaker", boom)

    await watchdog.run_once()
