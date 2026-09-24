"""Виджет: опознание пользователя платформы.

🔴 Кто пишет — решает подпись платформы, а не то, что прислал браузер.
Любой посетитель может отправить какой угодно user_id; доверяем только
тому, что подписано общим секретом и не просрочено. Неподписанный
посетитель обслуживается, но как аноним.

🔴 В журнал не уходит ни токен, ни почта целиком: журнал читают чаще,
чем базу, и утекает он легче.
"""

from __future__ import annotations

import logging
import time

import pytest

from src.channels.widget_identity import anonymous, read_identity, sign_identity
from tests.dashboard_fakes import sync_db  # noqa: F401 — фикстура из пространства имён модуля
from tests.widget_fakes import (
    IDENTITY_SECRET,
    ORG_ID,
    USER_EMAIL,
    USER_ID,
    USER_ROLE,
    conversation_of,
    identity_token,
    widget_app,
)

TTL = 3600


def _read(token: str | None, *, secret: str = IDENTITY_SECRET, now: int | None = None):
    return read_identity(secret, token, now=int(time.time()) if now is None else now, ttl_seconds=TTL)


# ─── Подпись и проверка ───


def test_signed_identity_is_read_back() -> None:
    visitor = _read(identity_token())

    assert visitor is not None
    assert visitor.signed is True
    assert visitor.user_id == USER_ID
    assert visitor.email == USER_EMAIL
    assert visitor.org_id == ORG_ID
    assert visitor.role == USER_ROLE
    # Ключ посетителя — всегда строка: по нему заводится клиент канала.
    assert isinstance(visitor.key, str) and visitor.key


def test_expired_identity_is_not_trusted() -> None:
    """Срок нужен затем, что утёкший токен иначе годен вечно."""
    old = int(time.time()) - TTL - 60

    assert _read(identity_token(issued_at=old)) is None


def test_identity_from_the_future_is_not_trusted() -> None:
    """Часы платформы могут уйти на секунды, но не на час: запас 60 с."""
    ahead = int(time.time()) + 600

    assert _read(identity_token(issued_at=ahead)) is None


def test_tampered_signature_is_not_trusted() -> None:
    token = identity_token()
    payload, _, mac = token.partition(".")
    spoiled = f"{payload}.{'0' * len(mac)}"

    assert _read(spoiled) is None


def test_tampered_payload_is_not_trusted() -> None:
    """Подпись считается по полям: подмена роли ломает её."""
    token = identity_token(role="user")
    other = identity_token(role="admin")
    payload, _, _ = other.partition(".")
    _, _, mac = token.partition(".")

    assert _read(f"{payload}.{mac}") is None


def test_empty_secret_trusts_nobody() -> None:
    """🔴 Нет ключа — нет доверия: иначе незаполненная настройка превращает
    любого посетителя в кого угодно."""
    assert _read(identity_token(), secret="") is None


@pytest.mark.parametrize("token", [None, "", "мусор", "a.b.c", "bez-tochki", "."])
def test_broken_token_gives_none_without_raising(token: str | None) -> None:
    assert _read(token) is None


def test_anonymous_visitor_is_a_visitor_too() -> None:
    visitor = anonymous("v-777")

    assert visitor.signed is False
    assert visitor.key == "v-777"
    assert visitor.user_id is None
    assert visitor.display_name is None


def test_signature_is_stable_for_the_same_fields() -> None:
    """Формат нужен платформе: она подписывает своим кодом, бот — проверяет."""
    issued_at = 1_700_000_000
    args = dict(user_id=USER_ID, email=USER_EMAIL, org_id=ORG_ID, role=USER_ROLE, issued_at=issued_at)

    first = sign_identity(IDENTITY_SECRET, **args)
    second = sign_identity(IDENTITY_SECRET, **args)

    assert first == second
    assert sign_identity("drugoy-sekret", **args) != first
    assert first.count(".") == 1


# ─── Признак в диалоге ───


@pytest.fixture
def app(monkeypatch, fake_redis, sync_db):  # noqa: F811
    with widget_app(monkeypatch, fake_redis) as w:
        yield w


def test_signed_visitor_lands_in_lead_data(app, sync_db) -> None:  # noqa: F811
    """Оператор и инструменты должны видеть, кто пишет из платформы."""
    response = app.session(identity=identity_token())

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["signed"] is True

    conversation = conversation_of(sync_db, body["visitor_key"])
    platform_user = dict(conversation.lead_data or {}).get("platform_user")
    assert platform_user, conversation.lead_data
    assert platform_user["user_id"] == USER_ID
    assert platform_user["org_id"] == ORG_ID
    assert platform_user["role"] == USER_ROLE


def test_expired_identity_is_served_as_anonymous(app, sync_db) -> None:  # noqa: F811
    """Просроченный признак — не отказ в обслуживании: посетитель аноним."""
    old = int(time.time()) - TTL - 60

    response = app.session(identity=identity_token(issued_at=old))

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["signed"] is False
    conversation = conversation_of(sync_db, body["visitor_key"])
    assert "platform_user" not in dict(conversation.lead_data or {})


def test_forged_identity_is_served_as_anonymous(app, sync_db) -> None:  # noqa: F811
    forged = identity_token(secret="chuzhoy-sekret", user_id="u-admin", role="owner")

    body = app.session(identity=forged).json()

    assert body["signed"] is False
    conversation = conversation_of(sync_db, body["visitor_key"])
    assert "u-admin" not in str(conversation.lead_data)


def test_without_the_secret_even_a_valid_signature_is_anonymous(
    monkeypatch, fake_redis, sync_db  # noqa: F811
) -> None:
    with widget_app(monkeypatch, fake_redis, WIDGET_IDENTITY_SECRET="") as app:
        body = app.session(identity=identity_token()).json()

    assert body["signed"] is False


def test_log_holds_neither_the_token_nor_the_email(
    monkeypatch, fake_redis, sync_db, caplog: pytest.LogCaptureFixture  # noqa: F811
) -> None:
    token = identity_token()
    with caplog.at_level(logging.DEBUG):
        with widget_app(monkeypatch, fake_redis) as app:
            key = app.new_visitor(identity=token)
            app.session(visitor_key=key, identity="podmenennyy.tokenchik")

    text = "\n".join(record.getMessage() for record in caplog.records)
    assert token not in text
    assert "podmenennyy.tokenchik" not in text
    assert USER_EMAIL not in text


def test_a_user_id_with_a_dot_and_an_at_works_everywhere(monkeypatch, fake_redis, sync_db) -> None:  # noqa: F811
    """🔴 Правило про ключ должно быть одно на все двери. Почта как
    идентификатор — обычное дело у платформы; если опрос судит ключ строже,
    чем приём, такой пользователь пишет боту и не видит ни одного ответа."""
    from tests.widget_fakes import FakeRunner

    token = identity_token(user_id="ivan.petrov@example.com")
    runner = FakeRunner()
    with widget_app(monkeypatch, fake_redis, runner=runner) as app:
        key = app.new_visitor(identity=token)
        sent = app.message(key, "Здравствуйте", identity=token)
        polled = app.poll(key, identity=token)

    assert key == "pu:ivan.petrov@example.com"
    assert sent.status_code == 200, sent.text
    assert runner.submitted[-1].external_id == key
    assert polled.status_code == 200, polled.text
    assert polled.json()["messages"] == []
