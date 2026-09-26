"""Шаг 8б: второй фактор. Пароль защищает до того момента, как его узнали.

🔴 Один код принимается один раз: номер использованного шага запоминается,
иначе подсмотренный код работает ещё полминуты.
🔴 Второй фактор включается только после подтверждения первым верным кодом,
иначе человек теряет доступ в ту же минуту, если не успел отсканировать QR.
🔴 Секрета и резервных кодов нет ни в журнале, ни в ответе после подключения.

Время в проверках кода считается от переданного now, а не от системных
часов: иначе тест зелёный или красный смотря по тому, в какую секунду запущен.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone

import pyotp
import pytest

from tests.dashboard_fakes import (
    OWNER_EMAIL,
    PANEL,
    bearer,
    get_user,
    make_user,
    panel,
    step_code,
    sync_db,  # noqa: F401 — фикстура берётся из пространства имён модуля
)

# Фиксированный момент: все проверки шагов считаются от него, не от «сейчас».
NOW = datetime(2026, 3, 1, 12, 0, 30, tzinfo=timezone.utc)
CONVERSATIONS = f"{PANEL}/conversations"


def _secret() -> str:
    from src.dashboard.twofa import new_secret

    return new_secret()


def _at(secret: str, step: int) -> str:
    return step_code(secret, step)


# ─── Чистые проверки кода ───


def test_current_step_is_unix_time_divided_by_thirty() -> None:
    from src.dashboard.twofa import current_step

    assert current_step(NOW) == int(NOW.timestamp()) // 30


def test_code_of_the_current_step_is_accepted_and_step_returned() -> None:
    from src.dashboard.twofa import current_step, verify_code

    secret = _secret()
    step = current_step(NOW)

    check = verify_code(secret, _at(secret, step), last_step=None, drift=1, now=NOW)

    assert check.ok is True
    assert check.step == step


def test_the_same_step_is_not_accepted_twice() -> None:
    """🔴 Шаг погашен: подсмотренный код не работает вторые полминуты."""
    from src.dashboard.twofa import current_step, verify_code

    secret = _secret()
    step = current_step(NOW)
    code = _at(secret, step)

    assert verify_code(secret, code, last_step=step, drift=1, now=NOW).ok is False
    # И более ранний шаг тоже: счётчик идёт только вперёд.
    assert verify_code(secret, _at(secret, step - 1), last_step=step, drift=1, now=NOW).ok is False


@pytest.mark.parametrize("shift", [-1, 0, 1])
def test_neighbour_steps_are_accepted(shift: int) -> None:
    from src.dashboard.twofa import current_step, verify_code

    secret = _secret()
    step = current_step(NOW)

    check = verify_code(secret, _at(secret, step + shift), last_step=None, drift=1, now=NOW)

    assert check.ok is True
    assert check.step == step + shift


@pytest.mark.parametrize("shift", [-2, 2])
def test_further_steps_are_refused(shift: int) -> None:
    """Допуск ровно один шаг в обе стороны: шире — это уже минута чужого окна."""
    from src.dashboard.twofa import current_step, verify_code

    secret = _secret()
    step = current_step(NOW)

    assert verify_code(secret, _at(secret, step + shift), last_step=None, drift=1, now=NOW).ok is False


def test_wrong_code_is_refused_with_a_reason() -> None:
    from src.dashboard.twofa import verify_code

    check = verify_code(_secret(), "000000", last_step=None, drift=1, now=NOW)

    assert check.ok is False
    assert check.step is None
    assert check.reason  # причина нужна журналу, не пользователю


def test_provisioning_uri_and_qr() -> None:
    from src.dashboard.twofa import provisioning_uri, qr_svg

    secret = _secret()
    uri = provisioning_uri(secret, email=OWNER_EMAIL, issuer="WETOP-test")

    assert uri.startswith("otpauth://totp/")
    assert secret in uri
    assert "WETOP-test" in uri
    assert "<svg" in qr_svg(uri)


# ─── Резервные коды ───


def test_backup_codes_are_unique_and_shaped() -> None:
    from src.dashboard.twofa import new_backup_codes

    codes = new_backup_codes(8)

    assert len(codes) == len(set(codes)) == 8
    for code in codes:
        assert re.fullmatch(r"[0-9a-z]{4}-[0-9a-z]{4}", code), code


def test_backup_codes_are_stored_as_fingerprints() -> None:
    from src.dashboard.twofa import hash_backup_code, new_backup_codes

    code = new_backup_codes(1)[0]
    digest = hash_backup_code(code)

    assert digest != code
    assert len(digest) == 64  # sha256 в hex
    assert hash_backup_code(code) == digest


def test_spent_backup_code_goes_dark() -> None:
    from src.dashboard.twofa import hash_backup_code, new_backup_codes, spend_backup_code

    codes = new_backup_codes(3)
    stored = [hash_backup_code(c) for c in codes]

    left = spend_backup_code(stored, codes[1])

    assert left is not None
    assert hash_backup_code(codes[1]) not in left
    assert len(left) == 2
    # Погашенный второй раз не подходит, чужой — тоже.
    assert spend_backup_code(left, codes[1]) is None
    assert spend_backup_code(left, "ffff-ffff") is None


# ─── Панель ───


@pytest.fixture
def secret() -> str:
    return pyotp.random_base32()


@pytest.fixture
def with_2fa(monkeypatch, fake_redis, sync_db, secret):
    """Панель со включённым вторым фактором и подтверждённым секретом."""
    make_user(sync_db, email=OWNER_EMAIL, totp_secret=secret, totp_confirmed=True)
    with panel(monkeypatch, fake_redis, DASHBOARD_2FA_ENABLED="true") as p:
        yield p


def _need_code_token(p) -> str:
    response = p.login()
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "need_code"
    return response.json()["token"]


def test_password_alone_does_not_open_the_api(with_2fa) -> None:
    token = _need_code_token(with_2fa)

    assert with_2fa.client.get(CONVERSATIONS, headers=bearer(token)).status_code == 401


def test_code_from_the_secret_is_accepted(with_2fa, secret) -> None:
    from src.dashboard.twofa import current_step

    token = _need_code_token(with_2fa)
    code = _at(secret, current_step())

    response = with_2fa.client.post(f"{PANEL}/code", json={"code": code}, headers=bearer(token))

    assert response.status_code == 200, response.text
    full = response.json()["token"]
    assert with_2fa.client.get(CONVERSATIONS, headers=bearer(full)).status_code == 200


def test_the_same_code_is_refused_the_second_time(with_2fa, secret, sync_db) -> None:
    """🔴 Шаг записан — подсмотренный код больше не работает."""
    from src.dashboard.security import LOGIN_FAILED_MESSAGE
    from src.dashboard.twofa import current_step

    code = _at(secret, current_step())
    first = with_2fa.client.post(
        f"{PANEL}/code", json={"code": code}, headers=bearer(_need_code_token(with_2fa))
    )
    assert first.status_code == 200, first.text
    assert get_user(sync_db).totp_last_step is not None

    second = with_2fa.client.post(
        f"{PANEL}/code", json={"code": code}, headers=bearer(_need_code_token(with_2fa))
    )

    assert second.status_code == 401
    assert second.json()["detail"] == LOGIN_FAILED_MESSAGE


def test_backup_code_works_once(monkeypatch, fake_redis, sync_db, secret) -> None:
    from src.dashboard.twofa import hash_backup_code, new_backup_codes

    codes = new_backup_codes(3)
    make_user(
        sync_db,
        email=OWNER_EMAIL,
        totp_secret=secret,
        totp_confirmed=True,
        backup_codes=[hash_backup_code(c) for c in codes],
    )
    with panel(monkeypatch, fake_redis, DASHBOARD_2FA_ENABLED="true") as p:
        first = p.client.post(
            f"{PANEL}/code", json={"code": codes[0]}, headers=bearer(_need_code_token(p))
        )
        assert first.status_code == 200, first.text
        assert hash_backup_code(codes[0]) not in get_user(sync_db).backup_codes

        second = p.client.post(
            f"{PANEL}/code", json={"code": codes[0]}, headers=bearer(_need_code_token(p))
        )

    assert second.status_code == 401


def test_failed_codes_count_together_with_passwords(with_2fa, secret) -> None:
    """Неудачные коды и неудачные пароли — один счётчик и одна блокировка."""
    from src.dashboard.twofa import current_step

    token = _need_code_token(with_2fa)
    stale = _at(secret, current_step() - 100)  # заведомо вне допуска
    for _ in range(with_2fa.settings.dashboard_login_max_attempts):
        refused = with_2fa.client.post(
            f"{PANEL}/code", json={"code": stale}, headers=bearer(token)
        )
        # Последняя попытка может прийти уже как «заблокировано» — обе формы
        # отказа общие и одинаковые по тексту.
        assert refused.status_code in (401, 429), refused.text

    assert with_2fa.login().status_code == 429


def test_disabled_second_factor_shows_no_code_form(monkeypatch, fake_redis, sync_db, secret) -> None:
    make_user(sync_db, email=OWNER_EMAIL, totp_secret=secret, totp_confirmed=True)
    with panel(monkeypatch, fake_redis, DASHBOARD_2FA_ENABLED="false") as p:
        response = p.login()

    assert response.json()["status"] == "ok"


def test_unconfirmed_secret_does_not_lock_the_owner_out(
    monkeypatch, fake_redis, sync_db, secret
) -> None:
    """🔴 Секрет создан, но первым кодом не подтверждён — второй фактор ещё
    не включён: иначе человек теряет доступ в ту же минуту."""
    make_user(sync_db, email=OWNER_EMAIL, totp_secret=secret, totp_confirmed=False)
    with panel(monkeypatch, fake_redis, DASHBOARD_2FA_ENABLED="true") as p:
        response = p.login()

    assert response.json()["status"] == "ok"


def test_setup_shows_the_secret_once_and_confirm_never(
    monkeypatch, fake_redis, sync_db, caplog
) -> None:
    """Секрет и резервные коды видны ровно один раз — в ответе setup.
    🔴 Ни в ответе confirm, ни в журнале их нет."""
    make_user(sync_db, email=OWNER_EMAIL)
    with panel(monkeypatch, fake_redis, DASHBOARD_2FA_ENABLED="true") as p:
        token = p.login().json()["token"]
        with caplog.at_level(logging.DEBUG):
            setup = p.client.post(f"{PANEL}/2fa/setup", headers=bearer(token))
            assert setup.status_code == 200, setup.text
            body = setup.json()
            new = body["secret"]
            codes = body["backup_codes"]
            assert body["uri"].startswith("otpauth://")
            assert "<svg" in body["qr"]
            assert len(codes) == p.settings.dashboard_2fa_backup_codes

            # В базе — секрет и ОТПЕЧАТКИ, подтверждения ещё нет.
            stored = get_user(sync_db)
            assert stored.totp_secret == new
            assert stored.totp_confirmed_at is None
            assert all(code not in stored.backup_codes for code in codes)

            confirm = p.client.post(
                f"{PANEL}/2fa/confirm",
                json={"code": pyotp.TOTP(new).now()},
                headers=bearer(token),
            )

    assert confirm.status_code == 200, confirm.text
    assert get_user(sync_db).totp_confirmed_at is not None
    assert new not in confirm.text
    # Смотрим только свои логгеры: драйвер базы на уровне debug печатает
    # параметры запросов, а в бою уровень info и драйвер молчит (AGENTS.md).
    ours = "\n".join(r.getMessage() for r in caplog.records if r.name.startswith("src."))
    assert new not in ours
    for code in codes:
        assert code not in confirm.text
        assert code not in ours


def test_code_before_login_is_refused(monkeypatch, fake_redis, sync_db, secret) -> None:
    """Без токена шага «нужен код» форма кода не работает: иначе второй
    фактор становится первым и единственным."""
    from src.dashboard.twofa import current_step

    make_user(sync_db, email=OWNER_EMAIL, totp_secret=secret, totp_confirmed=True)
    with panel(monkeypatch, fake_redis, DASHBOARD_2FA_ENABLED="true") as p:
        response = p.client.post(f"{PANEL}/code", json={"code": _at(secret, current_step())})

    assert response.status_code == 401


def test_correct_password_does_not_reset_the_code_counter(with_2fa, secret) -> None:
    """🔴 Верный пароль не гасит счётчик, пока второй фактор не пройден.

    Иначе тот, кто уже знает пароль (а фактор ставится ровно на этот
    случай), перебирает шестизначный код без предела: вход → неверный код
    → вход → … и блокировка не наступает никогда.
    """
    from src.dashboard.twofa import current_step

    stale = _at(secret, current_step() - 100)  # заведомо вне допуска
    codes = []
    for _ in range(with_2fa.settings.dashboard_login_max_attempts):
        login = with_2fa.login()
        if login.status_code == 429:
            codes.append(429)
            break
        token = login.json()["token"]
        codes.append(
            with_2fa.client.post(
                f"{PANEL}/code", json={"code": stale}, headers=bearer(token)
            ).status_code
        )

    assert 429 in codes or with_2fa.login().status_code == 429, codes


def test_setup_does_not_silently_switch_off_a_working_factor(with_2fa, secret, sync_db) -> None:
    """🔴 Повторный setup у подтверждённой учётки требует действующего кода.

    Иначе один запрос (открыл экран «показать QR ещё раз» и закрыл вкладку)
    гасит работающий второй фактор и старые резервные коды, и панель до
    утра живёт на одном пароле — узнать об этом неоткуда.
    """
    from src.dashboard.twofa import current_step

    token = with_2fa.client.post(
        f"{PANEL}/code",
        json={"code": _at(secret, current_step())},
        headers=bearer(_need_code_token(with_2fa)),
    ).json()["token"]

    refused = with_2fa.client.post(f"{PANEL}/2fa/setup", headers=bearer(token))

    assert refused.status_code == 409, refused.text
    stored = get_user(sync_db)
    assert stored.totp_secret == secret
    assert stored.totp_confirmed_at is not None
    # Фактор на месте: пароль по-прежнему не открывает панель сам.
    assert with_2fa.login().json()["status"] == "need_code"


def test_setup_with_a_valid_code_reconnects(with_2fa, secret, sync_db) -> None:
    """Пересоздать секрет можно — с действующим кодом в теле запроса."""
    from src.dashboard.twofa import current_step

    step = current_step()
    token = with_2fa.client.post(
        f"{PANEL}/code", json={"code": _at(secret, step)}, headers=bearer(_need_code_token(with_2fa))
    ).json()["token"]

    again = with_2fa.client.post(
        f"{PANEL}/2fa/setup", json={"code": _at(secret, step + 1)}, headers=bearer(token)
    )

    assert again.status_code == 200, again.text
    stored = get_user(sync_db)
    assert stored.totp_secret != secret
    # 🔴 Новый секрет ещё не подтверждён: включится первым верным кодом.
    assert stored.totp_confirmed_at is None
