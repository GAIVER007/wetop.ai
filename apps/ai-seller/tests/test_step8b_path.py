"""Шаг 8б: адрес панели берётся из настроек, а не /admin.

⚠️ Сам по себе длинный путь — не защита: он утекает в историю браузера
и в журналы привратника. Смысл один — убрать фоновый шум автоматических
переборщиков, которые круглые сутки ломятся в /admin и /wp-admin.

🔴 Пустой DASHBOARD_PATH_PREFIX не должен проходить молча: приложение
живёт (бот отвечает клиентам), но панель не подключается, и об этом есть
понятная строка в журнале.
"""

from __future__ import annotations

import logging

import pytest
from fastapi.testclient import TestClient

from tests.dashboard_fakes import (
    OWNER_EMAIL,
    OWNER_PASSWORD,
    PANEL,
    dashboard_settings,
    make_user,
    panel,
    sync_db,  # noqa: F401 — фикстура берётся из пространства имён модуля
    use_fake_redis,
)

LOGIN = {"email": OWNER_EMAIL, "password": OWNER_PASSWORD}


def test_empty_prefix_says_so_and_closes_the_panel(monkeypatch, fake_redis, caplog) -> None:
    """Сборка не стартует молча: в журнале ошибка с именем настройки."""
    from src.main import create_app

    dashboard_settings(monkeypatch, DASHBOARD_PATH_PREFIX="")
    use_fake_redis(monkeypatch, fake_redis)

    with caplog.at_level(logging.ERROR):
        app = create_app()

    assert "DASHBOARD_PATH_PREFIX" in caplog.text, caplog.text

    with TestClient(app, raise_server_exceptions=False) as client:
        # Приложение живёт: бот продолжает обслуживать клиентов.
        assert client.get("/health").status_code == 200
        # Панели нет ни по настроенному пути, ни по корню.
        assert client.post(f"{PANEL}/login", json=LOGIN).status_code == 404
        assert client.post("/login", json=LOGIN).status_code == 404


def test_panel_answers_on_the_configured_path(monkeypatch, fake_redis, sync_db) -> None:
    make_user(sync_db)
    with panel(monkeypatch, fake_redis) as p:
        assert p.login().status_code == 200


def test_admin_path_is_not_the_panel(monkeypatch, fake_redis, sync_db) -> None:
    """Переборщик, который ломится в /admin, получает 404, а не форму входа."""
    make_user(sync_db)
    with panel(monkeypatch, fake_redis) as p:
        for path in ("/admin/login", "/admin", "/wp-admin", "/login"):
            assert p.client.post(path, json=LOGIN).status_code == 404, path


def test_sandbox_survives_the_step(monkeypatch, fake_redis, sync_db) -> None:
    """Песочница «Остановки 2» остаётся на месте: 403 без ключа — значит
    маршрут есть; 404 означал бы, что его снесли вместе с правкой роутера."""
    with panel(monkeypatch, fake_redis) as p:
        response = p.client.post("/internal/sandbox", json={"external_id": "u1", "text": "привет"})

    assert response.status_code == 403


def test_require_dashboard_path_refuses_empty(monkeypatch) -> None:
    from src.dashboard.security import ConfigError, require_dashboard_path

    settings = dashboard_settings(monkeypatch, DASHBOARD_PATH_PREFIX="")

    with pytest.raises(ConfigError) as info:
        require_dashboard_path(settings)

    # Текст должен называть настройку: искать причину по слову «ошибка» дорого.
    assert "DASHBOARD_PATH_PREFIX" in str(info.value)


@pytest.mark.parametrize("raw", ["p7k2m9x4qz1w", "/p7k2m9x4qz1w", "/p7k2m9x4qz1w/"])
def test_require_dashboard_path_normalizes_slashes(monkeypatch, raw: str) -> None:
    """Заказчик впишет путь и со слешем, и без: нормализуем, а не падаем."""
    from src.dashboard.security import require_dashboard_path

    settings = dashboard_settings(monkeypatch, DASHBOARD_PATH_PREFIX=raw)

    assert require_dashboard_path(settings) == "/p7k2m9x4qz1w"


def test_health_says_nothing_about_the_panel(monkeypatch, fake_redis, sync_db) -> None:
    """Публичная живость — только статус: путь панели туда не просачивается."""
    with panel(monkeypatch, fake_redis) as p:
        response = p.client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert PANEL not in response.text
