"""Шаг 6: клиент Bot API. Отказ определяется по телу, не по коду; токен
и адрес не попадают в журнал; длинный текст режется на части <= 4096.

Все запросы идут в FakeTelegramApi через httpx.MockTransport — сети нет.
"""

from __future__ import annotations

import logging

import httpx
import pytest

from src.channels.sender import SendResult
from src.channels.telegram import TelegramClient
from tests.telegram_fakes import API_BASE, TEST_TOKEN, FakeTelegramApi

CHAT = "42"
LIMIT = 4096


@pytest.fixture
def api() -> FakeTelegramApi:
    return FakeTelegramApi()


@pytest.fixture
def tg(api: FakeTelegramApi) -> TelegramClient:
    return TelegramClient(TEST_TOKEN, api.client(), api_base=API_BASE)


def _long_text(target: int) -> str:
    """Текст из строк-абзацев заданной длины: есть где резать."""
    lines = []
    while sum(len(line) + 1 for line in lines) < target:
        lines.append(f"Строка {len(lines) + 1}: свободные номера на выходные есть, цена по прайсу.")
    return "\n".join(lines)[:target]


async def test_send_message_ok_returns_string_message_id(api: FakeTelegramApi, tg: TelegramClient) -> None:
    result = await tg.send_message(CHAT, "Здравствуйте!")
    assert isinstance(result, SendResult)
    assert result.ok is True
    assert result.error is None
    assert result.external_message_id == "1"
    assert isinstance(result.external_message_id, str)

    assert len(api.calls) == 1
    method, body = api.calls[0]
    assert method == "sendMessage"
    assert body["chat_id"] == CHAT
    assert body["text"] == "Здравствуйте!"
    assert body["disable_web_page_preview"] is True
    assert "parse_mode" not in body


async def test_token_goes_into_path_and_api_base_is_used(api: FakeTelegramApi) -> None:
    """Фейк принимает только /bot<test-token>/<метод>; чужой токен — 401 без записи."""
    proxied = TelegramClient(TEST_TOKEN, api.client(), api_base="https://proxy.example")
    result = await proxied.send_message(CHAT, "привет")
    assert result.ok is True
    assert api.hosts == ["proxy.example"]

    wrong = TelegramClient("other-token", api.client(), api_base=API_BASE)
    result = await wrong.send_message(CHAT, "привет")
    assert result.ok is False
    assert api.unauthorized == 1
    assert len(api.calls) == 1


async def test_body_ok_false_with_http_200_is_api_error(api: FakeTelegramApi, tg: TelegramClient) -> None:
    api.script("sendMessage", {"ok": False, "error_code": 400, "description": "Bad Request: chat not found"})
    result = await tg.send_message(CHAT, "текст")
    assert result.ok is False
    assert result.error == "api_error"
    assert result.external_message_id is None


async def test_http_429_is_rate_limited(api: FakeTelegramApi, tg: TelegramClient) -> None:
    api.script("sendMessage", 429)
    result = await tg.send_message(CHAT, "текст")
    assert result.ok is False
    assert result.error == "rate_limited"


async def test_other_http_code_is_http_code(api: FakeTelegramApi, tg: TelegramClient) -> None:
    api.script("sendMessage", 500)
    result = await tg.send_message(CHAT, "текст")
    assert result.ok is False
    assert result.error == "http_500"


async def test_timeout_is_timeout(api: FakeTelegramApi, tg: TelegramClient) -> None:
    api.script("sendMessage", httpx.ReadTimeout("timed out"))
    result = await tg.send_message(CHAT, "текст")
    assert result.ok is False
    assert result.error == "timeout"


async def test_connection_error_is_connection(api: FakeTelegramApi, tg: TelegramClient) -> None:
    api.script("sendMessage", httpx.ConnectError("connection refused"))
    result = await tg.send_message(CHAT, "текст")
    assert result.ok is False
    assert result.error == "connection"


async def test_deliver_is_send_message(api: FakeTelegramApi, tg: TelegramClient) -> None:
    result = await tg.deliver(CHAT, "через транспорт")
    assert result.ok is True
    assert api.calls_for("sendMessage")[0]["chat_id"] == CHAT


