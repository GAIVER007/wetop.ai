"""Виджет: гейт согласия (слой 0б).

🔴 Механизм без пути его снятия — тупик: движок на каждое сообщение
возвращает экран согласия, а записать согласие нечем, и бот не отвечает
никогда. Кнопку рисовал удалённый канал; теперь её принимает виджет.

Доказательством идёт дословно тот текст, который человек видел: флага
«да» недостаточно, предъявлять придётся обстоятельства.
"""

from __future__ import annotations

import pytest
import sqlalchemy as sa

from src.channels.consent_gate import consent_screen
from src.config import get_settings
from src.db.models import Client, Consent
from tests.dashboard_fakes import sync_db  # noqa: F401 — фикстура из пространства имён модуля
from tests.widget_fakes import CHANNEL, OTHER_ORIGIN, FakeRunner, widget_app

GATE_ON = {"CONSENT_GATE_ENABLED": "true", "CONSENT_POLICY_VERSION": "2024-01",
           "CONSENT_POLICY_URL": "https://app.example.test/policy"}


@pytest.fixture
def runner() -> FakeRunner:
    return FakeRunner()


@pytest.fixture
def app(monkeypatch, fake_redis, sync_db, runner):  # noqa: F811
    with widget_app(monkeypatch, fake_redis, runner=runner, **GATE_ON) as w:
        yield w


def _consents(sessions) -> list[Consent]:
    with sessions() as session:
        rows = list(session.execute(sa.select(Consent)).scalars())
        session.commit()
        return rows


def test_session_says_that_consent_is_needed(app) -> None:
    """Виджету надо знать, что рисовать кнопку: иначе снять гейт нечем."""
    body = app.session().json()

    assert body["consent_required"] is True


def test_the_visitor_can_agree_and_the_gate_opens(app, sync_db) -> None:  # noqa: F811
    key = app.new_visitor()

    granted = app.consent(key)

    assert granted.status_code == 200, granted.text
    # Тот же вопрос, что задаёт движок перед каждым ходом, теперь отвечает «нет».
    assert app.session(visitor_key=key).json()["consent_required"] is False


def test_what_is_written_is_what_was_shown(app, sync_db) -> None:  # noqa: F811
    key = app.new_visitor()

    app.consent(key)

    rows = _consents(sync_db)
    assert len(rows) == 1
    assert rows[0].method == CHANNEL
    assert rows[0].shown_text == consent_screen(get_settings()).text
    assert rows[0].policy_version == "2024-01"
    assert rows[0].revoked_at is None


def test_second_click_does_not_break_anything(app, sync_db) -> None:  # noqa: F811
    """Повторное нажатие — обычное дело: проверка «уже сделано» ДО записи."""
    key = app.new_visitor()

    first = app.consent(key)
    second = app.consent(key)

    assert (first.status_code, second.status_code) == (200, 200), second.text
    assert len(_consents(sync_db)) == 1


def test_consent_belongs_to_this_visitor(app, sync_db) -> None:  # noqa: F811
    mine = app.new_visitor()
    theirs = app.new_visitor()

    app.consent(mine)

    with sync_db() as session:
        holder = session.execute(
            sa.select(Client.external_id).join(Consent, Consent.client_id == Client.id)
        ).scalar_one()
        session.commit()
    assert holder == mine != theirs


def test_a_foreign_site_cannot_agree_for_anybody(app) -> None:
    key = app.new_visitor()

    assert app.consent(key, origin=OTHER_ORIGIN).status_code == 403


def test_without_a_key_there_is_nobody_to_agree(app) -> None:
    """Ключ здесь не выдаётся: согласие без разговора никому не нужно."""
    response = app.client.post("/widget/consent", json={}, headers=app.headers())

    assert response.status_code == 400, response.text


def test_the_gate_is_off_by_default(monkeypatch, fake_redis, sync_db, runner) -> None:  # noqa: F811
    """Выключен — экрана нет: основание обработки не согласие, и лишний
    экран здесь только отвал на входе."""
    with widget_app(monkeypatch, fake_redis, runner=runner) as app:
        assert app.session().json()["consent_required"] is False
