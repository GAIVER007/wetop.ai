"""С2 «под ключ»: API-ключ модели партнёра (Q-186, рекомендация; ADR-086).

Ключ хранит только бот — шифрованным (Fernet, секрет `LLM_KEYS_SECRET`);
платформа его ставит, проверяет и видит только последние 4 знака, обратно
ключ не читается. На ходе гостиницы каскад ходит к роутеру с её ключом —
расход на партнёре; ключ не задан — ключ платформы, как раньше.
"""

from __future__ import annotations

import base64
import uuid
from typing import Any

import httpx
import pytest
import sqlalchemy as sa

from src.ai.llm import CascadeClient, reset_cascade_client, set_cascade_client
from src.db.models import OrganizationLlmKey, OwnerAction
from tests.dashboard_fakes import (  # noqa: F401 — sync_db используется как фикстура
    PANEL,
    _all,
    panel,
    seed_org,
    sync_db,
)
from tests.engine_fakes import ScriptedLlm, reply

KEY = "service-key-for-tests-only"
ORG = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa"
ORG_B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb"
SERVICE = {"X-Service-Key": KEY}
# Секрет хранилища — base64url 32 байта, как его сгенерирует владелец
FERNET = base64.urlsafe_b64encode(b"test-secret-32-bytes-for-fernet!").decode()
PARTNER_KEY = "sk-partner-abcd1234"


@pytest.fixture
def app(monkeypatch, fake_redis, sync_db):  # noqa: F811
    with panel(
        monkeypatch,
        fake_redis,
        SELLER_SERVICE_KEY=KEY,
        BOT_ROLE="seller",
        LLM_KEYS_SECRET=FERNET,
        LLM_BASE_URL="https://router.example.com/v1",
    ) as p:
        seed_org(sync_db, ORG, prompt="Ты продавец гостиницы-стенда.")
        seed_org(sync_db, ORG_B, key="sk_" + "cd" * 12, name="Гостиница Б")
        yield p
    reset_cascade_client()


def _put(app, key: str, org: str = ORG):
    return app.client.put(
        f"{PANEL}/seller/organizations/{org}/llm-key", json={"key": key}, headers=SERVICE
    )


def _get(app, org: str = ORG):
    return app.client.get(f"{PANEL}/seller/organizations/{org}/llm-key", headers=SERVICE)


def test_the_key_is_stored_encrypted_and_never_read_back(app, sync_db) -> None:  # noqa: F811
    response = _put(app, PARTNER_KEY)
    assert response.status_code == 200, response.text
    assert response.json() == {"status": "ok", "set": True, "last4": "1234"}
    rows = _all(sync_db, sa.select(OrganizationLlmKey))
    assert len(rows) == 1
    blob = bytes(rows[0].key_encrypted)
    assert PARTNER_KEY.encode() not in blob, "ключ лежит открытым текстом"
    status = _get(app)
    assert status.json() == {"set": True, "last4": "1234", "state": None, "reason": None, "checked_at": None}
    assert PARTNER_KEY not in status.text
    # журнал — факт и последние 4 знака, не ключ
    actions = _all(sync_db, sa.select(OwnerAction).where(OwnerAction.action == "llm_key_set"))
    assert actions and PARTNER_KEY not in str(actions[-1].payload)


def test_an_empty_key_clears_the_stored_one(app, sync_db) -> None:  # noqa: F811
    _put(app, PARTNER_KEY)
    response = _put(app, "")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "set": False, "last4": None}
    assert _all(sync_db, sa.select(OrganizationLlmKey)) == []
    assert _get(app).json() == {"set": False, "last4": None, "state": None, "reason": None, "checked_at": None}


def test_each_hotel_sees_only_its_own_key(app) -> None:
    _put(app, PARTNER_KEY)
    assert _get(app, ORG_B).json() == {"set": False, "last4": None, "state": None, "reason": None, "checked_at": None}


def test_without_the_storage_secret_the_key_is_refused(
    monkeypatch, fake_redis, sync_db  # noqa: F811
) -> None:
    with panel(monkeypatch, fake_redis, SELLER_SERVICE_KEY=KEY, BOT_ROLE="seller") as p:
        seed_org(sync_db, ORG)
        response = p.client.put(
            f"{PANEL}/seller/organizations/{ORG}/llm-key",
            json={"key": PARTNER_KEY},
            headers=SERVICE,
        )
        assert response.status_code == 409
        assert "LLM_KEYS_SECRET" in response.json()["detail"]


def test_the_support_instance_refuses(monkeypatch, fake_redis, sync_db) -> None:  # noqa: F811
    with panel(
        monkeypatch, fake_redis, SELLER_SERVICE_KEY=KEY, BOT_ROLE="support", LLM_KEYS_SECRET=FERNET
    ) as p:
        response = p.client.put(
            f"{PANEL}/seller/organizations/{ORG}/llm-key",
            json={"key": PARTNER_KEY},
            headers=SERVICE,
        )
        assert response.status_code == 409


