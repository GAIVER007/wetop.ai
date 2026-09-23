"""Подмены для тестов канала (шаг 6): Telegram Bot API в памяти, транспорт
в память, сборщики обновлений и подменный runner для вебхука.

FakeTelegramApi живёт поверх httpx.MockTransport: ни один запрос не уходит
в сеть, а путь /bot<token>/<method> разбирается как это делает Telegram.
Токен в тестах — только 'test-token'.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

import httpx

from src.channels.outbox import Transport
from src.channels.sender import SendResult

TEST_TOKEN = "test-token"
API_BASE = "https://api.telegram.org"

_PATH_RE = re.compile(r"^/bot(?P<token>[^/]+)/(?P<method>[A-Za-z]+)$")

# Ответы по умолчанию: без сценария метод отвечает как живой Telegram
# на успешный вызов.
_DEFAULTS: dict[str, Any] = {
    "answerCallbackQuery": {"ok": True, "result": True},
    "setWebhook": {"ok": True, "result": True},
    "deleteWebhook": {"ok": True, "result": True},
    "getWebhookInfo": {"ok": True, "result": {"url": "", "pending_update_count": 0}},
}


class FakeTelegramApi:
    """Bot API в памяти.

    calls — список (метод, тело JSON) для проверок. script(method, ...)
    ставит очередь ответов: dict — тело с HTTP 200, int — код ошибки
    с телом {"ok": false}, Exception — поднимается из транспорта
    (так проверяются таймаут и обрыв связи).
    """

    def __init__(self, token: str = TEST_TOKEN) -> None:
        self.token = token
        self.calls: list[tuple[str, dict]] = []
        self.hosts: list[str] = []
        self.unauthorized: int = 0
        self._scripts: dict[str, list[Any]] = {}
        self._message_counter = 0

    def script(self, method: str, *responses: Any) -> None:
        self._scripts.setdefault(method, []).extend(responses)

    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self._handle)

    def client(self) -> httpx.AsyncClient:
        """HTTP-клиент, который ходит только в этот фейк."""
        return httpx.AsyncClient(transport=self.transport())

    def calls_for(self, method: str) -> list[dict]:
        return [body for name, body in self.calls if name == method]

    def _handle(self, request: httpx.Request) -> httpx.Response:
        match = _PATH_RE.match(request.url.path)
        if match is None:
            return httpx.Response(404, json={"ok": False, "error_code": 404, "description": "Not Found"})
        if match.group("token") != self.token:
            # Чужой токен — как у живого Telegram: 401 и никаких вызовов в журнале фейка.
            self.unauthorized += 1
            return httpx.Response(401, json={"ok": False, "error_code": 401, "description": "Unauthorized"})
        method = match.group("method")
        self.hosts.append(request.url.host)
        try:
            body = json.loads(request.content.decode("utf-8")) if request.content else {}
        except ValueError:
            body = {"_raw": request.content.decode("utf-8", errors="replace")}
        self.calls.append((method, body))

        queue = self._scripts.get(method)
        scripted = queue.pop(0) if queue else None
        if isinstance(scripted, Exception):
            raise scripted
        if isinstance(scripted, int):
            payload: dict[str, Any] = {"ok": False, "error_code": scripted, "description": f"Error {scripted}"}
            if scripted == 429:
                payload["description"] = "Too Many Requests: retry after 3"
                payload["parameters"] = {"retry_after": 3}
            return httpx.Response(scripted, json=payload)
        if isinstance(scripted, dict):
            return httpx.Response(200, json=scripted)
        if method == "sendMessage":
            self._message_counter += 1
            return httpx.Response(200, json={"ok": True, "result": {"message_id": self._message_counter}})
        if method in _DEFAULTS:
            return httpx.Response(200, json=_DEFAULTS[method])
        return httpx.Response(200, json={"ok": True, "result": True})


@dataclass
class FakeTransport(Transport):
    """Транспорт в память. ok=False — отказ с кодом error; raise_exc=True —
    исключение вместо результата (проверка внешнего try/except)."""

    ok: bool = True
    sent: list[tuple[str, str]] = field(default_factory=list)
    error: str = "boom"
    raise_exc: bool = False

    async def deliver(self, recipient: str, text: str) -> SendResult:
        if self.raise_exc:
            raise RuntimeError("транспорт сломан")
        if not self.ok:
            return SendResult(ok=False, error=self.error)
        self.sent.append((str(recipient), text))
        return SendResult(ok=True, external_message_id=str(len(self.sent)))


class FakeRunner:
    """Подмена WebhookRunner для тестов вебхука: запоминает, что ему отдали."""

    def __init__(self) -> None:
        self.submitted: list[dict] = []

    def submit(self, update: dict) -> None:
        self.submitted.append(update)

    async def drain(self) -> None:
        return None


# ─── Сборщики обновлений Telegram ───
# chat.id и from.id — числа, как их шлёт Telegram: канал обязан привести к строке.


def message_update(
    *,
    chat_id: int = 555,
    text: str | None = "Здравствуйте, есть места?",
    first_name: str | None = "Иван",
    last_name: str | None = None,
    update_id: int = 1,
    photo: bool = False,
) -> dict:
    sender: dict[str, Any] = {"id": chat_id, "is_bot": False}
    if first_name is not None:
        sender["first_name"] = first_name
    if last_name is not None:
        sender["last_name"] = last_name
    message: dict[str, Any] = {
        "message_id": 10 + update_id,
        "date": 1_700_000_000,
        "chat": {"id": chat_id, "type": "private"},
        "from": sender,
    }
    if text is not None:
        message["text"] = text
    if photo:
        message["photo"] = [{"file_id": "AgAC", "width": 90, "height": 90}]
    return {"update_id": update_id, "message": message}


def callback_update(
    *,
    chat_id: int = 555,
    data: str = "consent:accept",
    callback_id: str = "cb-1",
    first_name: str | None = "Иван",
    update_id: int = 2,
) -> dict:
    sender: dict[str, Any] = {"id": chat_id, "is_bot": False}
    if first_name is not None:
        sender["first_name"] = first_name
    return {
        "update_id": update_id,
        "callback_query": {
            "id": callback_id,
            "from": sender,
            "chat_instance": "1",
            "data": data,
            "message": {
                "message_id": 7,
                "date": 1_700_000_000,
                "chat": {"id": chat_id, "type": "private"},
                "text": "экран согласия",
            },
        },
    }
