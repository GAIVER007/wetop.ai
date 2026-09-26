"""Виджет: кросс-доменные заголовки.

🔴 Виджет стоит на странице платформы, а бот живёт на своём домене: ВСЕ
его запросы кросс-доменные. Без заголовков Access-Control браузер отбросит
ответы, и не будет ни сессии, ни опроса, ни отправки — а тесты на самом
адресе бота (/widget/demo) этого не заметят.

Открыт CORS только доменам из WIDGET_SITE_HOSTS: общий CORS приложения
под виджет расширять нельзя.
"""

from __future__ import annotations

import pytest

from tests.dashboard_fakes import sync_db  # noqa: F401 — фикстура из пространства имён модуля
from tests.widget_fakes import OTHER_ORIGIN, PREFIX, SITE_ORIGIN, widget_app


@pytest.fixture
def app(monkeypatch, fake_redis, sync_db):  # noqa: F811
    with widget_app(monkeypatch, fake_redis) as w:
        yield w


def test_middleware_is_actually_plugged_in(app) -> None:
    """Объявленный, но не подключённый слой — мёртвый класс и нерабочий канал."""
    names = [str(m) for m in app.client.app.user_middleware]
    assert any("WidgetCorsMiddleware" in name for name in names), names


def test_session_answers_the_platform_domain(app) -> None:
    response = app.session()

    assert response.status_code == 200, response.text
    assert response.headers.get("access-control-allow-origin") == SITE_ORIGIN
    # 🔴 Без Vary кэш отдаст чужому сайту заголовок, выписанный нашему.
    assert "Origin" in response.headers.get("vary", "")


def test_preflight_is_answered(app) -> None:
    """Предполётный запрос браузер шлёт сам: 405 на нём закрывает виджет."""
    response = app.client.options(
        f"{PREFIX}/message",
        headers={
            "Origin": SITE_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 204, response.status_code
    assert response.headers.get("access-control-allow-origin") == SITE_ORIGIN
    assert "POST" in response.headers.get("access-control-allow-methods", "")


def test_foreign_domain_gets_no_headers(app) -> None:
    response = app.session(origin=OTHER_ORIGIN)

    assert response.status_code == 403, response.text
    assert "access-control-allow-origin" not in response.headers


def test_the_script_itself_is_cross_domain_too(app) -> None:
    """Скрипт тянет страница платформы: без заголовка его не будет видно."""
    response = app.client.get(f"{PREFIX}/widget.js", headers={"Origin": SITE_ORIGIN})

    assert response.status_code == 200, response.text
    assert response.headers.get("access-control-allow-origin") == SITE_ORIGIN


def test_other_paths_are_left_to_the_common_cors(app) -> None:
    """Слой трогает только /widget: остальное приложение живёт своим CORS."""
    response = app.client.get("/health", headers={"Origin": SITE_ORIGIN})

    assert response.status_code == 200, response.text
    assert "access-control-allow-origin" not in response.headers
