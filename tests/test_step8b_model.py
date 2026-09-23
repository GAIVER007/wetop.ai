"""Шаг 8б: смена модели из панели — только из списка и только владельцем.

Свободного поля с именем модели быть не должно: опечатка в имени роутера
превращается в «бот молчит», и искать её будут в каскаде, а не в панели.
Смена пишется в owner_actions вместе с ПРЕЖНИМ значением: без него некуда
возвращаться, когда новая модель окажется хуже.
🔴 Экран настроек не отдаёт ни одного секрета: панель стоит наружу.
"""

from __future__ import annotations

import pytest

from tests.dashboard_fakes import (
    OPERATOR_EMAIL,
    OWNER_EMAIL,
    PANEL,
    as_text,
    make_user,
    owner_actions,
    panel,
    sync_db,  # noqa: F401 — фикстура берётся из пространства имён модуля
)

SETTINGS = f"{PANEL}/settings"
MODEL = f"{PANEL}/settings/model"
FIRST = "vendor-a/base"
SECOND = "vendor-b/fallback"
ALLOWED = f"{FIRST},{SECOND}"

# Приметные значения: если секрет просочится в ответ, это будет видно.
SECRETS = {
    "LLM_API_KEY": "sk-primetnyy-klyuch-modeli",
    "SMTP_PASSWORD": "primetnyy-parol-pochty",
    "WIDGET_IDENTITY_SECRET": "primetnyy-sekret-vidzheta",
    "INTERNAL_HEALTH_KEY": "primetnyy-vnutrenniy-klyuch",
}


@pytest.fixture
def with_models(monkeypatch, fake_redis, sync_db):
    """Панель со списком моделей, владельцем и оператором."""
    make_user(sync_db, email=OWNER_EMAIL, role="owner")
    make_user(sync_db, email=OPERATOR_EMAIL, role="operator")
    with panel(monkeypatch, fake_redis, LLM_ALLOWED_MODELS=ALLOWED, **SECRETS) as p:
        yield p


@pytest.fixture
def without_models(monkeypatch, fake_redis, sync_db):
    """Список пуст — экран выбора модели не показывается вовсе."""
    make_user(sync_db, email=OWNER_EMAIL, role="owner")
    with panel(monkeypatch, fake_redis, LLM_ALLOWED_MODELS="") as p:
        yield p


def _operator(p) -> dict[str, str]:
    return p.headers(role="operator", email=OPERATOR_EMAIL)


def test_settings_show_the_list_and_the_current_model(with_models) -> None:
    response = with_models.client.get(SETTINGS, headers=with_models.headers())

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["models"] == [FIRST, SECOND]
    assert body["model"] == FIRST


def test_settings_carry_no_secrets(with_models) -> None:
    """🔴 Ни ключа модели, ни пароля почты, ни токена канала, ни ключа
    подписи сессий: экран настроек открыт в браузере оператора."""
    response = with_models.client.get(SETTINGS, headers=with_models.headers())
    text = as_text(response.json())

    for value in SECRETS.values():
        assert value not in text, value
    assert with_models.settings.dashboard_jwt_secret not in text
    assert with_models.settings.dashboard_admin_password_hash not in text


def test_empty_list_hides_the_screen(without_models) -> None:
    body = without_models.client.get(SETTINGS, headers=without_models.headers()).json()

    assert body.get("models") in ([], None)


def test_empty_list_refuses_the_change_with_404(without_models) -> None:
    """Экрана нет — значит и ручки нет: 404, а не «поменяли на что попало»."""
    response = without_models.client.put(
        MODEL, json={"model": FIRST}, headers=without_models.headers()
    )

    assert response.status_code == 404


def test_owner_changes_the_model_and_the_previous_value_is_kept(with_models, sync_db) -> None:
    response = with_models.client.put(
        MODEL, json={"model": SECOND}, headers=with_models.headers()
    )

    assert response.status_code == 200, response.text
    # Правка действует: тот же экран уже показывает новую модель.
    current = with_models.client.get(SETTINGS, headers=with_models.headers()).json()
    assert current["model"] == SECOND

    rows = owner_actions(sync_db)
    assert rows, "смена модели не записана в owner_actions"
    payload = as_text(rows[-1].payload)
    assert SECOND in payload
    assert FIRST in payload, "прежнего значения нет — возвращаться некуда"


def test_model_outside_the_list_is_refused(with_models, sync_db) -> None:
    """Даже если роутер такую модель знает: список — это решение владельца."""
    response = with_models.client.put(
        MODEL, json={"model": "vendor-c/neizvestnaya"}, headers=with_models.headers()
    )

    assert response.status_code == 400
    assert owner_actions(sync_db) == []
    body = with_models.client.get(SETTINGS, headers=with_models.headers()).json()
    assert body["model"] == FIRST


def test_operator_cannot_change_the_model(with_models, sync_db) -> None:
    response = with_models.client.put(MODEL, json={"model": SECOND}, headers=_operator(with_models))

    assert response.status_code == 403
    assert owner_actions(sync_db) == []


def test_operator_still_sees_the_settings_screen(with_models) -> None:
    """Смотреть можно, менять нельзя: иначе оператор не понимает, на чём работает."""
    response = with_models.client.get(SETTINGS, headers=_operator(with_models))

    assert response.status_code == 200
