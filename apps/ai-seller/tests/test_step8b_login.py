"""Шаг 8б: вход в панель — хеш вместо пароля, одинаковый отказ, блокировка.

Перебор пароля — самая дешёвая атака на панель: нужны только адрес и время.
Поэтому здесь проверяется не «пускает верный пароль», а всё остальное:
🔴 ответ на любую неудачу одинаков побайтно — разные ответы подсказывают,
что логин угадан;
🔴 счётчик попыток живёт в Redis, а не в браузере, и переживает смену клиента;
🔴 в настройках лежит хеш, а не пароль: файл настроек читают агент и бэкап.
"""

from __future__ import annotations

import re
import time
from pathlib import Path

import pytest

from tests.dashboard_fakes import (
    OWNER_EMAIL,
    OWNER_PASSWORD,
    PANEL,
    UNKNOWN_EMAIL,
    alert_bodies,
    dashboard_settings,
    fresh_browser,
    make_user,
    panel,
    sync_db,  # noqa: F401 — фикстура берётся из пространства имён модуля
    use_fake_redis,
)

ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture
def wide(monkeypatch, fake_redis, sync_db):
    """Панель с широким пределом попыток: здесь проверяется форма отказа,
    а не блокировка, и вторая попытка не должна превращаться в 429."""
    make_user(sync_db, email=OWNER_EMAIL, password=OWNER_PASSWORD)
    with panel(
        monkeypatch,
        fake_redis,
        DASHBOARD_LOGIN_MAX_ATTEMPTS="10",
        DASHBOARD_LOGIN_ALERT_AFTER="99",
    ) as p:
        yield p


@pytest.fixture
def strict(monkeypatch, fake_redis, sync_db):
    """Панель с настройками из образца: три попытки, алерт со второй."""
    make_user(sync_db, email=OWNER_EMAIL, password=OWNER_PASSWORD)
    with panel(monkeypatch, fake_redis) as p:
        yield p


def _message(response) -> str:
    body = response.json()
    return body.get("detail") if isinstance(body, dict) else str(body)


def test_correct_password_logs_in(wide) -> None:
    response = wide.login()

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "ok"
    assert response.json().get("token")


def test_unknown_email_and_wrong_password_answer_identically(wide) -> None:
    """🔴 Побайтно одинаковый ответ: иначе по разнице видно, что логин угадан."""
    from src.dashboard.security import LOGIN_FAILED_MESSAGE

    wrong_password = wide.login(email=OWNER_EMAIL, password="не-тот-пароль")
    unknown_email = wide.login(email=UNKNOWN_EMAIL, password=OWNER_PASSWORD)

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.content == unknown_email.content
    assert _message(wrong_password) == LOGIN_FAILED_MESSAGE


def test_settings_hold_a_hash_not_the_password(wide) -> None:
    from src.dashboard.security import verify_password

    stored = wide.settings.dashboard_admin_password_hash
    assert stored and stored != OWNER_PASSWORD
    assert stored.startswith("$2"), stored[:4]  # bcrypt, а не «пароль как есть»
    assert verify_password(OWNER_PASSWORD, stored) is True


def test_no_plaintext_password_variable_anywhere() -> None:
    """В образце окружения и в коде есть только ХЕШ: переменной с открытым
    паролем не существует, иначе её однажды заполнят."""
    env_example = (ROOT / "env.example").read_text(encoding="utf-8")
    assert "DASHBOARD_ADMIN_PASSWORD_HASH=" in env_example
    assert re.search(r"^DASHBOARD_ADMIN_PASSWORD\s*=", env_example, re.M) is None

    for path in ROOT.joinpath("src").rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        without_hash = text.lower().replace("dashboard_admin_password_hash", "")
        assert "dashboard_admin_password" not in without_hash, path
        assert OWNER_PASSWORD not in text, path


def test_block_after_max_attempts(strict, sync_db) -> None:
    """Исчерпали попытки — 429, и верный пароль больше не помогает."""
    from src.dashboard.security import LOGIN_FAILED_MESSAGE

    attempts = strict.settings.dashboard_login_max_attempts
    for _ in range(attempts):
        assert strict.login(password="не-тот-пароль").status_code == 401

    blocked = strict.login(password=OWNER_PASSWORD)

    assert blocked.status_code == 429
    # Та же общая фраза: по тексту отказа нельзя понять, что пароль был верным.
    assert _message(blocked) == LOGIN_FAILED_MESSAGE


