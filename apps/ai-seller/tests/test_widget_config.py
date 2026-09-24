"""Настройки канала «виджет на сайте».

Настройка, которой нет в env.example, не существует: её не поставит ни один
заказчик, и она молча останется со значением по умолчанию.

🔴 Здесь же сторожится развязка алертов и удалённого канала: адрес Bot API
бота алертов теперь свой, а имён CHANNEL_TELEGRAM_* не осталось нигде.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from src.config import Settings, get_settings

ROOT = Path(__file__).resolve().parent.parent
ENV_NAME_RE = re.compile(r"^([A-Z_]+)=", re.MULTILINE)

WIDGET_NAMES = [
    "WIDGET_SITE_HOSTS",
    "WIDGET_IDENTITY_SECRET",
    "WIDGET_IDENTITY_TTL_SECONDS",
    "WIDGET_SESSION_TTL_HOURS",
    "WIDGET_MESSAGES_PER_HOUR",
    "WIDGET_MAX_BODY_BYTES",
    "WIDGET_ATTACHMENTS_ENABLED",
    "WIDGET_ATTACHMENT_MAX_MB",
    "WIDGET_ATTACHMENT_DIR",
    "WIDGET_ATTACHMENT_TYPES",
    "WIDGET_POLL_TIMEOUT_SECONDS",
]

DEFAULTS = {
    "widget_site_hosts": "",
    "widget_identity_secret": "",
    "widget_identity_ttl_seconds": 43200,
    "widget_session_ttl_hours": 720,
    "widget_messages_per_hour": 60,
    "widget_max_body_bytes": 64 * 1024,
    "widget_attachments_enabled": True,
    "widget_attachment_max_mb": 5,
    "widget_attachment_dir": "data/attachments",
    "widget_attachment_types": "image/png,image/jpeg,image/webp",
    "widget_poll_timeout_seconds": 25,
}


def _env_text() -> str:
    return (ROOT / "env.example").read_text(encoding="utf-8")


@pytest.mark.parametrize("name", WIDGET_NAMES)
def test_widget_variable_is_in_env_example(name: str) -> None:
    assert name in set(ENV_NAME_RE.findall(_env_text())), name


@pytest.mark.parametrize("name", WIDGET_NAMES)
def test_widget_variable_is_a_settings_field(name: str) -> None:
    assert name.lower() in Settings.model_fields, name


@pytest.mark.parametrize("name,value", sorted(DEFAULTS.items()))
def test_widget_default(name: str, value: object) -> None:
    assert Settings.model_fields[name].default == value


def test_widget_block_is_explained_in_env_example() -> None:
    """Блок виджета подписан: кто это читает, тот настраивает бота у заказчика."""
    text = _env_text().lower()
    assert "виджет" in text


def test_identity_secret_is_empty_by_default() -> None:
    """🔴 Пусто — подписанные признаки не принимаются вовсе, все посетители
    анонимные. «Секрет не настроен» не значит «верим кому попало»."""
    assert Settings.model_fields["widget_identity_secret"].default == ""
    assert re.search(r"^WIDGET_IDENTITY_SECRET=\s*(#.*)?$", _env_text(), re.MULTILINE)


def test_site_hosts_are_split(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("WIDGET_SITE_HOSTS", "https://a.example.test, https://b.example.test ,,")
    get_settings.cache_clear()
    assert get_settings().widget_site_hosts_list == [
        "https://a.example.test",
        "https://b.example.test",
    ]


def test_empty_site_hosts_give_an_empty_list() -> None:
    """Пустой список — проверка Origin выключена; предупреждение при старте
    сторожит тест сессии."""
    get_settings.cache_clear()
    assert get_settings().widget_site_hosts_list == []


def test_attachment_types_are_split_and_lowered(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("WIDGET_ATTACHMENT_TYPES", "Image/PNG, image/jpeg ,")
    get_settings.cache_clear()
    assert get_settings().widget_attachment_types_list == ["image/png", "image/jpeg"]


# ─── Развязка с удалённым каналом ───


def test_alert_api_base_is_its_own_setting() -> None:
    """Адрес бота АЛЕРТОВ больше не одалживается у канала клиентов."""
    assert Settings.model_fields["alert_telegram_api_base"].default == "https://api.telegram.org"
    assert "ALERT_TELEGRAM_API_BASE=" in _env_text()


def test_alert_api_bases_fall_back_to_the_alert_base(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ALERT_TELEGRAM_API_BASES", "")
    monkeypatch.setenv("ALERT_TELEGRAM_API_BASE", "https://alive.example.test")
    get_settings.cache_clear()
    assert get_settings().alert_telegram_api_base_list == ["https://alive.example.test"]


def test_no_channel_telegram_names_are_left() -> None:
    """🔴 Настройка удалённого канала, оставшаяся в образце, однажды будет
    заполнена — и заказчик будет ждать от неё работы."""
    gone = [n for n in ENV_NAME_RE.findall(_env_text()) if n.startswith("CHANNEL_TELEGRAM")]
    assert gone == [], gone
    fields = [n for n in Settings.model_fields if n.startswith("channel_telegram")]
    assert fields == [], fields
