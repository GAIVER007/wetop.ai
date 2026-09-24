"""Шаг 8б: сессия панели — подпись, срок, отказ вместо пустого экрана.

🔴 Истёкшая сессия отвечает 401, а не молчанием и не пустым списком:
клиент по 401 сам ведёт человека на форму входа, а пустой экран
неотличим от «данных нет» и разбирается звонком заказчика.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
import pytest

from tests.dashboard_fakes import (
    JWT_SECRET,
    OWNER_EMAIL,
    PANEL,
    dashboard_settings,
    bearer,
    make_user,
    panel,
    sync_db,  # noqa: F401 — фикстура берётся из пространства имён модуля
    token_for,
)

PROTECTED = f"{PANEL}/conversations"
# Чужой ключ подписи: длинный, иначе pyjwt справедливо ругается на длину.
FOREIGN_SECRET = "foreign-signing-key-not-ours-0123456789"


def _encode(*, secret: str, exp_delta: timedelta, tfa: bool = True) -> str:
    """Токен «как настоящий», но со сдвинутым сроком или чужой подписью."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": OWNER_EMAIL,
        "role": "owner",
        "tfa": tfa,
        "iat": int((now - timedelta(minutes=1)).timestamp()),
        "exp": int((now + exp_delta).timestamp()),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


@pytest.fixture
def session_panel(monkeypatch, fake_redis, sync_db):
    make_user(sync_db, email=OWNER_EMAIL)
    with panel(monkeypatch, fake_redis) as p:
        yield p


def test_valid_token_opens_the_api(session_panel) -> None:
    response = session_panel.client.get(PROTECTED, headers=session_panel.headers())

    assert response.status_code == 200, response.text


def test_expired_token_gives_401_not_an_empty_screen(session_panel) -> None:
    token = _encode(secret=JWT_SECRET, exp_delta=timedelta(seconds=-5))

    response = session_panel.client.get(PROTECTED, headers=bearer(token))

    assert response.status_code == 401
    # Тело не пустое: клиенту есть что показать и куда вести.
    assert response.json().get("detail")


def test_foreign_signature_gives_401(session_panel) -> None:
    token = _encode(secret=FOREIGN_SECRET, exp_delta=timedelta(hours=1))

    response = session_panel.client.get(PROTECTED, headers=bearer(token))

    assert response.status_code == 401


def test_no_token_gives_401(session_panel) -> None:
    response = session_panel.client.get(PROTECTED)

    assert response.status_code == 401


def test_garbage_token_gives_401(session_panel) -> None:
    response = session_panel.client.get(PROTECTED, headers=bearer("ne.token.vovse"))

    assert response.status_code == 401


def test_read_token_returns_none_instead_of_raising(monkeypatch) -> None:
    """🔴 Чтение токена не поднимает исключений: иначе каждый мусорный
    заголовок превращается в пятисотку и в шум в журнале."""
    from src.dashboard.security import read_token

    settings = dashboard_settings(monkeypatch)

    assert read_token(settings, "") is None
    assert read_token(settings, "ne.token.vovse") is None
    assert read_token(settings, _encode(secret=JWT_SECRET, exp_delta=timedelta(seconds=-5))) is None
    assert read_token(settings, _encode(secret=FOREIGN_SECRET, exp_delta=timedelta(hours=1))) is None


def test_issued_token_carries_subject_role_and_second_factor(monkeypatch) -> None:
    from src.dashboard.security import read_token

    settings = dashboard_settings(monkeypatch)
    token = token_for(settings, email=OWNER_EMAIL, role="operator", twofa=False)

    claims = read_token(settings, token)

    assert claims is not None
    assert claims["sub"] == OWNER_EMAIL
    assert claims["role"] == "operator"
    assert claims["tfa"] is False
    assert claims["exp"] > claims["iat"]


def test_ttl_comes_from_the_settings(monkeypatch) -> None:
    from src.dashboard.security import read_token

    settings = dashboard_settings(monkeypatch, DASHBOARD_SESSION_TTL_HOURS="2")
    claims = read_token(settings, token_for(settings))

    assert claims is not None
    lifetime = claims["exp"] - claims["iat"]
    assert abs(lifetime - 2 * 3600) <= 5, lifetime


def test_empty_secret_refuses_to_sign(monkeypatch) -> None:
    """🔴 Подписать пустым ключом — значит не подписать: любой соберёт
    себе токен владельца."""
    from src.dashboard.security import ConfigError, issue_token

    settings = dashboard_settings(monkeypatch, DASHBOARD_JWT_SECRET="")

    with pytest.raises(ConfigError):
        issue_token(settings, email=OWNER_EMAIL, role="owner", twofa_done=True)


def test_config_error_is_a_runtime_error() -> None:
    from src.dashboard.security import ConfigError

    assert issubclass(ConfigError, RuntimeError)
