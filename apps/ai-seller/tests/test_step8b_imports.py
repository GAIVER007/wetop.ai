"""Шаг 8б: модули панели импортируются и отдают обещанный контракт имён.

Тест дешёвый и ловит самое дорогое: опечатку в имени и циклический импорт,
который в бою всплывает при старте приложения, а не в наборе тестов.
"""

from __future__ import annotations

import dataclasses
import importlib
import inspect

import pytest

MODULES: dict[str, list[str]] = {
    "src.dashboard": [],
    "src.dashboard.security": [
        "hash_password",
        "verify_password",
        "LOGIN_FAILED_MESSAGE",
        "FAILED_DELAY_SECONDS",
        "LoginAttempt",
        "register_failure",
        "is_blocked",
        "reset_failures",
        "issue_token",
        "read_token",
        "check_ip_allowed",
        "require_dashboard_path",
        "ConfigError",
    ],
    "src.dashboard.twofa": [
        "new_secret",
        "provisioning_uri",
        "qr_svg",
        "current_step",
        "CodeCheck",
        "verify_code",
        "hash_backup_code",
        "new_backup_codes",
        "spend_backup_code",
    ],
    "src.dashboard.seed": ["ensure_admin_user", "admin_credentials_ok"],
    "src.dashboard.auth_router": ["router", "current_user", "require_owner"],
    "src.dashboard.panel_conversations": ["router", "build_reply_sender"],
    "src.dashboard.panel_settings": ["router"],
    "src.dashboard_router": ["router", "panel_router", "CollectSender", "SANDBOX_CHANNEL"],
}


@pytest.mark.parametrize("name", list(MODULES))
def test_module_imports_and_exposes_contract(name: str) -> None:
    module = importlib.import_module(name)
    missing = [attr for attr in MODULES[name] if not hasattr(module, attr)]
    assert not missing, f"{name}: нет {missing}"


@pytest.mark.parametrize("name", list(MODULES))
def test_every_module_says_what_it_is_for(name: str) -> None:
    """Docstring не украшение: без него через полгода никто не помнит,
    почему модуль устроен именно так."""
    doc = importlib.import_module(name).__doc__ or ""
    assert doc.strip(), name


def test_twofa_docstring_states_the_logging_rule() -> None:
    """🔴 Ни секрет, ни код, ни резервный код в журнал не пишутся — правило
    должно стоять в модуле, а не только в файле защиты."""
    doc = importlib.import_module("src.dashboard.twofa").__doc__ or ""

    assert "журнал" in doc.lower()


def test_one_message_for_every_failure() -> None:
    from src.dashboard.security import FAILED_DELAY_SECONDS, LOGIN_FAILED_MESSAGE

    assert isinstance(LOGIN_FAILED_MESSAGE, str) and LOGIN_FAILED_MESSAGE.strip()
    # Ни «нет такого пользователя», ни «неверный пароль» по отдельности.
    lowered = LOGIN_FAILED_MESSAGE.lower()
    assert "не найден" not in lowered
    assert "не существует" not in lowered
    assert FAILED_DELAY_SECONDS >= 1.0


def test_login_attempt_is_a_frozen_dataclass() -> None:
    from src.dashboard.security import LoginAttempt

    assert dataclasses.is_dataclass(LoginAttempt)
    assert [f.name for f in dataclasses.fields(LoginAttempt)] == [
        "allowed",
        "blocked_until",
        "count",
    ]
    with pytest.raises(dataclasses.FrozenInstanceError):
        LoginAttempt(allowed=False, blocked_until=None, count=1).count = 2  # type: ignore[misc]


def test_code_check_is_a_frozen_dataclass() -> None:
    from src.dashboard.twofa import CodeCheck

    assert dataclasses.is_dataclass(CodeCheck)
    assert [f.name for f in dataclasses.fields(CodeCheck)] == ["ok", "step", "reason"]
    with pytest.raises(dataclasses.FrozenInstanceError):
        CodeCheck(ok=True, step=1, reason="").ok = False  # type: ignore[misc]


def test_register_failure_signature() -> None:
    from src.dashboard.security import register_failure

    params = inspect.signature(register_failure).parameters
    assert list(params)[:3] == ["redis", "sessionmaker", "settings"]
    for name in ("email", "ip"):
        assert params[name].kind is inspect.Parameter.KEYWORD_ONLY, name


def test_issue_token_signature() -> None:
    from src.dashboard.security import issue_token

    params = inspect.signature(issue_token).parameters
    assert list(params)[0] == "settings"
    for name in ("email", "role", "twofa_done"):
        assert params[name].kind is inspect.Parameter.KEYWORD_ONLY, name


def test_verify_code_signature() -> None:
    from src.dashboard.twofa import verify_code

    params = inspect.signature(verify_code).parameters
    assert list(params)[:2] == ["secret", "code"]
    for name in ("last_step", "drift", "now"):
        assert params[name].kind is inspect.Parameter.KEYWORD_ONLY, name
    # 🔴 now — параметр, а не системные часы: иначе проверку не воспроизвести.
    assert params["now"].default is None


def test_sandbox_route_is_still_there() -> None:
    """Песочница «Остановки 2» живёт в том же роутере: правка шага 8б
    её не уносит."""
    from src.dashboard_router import router

    paths = {getattr(route, "path", "") for route in router.routes}

    assert "/internal/sandbox" in paths


def test_dashboard_modules_hold_no_secrets() -> None:
    """Ключи и пароли приходят из настроек, а не лежат в коде."""
    from pathlib import Path

    root = Path(__file__).resolve().parent.parent / "src"
    for path in [root / "dashboard_router.py", *(root / "dashboard").glob("*.py")]:
        text = path.read_text(encoding="utf-8")
        assert "$2b$" not in text, path  # готовый хеш пароля
        assert "otpauth://totp/?secret=" not in text, path
