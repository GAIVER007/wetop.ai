"""Шаг 6: модули канала импортируются, контракт имён на месте, маршруты
виджета подключены к приложению.

Канал клиентов — виджет на сайте платформы; очередь исходящих осталась
за алертами, поэтому outbox и задача повторной доставки здесь же.
"""

from __future__ import annotations

import importlib

import pytest

MODULES = {
    "src.channels.outbox": ["OutboxSender", "Transport", "redeliver_pending", "RedeliverReport"],
    "src.channels.widget": ["WidgetSender", "WidgetRunner", "build_runner", "router", "CHANNEL", "PREFIX"],
    "src.channels.widget_identity": ["Visitor", "sign_identity", "read_identity", "anonymous"],
    "src.site": [],
    "src.jobs": [],
    "src.jobs.outbox_redeliver": ["run_once", "build_transports"],
}

ROUTES = [
    ("/widget/session", "POST"),
    ("/widget/message", "POST"),
    ("/widget/messages", "GET"),
    ("/widget/widget.js", "GET"),
    ("/widget/demo", "GET"),
]


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


def test_channel_names_are_strings() -> None:
    from src.channels.widget import CHANNEL, PREFIX

    assert CHANNEL == "widget"
    assert PREFIX == "/widget"


def _routes() -> set[tuple[str, str]]:
    from src.main import create_app

    app = create_app()
    # include_router в FastAPI кладёт вложенный роутер лениво: у такого
    # элемента нет path, зато есть original_router со своими маршрутами.
    flat = []
    for route in app.routes:
        inner = getattr(route, "original_router", None)
        flat.extend(inner.routes if inner is not None else [route])
    return {
        (route.path, method)
        for route in flat
        if getattr(route, "path", None)
        for method in (getattr(route, "methods", None) or ())
    }


@pytest.mark.parametrize("path,method", ROUTES)
def test_widget_route_is_included_in_app(path: str, method: str) -> None:
    assert (path, method) in _routes()


def test_widget_module_does_not_log_the_identity_token() -> None:
    """🔴 Подписанный признак и почта пользователя в журнал не уходят:
    в вызовах logger не встречается ни токен, ни поле email."""
    import inspect

    from src.channels import widget, widget_identity

    for module in (widget, widget_identity):
        for line in inspect.getsource(module).splitlines():
            stripped = line.strip()
            if "logger." not in stripped:
                continue
            assert "token" not in stripped, line
            assert "email" not in stripped, line
