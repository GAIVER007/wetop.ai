"""Шаг 4: вендоры каскада разные. Проверяется по префиксу имени модели
и пишется предупреждением в журнал, а не падением: конфиг с одним вендором
хуже, чем без предупреждения, но лучше, чем бот, который не стартует."""

import logging

import pytest

from src.ai.llm import CascadeClient, check_distinct_vendors, vendor_of
from tests.llm_fakes import ScriptedRouter, llm_env


@pytest.mark.parametrize(
    ("model", "vendor"),
    [
        ("openai/gpt-4.1", "openai"),
        ("anthropic/claude-sonnet-4", "anthropic"),
        ("gpt-4.1", "gpt"),
        ("GPT-4o-mini", "gpt"),
        ("claude-3-5-sonnet", "claude"),
        ("gemini-2.0-flash", "gemini"),
        ("deepseek-chat", "deepseek"),
        ("llama3:8b", "llama3"),
    ],
)
def test_vendor_of(model: str, vendor: str) -> None:
    assert vendor_of(model) == vendor


def test_distinct_vendors_no_warnings() -> None:
    assert check_distinct_vendors(["openai/a", "anthropic/b", "google/c"]) == []
    assert check_distinct_vendors([]) == []
    assert check_distinct_vendors(["openai/a"]) == []


def test_same_vendor_one_warning() -> None:
    warnings = check_distinct_vendors(["gpt-4.1", "gpt-4o-mini", "claude-x"])
    assert len(warnings) == 1
    assert "gpt-4.1" in warnings[0] and "gpt-4o-mini" in warnings[0]
    assert "gpt" in warnings[0]


def test_all_same_vendor_warns_for_each_pair() -> None:
    warnings = check_distinct_vendors(["openai/a", "openai/b", "openai/c"])
    assert len(warnings) == 3


def test_cascade_client_logs_warning(monkeypatch: pytest.MonkeyPatch, caplog) -> None:
    caplog.set_level(logging.WARNING)
    settings = llm_env(monkeypatch, LLM_MODEL="gpt-4.1", LLM_MODEL_FALLBACK="gpt-4o-mini", LLM_MODEL_EMERGENCY="claude-x")
    CascadeClient(settings, http_client=ScriptedRouter().http_client())
    assert any("gpt-4.1" in r.getMessage() and "gpt-4o-mini" in r.getMessage() for r in caplog.records)


def test_cascade_client_silent_for_distinct_vendors(monkeypatch: pytest.MonkeyPatch, caplog) -> None:
    caplog.set_level(logging.WARNING)
    settings = llm_env(monkeypatch)
    client = CascadeClient(settings, http_client=ScriptedRouter().http_client())
    assert client.models == ["openai/a", "anthropic/b", "google/c"]
    assert not any("вендор" in r.getMessage() for r in caplog.records)