async def test_text_over_limit_is_split_into_parts(api: FakeTelegramApi, tg: TelegramClient) -> None:
    text = _long_text(6000)
    result = await tg.send_message(CHAT, text)
    assert result.ok is True
    parts = [body["text"] for body in api.calls_for("sendMessage")]
    assert len(parts) == 2
    assert all(len(p) <= LIMIT for p in parts)
    # Ничего не потеряно: части, склеенные обратно, дают исходный текст
    # с точностью до переводов строк на стыках.
    assert "".join(parts).replace("\n", "") == text.replace("\n", "")
    # id — от последней части.
    assert result.external_message_id == "2"


async def test_text_of_9000_chars_is_split_into_chunks_under_limit(api: FakeTelegramApi, tg: TelegramClient) -> None:
    """9000 символов в 4096 не помещаются двумя частями: частей столько,
    сколько нужно, и каждая в пределе."""
    text = _long_text(9000)
    result = await tg.send_message(CHAT, text)
    assert result.ok is True
    parts = [body["text"] for body in api.calls_for("sendMessage")]
    assert len(parts) >= 3
    assert all(0 < len(p) <= LIMIT for p in parts)
    assert "".join(parts).replace("\n", "") == text.replace("\n", "")
    assert result.external_message_id == str(len(parts))


async def test_failure_in_middle_of_split_is_failure(api: FakeTelegramApi, tg: TelegramClient) -> None:
    api.script("sendMessage", {"ok": True, "result": {"message_id": 1}}, 500)
    result = await tg.send_message(CHAT, _long_text(6000))
    assert result.ok is False


async def test_log_on_failure_has_no_token_and_no_url(
    api: FakeTelegramApi, tg: TelegramClient, caplog: pytest.LogCaptureFixture
) -> None:
    """🔴 Токен едет в адресе каждого запроса: в журнале только имя метода."""
    api.script(
        "sendMessage",
        {"ok": False, "error_code": 403, "description": "Forbidden: see https://example.org/help for details"},
        429,
        500,
        httpx.ConnectError(f"cannot connect to {API_BASE}/bot{TEST_TOKEN}/sendMessage"),
        httpx.ReadTimeout(f"timeout on {API_BASE}/bot{TEST_TOKEN}/sendMessage"),
    )
    with caplog.at_level(logging.DEBUG):
        for _ in range(5):
            result = await tg.send_message(CHAT, "текст")
            assert result.ok is False
    assert caplog.text, "отказ должен попасть в журнал"
    assert TEST_TOKEN not in caplog.text
    assert "https://" not in caplog.text
    assert "http://" not in caplog.text
    assert "sendMessage" in caplog.text


async def test_set_webhook_keeps_pending_updates_and_sends_secret(api: FakeTelegramApi, tg: TelegramClient) -> None:
    ok = await tg.set_webhook("https://example.com/webhooks/telegram", "hook-secret")
    assert ok is True
    calls = api.calls_for("setWebhook")
    assert len(calls) == 1
    body = calls[0]
    assert body["url"] == "https://example.com/webhooks/telegram"
    assert body["secret_token"] == "hook-secret"
    assert body["drop_pending_updates"] is False
    assert set(body["allowed_updates"]) == {"message", "callback_query"}


async def test_set_webhook_failure_returns_false(api: FakeTelegramApi, tg: TelegramClient) -> None:
    api.script("setWebhook", {"ok": False, "error_code": 400, "description": "Bad Request: bad webhook"})
    assert await tg.set_webhook("https://example.com/webhooks/telegram", "hook-secret") is False


async def test_answer_callback_query(api: FakeTelegramApi, tg: TelegramClient) -> None:
    assert await tg.answer_callback_query("cb-1", "Спасибо") is True
    body = api.calls_for("answerCallbackQuery")[0]
    assert body["callback_query_id"] == "cb-1"
    assert body["text"] == "Спасибо"

    assert await tg.answer_callback_query("cb-2") is True
    body = api.calls_for("answerCallbackQuery")[1]
    assert body["callback_query_id"] == "cb-2"
    assert not body.get("text")


async def test_delete_webhook_and_info(api: FakeTelegramApi, tg: TelegramClient) -> None:
    assert await tg.delete_webhook() is True
    assert len(api.calls_for("deleteWebhook")) == 1

    api.script("getWebhookInfo", {"ok": True, "result": {"url": "https://example.com/webhooks/telegram"}})
    info = await tg.webhook_info()
    assert info == {"url": "https://example.com/webhooks/telegram"}

    api.script("getWebhookInfo", 500)
    assert await tg.webhook_info() == {}
