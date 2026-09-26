"""Шаг 7: модули интеграций импортируются, контракт имён на месте,
граница «ядро / реализация заказчика» не размыта.
"""

from __future__ import annotations

import importlib
import inspect
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent

MODULES = {
    "src.integrations": [],
    "src.integrations.providers": [
        "Availability", "Quote", "OrderStatus", "Customer", "LeadRef",
        "ProviderUnavailable", "OrderStatusProvider", "CustomerDBProvider",
        "AvailabilityProvider", "LeadSink", "Providers",
    ],
    "src.integrations.stub": ["StubProviders"],
    "src.integrations.factory": [
        "build_providers", "get_providers", "set_providers", "reset_providers",
    ],
    "src.integrations.wetop": ["WetopProviders"],
    "src.integrations.wetop_parse": ["pick", "as_int", "body_reason", "categories", "has_error"],
    "src.integrations.lead_writer": ["LeadWriter", "LeadNotWritten", "natural_key", "write_alert"],
    "src.ai.hotel_tools": ["build_registry"],
}


@pytest.mark.parametrize("name", list(MODULES))
def test_module_imports_and_exposes_contract(name: str) -> None:
    module = importlib.import_module(name)
    missing = [attr for attr in MODULES[name] if not hasattr(module, attr)]
    assert not missing, f"{name}: нет {missing}"


@pytest.mark.parametrize("name", list(MODULES))
def test_module_has_a_docstring(name: str) -> None:
    module = importlib.import_module(name)
    assert module.__doc__ and module.__doc__.strip(), f"{name}: нет docstring"


@pytest.mark.parametrize(
    "name", ["OrderStatusProvider", "CustomerDBProvider", "AvailabilityProvider", "LeadSink"]
)
def test_interfaces_are_protocols(name: str) -> None:
    """Протокол, а не базовый класс: реализация заказчика ничего от нас
    не наследует и живёт в своём файле."""
    from typing import Protocol

    import src.integrations.providers as providers

    cls = getattr(providers, name)
    assert Protocol in cls.__mro__ or getattr(cls, "_is_protocol", False), name


@pytest.mark.parametrize(
    ("cls_name", "method"),
    [
        ("OrderStatusProvider", "get_status"),
        ("CustomerDBProvider", "find_by_phone"),
        ("AvailabilityProvider", "check"),
        ("AvailabilityProvider", "quote"),
        ("LeadSink", "create_lead"),
    ],
)
def test_protocol_methods_are_async(cls_name: str, method: str) -> None:
    """Внешний вызов всегда асинхронный: синхронный провайдер встал бы
    поперёк цикла событий и заморозил все остальные диалоги."""
    import src.integrations.providers as providers

    func = getattr(getattr(providers, cls_name), method)
    assert inspect.iscoroutinefunction(func), f"{cls_name}.{method} не async"


def test_wetop_docstring_names_the_decision_and_its_scope() -> None:
    """Подключение решено в объёме чтения (ADR-085), бронь из чата — нет
    (Q-166б, ADR-086): файл обязан называть решение и границу сам,
    иначе бронь включат как готовую."""
    import src.integrations.wetop as wetop

    doc = wetop.__doc__ or ""
    assert "ADR-085" in doc, "в docstring нет решения о котировке"
    assert "Q-166б" in doc, "в docstring нет границы: бронь не включена"


def _code_without_docs(module) -> str:
    """Исходник без комментариев и docstring: пояснение про адрес в docstring —
    это документация, а зашитый адрес в коде — секрет в репозитории."""
    import ast

    source = Path(inspect.getsourcefile(module)).read_text(encoding="utf-8")
    tree = ast.parse(source)
    docs = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            doc = ast.get_docstring(node, clean=False)
            if doc:
                docs.append(doc)
    for doc in docs:
        source = source.replace(doc, "")
    return "\n".join(line for line in source.splitlines() if not line.strip().startswith("#"))


def test_wetop_takes_address_and_key_from_settings_only() -> None:
    """🔴 Адрес и ключ внешней системы в код не попадают ни разу."""
    module = importlib.import_module("src.integrations.wetop")
    code = _code_without_docs(module)
    urls = re.findall(r"https?://[^\s\"'`]+", code)
    assert not urls, f"в коде есть адрес: {urls}"
    source = Path(inspect.getsourcefile(module)).read_text(encoding="utf-8")
    assert "integration_base_url" in source and "integration_api_key" in source


def test_hotel_tools_does_not_touch_the_core_registry() -> None:
    """Реестр — ядро: инструменты заказчика его используют, а не правят."""
    source = inspect.getsource(importlib.import_module("src.ai.hotel_tools"))
    assert "ToolRegistry" in source
    assert "class ToolRegistry" not in source


def test_integrations_files_stay_short() -> None:
    """Правило проекта: файл не длиннее ~300 строк — длинный модуль читают
    по диагонали, а именно в нём и прячется пропущенная проверка."""
    for path in sorted((ROOT / "src" / "integrations").glob("*.py")):
        lines = path.read_text(encoding="utf-8").count("\n")
        assert lines <= 300, f"{path.name}: {lines} строк"
