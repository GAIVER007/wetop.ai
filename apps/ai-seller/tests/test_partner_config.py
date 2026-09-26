"""Настройки «продавца партнёра под ключ» (С2, С3) есть и в Settings, и в env.example.

Настройка, которой нет в env.example, не существует: её не поставит ни один
заказчик, и она молча останется со значением по умолчанию. Без
LLM_KEYS_SECRET окна «Модель» и «WhatsApp» не сохраняют ни одного ключа.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from src.config import Settings

ROOT = Path(__file__).resolve().parent.parent
ENV_LINE_RE = re.compile(r"^([A-Z_]+)=([^\s#]*)", re.MULTILINE)

NEW_NAMES = ["LLM_KEYS_SECRET", "WHATSAPP_GRAPH_BASE_URL"]


def _env() -> dict[str, str]:
    text = (ROOT / "env.example").read_text(encoding="utf-8")
    return dict(ENV_LINE_RE.findall(text))


@pytest.mark.parametrize("name", NEW_NAMES)
def test_new_variable_is_in_env_example(name: str) -> None:
    assert name in _env(), f"{name} нет в env.example"


@pytest.mark.parametrize("name", NEW_NAMES)
def test_new_variable_is_a_settings_field(name: str) -> None:
    assert name.lower() in Settings.model_fields, name


def test_the_keys_secret_stands_empty_in_the_template() -> None:
    """🔴 Секрет хранилища в шаблоне пуст: значение генерирует владелец."""
    assert _env().get("LLM_KEYS_SECRET") == ""


def test_the_graph_address_in_the_template_matches_the_default() -> None:
    """Адрес Graph в шаблоне тот же, что умолчание в коде: два разных
    значения — это вопрос «какое настоящее», на который никто не ответит."""
    assert _env().get("WHATSAPP_GRAPH_BASE_URL") == Settings.model_fields[
        "whatsapp_graph_base_url"
    ].default
