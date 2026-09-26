"""Шаг 4: настройки слоя модели есть и в env.example, и в Settings;
каскад собирается без пустых и без дублей."""

import re
from pathlib import Path

import pytest

from src.config import Settings, get_settings

ROOT = Path(__file__).resolve().parent.parent
NEW_NAMES = ("LLM_TEMPERATURE", "LLM_HISTORY_TURNS", "PROMPT_PATH")
EXISTING = (
    "llm_api_key",
    "llm_base_url",
    "llm_model",
    "llm_model_fallback",
    "llm_model_emergency",
    "llm_allowed_models",
    "llm_timeout_seconds",
    "llm_max_tokens",
)


def test_names_in_env_example_and_settings() -> None:
    text = (ROOT / "env.example").read_text(encoding="utf-8")
    names = set(re.findall(r"^([A-Z_0-9]+)=", text, re.MULTILINE))
    for name in NEW_NAMES:
        assert name in names, name
        assert name.lower() in Settings.model_fields, name
    for name in EXISTING:
        assert name in Settings.model_fields, name


def test_defaults() -> None:
    settings = get_settings()
    assert settings.llm_temperature == pytest.approx(0.2)
    assert settings.llm_history_turns == 20
    assert settings.prompt_path == "data/system_prompt.md"


def test_env_overrides(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_TEMPERATURE", "0.7")
    monkeypatch.setenv("LLM_HISTORY_TURNS", "6")
    monkeypatch.setenv("PROMPT_PATH", "/data/prompt.md")
    get_settings.cache_clear()
    settings = get_settings()
    assert settings.llm_temperature == pytest.approx(0.7)
    assert settings.llm_history_turns == 6
    assert settings.prompt_path == "/data/prompt.md"


def test_llm_models_order_and_no_empties(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_MODEL", "openai/a")
    monkeypatch.setenv("LLM_MODEL_FALLBACK", "anthropic/b")
    monkeypatch.setenv("LLM_MODEL_EMERGENCY", "google/c")
    get_settings.cache_clear()
    assert get_settings().llm_models == ["openai/a", "anthropic/b", "google/c"]

    monkeypatch.delenv("LLM_MODEL_FALLBACK")
    get_settings.cache_clear()
    assert get_settings().llm_models == ["openai/a", "google/c"]


def test_llm_models_without_duplicates(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_MODEL", "openai/a")
    monkeypatch.setenv("LLM_MODEL_FALLBACK", "openai/a")
    monkeypatch.setenv("LLM_MODEL_EMERGENCY", " google/c ")
    get_settings.cache_clear()
    assert get_settings().llm_models == ["openai/a", "google/c"]


def test_llm_models_empty_by_default() -> None:
    assert get_settings().llm_models == []


def test_no_secrets_in_env_example() -> None:
    # Адреса роутеров и ключи в образце не появляются: значения пустые.
    text = (ROOT / "env.example").read_text(encoding="utf-8")
    for name in ("LLM_API_KEY", "LLM_BASE_URL", "PROMPT_PATH"):
        match = re.search(rf"^{name}=([^#\n]*)", text, re.MULTILINE)
        assert match is not None, name
        assert match.group(1).strip() == "", name
