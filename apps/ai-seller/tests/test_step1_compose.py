"""Шаг 1: состав compose.yml.

PyYAML в зависимостях нет, поэтому проверяем текст простыми строками.
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COMPOSE_TEXT = (ROOT / "compose.yml").read_text(encoding="utf-8")


def test_no_dashboard_service() -> None:
    # Панель — серверные шаблоны внутри app; отдельного сервиса нет.
    assert re.search(r"^\s{2}dashboard:\s*$", COMPOSE_TEXT, re.MULTILINE) is None
    assert "PUBLIC_BASE_URL" not in COMPOSE_TEXT


def test_monitor_is_a_separate_process() -> None:
    assert "monitor:" in COMPOSE_TEXT
    assert "command: python -m src.monitoring" in COMPOSE_TEXT


def test_app_has_healthcheck_on_public_health() -> None:
    assert "http://127.0.0.1:8000/health" in COMPOSE_TEXT


def test_postgres_18_volume_is_mounted_one_level_up() -> None:
    """С 18-й версии образ Postgres кладёт данные в подкаталог версии и
    отказывается стартовать, если том смонтирован в .../data: база «unhealthy»,
    app и monitor не поднимаются. Поймано живым docker compose up."""
    assert "pgdata:/var/lib/postgresql\n" in COMPOSE_TEXT
    assert "pgdata:/var/lib/postgresql/data" not in COMPOSE_TEXT