def _swap_http(monkeypatch, handler) -> list[httpx.Request]:
    """Подменить общий HTTP-клиент бота транспортом-ловушкой."""
    from src import dependencies

    seen: list[httpx.Request] = []

    def catcher(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return handler(request)

    client = httpx.AsyncClient(transport=httpx.MockTransport(catcher))
    monkeypatch.setattr(dependencies._resources, "http_client", client)
    return seen


def test_check_says_valid_or_not_without_leaking_the_key(app, monkeypatch) -> None:
    seen = _swap_http(monkeypatch, lambda r: httpx.Response(200, json={"data": []}))
    response = app.client.post(
        f"{PANEL}/seller/organizations/{ORG}/llm-key/check",
        json={"key": PARTNER_KEY},
        headers=SERVICE,
    )
    assert response.status_code == 200, response.text
    assert response.json()["valid"] is True
    assert seen and seen[0].headers["authorization"] == f"Bearer {PARTNER_KEY}"

    _swap_http(monkeypatch, lambda r: httpx.Response(401, json={"error": "bad key"}))
    response = app.client.post(
        f"{PANEL}/seller/organizations/{ORG}/llm-key/check",
        json={"key": PARTNER_KEY},
        headers=SERVICE,
    )
    body = response.json()
    assert response.status_code == 200 and body["valid"] is False
    assert PARTNER_KEY not in response.text


def test_a_turn_of_the_hotel_uses_its_partner_key(app, sync_db) -> None:  # noqa: F811
    _put(app, PARTNER_KEY)
    llm = ScriptedLlm([reply("Здравствуйте! Есть места.")])
    set_cascade_client(llm)
    response = app.client.post(
        "/internal/sandbox",
        json={"external_id": "u-key-1", "text": "Есть места?", "organization_id": ORG},
        headers=SERVICE,
    )
    assert response.status_code == 200, response.text
    assert llm.last_api_key == PARTNER_KEY

    llm2 = ScriptedLlm([reply("Здравствуйте!")])
    set_cascade_client(llm2)
    response = app.client.post(
        "/internal/sandbox",
        json={"external_id": "u-key-2", "text": "Есть места?", "organization_id": ORG_B},
        headers=SERVICE,
    )
    assert response.status_code == 200, response.text
    assert llm2.last_api_key is None, "без ключа партнёра ход идёт ключом платформы"


async def test_the_cascade_sends_the_partner_key_to_the_router() -> None:
    """Каскад с ключом хода: Authorization — ключ партнёра; без него — платформы."""
    from src.config import get_settings

    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": '{"reply": "ok"}'}}], "usage": {"total_tokens": 5}},
        )

    settings = get_settings().model_copy(
        update={
            "llm_base_url": "https://router.example.com/v1",
            "llm_api_key": "platform-key",
            "llm_model": "test-model",
        }
    )
    cascade = CascadeClient(settings, http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    result = await cascade.generate(
        [{"role": "user", "content": "привет"}], use_tools=False, api_key="partner-777"
    )
    assert result.ok, result.error
    assert seen[0].headers["authorization"] == "Bearer partner-777"

    result = await cascade.generate([{"role": "user", "content": "привет"}], use_tools=False)
    assert result.ok
    assert seen[-1].headers["authorization"] == "Bearer platform-key"


def test_key_check_has_an_hourly_limit_and_closes_without_the_counter(monkeypatch, fake_redis, sync_db) -> None:  # noqa: F811
    """🔴 Аудит 30.09.2026: проверка ключа — запрос к роутеру с произвольным ключом (оракул годности
    чужих ключей) без предела. Теперь часовой предел по организации, а без счётчика (Redis) — 503."""
    import httpx

    calls: list[str] = []

    async def fake_get(url, **kwargs):
        calls.append(url)
        return httpx.Response(401, request=httpx.Request("GET", url))

    class _Http:
        get = staticmethod(fake_get)

    with panel(
        monkeypatch, fake_redis, SELLER_SERVICE_KEY=KEY, BOT_ROLE="seller", LLM_KEYS_SECRET=FERNET,
        LLM_BASE_URL="https://router.example.invalid/v1", WIDGET_MESSAGES_PER_HOUR="2",
    ) as app:
        from src import dependencies

        monkeypatch.setattr(dependencies, "get_http_client", lambda: _Http())
        check = lambda: app.client.post(  # noqa: E731
            f"{PANEL}/seller/organizations/{ORG}/llm-key/check", json={"key": PARTNER_KEY}, headers=SERVICE
        )
        codes = [check().status_code for _ in range(3)]
        assert codes == [200, 200, 429], codes
        assert len(calls) == 2

        async def down(*_args, **_kwargs):
            raise RuntimeError("redis недоступен")

        monkeypatch.setattr(fake_redis, "incr", down)
        assert check().status_code == 503
        assert len(calls) == 2


def _router(chat_status: int, chat_error: dict | None = None):
    """Роутер-ловушка: список моделей всегда 200 (так OpenAI отвечает и на пустом счёте), вызов модели как задано."""

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/models"):
            return httpx.Response(200, json={"data": []})
        return httpx.Response(chat_status, json={"error": chat_error} if chat_error else {"choices": []})

    return handler


def test_check_sees_an_empty_balance_that_the_model_list_hides(app, monkeypatch) -> None:
    """20.10.2026: ключ с пустым счётом проходил проверку (список моделей 200), а каждый ход гостя падал 429."""
    seen = _swap_http(
        monkeypatch, _router(429, {"code": "credit_balance_exhausted", "type": "insufficient_quota"})
    )
    body = app.client.post(
        f"{PANEL}/seller/organizations/{ORG}/llm-key/check", json={"key": PARTNER_KEY}, headers=SERVICE
    ).json()
    assert body["valid"] is False and body["state"] == "no_credits"
    assert "пополните баланс" in body["reason"]
    assert [r.url.path.rsplit("/", 1)[-1] for r in seen] == ["models", "completions"]
    assert seen[1].headers["authorization"] == f"Bearer {PARTNER_KEY}"
    # проверка чужого ключа до сохранения состояние сохранённого не трогает
    assert _get(app).json()["state"] is None


def test_check_of_the_saved_key_records_its_state(app, monkeypatch) -> None:
    assert app.client.post(
        f"{PANEL}/seller/organizations/{ORG}/llm-key/check", json={}, headers=SERVICE
    ).status_code == 422, "ключ не сохранён: проверять нечего"
    _put(app, PARTNER_KEY)
    seen = _swap_http(monkeypatch, _router(200))
    body = app.client.post(f"{PANEL}/seller/organizations/{ORG}/llm-key/check", json={}, headers=SERVICE).json()
    assert body == {"valid": True, "state": "ok", "reason": None}
    assert seen[0].headers["authorization"] == f"Bearer {PARTNER_KEY}"
    status = _get(app).json()
    assert status["state"] == "ok" and status["checked_at"]
    assert PARTNER_KEY not in str(status)

    _swap_http(monkeypatch, _router(401, {"code": "invalid_api_key"}))
    app.client.post(f"{PANEL}/seller/organizations/{ORG}/llm-key/check", json={}, headers=SERVICE)
    assert _get(app).json()["state"] == "invalid_key"
    # новый ключ: прежнее состояние больше не про него
    _put(app, "sk-another-key-9876")
    assert _get(app).json()["state"] is None


def test_key_state_from_provider_codes() -> None:
    from src.ai import key_state
    from src.ai.llm import AttemptLog

    assert key_state.classify(429, "insufficient_quota") == "no_credits"
    assert key_state.classify(429, "credit_balance_exhausted") == "no_credits"
    assert key_state.classify(429, "rate_limit_exceeded") == "rate_limited"
    assert key_state.classify(401, None) == "invalid_key"
    assert key_state.classify(500, None) == "error"
    steps = [AttemptLog("a", "http_error", 0.1, note="HTTP 429 credit_balance_exhausted"),
             AttemptLog("b", "timeout", 1.0, note="таймаут попытки")]
    assert key_state.from_attempts(steps) == "no_credits"
    assert key_state.from_attempts([AttemptLog("a", "timeout", 1.0, note="таймаут попытки")]) is None


async def test_the_cascade_note_carries_the_provider_code() -> None:
    """Код ошибки поставщика доходит до заметки ступени: по нему ход пишет состояние ключа."""
    from src.config import get_settings

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={"error": {"code": "insufficient_quota", "message": "no credits"}})

    settings = get_settings().model_copy(
        update={"llm_base_url": "https://router.example.com/v1", "llm_api_key": "platform-key", "llm_model": "m1"}
    )
    cascade = CascadeClient(settings, http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    result = await cascade.generate([{"role": "user", "content": "привет"}], use_tools=False)
    assert not result.ok
    assert result.attempts[0].note == "HTTP 429 insufficient_quota"


def test_usage_of_the_month_by_our_own_count(app, sync_db) -> None:  # noqa: F811
    """Расход по нашему учёту ответов: ход песочницы виден гостинице, соседней нет."""
    llm = ScriptedLlm([reply("Здравствуйте! Есть места.")])
    set_cascade_client(llm)
    assert app.client.post(
        "/internal/sandbox",
        json={"external_id": "u-usage-1", "text": "Есть места?", "organization_id": ORG},
        headers=SERVICE,
    ).status_code == 200
    usage = app.client.get(f"{PANEL}/seller/organizations/{ORG}/llm-usage", headers=SERVICE).json()
    assert usage["replies"] == 1 and usage["tokens"] > 0
    assert usage["priced"] is False and usage["cost_usd"] is None, "без LLM_PRICES стоимость не выдумываем"
    other = app.client.get(f"{PANEL}/seller/organizations/{ORG_B}/llm-usage", headers=SERVICE).json()
    assert other["replies"] == 0 and other["tokens"] == 0
    assert app.client.get(
        f"{PANEL}/seller/organizations/{ORG}/llm-usage?month=2026-13", headers=SERVICE
    ).status_code == 422
