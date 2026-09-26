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
        ("GET", "/prompt"),
        ("PUT", "/settings/model"),
        ("POST", "/2fa/setup"),
    ],
)
def test_route_outside_the_list_is_forbidden_for_the_seller(
    monkeypatch, fake_redis, sync_db, method: str, path: str  # noqa: F811
) -> None:
    with panel(monkeypatch, fake_redis, SELLER_SERVICE_KEY=KEY, BOT_ROLE="seller") as p:
        response = p.client.request(method, f"{PANEL}{path}", headers={HEADER: KEY}, json={})
        assert response.status_code == 403, f"{method} {path} открыт служебным ключом продавца"


# «Платформа → Техподдержка» (ADR-084): помощник — бот самой платформы, его правила ведёт главный
# администратор WETOP. Служебный ключ помощника открывает ещё правила и выбор модели.
SUPPORT_EXTRA = [("GET", "/prompt"), ("PUT", "/prompt"), ("GET", "/settings"), ("PUT", "/settings/model")]


@pytest.mark.parametrize(("method", "path"), SUPPORT_EXTRA)
def test_support_key_opens_rules_and_model(monkeypatch, fake_redis, sync_db, method: str, path: str) -> None:  # noqa: F811
    with panel(monkeypatch, fake_redis, SELLER_SERVICE_KEY=KEY, BOT_ROLE="support") as p:
        body = {"text": "Ты — помощник WETOP."} if path == "/prompt" else {"model": "нет-такой"}
        response = p.client.request(method, f"{PANEL}{path}", headers={HEADER: KEY}, json=body)
        # маршрут открыт: дальше решает сам обработчик (модели нет в списке — 404 или 400, но не 403)
        assert response.status_code != 403, f"{method} {path}: {response.text}"


def test_support_key_writes_the_rules_the_engine_reads(monkeypatch, fake_redis, sync_db) -> None:  # noqa: F811
    with panel(monkeypatch, fake_redis, SELLER_SERVICE_KEY=KEY, BOT_ROLE="support") as p:
        text = "Ты — помощник WETOP. Отвечай коротко."
        assert p.client.put(f"{PANEL}/prompt", headers={HEADER: KEY}, json={"text": text}).status_code == 200
        assert p.client.get(f"{PANEL}/prompt", headers={HEADER: KEY}).json() == {"text": text}


def test_mistyped_role_keeps_the_rules_closed(monkeypatch, fake_redis, sync_db) -> None:  # noqa: F811
    """Опечатка в BOT_ROLE не открывает правила ключу: иначе опечатка в .env продавца отдала бы его ядро правил
    платформе. С 26.09 (аудит, С-60) опечатка не сводится к support, а не даёт боту стартовать вовсе — закрыто всё."""
    from pydantic import ValidationError

    with pytest.raises(ValidationError), panel(monkeypatch, fake_redis, SELLER_SERVICE_KEY=KEY, BOT_ROLE="suport"):
        pass


def test_second_factor_setup_stays_closed_to_the_support_key(monkeypatch, fake_redis, sync_db) -> None:  # noqa: F811
    with panel(monkeypatch, fake_redis, SELLER_SERVICE_KEY=KEY, BOT_ROLE="support") as p:
        assert p.client.post(f"{PANEL}/2fa/setup", headers={HEADER: KEY}, json={}).status_code == 403


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