def test_counter_survives_a_new_browser(strict) -> None:
    """🔴 Счётчик на сервере: смена клиента его не обнуляет."""
    attempts = strict.settings.dashboard_login_max_attempts
    for _ in range(attempts):
        strict.login(password="не-тот-пароль")

    other = fresh_browser()
    response = other.post(f"{PANEL}/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})

    assert response.status_code == 429


def test_alert_goes_out_from_the_configured_attempt(strict, sync_db) -> None:
    """С настроенной попытки владельцу уходит алерт: панель ломают прямо сейчас."""
    for _ in range(strict.settings.dashboard_login_alert_after):
        strict.login(password="не-тот-пароль")

    bodies = alert_bodies(sync_db)

    assert bodies, "алерта о переборе нет"
    joined = "\n".join(bodies)
    assert "неудачных попыток входа" in joined
    # 🔴 Ни пароля, ни полного адреса: канал алертов чужой.
    assert "не-тот-пароль" not in joined
    assert OWNER_EMAIL not in joined


def test_alert_is_silent_before_the_configured_attempt(strict, sync_db) -> None:
    strict.login(password="не-тот-пароль")

    assert alert_bodies(sync_db) == []


def test_password_longer_than_72_bytes_does_not_break_the_form(wide) -> None:
    """🔴 bcrypt 5.x поднимает ошибку на пароле длиннее 72 байт. Ловим её
    и показываем общий отказ: иначе форма входа отвечает пятисоткой."""
    response = wide.login(password="д" * 200)

    assert response.status_code == 401, response.text
    assert "Traceback" not in response.text


def test_verify_password_survives_a_broken_hash() -> None:
    from src.dashboard.security import verify_password

    for broken in ("", "не хеш", "$2b$12$слишком-короткий"):
        assert verify_password(OWNER_PASSWORD, broken) is False


def test_failed_login_is_delayed(monkeypatch, fake_redis, sync_db) -> None:
    """Задержка на каждую неудачу: перебор становится нерентабельным ещё
    до блокировки. Единственный тест, где задержку не отключаем."""
    from fastapi.testclient import TestClient

    from src.dashboard.security import FAILED_DELAY_SECONDS
    from src.main import create_app

    assert FAILED_DELAY_SECONDS >= 1.0
    make_user(sync_db, email=OWNER_EMAIL, password=OWNER_PASSWORD)
    dashboard_settings(monkeypatch, DASHBOARD_LOGIN_MAX_ATTEMPTS="10")
    use_fake_redis(monkeypatch, fake_redis)

    with TestClient(create_app(), raise_server_exceptions=False) as client:
        started = time.monotonic()
        response = client.post(
            f"{PANEL}/login", json={"email": OWNER_EMAIL, "password": "не-тот-пароль"}
        )
        elapsed = time.monotonic() - started

    assert response.status_code == 401
    assert elapsed >= FAILED_DELAY_SECONDS * 0.9, elapsed


def test_ip_outside_the_allowlist_is_refused(monkeypatch, fake_redis, sync_db) -> None:
    """Список адресов заполнен, адрес клиента в него не входит — 403 до
    всякой проверки пароля."""
    make_user(sync_db, email=OWNER_EMAIL, password=OWNER_PASSWORD)
    with panel(monkeypatch, fake_redis, DASHBOARD_ALLOWED_IPS="203.0.113.7") as p:
        response = p.login()

    assert response.status_code == 403


def test_empty_allowlist_lets_everyone_in(wide) -> None:
    from src.dashboard.security import check_ip_allowed

    assert check_ip_allowed(wide.settings, "203.0.113.7") is True
    assert check_ip_allowed(wide.settings, None) is True


def test_token_cookie_is_httponly_and_secure(wide) -> None:
    """Cookie сессии не читается скриптом и не уходит по http: украденный
    токен панели — это все контакты заказчика."""
    response = wide.login()
    cookie = response.headers.get("set-cookie", "").lower()

    assert cookie, response.headers
    assert "httponly" in cookie
    assert "secure" in cookie
    assert "samesite=lax" in cookie


def test_logout_answers_and_drops_the_cookie(wide) -> None:
    wide.login()
    response = wide.client.post(f"{PANEL}/logout")

    assert response.status_code == 200
    assert "set-cookie" in {name.lower() for name in response.headers}


# ─── Первая учётка из настроек ───


def test_settings_pair_opens_the_panel_on_a_clean_base(monkeypatch, fake_redis, sync_db) -> None:
    """🔴 На свежей выкатке в панель входят парой из настроек: таблица
    пользователей пуста, ручки «создать владельца» нет. Без посева
    DASHBOARD_ADMIN_EMAIL и DASHBOARD_ADMIN_PASSWORD_HASH не читает никто,
    и войти нельзя вообще — а env.example обещает обратное."""
    with panel(monkeypatch, fake_redis) as p:  # ни одного make_user
        response = p.login()

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "ok"


def test_seeded_owner_is_an_owner(monkeypatch, fake_redis, sync_db) -> None:
    """Учётка из настроек — владелец: иначе первый вошедший не сможет
    ни промпт поправить, ни модель сменить."""
    from tests.dashboard_fakes import get_user

    with panel(monkeypatch, fake_redis) as p:
        assert p.login().status_code == 200

    assert get_user(sync_db, OWNER_EMAIL).role == "owner"


def test_empty_admin_hash_says_so_and_closes_the_panel(monkeypatch, fake_redis, caplog) -> None:
    """Почта владельца без хеша — та же беда, что пустой путь: панель была бы
    открыта, а войти в неё нечем. В журнале понятная строка, приложение живёт."""
    import logging

    from fastapi.testclient import TestClient

    from src.main import create_app

    dashboard_settings(monkeypatch, DASHBOARD_ADMIN_PASSWORD_HASH="")
    use_fake_redis(monkeypatch, fake_redis)

    with caplog.at_level(logging.ERROR):
        app = create_app()

    assert "DASHBOARD_ADMIN_PASSWORD_HASH" in caplog.text, caplog.text

    with TestClient(app, raise_server_exceptions=False) as client:
        assert client.get("/health").status_code == 200
        assert client.post(f"{PANEL}/login", json={"email": OWNER_EMAIL, "password": "x"}).status_code == 404


# ─── Пароль не попадает в журнал ───


def test_failed_login_keeps_the_password_out_of_the_log(wide, caplog) -> None:
    """🔴 Открытого пароля нет ни в настройках, ни в коде, ни в журнале:
    строка журнала переживает инцидент и уезжает наружу с выгрузкой."""
    import logging

    marked = "primetnyy-parol-777"

    with caplog.at_level(logging.DEBUG):
        assert wide.login(password=marked).status_code == 401

    ours = "\n".join(r.getMessage() for r in caplog.records if r.name.startswith("src."))
    assert marked not in ours, ours


# ─── Секундомер тоже не должен подсказывать ───


def _median(values: list[float]) -> float:
    ordered = sorted(values)
    return ordered[len(ordered) // 2]


def test_unknown_email_and_wrong_password_take_the_same_time(wide) -> None:
    """🔴 Тела ответов совпадают побайтно, но и время должно совпадать:
    без bcrypt на несуществующей почте ответ приходит на стоимость одного
    checkpw раньше, и логин угадывается секундомером."""
    from src.dashboard.security import DUMMY_PASSWORD_HASH, verify_password

    started = time.monotonic()
    verify_password("что угодно", DUMMY_PASSWORD_HASH)
    checkpw_cost = time.monotonic() - started

    def timing(email: str) -> float:
        started = time.monotonic()
        assert wide.login(email=email, password="не-тот-пароль").status_code == 401
        return time.monotonic() - started

    unknown = _median([timing(UNKNOWN_EMAIL) for _ in range(3)])
    existing = _median([timing(OWNER_EMAIL) for _ in range(3)])

    assert abs(existing - unknown) < checkpw_cost / 2, (existing, unknown, checkpw_cost)


def test_login_does_not_hold_the_event_loop(monkeypatch, fake_redis, sync_db) -> None:
    """🔴 bcrypt считается в потоке: держать им цикл событий — значит
    остановить горячий путь движка, и снаружи это «бот замолчал»."""
    import concurrent.futures

    import src.dashboard.security as security

    slow = 1.0
    make_user(sync_db, email=OWNER_EMAIL, password=OWNER_PASSWORD)
    with panel(monkeypatch, fake_redis, DASHBOARD_LOGIN_MAX_ATTEMPTS="10") as p:

        def slow_verify(plain: str, hashed: str) -> bool:
            time.sleep(slow)
            return False

        monkeypatch.setattr(security, "verify_password", slow_verify)
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            busy = pool.submit(p.login, OWNER_EMAIL, "не-тот-пароль")
            time.sleep(0.1)  # даём входу дойти до проверки пароля
            started = time.monotonic()
            health = p.client.get("/health")
            elapsed = time.monotonic() - started
            busy.result()

    assert health.status_code == 200
    assert elapsed < slow / 2, elapsed


def test_session_from_a_foreign_ip_is_refused(monkeypatch, fake_redis, sync_db) -> None:
    """🔴 Список адресов закрывает не только форму входа: токен отдаётся
    в теле ответа, и выданный в офисе он иначе открывает карточки клиентов
    с любого адреса в интернете."""
    from tests.dashboard_fakes import bearer, token_for

    make_user(sync_db, email=OWNER_EMAIL, password=OWNER_PASSWORD)
    with panel(monkeypatch, fake_redis, DASHBOARD_ALLOWED_IPS="203.0.113.7") as p:
        token = token_for(p.settings, email=OWNER_EMAIL, role="owner")
        response = p.client.get(f"{PANEL}/conversations", headers=bearer(token))

    assert response.status_code == 403
