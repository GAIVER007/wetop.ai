"""Инструмент platform_status: общее состояние платформы.

🔴 Главное здесь одно: провайдера нет — «не знаю», а НЕ «всё работает».
Молчаливое «всё хорошо» неотличимо от незнания, но человек прочитает его
как проверенный факт и пойдёт искать поломку у себя.
"""

from __future__ import annotations

import logging
from pathlib import Path

import pytest

from src.ai.support_tools import UNKNOWN, build_registry
from tests.support_fakes import (
    SAMPLE_CATALOG,
    FakeHealth,
    call_tool,
    signed_visitor,
    support_providers,
    support_settings,
    write_catalog,
)

TOOL = "platform_status"


@pytest.fixture(autouse=True)
def clean_catalog_cache():
    from src.knowledge.catalog import reset_catalog_cache

    reset_catalog_cache()
    yield
    reset_catalog_cache()


def registry_for(tmp_path: Path, *, health=None, visitor=None):
    settings = support_settings(catalog=write_catalog(tmp_path, SAMPLE_CATALOG))
    providers = support_providers(health=health)
    return build_registry(
        lambda: providers,
        settings_getter=lambda: settings,
        visitor_getter=lambda: visitor if visitor is not None else signed_visitor(),
    )


async def test_no_provider_is_unknown_not_all_good(tmp_path: Path) -> None:
    """🔴 Источник состояния не подключён — «не знаю»."""
    assert await call_tool(registry_for(tmp_path, health=None), TOOL) == UNKNOWN


async def test_ok(tmp_path: Path) -> None:
    health = FakeHealth(ok=True, degraded=[])
    answer = await call_tool(registry_for(tmp_path, health=health), TOOL)
    assert answer != UNKNOWN
    assert "работает" in answer.lower()
    assert health.calls == 1


async def test_degraded_lists_sections(tmp_path: Path) -> None:
    """Список разделов — это то, ради чего человек спрашивает: он ищет свой."""
    health = FakeHealth(ok=False, degraded=["Отчёты", "Оплаты"])
    answer = await call_tool(registry_for(tmp_path, health=health), TOOL)
    assert "Отчёты" in answer and "Оплаты" in answer
    assert "сбо" in answer.lower(), "ответ не говорит, что это сбой"


async def test_degraded_without_names_is_still_not_ok(tmp_path: Path) -> None:
    """ok=False без списка разделов — всё равно не «всё работает»."""
    answer = await call_tool(registry_for(tmp_path, health=FakeHealth(ok=False, degraded=[])), TOOL)
    assert "всё работает" not in answer.lower()


async def test_failure_is_unknown_with_a_warning(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    """Проверка состояния упала — «не знаю» и предупреждение без трассировки."""
    caplog.set_level(logging.WARNING)
    assert await call_tool(registry_for(tmp_path, health=FakeHealth(fail=True)), TOOL) == UNKNOWN
    assert caplog.records, "падение проверки прошло молча"
    assert "Traceback" not in caplog.text


async def test_broken_provider_does_not_break_the_turn(tmp_path: Path) -> None:
    class Broken:
        async def status(self):
            raise RuntimeError("внутренняя поломка источника")

    assert await call_tool(registry_for(tmp_path, health=Broken()), TOOL) == UNKNOWN


async def test_providers_factory_failure_is_unknown(tmp_path: Path) -> None:
    """Сбой самой фабрики провайдеров тоже не роняет ход."""

    def boom():
        raise RuntimeError("фабрика провайдеров упала")

    settings = support_settings(catalog=write_catalog(tmp_path, SAMPLE_CATALOG))
    registry = build_registry(
        boom, settings_getter=lambda: settings, visitor_getter=signed_visitor
    )
    assert await call_tool(registry, TOOL) == UNKNOWN


async def test_answer_has_no_internal_details(tmp_path: Path) -> None:
    """🔴 Ни адресов внутренних сервисов, ни трассировки в ответе человеку."""
    health = FakeHealth(ok=False, degraded=["Отчёты"])
    answer = (await call_tool(registry_for(tmp_path, health=health), TOOL)).lower()
    for forbidden in ("traceback", "http://", "https://", "postgres", "redis", "127.0.0.1"):
        assert forbidden not in answer, forbidden


async def test_anonymous_may_ask_about_the_platform(tmp_path: Path) -> None:
    """Состояние платформы — не чужие данные: его видно и без подписи."""
    from tests.support_fakes import anon_visitor

    health = FakeHealth(ok=True, degraded=[])
    answer = await call_tool(registry_for(tmp_path, health=health, visitor=anon_visitor()), TOOL)
    assert "работает" in answer.lower()
