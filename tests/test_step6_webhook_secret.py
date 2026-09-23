"""Шаг 6: вебхук Telegram пускает только запросы с верным секретным заголовком.

Пустой секрет в настройках — 403 всегда: «не настроен» не значит «пускаем
всех». Обработка идёт в фоновой задаче, поэтому ответ 200 приходит сразу,
а тест проверяет лишь, что обновление отдано runner'у.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from src.config import get_settings
from tests.telegram_fakes import FakeRunner, message_update

SECRET = "webhook-secret-for-tests"
HEADER = "X-Telegram-Bot-Api-Secret-Token"
PATH = "/webhooks/telegram"


def _make_client(runner: FakeRunner) -> TestClient:
    from src.main import create_app

    app = create_app()
    app.state.telegram_runner = runner
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def runner() -> FakeRunner:
    return FakeRunner()


@pytest.fixture
def tg_client(monkeypatch: pytest.MonkeyPatch, fake_redis, runner: FakeRunner) -> Iterator[TestClient]:
    """Приложение с настроенным секретом и подменным runner в app.state."""
    monkeypatch.setenv("CHANNEL_TELEGRAM_BOT_TOKEN", "test-token")
    monkeypatch.setenv("CHANNEL_TELEGRAM_WEBHOOK_SECRET", SECRET)
    get_settings.cache_clear()
    with _make_client(runner) as client:
        yield client


@pytest.fixture
def tg_client_no_secret(monkeypatch: pytest.MonkeyPatch, fake_redis, runner: FakeRunner) -> Iterator[TestClient]:
    """Секрет в настройках пуст."""
    monkeypatch.setenv("CHANNEL_TELEGRAM_BOT_TOKEN", "test-token")
    monkeypatch.delenv("CHANNEL_TELEGRAM_WEBHOOK_SECRET", raising=False)
    get_settings.cache_clear()
    with _make_client(runner) as client:
        yield client


def test_without_header_is_forbidden(tg_client: TestClient, runner: FakeRunner) -> None:
    response = tg_client.post(PATH, json=message_update())
    assert response.status_code == 403
    assert response.json() == {"status": "forbidden"}
    assert runner.submitted == []


def test_wrong_header_is_forbidden(tg_client: TestClient, runner: FakeRunner) -> None:
    response = tg_client.post(PATH, json=message_update(), headers={HEADER: "wrong"})
    assert response.status_code == 403
    assert response.json() == {"status": "forbidden"}
    assert runner.submitted == []


def test_empty_secret_in_settings_forbids_even_empty_header(
    tg_client_no_secret: TestClient, runner: FakeRunner
) -> None:
    """Пустой секрет и пустой заголовок совпадают побайтно — и всё равно 403."""
    assert get_settings().channel_telegram_webhook_secret == ""
    response = tg_client_no_secret.post(PATH, json=message_update(), headers={HEADER: ""})
    assert response.status_code == 403
    assert runner.submitted == []
    response = tg_client_no_secret.post(PATH, json=message_update())
    assert response.status_code == 403
    assert runner.submitted == []


def test_valid_header_accepts_and_submits(tg_client: TestClient, runner: FakeRunner) -> None:
    update = message_update(chat_id=777, text="Привет")
    response = tg_client.post(PATH, json=update, headers={HEADER: SECRET})
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert runner.submitted == [update]


def test_non_json_body_is_bad_request(tg_client: TestClient, runner: FakeRunner) -> None:
    response = tg_client.post(
        PATH,
        content=b"not json at all",
        headers={HEADER: SECRET, "Content-Type": "application/json"},
    )
    assert response.status_code == 400
    assert response.json() == {"status": "bad_request"}
    assert runner.submitted == []


def test_forbidden_response_reveals_nothing(tg_client: TestClient) -> None:
    """В ответе наружу нет ни имени сервиса, ни версии, ни причины отказа."""
    response = tg_client.post(PATH, json=message_update(), headers={HEADER: "wrong"})
    body = response.text.lower()
    for leak in ("telegram", "secret", "token", "settings"):
        assert leak not in body, leak


def test_deeply_nested_body_is_bad_request(tg_client: TestClient, runner: FakeRunner) -> None:
    """Глубокая вложенность роняет разбор JSON RecursionError'ом: клиенту 400,
    а не 500 — на не-2xx Telegram шлёт то же обновление снова."""
    response = tg_client.post(
        PATH,
        content=b"[" * 200_000,
        headers={HEADER: SECRET, "Content-Type": "application/json"},
    )
    assert response.status_code == 400
    assert response.json() == {"status": "bad_request"}
    assert runner.submitted == []


def test_oversized_body_is_bad_request(tg_client: TestClient, runner: FakeRunner) -> None:
    """Обновление Telegram — десятки килобайт; переросток отбивается до разбора."""
    response = tg_client.post(
        PATH,
        content=b'{"a":"' + b"x" * 2_000_000 + b'"}',
        headers={HEADER: SECRET, "Content-Type": "application/json"},
    )
    assert response.status_code == 400
    assert response.json() == {"status": "bad_request"}
    assert runner.submitted == []
