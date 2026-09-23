"""Шаг 6: секреты канала.

Канал сменился с мессенджера на виджет, правило осталось: секрет живёт
только в окружении, в коде и в образце его нет. Имена и умолчания новых
настроек проверяет test_widget_config.py, здесь — гигиена секретов.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from src.config import Settings, get_settings

ROOT = Path(__file__).resolve().parent.parent

# Секреты, которые канал читает из окружения.
SECRET_FIELDS = ["widget_identity_secret"]


def _env_example() -> str:
    return (ROOT / "env.example").read_text(encoding="utf-8")


@pytest.mark.parametrize("field", SECRET_FIELDS)
def test_channel_secret_is_empty_by_default(field: str) -> None:
    assert Settings.model_fields[field].default == ""
    assert re.search(rf"^{field.upper()}=\s*(#.*)?$", _env_example(), re.MULTILINE), (
        f"{field.upper()} в env.example должен стоять пустым"
    )


def test_channel_secret_comes_from_the_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    """Подмена настройкой, а не правкой модуля: у каждого заказчика свой ключ."""
    monkeypatch.setenv("WIDGET_IDENTITY_SECRET", "test-obshchiy-sekret")
    get_settings.cache_clear()
    assert get_settings().widget_identity_secret == "test-obshchiy-sekret"


def test_no_secret_values_in_the_example() -> None:
    """В образце окружения стоят объяснения, а не значения."""
    for line in _env_example().splitlines():
        if line.startswith("WIDGET_IDENTITY_SECRET="):
            value = line.split("=", 1)[1].split("#", 1)[0].strip()
            assert value == "", line
