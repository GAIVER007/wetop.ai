"""Инструмент my_recent_errors: происшествия ТОЛЬКО этого пользователя.

🔴 Главное свойство: поиск идёт по идентификатору и организации из
ПОДПИСАННОГО признака. Аноним не получает из журнала платформы ничего —
неподписанный признак подставляется в теге script за десять секунд.

🔴 И второе: недоступный журнал — признак «не знаю», а не исключение
и не пустой список. Пустой список означал бы «у вас всё чисто», то есть
неотличим от незнания.
"""

from __future__ import annotations

import dataclasses
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from src.ai.support_tools import UNKNOWN, build_registry
from src.db.base import utcnow
from tests.support_fakes import (
    ORG_ID,
    SAMPLE_CATALOG,
    USER_ID,
    FakeIncidents,
    anon_visitor,
    call_tool,
    incident,
    signed_visitor,
    support_providers,
    support_settings,
    write_catalog,
)

TOOL = "my_recent_errors"


@pytest.fixture(autouse=True)
def clean_catalog_cache():
    from src.knowledge.catalog import reset_catalog_cache

    reset_catalog_cache()
    yield
    reset_catalog_cache()


def registry_for(tmp_path: Path, *, visitor=None, incidents=None, **overrides):
    settings = support_settings(catalog=write_catalog(tmp_path, SAMPLE_CATALOG), **overrides)
    providers = support_providers(incidents=incidents)
    return build_registry(
        lambda: providers,
        settings_getter=lambda: settings,
        visitor_getter=lambda: visitor,
    )


# ─── Аноним ───


async def test_anonymous_gets_nothing_from_the_platform_log(tmp_path: Path) -> None:
    """🔴 Без подписи журнал платформы не показывается вовсе."""
    provider = FakeIncidents(items=[incident()])
    registry = registry_for(tmp_path, visitor=anon_visitor(), incidents=provider)
    answer = await call_tool(registry, TOOL)
    assert "не вошли" in answer.lower()
    assert provider.calls == [], "к журналу пошли за анонима"


async def test_no_visitor_at_all_is_the_same(tmp_path: Path) -> None:
    """Инструмент вызвали вне хода (посетителя нет) — ответ тот же, и в журнал
    платформы никто не ходит."""
    provider = FakeIncidents(items=[incident()])
    registry = registry_for(tmp_path, visitor=None, incidents=provider)
    answer = await call_tool(registry, TOOL)
    assert "не вошли" in answer.lower()
    assert provider.calls == []


async def test_signed_visitor_without_user_id_is_not_trusted(tmp_path: Path) -> None:
    """Признак без идентификатора — не пропуск в журнал: иначе запрос уйдёт
    с user_id=None и вернёт происшествия всех подряд."""
    provider = FakeIncidents(items=[incident()])
    visitor = dataclasses.replace(signed_visitor(), user_id=None)
    registry = registry_for(tmp_path, visitor=visitor, incidents=provider)
    await call_tool(registry, TOOL)
    assert provider.args_of("recent_for_user") == [], (
        "запрос ушёл в журнал с user_id=None: проверка в my_recent_errors должна "
        "требовать не только signed, но и непустой user_id"
    )


# ─── Свой пользователь ───


async def test_search_goes_by_this_user_and_org(tmp_path: Path) -> None:
    """🔴 Доказательство изоляции: в провайдер ушли ИМЕННО его user_id и org_id."""
    provider = FakeIncidents(items=[incident(summary="не сохранилась бронь", section="Брони")])
    registry = registry_for(tmp_path, visitor=signed_visitor(), incidents=provider)
    await call_tool(registry, TOOL)
    arguments = provider.args_of("recent_for_user")
    assert len(arguments) == 1, "журнал спросили не один раз"
    assert arguments[0]["user_id"] == USER_ID
    assert arguments[0]["org_id"] == ORG_ID


async def test_personal_log_is_not_a_global_search(tmp_path: Path) -> None:
    """Общий поиск по журналу — это чужие происшествия. Здесь его быть не должно."""
    provider = FakeIncidents(items=[incident()])
    registry = registry_for(tmp_path, visitor=signed_visitor(), incidents=provider)
    await call_tool(registry, TOOL)
    assert provider.count("search") == 0


async def test_answer_has_section_and_summary(tmp_path: Path) -> None:
    provider = FakeIncidents(items=[incident(summary="не сохранилась бронь", section="Брони")])
    registry = registry_for(tmp_path, visitor=signed_visitor(), incidents=provider)
    answer = await call_tool(registry, TOOL)
    assert "не сохранилась бронь" in answer
    assert "Брони" in answer
    assert answer != UNKNOWN


