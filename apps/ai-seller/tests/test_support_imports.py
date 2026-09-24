"""Модули роли помощника импортируются, контракт имён на месте,
граница «ядро / файл под заказчика» не размыта.

Файл дешёвый и ловит дорогое: опечатку в имени и лишний импорт, из-за
которого приложение не поднимется в бою, а не в тесте.
"""

from __future__ import annotations

import importlib
import inspect
from pathlib import Path

import pytest

MODULES = {
    "src.knowledge.catalog": [
        "ErrorEntry", "CatalogMissing", "load_catalog", "reset_catalog_cache",
        "normalize_message", "find_by_code", "find_by_text",
    ],
    "src.ai.support_tools": ["UNKNOWN", "build_registry"],
    "src.integrations.providers": [
        "Incident", "HealthReport", "IncidentProvider", "PlatformHealthProvider",
    ],
    "src.channels.widget_identity": ["current_visitor", "Visitor"],
    "src.config": ["BOT_ROLES", "normalize_bot_role"],
}


@pytest.mark.parametrize("name", list(MODULES))
def test_module_imports_and_exposes_contract(name: str) -> None:
    module = importlib.import_module(name)
    missing = [attr for attr in MODULES[name] if not hasattr(module, attr)]
    assert not missing, f"{name}: нет {missing}"


@pytest.mark.parametrize("name", ["src.knowledge.catalog", "src.ai.support_tools"])
def test_module_has_a_docstring(name: str) -> None:
    module = importlib.import_module(name)
    assert (module.__doc__ or "").strip(), f"{name}: нет docstring"


@pytest.mark.parametrize("name", ["src.knowledge.catalog", "src.ai.support_tools"])
def test_files_stay_short(name: str) -> None:
    """Правило проекта: файл не длиннее ~300 строк — длинный модуль читают
    по диагонали, а именно в нём и прячется пропущенная проверка."""
    path = Path(inspect.getsourcefile(importlib.import_module(name)))
    lines = path.read_text(encoding="utf-8").count("\n")
    assert lines <= 300, f"{path.name}: {lines} строк"


def test_support_tools_do_not_touch_the_core_registry() -> None:
    """Реестр — ядро: инструменты роли его используют, а не правят."""
    source = inspect.getsource(importlib.import_module("src.ai.support_tools"))
    assert "ToolRegistry" in source
    assert "class ToolRegistry" not in source


def test_catalog_does_not_reach_outside() -> None:
    """Справочник — это файл на диске: ни сети, ни базы здесь быть не должно.
    Чтение справочника происходит внутри хода, и поход в базу за ним
    задержал бы ответ человеку."""
    source = inspect.getsource(importlib.import_module("src.knowledge.catalog"))
    for forbidden in ("httpx", "requests", "sqlalchemy", "redis"):
        assert forbidden not in source, forbidden


@pytest.mark.parametrize(
    ("cls_name", "method"),
    [("IncidentProvider", "recent_for_user"), ("IncidentProvider", "search"),
     ("PlatformHealthProvider", "status")],
)
def test_new_protocol_methods_are_async(cls_name: str, method: str) -> None:
    """Внешний вызов всегда асинхронный: синхронный провайдер встал бы
    поперёк цикла событий и заморозил все остальные диалоги."""
    import src.integrations.providers as providers

    func = getattr(getattr(providers, cls_name), method)
    assert inspect.iscoroutinefunction(func), f"{cls_name}.{method} не async"


@pytest.mark.parametrize("name", ["IncidentProvider", "PlatformHealthProvider"])
def test_new_interfaces_are_protocols(name: str) -> None:
    """Протокол, а не базовый класс: источник журнала платформы ничего
    от нас не наследует и живёт в своём файле."""
    from typing import Protocol

    import src.integrations.providers as providers

    cls = getattr(providers, name)
    assert Protocol in cls.__mro__ or getattr(cls, "_is_protocol", False), name


def test_providers_keeps_new_slots_optional() -> None:
    """🔴 Новые слоты со значением None по умолчанию: существующие сборки
    набора (и продавец, и заглушка) не должны сломаться."""
    from src.integrations.providers import Providers

    providers = Providers(orders=None, customers=None, availability=None, leads=None, mode="test")
    assert providers.incidents is None
    assert providers.health is None


def test_stub_mode_leaves_the_platform_log_unknown() -> None:
    """🔴 Заглушка не отвечает «всё хорошо» за платформу: слотов нет,
    инструменты честно скажут «не знаю»."""
    from src.config import get_settings
    from src.integrations.factory import build_providers

    providers = build_providers(get_settings())
    assert providers.mode == "stub"
    assert providers.incidents is None
    assert providers.health is None
