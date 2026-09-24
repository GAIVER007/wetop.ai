"""Шаг 3: настройки защиты есть и в env.example, и в Settings; белый список разбирается."""

import re
from pathlib import Path

import pytest

from src.config import Settings, get_settings

ROOT = Path(__file__).resolve().parent.parent
GUARD_NAMES = (
    "GUARD_MAX_INPUT_CHARS",
    "GUARD_DEDUP_TTL_SECONDS",
    "GUARD_CRESCENDO_WINDOW",
    "GUARD_CRESCENDO_HITS",
)


def test_guard_names_in_env_example_and_settings() -> None:
    text = (ROOT / "env.example").read_text(encoding="utf-8")
    names = set(re.findall(r"^([A-Z_]+)=", text, re.MULTILINE))
    for name in GUARD_NAMES:
        assert name in names, name
        assert name.lower() in Settings.model_fields, name
    # Уже существующие поля защиты используются, а не дублируются.
    for name in ("injection_strike_limit", "injection_strike_window_seconds", "ip_block_ttl_seconds"):
        assert name in Settings.model_fields


def test_guard_defaults() -> None:
    settings = get_settings()
    assert settings.guard_max_input_chars == 4000
    assert settings.guard_dedup_ttl_seconds == 60
    assert settings.guard_crescendo_window == 10
    assert settings.guard_crescendo_hits == 3


def test_allowlist_parsing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PII_ALLOWLIST_PHONES", "+7 701 000 00 00, 8-707-123-45-67,, ")
    monkeypatch.setenv("PII_ALLOWLIST_EMAILS", "Info@Example.com, ,sales@example.com")
    get_settings.cache_clear()
    settings = get_settings()
    assert settings.pii_allowlist_phones_list == ["77010000000", "87071234567"]
    assert settings.pii_allowlist_emails_list == ["info@example.com", "sales@example.com"]


def test_allowlist_empty_by_default() -> None:
    settings = get_settings()
    assert settings.pii_allowlist_phones_list == []
    assert settings.pii_allowlist_emails_list == []
