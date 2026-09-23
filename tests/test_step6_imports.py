"""Шаг 6: модули канала импортируются, контракт имён на месте, маршрут
вебхука подключён к приложению, CLI-скрипт компилируется.
"""

from __future__ import annotations

import importlib
import py_compile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent

MODULES = {
    "src.channels.outbox": ["OutboxSender", "Transport", "redeliver_pending", "RedeliverReport"],
    "src.channels.telegram": [
        "TelegramClient",
        "WebhookRunner",
        "parse_update",
        "CallbackEvent",
        "consent_keyboard",
        "CONSENT_CALLBACK",
        "router",
    ],
    "src.jobs": [],
    "src.jobs.outbox_redeliver": ["run_once", "build_transports"],
}


@pytest.mark.parametrize("name", list(MODULES))
def test_module_imports_and_exposes_contract(name: str) -> None:
    module = importlib.import_module(name)
    missing = [attr for attr in MODULES[name] if not hasattr(module, attr)]
    assert not missing, f"{name}: нет {missing}"


def test_jobs_package_has_docstring() -> None:
    module = importlib.import_module("src.jobs")
    assert module.__doc__ and module.__doc__.strip()


def test_transport_is_protocol() -> None:
    from typing import Protocol

    from src.channels.outbox import Transport

    assert Protocol in Transport.__mro__ or getattr(Transport, "_is_protocol", False)


def test_consent_keyboard_shape() -> None:
    from src.channels.telegram import CONSENT_CALLBACK, consent_keyboard

    assert consent_keyboard("Согласен") == {
        "inline_keyboard": [[{"text": "Согласен", "callback_data": CONSENT_CALLBACK}]]
    }


def test_webhook_route_is_included_in_app() -> None:
    from src.main import create_app

    app = create_app()
    # include_router в FastAPI кладёт вложенный роутер лениво: у такого
    # элемента нет path, зато есть original_router со своими маршрутами.
    flat = []
    for route in app.routes:
        inner = getattr(route, "original_router", None)
        flat.extend(inner.routes if inner is not None else [route])
    routes = [
        (route.path, tuple(sorted(getattr(route, "methods", None) or ())))
        for route in flat
        if getattr(route, "path", None)
    ]
    assert ("/webhooks/telegram", ("POST",)) in routes


def test_webhook_cli_script_compiles() -> None:
    script = ROOT / "scripts" / "telegram_webhook.py"
    assert script.exists(), "нет scripts/telegram_webhook.py"
    py_compile.compile(str(script), doraise=True)
    text = script.read_text(encoding="utf-8")
    assert "vykatka.md" in text, "перед set — напоминание прочитать vykatka.md"


def test_telegram_module_does_not_log_full_url() -> None:
    """🔴 Полный адрес с токеном не должен уходить в журнал: в вызовах
    logger не встречается self._url."""
    import inspect

    from src.channels import telegram

    source = inspect.getsource(telegram)
    for line in source.splitlines():
        stripped = line.strip()
        if stripped.startswith("logger.") or "logger." in stripped:
            assert "_url(" not in stripped, line
            assert "self._url" not in stripped, line
