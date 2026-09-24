"""Шаг 2: прогрев модели на старте. Не прогрелась — /health отвечает 503 без подробностей."""

import pytest

from src.config import get_settings


@pytest.fixture
def warmup_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    """Включает прогрев поверх conftest (там он выключен) до сборки приложения.

    Запрашивать ПЕРЕД client: приложение читает настройки при создании.
    """
    monkeypatch.setenv("KB_EMBED_WARMUP", "true")
    get_settings.cache_clear()
    assert get_settings().kb_embed_warmup is True


def test_warmup_runs_on_start_and_health_is_ok(fake_embedder, fake_backend, warmup_enabled, client) -> None:
    assert fake_backend.calls >= 1, "прогрев не вызвал модель"
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_failed_warmup_makes_health_unavailable(
    fake_embedder, fake_backend, warmup_enabled, monkeypatch: pytest.MonkeyPatch
) -> None:
    from fastapi.testclient import TestClient

    from src.main import create_app

    secret = "model-file-missing-at-/app/.hf"

    async def _boom() -> None:
        raise RuntimeError(secret)

    monkeypatch.setattr(fake_embedder, "warmup", _boom)

    with TestClient(create_app(), raise_server_exceptions=False) as c:
        response = c.get("/health")

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}
    assert secret not in response.text
    assert "RuntimeError" not in response.text
    assert fake_backend.calls == 0


def test_warmup_is_skipped_when_disabled(fake_embedder, fake_backend, client) -> None:
    # conftest ставит KB_EMBED_WARMUP=false: модель на старте не трогается.
    assert fake_backend.calls == 0
    assert client.get("/health").status_code == 200
