"""Шаг 8а: модули импортируются и отдают обещанный контракт имён.

Тест дешёвый и ловит самое дорогое: опечатку в имени и циклический импорт,
который в бою всплывает при старте monitor, а не в наборе тестов.
"""

from __future__ import annotations

import importlib
import inspect

import pytest

MODULES = {
    "src.alerts": [],
    "src.alerts.email": ["EmailTransport", "build_email_transport"],
    "src.alerts.messenger": ["MessengerTransport", "build_messenger_transport", "to_html"],
    "src.alerts.dedup": ["silenced", "flood_check", "FloodVerdict", "window_for"],
    "src.alerts.raise_alert": ["raise_alert", "AlertResult", "EVENT_TYPES"],
    "src.sla_alerts": ["StaleTurn", "find_stale", "scan_and_alert"],
    "src.runtime_settings": [
        "get_override", "set_override", "clear_override", "all_overrides", "effective",
    ],
    "src.jobs.watchdog": ["run_once"],
    "src.jobs.heartbeat": ["run_once"],
    "src.jobs.outbox_redeliver": ["build_transports", "run_once"],
    "src.monitoring": ["default_jobs", "run", "tick"],
    "src.integrations.lead_writer": ["write_alert"],
}


@pytest.mark.parametrize("name", list(MODULES))
def test_module_imports_and_exposes_contract(name: str) -> None:
    module = importlib.import_module(name)
    missing = [attr for attr in MODULES[name] if not hasattr(module, attr)]
    assert not missing, f"{name}: нет {missing}"


def test_write_alert_keeps_its_signature() -> None:
    """На write_alert стоят тесты шага 7 и фикстура alert_spy: имя и сигнатура
    не меняются, меняется только то, что происходит внутри."""
    from src.integrations.lead_writer import write_alert

    params = inspect.signature(write_alert).parameters
    assert list(params) == ["sessionmaker", "settings", "body", "dedup_key"]
    assert params["body"].kind is inspect.Parameter.KEYWORD_ONLY
    assert params["dedup_key"].kind is inspect.Parameter.KEYWORD_ONLY


def test_event_types_cover_the_kit_list() -> None:
    from src.alerts.raise_alert import EVENT_TYPES

    expected = {
        "sla", "hot_lead", "lead_failed", "lead_no_provider", "lead_idem",
        "llm_down", "channel_down", "outbox_failed", "login_attack",
        "heartbeat", "flood",
    }
    assert expected <= set(EVENT_TYPES), sorted(expected - set(EVENT_TYPES))


def test_raise_alert_signature() -> None:
    from src.alerts.raise_alert import raise_alert

    params = inspect.signature(raise_alert).parameters
    assert list(params)[:3] == ["sessionmaker", "redis", "settings"]
    for name in ("event_type", "body", "dedup_key", "force"):
        assert params[name].kind is inspect.Parameter.KEYWORD_ONLY, name
    assert params["force"].default is False
