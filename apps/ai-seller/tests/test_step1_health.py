"""Шаг 1: проверка живости и ошибки наружу не рассказывают об устройстве системы.

Публичный адрес отвечает только статусом; подробности — по ключу.
Текст исключения, имя таблицы и трассировка клиенту не уходят.
"""

import re

from fastapi.testclient import TestClient

# Слова, по которым сканер строит карту системы: имена сервисов, окружений, версий.
FORBIDDEN_WORDS = (
    "postgres",
    "redis",
    "production",
    "staging",
    "dev",
    "fastapi",
    "uvicorn",
    "python",
    "version",
    "sqlalchemy",
    "alembic",
)
VERSION_RE = re.compile(r"\d+\.\d+")


def test_public_health_returns_only_status(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

    body = response.text.lower()
    for word in FORBIDDEN_WORDS:
        assert word not in body, f"публичная проверка живости выдала «{word}»"
    assert VERSION_RE.search(body) is None, "в ответе есть что-то похожее на версию"


def test_internal_health_without_key_is_forbidden(client: TestClient) -> None:
    response = client.get("/internal/health")
    assert response.status_code == 403
    assert response.json() == {"status": "forbidden"}
    body = response.text.lower()
    for word in ("db", "redis", "postgres"):
        assert word not in body


def test_internal_health_with_key_reports_checks(client: TestClient, migrated_db, fake_redis) -> None:
    response = client.get("/internal/health", headers={"X-Internal-Key": "test-key"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["checks"]["db"] == "ok"
    assert payload["checks"]["redis"] == "ok"


def test_internal_health_with_wrong_key_is_forbidden(client: TestClient) -> None:
    response = client.get("/internal/health", headers={"X-Internal-Key": "wrong"})
    assert response.status_code == 403
    assert response.json() == {"status": "forbidden"}


def test_internal_health_with_non_ascii_key_is_forbidden(client: TestClient) -> None:
    # Starlette декодирует заголовок как latin-1; чужой байт — это 403, а не 500.
    response = client.get("/internal/health", headers={"X-Internal-Key": b"caf\xe9"})
    assert response.status_code == 403
    assert response.json() == {"status": "forbidden"}


def test_unhandled_exception_hides_internals() -> None:
    from src.main import create_app

    app = create_app()

    @app.get("/boom")
    async def boom() -> None:
        raise RuntimeError("table clients boom")

    with TestClient(app, raise_server_exceptions=False) as c:
        response = c.get("/boom")

    assert response.status_code == 500
    assert response.json() == {"status": "error"}
    for leak in ("clients", "RuntimeError", "Traceback", "boom"):
        assert leak not in response.text


def test_api_docs_are_not_exposed(client: TestClient) -> None:
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert client.get(path).status_code == 404, f"{path} открыт наружу"
