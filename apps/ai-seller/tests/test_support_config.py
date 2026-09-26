"""Настройки роли помощника: поля в Settings, блок в env.example, справочник.

🔴 Роль, путь к справочнику и окно происшествий — НАСТРОЙКИ. Зашитые
в код, они означают форк движка под каждого следующего заказчика.

🔴 И образец окружения не содержит ни адресов, ни ключей: то, что попало
в репозиторий, оттуда уже не убрать.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from src.config import BOT_ROLES, Settings, get_settings

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "data" / "errors.md"

DEFAULTS = {
    "bot_role": "support",
    "errors_catalog_path": "data/errors.md",
    "knowledge_dir": "data/knowledge",
    "support_incident_window_hours": 24,
    "support_max_incidents": 5,
}
VARIABLES = [
    "BOT_ROLE",
    "ERRORS_CATALOG_PATH",
    "KNOWLEDGE_DIR",
    "SUPPORT_INCIDENT_WINDOW_HOURS",
    "SUPPORT_MAX_INCIDENTS",
]


def _env_example() -> str:
    return (ROOT / "env.example").read_text(encoding="utf-8")


# ─── Settings ───


@pytest.mark.parametrize(("name", "default"), sorted(DEFAULTS.items()))
def test_settings_field_and_default(name: str, default) -> None:
    assert name in Settings.model_fields, f"в Settings нет поля {name}"
    assert Settings.model_fields[name].default == default
    assert getattr(get_settings(), name) == default


def test_roles_are_two() -> None:
    assert set(BOT_ROLES) == {"support", "seller"}


def test_role_comes_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BOT_ROLE", "seller")
    get_settings.cache_clear()
    assert get_settings().bot_role == "seller"


def test_window_and_limit_come_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUPPORT_INCIDENT_WINDOW_HOURS", "6")
    monkeypatch.setenv("SUPPORT_MAX_INCIDENTS", "3")
    get_settings.cache_clear()
    settings = get_settings()
    assert settings.support_incident_window_hours == 6
    assert settings.support_max_incidents == 3


# ─── env.example ───


def test_env_example_has_the_role_block() -> None:
    assert re.search(r"^#\s*─+\s*Роль бота\s*─+\s*$", _env_example(), re.MULTILINE), "нет блока «Роль бота»"


@pytest.mark.parametrize("name", VARIABLES)
def test_env_example_has_variable(name: str) -> None:
    assert re.search(rf"^{name}=", _env_example(), re.MULTILINE), name


def test_env_example_sets_support_by_default() -> None:
    assert re.search(r"^BOT_ROLE=support\b", _env_example(), re.MULTILINE)


def test_role_block_stands_before_the_service_block() -> None:
    """Порядок блоков — это оглавление файла: настройки заказчика идут
    до служебных, иначе их не найдут."""
    text = _env_example()
    role = text.find("Роль бота")
    service = text.find("─── Служебное ───")
    assert role != -1 and service != -1
    assert role < service, "блок роли оказался после служебного"


def test_env_example_explains_both_roles() -> None:
    """Комментарий в образце — единственное, что прочитает тот, кто будет
    настраивать бота: от роли зависят инструменты, промпт и сбор контакта."""
    text = _env_example()
    block = text[text.find("Роль бота") : text.find("─── Служебное ───")].lower()
    assert "support" in block and "seller" in block
    assert "помощник" in block and "продавец" in block
    assert "инструмент" in block
    assert "контакт" in block or "заявк" in block


def test_every_new_variable_has_a_settings_field() -> None:
    names = re.findall(r"^(BOT_ROLE|ERRORS_CATALOG_PATH|KNOWLEDGE_DIR|SUPPORT_[A-Z_]+)=", _env_example(), re.MULTILINE)
    assert set(names) == set(VARIABLES)
    missing = [n for n in names if n.lower() not in Settings.model_fields]
    assert not missing, f"в Settings нет полей для: {missing}"


def test_role_block_has_no_secrets() -> None:
    """В блоке роли только пути и числа: ни адреса, ни ключа."""
    text = _env_example()
    block = text[text.find("Роль бота") : text.find("─── Служебное ───")]
    assert not re.findall(r"https?://", block), "в блоке роли есть адрес"
    assert "KEY=" not in block and "SECRET=" not in block


# ─── Справочник как данные ───


def test_catalog_file_exists() -> None:
    """Путь по умолчанию должен вести на существующий файл: иначе первый же
    вопрос про ошибку получит «не знаю» без объяснимой причины."""
    assert CATALOG.exists(), "нет data/errors.md"
    assert Settings.model_fields["errors_catalog_path"].default == "data/errors.md"


def test_catalog_says_it_is_data() -> None:
    """🔴 В шапке сказано, что это данные и правит их владелец: иначе
    следующий заказчик получит правку файла коммитом в ядро."""
    head = CATALOG.read_text(encoding="utf-8")[:1500].lower()
    assert "данные" in head
    assert "владел" in head


def test_catalog_has_no_secrets_and_no_personal_data() -> None:
    """🔴 Справочник лежит в репозитории: ни адресов, ни ключей, ни чужих
    телефонов и почт в нём быть не может."""
    text = CATALOG.read_text(encoding="utf-8")
    urls = [u for u in re.findall(r"https?://[^\s)\]\"'`]+", text) if "example." not in u]
    assert not urls, f"в справочнике есть адрес: {urls}"
    emails = [e for e in re.findall(r"[\w.+-]+@[\w.-]+\.\w+", text) if "example." not in e]
    assert not emails, f"в справочнике есть почта: {emails}"
    phones = re.findall(r"\+?\d[\d\s\-()]{9,}\d", text)
    assert not phones, f"в справочнике есть телефон: {phones}"


def test_catalog_is_parsed_by_the_reader() -> None:
    """Образец читается тем же разборщиком, что и боевой файл."""
    from src.knowledge.catalog import load_catalog, reset_catalog_cache

    reset_catalog_cache()
    try:
        entries = load_catalog(CATALOG)
    finally:
        reset_catalog_cache()
    assert len(entries) >= 3


def test_catalog_keeps_the_code_field_optional() -> None:
    """🔴 У платформы кодов ошибок нет: в образце поле есть, но пустое.
    Заполненный выдуманный код увёл бы поиск в никуда."""
    from src.knowledge.catalog import load_catalog, reset_catalog_cache

    reset_catalog_cache()
    try:
        entries = load_catalog(CATALOG)
    finally:
        reset_catalog_cache()
    assert any(entry.code is None for entry in entries), "во всех записях проставлен код"
