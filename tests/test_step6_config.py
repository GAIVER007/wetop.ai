"""Шаг 6: настройки канала. Адрес Bot API — настройка, а не константа в коде:
прокси и тесты подменяют его через окружение, не правя модуль.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from src.config import Settings, get_settings

ROOT = Path(__file__).resolve().parent.parent
CHANNEL_NAME_RE = re.compile(r"^(CHANNEL_TELEGRAM_[A-Z_]+)=", re.MULTILINE)
DEFAULT_API_BASE = "https://api.telegram.org"


def _env_example() -> str:
    return (ROOT / "env.example").read_text(encoding="utf-8")


def test_api_base_documented_in_env_example() -> None:
    text = _env_example()
    assert re.search(rf"^CHANNEL_TELEGRAM_API_BASE={re.escape(DEFAULT_API_BASE)}\b", text, re.MULTILINE), (
        "в env.example нет CHANNEL_TELEGRAM_API_BASE=https://api.telegram.org"
    )


def test_api_base_field_and_default() -> None:
    field = Settings.model_fields["channel_telegram_api_base"]
    assert field.default == DEFAULT_API_BASE
    assert get_settings().channel_telegram_api_base == DEFAULT_API_BASE


def test_api_base_overridable_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CHANNEL_TELEGRAM_API_BASE", "https://proxy.example")
    get_settings.cache_clear()
    assert get_settings().channel_telegram_api_base == "https://proxy.example"


def test_channel_variables_from_env_example_are_settings_fields() -> None:
    names = CHANNEL_NAME_RE.findall(_env_example())
    assert "CHANNEL_TELEGRAM_API_BASE" in names
    missing = [n for n in names if n.lower() not in Settings.model_fields]
    assert not missing, f"в Settings нет полей для: {missing}"


def test_channel_secrets_are_empty_by_default() -> None:
    """Токен и секрет — только из окружения; в коде и образце их нет."""
    fields = Settings.model_fields
    assert fields["channel_telegram_bot_token"].default == ""
    assert fields["channel_telegram_webhook_secret"].default == ""
    text = _env_example()
    assert re.search(r"^CHANNEL_TELEGRAM_BOT_TOKEN=\s*(#.*)?$", text, re.MULTILINE)
    assert re.search(r"^CHANNEL_TELEGRAM_WEBHOOK_SECRET=\s*(#.*)?$", text, re.MULTILINE)
