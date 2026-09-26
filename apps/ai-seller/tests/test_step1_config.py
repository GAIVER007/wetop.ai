"""Шаг 1: настройки — один объект, и в нём есть всё, что перечислено в env.example."""

import re
from pathlib import Path

import pytest

from src.config import Settings, get_settings

ROOT = Path(__file__).resolve().parent.parent
ENV_NAME_RE = re.compile(r"^([A-Z_]+)=", re.MULTILINE)


def _env_example_names() -> list[str]:
    text = (ROOT / "env.example").read_text(encoding="utf-8")
    return ENV_NAME_RE.findall(text)


def test_every_env_example_variable_is_a_settings_field() -> None:
    names = _env_example_names()
    assert names, "env.example пуст или не разобрался"
    missing = [n for n in names if n.lower() not in Settings.model_fields]
    assert not missing, f"в Settings нет полей для: {missing}"


def test_service_variables_are_documented_in_env_example() -> None:
    names = set(_env_example_names())
    assert "DATABASE_URL" in names
    assert "INTERNAL_HEALTH_KEY" in names


def test_database_url_overrides_postgres_parts() -> None:
    settings = get_settings()
    assert settings.sqlalchemy_url.startswith("sqlite+aiosqlite:///")


def test_sqlalchemy_url_is_built_from_postgres_parts(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL")
    monkeypatch.setenv("POSTGRES_HOST", "db-host")
    monkeypatch.setenv("POSTGRES_PORT", "5432")
    monkeypatch.setenv("POSTGRES_DB", "sales")
    monkeypatch.setenv("POSTGRES_USER", "app")
    monkeypatch.setenv("POSTGRES_PASSWORD", "pw")
    get_settings.cache_clear()
    assert get_settings().sqlalchemy_url == "postgresql+asyncpg://app:pw@db-host:5432/sales"


def test_cors_origins_list_drops_empty_entries(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "https://a.example, https://b.example,,")
    get_settings.cache_clear()
    assert get_settings().cors_origins_list == ["https://a.example", "https://b.example"]

    monkeypatch.setenv("CORS_ORIGINS", "")
    get_settings.cache_clear()
    assert get_settings().cors_origins_list == []
