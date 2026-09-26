"""Виджет: сессия посетителя.

Посетитель опознаётся ключом из localStorage: одна вкладка — один диалог,
перезагрузка страницы не начинает разговор заново. Чужой сайт, вставивший
скрипт к себе, к боту не подключается — проверяется Origin.
"""

from __future__ import annotations

import pytest

from tests.dashboard_fakes import sync_db  # noqa: F401 — фикстура из пространства имён модуля
from tests.widget_fakes import (
    CHANNEL,
    OTHER_ORIGIN,
    clients_of,
    conversation_of,
    widget_app,
)


@pytest.fixture
def app(monkeypatch, fake_redis, sync_db):  # noqa: F811
    with widget_app(monkeypatch, fake_redis) as w:
        yield w


def test_new_visitor_gets_a_key_and_a_dialog(app, sync_db) -> None:  # noqa: F811
    response = app.session()

    assert response.status_code == 200, response.text
    body = response.json()
    key = body["visitor_key"]
    assert isinstance(key, str) and key
    assert body["signed"] is False
    assert conversation_of(sync_db, key) is not None

    clients = clients_of(sync_db)
    assert [c.channel for c in clients] == [CHANNEL]
    # 🔴 Внешний идентификатор — строкой, без сюрпризов на границе.
    assert clients[0].external_id == key
    assert isinstance(clients[0].external_id, str)


def test_the_same_key_returns_the_same_dialog(app, sync_db) -> None:  # noqa: F811
    """Перезагрузка страницы не начинает разговор заново."""
    key = app.new_visitor()
    first = conversation_of(sync_db, key)

    again = app.session(visitor_key=key)

    assert again.status_code == 200, again.text
    assert again.json()["visitor_key"] == key
    assert conversation_of(sync_db, key).id == first.id
    assert len(clients_of(sync_db)) == 1


def test_two_visitors_get_two_dialogs(app, sync_db) -> None:  # noqa: F811
    first = app.new_visitor()
    second = app.new_visitor()

    assert first != second
    assert conversation_of(sync_db, first).id != conversation_of(sync_db, second).id


def test_foreign_origin_is_refused(app) -> None:
    """Скрипт виджета, вставленный на чужой сайт, к боту не подключается."""
    response = app.session(origin=OTHER_ORIGIN)

    assert response.status_code == 403, response.text


def test_empty_host_list_lets_everyone_in(monkeypatch, fake_redis, sync_db) -> None:  # noqa: F811
    """Пустой список доменов — режим разработки: проверка Origin выключена.
    Предупреждение об этом пишется при старте, его сторожит отдельный тест."""
    with widget_app(monkeypatch, fake_redis, WIDGET_SITE_HOSTS="") as app:
        response = app.session(origin=OTHER_ORIGIN)

    assert response.status_code == 200, response.text


def test_empty_host_list_warns_once_at_start(
    monkeypatch, fake_redis, sync_db, caplog: pytest.LogCaptureFixture  # noqa: F811
) -> None:
    """🔴 Молчаливый старт с выключенной проверкой Origin ищут потом полдня."""
    import logging

    with caplog.at_level(logging.WARNING):
        with widget_app(monkeypatch, fake_redis, WIDGET_SITE_HOSTS="") as app:
            app.session(origin=OTHER_ORIGIN)

    warnings = [r.getMessage().lower() for r in caplog.records if r.levelno >= logging.WARNING]
    assert any("origin" in text or "домен" in text for text in warnings), warnings


def test_no_origin_header_is_still_served(app) -> None:
    """Запрос без Origin — это не чужой сайт, а прямой заход (демо-страница,
    старый браузер). Отбивать его нечем и незачем."""
    response = app.session(origin=None)

    assert response.status_code == 200, response.text


# ─── Срок жизни ключа ───


def test_the_key_lifetime_comes_from_the_settings(monkeypatch, fake_redis, sync_db) -> None:  # noqa: F811
    """🔴 Настройка, которую никто не читает, — обещание, которое врёт:
    заказчик сократит срок в окружении, а браузер будет держать ключ месяц.
    Срок едет в ответе сессии, скрипт кладёт его рядом с ключом."""
    with widget_app(monkeypatch, fake_redis, WIDGET_SESSION_TTL_HOURS="1") as app:
        body = app.session().json()

    assert body["session_ttl_hours"] == 1


def test_the_script_takes_the_lifetime_from_the_answer() -> None:
    """Иначе срок остаётся зашитой константой, и настройка ни на что не влияет."""
    from pathlib import Path

    script = (Path(__file__).resolve().parent.parent / "src" / "site" / "widget.js").read_text(
        encoding="utf-8"
    )

    assert "session_ttl_hours" in script
    # Зашитого «720 часов» в проверке срока не осталось: только запас
    # на самый первый заход, когда ответа сессии ещё не было.
    assert script.count("720") == 1, "срок жизни ключа зашит в скрипт"
