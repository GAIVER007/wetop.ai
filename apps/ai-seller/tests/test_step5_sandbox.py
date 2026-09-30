"""Шаг 5: песочница /internal/sandbox — по служебному ключу платформы, через движок,
без сети; текст ошибки наружу не уходит. Ключ живости (/internal/health) её не открывает
(решение владельца 30.09.2026)."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.ai.engine import NEUTRAL_REPLY
from src.ai.llm import reset_cascade_client, set_cascade_client
from src.config import get_settings
from tests.engine_fakes import ScriptedLlm, reply

SERVICE_KEY = "sandbox-service-key-for-tests"
KEY = {"X-Service-Key": SERVICE_KEY}
HEALTH_KEY = {"X-Internal-Key": "test-key"}


def _prepare(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, fake_redis, llm) -> None:
    """Промпт на диске, модель и Redis подменены; настройки перечитаны."""
    prompt = tmp_path / "system_prompt.md"
    prompt.write_text("Ты продавец апартаментов.", encoding="utf-8")
    monkeypatch.setenv("PROMPT_PATH", str(prompt))
    monkeypatch.setenv("SELLER_SERVICE_KEY", SERVICE_KEY)
    get_settings.cache_clear()
    set_cascade_client(llm)  # Redis подменяет фикстура fake_redis через dependencies.get_redis


@pytest.fixture
def sandbox(tmp_path, monkeypatch, migrated_db, fake_redis, fake_embedder):
    """Клиент приложения с подменёнными синглтонами и модель по сценарию."""
    llm = ScriptedLlm([reply("Привет из песочницы.")])
    _prepare(tmp_path, monkeypatch, fake_redis, llm)
    from src.main import create_app

    with TestClient(create_app(), raise_server_exceptions=False) as client:
        yield client, llm
    reset_cascade_client()


def test_without_key_forbidden(sandbox) -> None:
    client, llm = sandbox
    response = client.post("/internal/sandbox", json={"external_id": "u1", "text": "Есть места?"})
    assert response.status_code == 403
    assert llm.calls == 0


def test_wrong_key_forbidden(sandbox) -> None:
    client, _ = sandbox
    response = client.post(
        "/internal/sandbox",
        json={"external_id": "u1", "text": "Есть места?"},
        headers={"X-Service-Key": "wrong"},
    )
    assert response.status_code == 403


def test_the_health_key_does_not_open_the_sandbox(sandbox) -> None:
    """🔴 Аудит 30.09.2026: ключ живости открывал песочницу — ход модели от имени любой
    организации из тела. Красный на коде до правки: 200."""
    client, llm = sandbox
    response = client.post(
        "/internal/sandbox", json={"external_id": "u1", "text": "Есть места?"}, headers=HEALTH_KEY
    )
    assert response.status_code == 403
    assert llm.calls == 0


def test_with_key_replies(sandbox) -> None:
    client, llm = sandbox
    response = client.post("/internal/sandbox", json={"external_id": "u1", "text": "Есть места?"}, headers=KEY)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "replied"
    assert body["reply"] == "Привет из песочницы."
    assert body["needs_human"] is False
    assert isinstance(body["edits"], list)
    assert isinstance(body["reasons"], list)
    assert body["conversation_id"]
    assert llm.calls == 1


def test_error_text_not_exposed(tmp_path, monkeypatch, migrated_db, fake_redis, fake_embedder) -> None:
    llm = ScriptedLlm([RuntimeError("секретная трассировка модели")])
    _prepare(tmp_path, monkeypatch, fake_redis, llm)
    from src.main import create_app

    with TestClient(create_app(), raise_server_exceptions=False) as client:
        response = client.post(
            "/internal/sandbox", json={"external_id": "u1", "text": "Есть места?"}, headers=KEY
        )
    reset_cascade_client()
    assert response.status_code == 200
    assert "секретная" not in response.text
    assert "Traceback" not in response.text
    assert response.json()["reply"] == NEUTRAL_REPLY


def test_empty_key_in_settings_closes_sandbox(tmp_path, monkeypatch, migrated_db, fake_redis, fake_embedder) -> None:
    llm = ScriptedLlm([reply("Не должно дойти.")])
    _prepare(tmp_path, monkeypatch, fake_redis, llm)
    monkeypatch.setenv("SELLER_SERVICE_KEY", "")
    get_settings.cache_clear()
    from src.main import create_app

    with TestClient(create_app(), raise_server_exceptions=False) as client:
        response = client.post(
            "/internal/sandbox", json={"external_id": "u1", "text": "Есть места?"}, headers=KEY
        )
    reset_cascade_client()
    assert response.status_code == 403
    assert llm.calls == 0