async def test_window_comes_from_settings(tmp_path: Path) -> None:
    """Окно — настройка владельца, а не константа в коде."""
    provider = FakeIncidents(items=[incident()])
    registry = registry_for(
        tmp_path, visitor=signed_visitor(), incidents=provider, support_incident_window_hours=3
    )
    await call_tool(registry, TOOL)
    since = provider.args_of("recent_for_user")[0]["since"]
    assert isinstance(since, datetime) and since.tzinfo is not None, "время без зоны"
    expected = utcnow() - timedelta(hours=3)
    assert abs((since - expected).total_seconds()) < 120
    assert since < datetime.now(timezone.utc)


async def test_limit_comes_from_settings(tmp_path: Path) -> None:
    provider = FakeIncidents(items=[incident(minutes_ago=m) for m in range(10)])
    registry = registry_for(
        tmp_path, visitor=signed_visitor(), incidents=provider, support_max_incidents=2
    )
    await call_tool(registry, TOOL)
    assert provider.args_of("recent_for_user")[0]["limit"] == 2


async def test_long_list_is_trimmed(tmp_path: Path) -> None:
    """Длинный список модель перескажет целиком, и человек в нём утонет."""
    provider = FakeIncidents(
        items=[incident(minutes_ago=m, summary=f"сбой номер {m}") for m in range(10)]
    )
    registry = registry_for(
        tmp_path, visitor=signed_visitor(), incidents=provider, support_max_incidents=2
    )
    answer = await call_tool(registry, TOOL)
    assert "сбой номер 0" in answer and "сбой номер 1" in answer
    assert "сбой номер 5" not in answer, "предел не соблюдён"


async def test_empty_log_is_a_human_phrase_not_unknown(tmp_path: Path) -> None:
    """🔴 «Ошибок не записано» и «не знаю» — разные ответы: смешав их, бот
    либо успокоит зря, либо зря позовёт человека."""
    registry = registry_for(tmp_path, visitor=signed_visitor(), incidents=FakeIncidents(items=[]))
    answer = await call_tool(registry, TOOL)
    assert answer != UNKNOWN
    assert "не записано" in answer.lower() or "не найдено" in answer.lower()


# ─── Журнала нет или он упал ───


async def test_no_provider_is_unknown(tmp_path: Path) -> None:
    """Источник журнала ещё не подключён (решение владельца не принято) —
    честное «не знаю», а не «у вас всё чисто»."""
    registry = registry_for(tmp_path, visitor=signed_visitor(), incidents=None)
    assert await call_tool(registry, TOOL) == UNKNOWN


async def test_provider_failure_is_unknown_with_a_warning(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    """Штатная недоступность: предупреждение без трассировки, ответ — признак."""
    caplog.set_level(logging.WARNING)
    provider = FakeIncidents(items=[incident()], raise_on={"recent_for_user"})
    registry = registry_for(tmp_path, visitor=signed_visitor(), incidents=provider)
    assert await call_tool(registry, TOOL) == UNKNOWN
    assert caplog.records, "падение журнала прошло молча"
    assert "Traceback" not in caplog.text, "ожидаемая недоступность не трассировка"


async def test_broken_provider_does_not_break_the_turn(tmp_path: Path) -> None:
    """Дефект чужого кода (не ProviderUnavailable) тоже остаётся признаком."""

    class Broken:
        async def recent_for_user(self, **kwargs):
            raise RuntimeError("внутренняя поломка источника")

        async def search(self, **kwargs):
            raise RuntimeError("внутренняя поломка источника")

    registry = registry_for(tmp_path, visitor=signed_visitor(), incidents=Broken())
    assert await call_tool(registry, TOOL) == UNKNOWN


async def test_nothing_internal_leaks_into_the_answer(tmp_path: Path) -> None:
    """🔴 В ответ человеку не уходят ни имена таблиц, ни адреса, ни трассировка."""
    provider = FakeIncidents(items=[incident(summary="не сохранилась бронь")])
    registry = registry_for(tmp_path, visitor=signed_visitor(), incidents=provider)
    answer = (await call_tool(registry, TOOL)).lower()
    for forbidden in ("traceback", "select ", "http://", "https://", "postgres", "redis"):
        assert forbidden not in answer, forbidden


# ─── Ответ не расходится с тем, что проверили ───


async def test_empty_log_names_the_real_window(tmp_path: Path) -> None:
    """🔴 Окно — настройка. Сказать «за последние сутки», посмотрев три часа,
    значит назвать фактом то, чего не проверял."""
    registry = registry_for(
        tmp_path,
        visitor=signed_visitor(),
        incidents=FakeIncidents(items=[]),
        support_incident_window_hours=3,
    )
    answer = (await call_tool(registry, TOOL)).lower()
    assert "сутки" not in answer, answer
    assert "3" in answer, answer


async def test_incident_time_names_its_zone(tmp_path: Path) -> None:
    """Метка происшествия в UTC, а человек живёт в UTC+5: без пометки зоны
    он сверит свои действия со временем, сдвинутым на часы."""
    provider = FakeIncidents(items=[incident(summary="не сохранилась бронь")])
    registry = registry_for(tmp_path, visitor=signed_visitor(), incidents=provider)
    answer = await call_tool(registry, TOOL)
    assert "UTC" in answer, answer
