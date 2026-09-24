"""Служебный вход платформы в панель бота (ТЗ интеграции, Б5).

Раздел «ИИ-продавец» в платформе управляет ботом с сервера, а не руками
человека: пароль и второй фактор тут неприменимы. Ключ открывает ровно
список маршрутов и ничего сверх него.
"""

from __future__ import annotations

import logging

import pytest

from tests.dashboard_fakes import PANEL, panel, sync_db  # noqa: F401 — фикстура

KEY = "service-key-for-tests-only"
HEADER = "X-Service-Key"


@pytest.fixture
def app(monkeypatch, fake_redis, sync_db):  # noqa: F811
    with panel(monkeypatch, fake_redis, SELLER_SERVICE_KEY=KEY) as p:
        yield p


def _get(app, path: str, key: str | None = KEY):
    headers = {HEADER: key} if key is not None else {}
    return app.client.get(f"{PANEL}{path}", headers=headers)


def test_right_key_opens_a_listed_route(app) -> None:
    assert _get(app, "/conversations").status_code == 200


def test_wrong_key_is_refused(app) -> None:
    assert _get(app, "/conversations", key="wrong-key").status_code == 401


def test_non_ascii_key_is_refused_not_crashed(app) -> None:
    """Сравнение байтами: compare_digest на строках падает на не-ASCII, и
    посторонний заголовок давал бы 500 вместо отказа."""
    # Байтами: клиент не отправит такую строку, а живой запрос с чужими байтами — да.
    response = app.client.get(f"{PANEL}/conversations", headers={HEADER.encode(): "ключ".encode("utf-8")})
    assert response.status_code == 401


def test_empty_key_in_settings_closes_the_door(monkeypatch, fake_redis, sync_db) -> None:  # noqa: F811
    """Ключ не задан — это «не настроено», а не «пускаем всех»."""
    with panel(monkeypatch, fake_redis, SELLER_SERVICE_KEY="") as p:
        assert _get(p, "/conversations", key="").status_code == 401
        assert _get(p, "/conversations", key="any-key").status_code == 401


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("PUT", "/prompt"),  # 🔴 ядро правил продавца платформа не переписывает
        ("PUT", "/settings/model"),
        ("POST", "/2fa/setup"),
    ],
)
def test_route_outside_the_list_is_forbidden(app, method: str, path: str) -> None:
    response = app.client.request(method, f"{PANEL}{path}", headers={HEADER: KEY}, json={})
    assert response.status_code == 403, f"{method} {path} открыт служебным ключом"


def test_the_key_acts_as_the_owner_on_listed_owner_routes(app) -> None:
    """Загрузка знаний — действие владельца; раздел платформы им пользуется."""
    response = app.client.post(
        f"{PANEL}/knowledge",
        headers={HEADER: KEY},
        files={"file": ("pravila.md", "Заезд с 14:00.".encode(), "text/markdown")},
    )
    assert response.status_code != 403, response.text


def test_the_key_never_reaches_the_log(app, caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.DEBUG)
    _get(app, "/conversations")
    _get(app, "/conversations", key="wrong-key")
    assert KEY not in caplog.text


def test_human_login_still_works_beside_the_key(app) -> None:
    """Служебный вход — дополнение, а не замена входу человека."""
    assert app.client.get(f"{PANEL}/conversations", headers=app.headers()).status_code == 200
    assert app.client.get(f"{PANEL}/conversations").status_code == 401


def test_the_sandbox_accepts_the_service_key(monkeypatch, fake_redis, sync_db) -> None:  # noqa: F811
    """Экран «Проверка» раздела говорит с ботом через песочницу: без ключа
    платформе туда не попасть, с чужим — тоже."""
    with panel(monkeypatch, fake_redis, SELLER_SERVICE_KEY=KEY) as p:
        body = {"external_id": "platform-check", "text": "Здравствуйте"}
        assert p.client.post("/internal/sandbox", json=body, headers={HEADER: "wrong-key"}).status_code == 403
        assert p.client.post("/internal/sandbox", json=body, headers={HEADER: KEY}).status_code != 403
