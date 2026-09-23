"""Шаг 7: настройки внешней системы.

🔴 Режим выбирается настройкой, а не правкой кода: иначе следующий заказчик
получит форк движка. И адрес с ключом чужой системы в репозиторий не попадают
ни в каком виде — в образце окружения они пустые.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from src.config import Settings, get_settings

ROOT = Path(__file__).resolve().parent.parent
DEFAULTS = {
    "integration_mode": "stub",
    "integration_base_url": "",
    "integration_api_key": "",
    "integration_timeout_seconds": 10,
    "alert_transport": "telegram",
    "alert_recipient": "",
}


def _env_example() -> str:
    return (ROOT / "env.example").read_text(encoding="utf-8")


@pytest.mark.parametrize(("name", "default"), sorted(DEFAULTS.items()))
def test_settings_field_and_default(name: str, default) -> None:
    assert name in Settings.model_fields, f"в Settings нет поля {name}"
    assert Settings.model_fields[name].default == default
    assert getattr(get_settings(), name) == default


def test_integration_secrets_are_empty_by_default() -> None:
    """🔴 Адрес и ключ внешней системы — только из окружения."""
    assert Settings.model_fields["integration_base_url"].default == ""
    assert Settings.model_fields["integration_api_key"].default == ""
    text = _env_example()
    assert re.search(r"^INTEGRATION_BASE_URL=\s*(#.*)?$", text, re.MULTILINE), "в образце заполнен адрес"
    assert re.search(r"^INTEGRATION_API_KEY=\s*(#.*)?$", text, re.MULTILINE), "в образце заполнен ключ"


def test_mode_comes_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTEGRATION_MODE", "wetop")
    get_settings.cache_clear()
    assert get_settings().integration_mode == "wetop"


def test_env_example_has_integration_block() -> None:
    text = _env_example()
    assert re.search(r"^#\s*─+\s*Внешняя система\s*─+\s*$", text, re.MULTILINE), "нет блока «Внешняя система»"
    assert re.search(r"^INTEGRATION_MODE=stub\b", text, re.MULTILINE)
    assert re.search(r"^INTEGRATION_TIMEOUT_SECONDS=10\b", text, re.MULTILINE)


def test_integration_block_stands_before_the_service_block() -> None:
    """Порядок блоков — это оглавление файла: настройки заказчика идут
    до служебных, иначе их не найдут."""
    text = _env_example()
    external = text.find("Внешняя система")
    service = text.find("─── Служебное ───")
    assert external != -1 and service != -1
    assert external < service, "блок внешней системы оказался после служебного"


def test_env_example_explains_why_mode_is_a_setting() -> None:
    """Комментарий в образце — единственное, что прочитает тот, кто будет
    настраивать бота у заказчика."""
    text = _env_example()
    block = text[text.find("Внешняя система") : text.find("─── Служебное ───")]
    assert "stub" in block
    assert "заглушк" in block.lower()


def test_alert_recipient_documented() -> None:
    text = _env_example()
    assert re.search(r"^ALERT_TRANSPORT=telegram\b", text, re.MULTILINE)
    assert re.search(r"^ALERT_RECIPIENT=\s*(#.*)?$", text, re.MULTILINE), "получатель алертов заполнен в образце"


def test_every_new_variable_of_env_example_has_a_settings_field() -> None:
    names = re.findall(r"^(INTEGRATION_[A-Z_]+|ALERT_TRANSPORT|ALERT_RECIPIENT)=", _env_example(), re.MULTILINE)
    assert "INTEGRATION_MODE" in names
    missing = [n for n in names if n.lower() not in Settings.model_fields]
    assert not missing, f"в Settings нет полей для: {missing}"


def test_env_example_has_no_real_address_or_key() -> None:
    """Секрет, попавший в образец, попадает в репозиторий навсегда."""
    block_start = _env_example().find("Внешняя система")
    block = _env_example()[block_start : block_start + 1200]
    for line in block.splitlines():
        if line.startswith(("INTEGRATION_BASE_URL=", "INTEGRATION_API_KEY=")):
            value = line.split("=", 1)[1].split("#", 1)[0].strip()
            assert value == "", f"в образце есть значение: {line}"
