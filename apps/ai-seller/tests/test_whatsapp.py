"""С3 «под ключ»: канал WhatsApp Cloud API (Q-185, рекомендация (а); ADR-086).

Номер и аккаунт Meta заводит партнёр; бот хранит `phone_number_id`, токен и
секрет приложения (шифрованными, тем же секретом хранилища `LLM_KEYS_SECRET`),
а дверь вебхука живёт под организацией: подпись `X-Hub-Signature-256`
считается секретом ЕЁ приложения, чужой номер в теле — молча мимо.
Бот только отвечает написавшим (окно 24 часов Cloud API соблюдено само
собой), первым не пишет. Телефон гостя приходит каналом (`wa_id`).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
from typing import Any

import httpx
import pytest
import sqlalchemy as sa

from src import dependencies
from src.db.models import Client, Conversation, WhatsAppConnection
from tests.dashboard_fakes import (  # noqa: F401 — sync_db используется как фикстура
    PANEL,
    _all,
    panel,
    seed_org,
    sync_db,
)
from tests.llm_fakes import LLM_ENV

KEY = "service-key-for-tests-only"
ORG = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa"
ORG_B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb"
SERVICE = {"X-Service-Key": KEY}
FERNET = base64.urlsafe_b64encode(b"test-secret-32-bytes-for-fernet!").decode()

PHONE_ID = "555000111"
TOKEN = "EAAG-partner-token-for-tests"
APP_SECRET = "meta-app-secret-for-tests"
GUEST = "77021112233"  # вымышленный номер (ADR-010)
REPLY = "Здравствуйте! Есть места, помогу с выбором."


def _webhook_body(text: str = "Есть места на завтра?", phone_id: str = PHONE_ID, wamid: str = "wamid.TEST1") -> bytes:
    body = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "WBA-1",
                "changes": [
                    {
                        "field": "messages",
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {"display_phone_number": "77010000000", "phone_number_id": phone_id},
                            "contacts": [{"profile": {"name": "Гость Тестовый"}, "wa_id": GUEST}],
                            "messages": [
                                {
                                    "from": GUEST,
                                    "id": wamid,
                                    "timestamp": "1758800000",
                                    "type": "text",
                                    "text": {"body": text},
                                }
                            ],
                        },
                    }
                ],
            }
        ],
    }
    return json.dumps(body, ensure_ascii=False).encode()


def _sign(raw: bytes, secret: str = APP_SECRET) -> str:
    return "sha256=" + hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()


class FakeNet:
    """Одна сеть на процесс: роутер моделей отвечает сценарием, Graph — принимает отправку."""

    def __init__(self) -> None:
        self.graph: list[httpx.Request] = []
        self.llm_calls = 0

    def handler(self, request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if "/chat/completions" in url:
            self.llm_calls += 1
            return httpx.Response(
                200,
                json={
                    "choices": [{"message": {"content": json.dumps({"reply": REPLY}, ensure_ascii=False)}}],
                    "usage": {"total_tokens": 7},
                },
            )
        if "graph.test" in url:
            self.graph.append(request)
            return httpx.Response(200, json={"messages": [{"id": "wamid.OUT1"}]})
        raise AssertionError(f"неожиданный адрес наружу: {url}")

    def client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(transport=httpx.MockTransport(self.handler))


@pytest.fixture
def net(monkeypatch) -> FakeNet:
    fake = FakeNet()
    client = fake.client()
    monkeypatch.setattr(dependencies._resources, "http_client", client)
    return fake


@pytest.fixture
def app(monkeypatch, fake_redis, sync_db, net):  # noqa: F811
    with panel(
        monkeypatch,
        fake_redis,
        SELLER_SERVICE_KEY=KEY,
        BOT_ROLE="seller",
        LLM_KEYS_SECRET=FERNET,
        WHATSAPP_GRAPH_BASE_URL="https://graph.test/v20.0",
        **LLM_ENV,
    ) as p:
        seed_org(sync_db, ORG, prompt="Ты продавец гостиницы-стенда. Отвечай коротко.")
        seed_org(sync_db, ORG_B, key="sk_" + "cd" * 12, name="Гостиница Б")
        yield p


def _connect(app, org: str = ORG, phone_id: str = PHONE_ID):
    return app.client.put(
        f"{PANEL}/seller/organizations/{org}/whatsapp",
        json={"phone_number_id": phone_id, "token": TOKEN, "app_secret": APP_SECRET},
        headers=SERVICE,
    )


def _drain(app) -> None:
    runner = getattr(app.client.app.state, "whatsapp_runner", None)
    if runner is not None:
        app.client.portal.call(runner.drain)


def test_connection_is_stored_encrypted_and_token_never_returns(app, sync_db) -> None:  # noqa: F811
    response = _connect(app)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["set"] is True and body["phone_number_id"] == PHONE_ID
    assert body["verify_token"], "проверочное слово для консоли Meta не выдано"
    assert TOKEN not in response.text and APP_SECRET not in response.text
    rows = _all(sync_db, sa.select(WhatsAppConnection))
    assert len(rows) == 1
    blob = bytes(rows[0].token_encrypted) + bytes(rows[0].app_secret_encrypted)
    assert TOKEN.encode() not in blob and APP_SECRET.encode() not in blob
    status = app.client.get(f"{PANEL}/seller/organizations/{ORG}/whatsapp", headers=SERVICE)
    assert status.json()["set"] is True and TOKEN not in status.text


def test_meta_verification_echoes_challenge_only_with_the_right_word(app) -> None:
    verify = _connect(app).json()["verify_token"]
    ok = app.client.get(
        f"/channels/whatsapp/webhook/{ORG}",
        params={"hub.mode": "subscribe", "hub.verify_token": verify, "hub.challenge": "42-echo"},
    )
    assert ok.status_code == 200 and ok.text == "42-echo"
    bad = app.client.get(
        f"/channels/whatsapp/webhook/{ORG}",
        params={"hub.mode": "subscribe", "hub.verify_token": "ne-to", "hub.challenge": "42"},
    )
    assert bad.status_code == 403


def test_a_message_becomes_a_dialog_and_the_reply_goes_to_graph(app, sync_db, net) -> None:  # noqa: F811
    _connect(app)
    raw = _webhook_body()
    response = app.client.post(
        f"/channels/whatsapp/webhook/{ORG}",
        content=raw,
        headers={"Content-Type": "application/json", "X-Hub-Signature-256": _sign(raw)},
    )
    assert response.status_code == 200, response.text
    _drain(app)
    assert net.llm_calls == 1, "ход не дошёл до модели"
    assert len(net.graph) == 1, "ответ не ушёл в Graph API"
    out = net.graph[0]
    assert out.url.path.endswith(f"/{PHONE_ID}/messages")
    assert out.headers["authorization"] == f"Bearer {TOKEN}"
    sent = json.loads(out.content)
    assert sent["to"] == GUEST and sent["messaging_product"] == "whatsapp"
    assert REPLY.split("!")[0] in sent["text"]["body"]
    clients = _all(sync_db, sa.select(Client).where(Client.channel == "whatsapp"))
    assert len(clients) == 1 and clients[0].external_id == GUEST
    assert str(clients[0].organization_id) == ORG
    dialogs = _all(sync_db, sa.select(Conversation))
    assert any(str(d.organization_id) == ORG for d in dialogs)


def test_wrong_signature_is_refused_before_the_engine(app, net) -> None:
    _connect(app)
    raw = _webhook_body()
    response = app.client.post(
        f"/channels/whatsapp/webhook/{ORG}",
        content=raw,
        headers={"Content-Type": "application/json", "X-Hub-Signature-256": _sign(raw, "chuzhoy-secret")},
    )
    assert response.status_code == 403
    _drain(app)
    assert net.llm_calls == 0 and net.graph == []


def test_a_foreign_phone_number_id_is_ignored_silently(app, net) -> None:
    _connect(app)
    raw = _webhook_body(phone_id="999999999")
    response = app.client.post(
        f"/channels/whatsapp/webhook/{ORG}",
        content=raw,
        headers={"Content-Type": "application/json", "X-Hub-Signature-256": _sign(raw)},
    )
    # Meta повторяет доставку на не-200: чужой номер — 200 и мимо, не 4xx
    assert response.status_code == 200
    _drain(app)
    assert net.llm_calls == 0 and net.graph == []


def test_redelivery_of_the_same_message_is_answered_once(app, net) -> None:
    _connect(app)
    raw = _webhook_body()
    headers = {"Content-Type": "application/json", "X-Hub-Signature-256": _sign(raw)}
    assert app.client.post(f"/channels/whatsapp/webhook/{ORG}", content=raw, headers=headers).status_code == 200
    _drain(app)
    assert app.client.post(f"/channels/whatsapp/webhook/{ORG}", content=raw, headers=headers).status_code == 200
    _drain(app)
    assert net.llm_calls == 1 and len(net.graph) == 1


def test_disconnect_clears_and_the_webhook_goes_dark(app, sync_db) -> None:  # noqa: F811
    verify = _connect(app).json()["verify_token"]
    response = app.client.put(
        f"{PANEL}/seller/organizations/{ORG}/whatsapp",
        json={"phone_number_id": "", "token": "", "app_secret": ""},
        headers=SERVICE,
    )
    assert response.status_code == 200 and response.json()["set"] is False
    assert _all(sync_db, sa.select(WhatsAppConnection)) == []
    gone = app.client.get(
        f"/channels/whatsapp/webhook/{ORG}",
        params={"hub.mode": "subscribe", "hub.verify_token": verify, "hub.challenge": "42"},
    )
    assert gone.status_code == 403


def test_the_support_instance_has_no_whatsapp(monkeypatch, fake_redis, sync_db, net) -> None:  # noqa: F811
    with panel(
        monkeypatch, fake_redis, SELLER_SERVICE_KEY=KEY, BOT_ROLE="support", LLM_KEYS_SECRET=FERNET
    ) as p:
        response = p.client.put(
            f"{PANEL}/seller/organizations/{ORG}/whatsapp",
            json={"phone_number_id": PHONE_ID, "token": TOKEN, "app_secret": APP_SECRET},
            headers=SERVICE,
        )
        assert response.status_code == 409
