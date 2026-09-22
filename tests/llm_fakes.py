"""Подменный роутер для тестов слоя модели: без сети, через httpx.MockTransport.

Формат ответа — как у настоящего ChatCompletion, иначе SDK его не разберёт.
Сценарий задаётся очередью ответов на имя модели: так проверяется каскад
(основная упала — запасная ответила), а не одна удачная попытка.
"""

from __future__ import annotations

import json
import time
from typing import Any

import httpx
import pytest

from src.config import Settings, get_settings

# Настройки каскада для тестов: три разных вендора, адрес и ключ вымышленные.
LLM_ENV = {
    "LLM_API_KEY": "test",
    "LLM_BASE_URL": "http://router.test/v1",
    "LLM_MODEL": "openai/a",
    "LLM_MODEL_FALLBACK": "anthropic/b",
    "LLM_MODEL_EMERGENCY": "google/c",
}
PRIMARY, FALLBACK, EMERGENCY = "openai/a", "anthropic/b", "google/c"


def llm_env(monkeypatch: pytest.MonkeyPatch, **overrides: str) -> Settings:
    """Ставит переменные каскада поверх окружения conftest и отдаёт свежие Settings."""
    for name, value in {**LLM_ENV, **overrides}.items():
        if value == "":
            monkeypatch.delenv(name, raising=False)
        else:
            monkeypatch.setenv(name, value)
    get_settings.cache_clear()
    return get_settings()


def tool_call(call_id: str, name: str, arguments: dict[str, Any]) -> dict:
    """Вызов инструмента в формате SDK: аргументы — строка JSON, не объект."""
    return {
        "id": call_id,
        "type": "function",
        "function": {"name": name, "arguments": json.dumps(arguments, ensure_ascii=False)},
    }


def chat_response(
    content: str | None,
    *,
    model: str,
    tool_calls: list[dict] | None = None,
    finish_reason: str = "stop",
    refusal: str | None = None,
    usage_total: int = 42,
) -> dict:
    """Тело ответа 200 в формате ChatCompletion."""
    return {
        "id": "chatcmpl-test",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": model,
        "choices": [
            {
                "index": 0,
                "finish_reason": finish_reason,
                "message": {
                    "role": "assistant",
                    "content": content,
                    "refusal": refusal,
                    "tool_calls": tool_calls,
                },
            }
        ],
        "usage": {
            "prompt_tokens": max(usage_total - 1, 0),
            "completion_tokens": min(usage_total, 1),
            "total_tokens": usage_total,
        },
    }


class ScriptedRouter:
    """Роутер по сценарию.

    script: имя модели -> очередь ответов. Элемент очереди:
    - dict — ответ 200 с этим JSON;
    - int — HTTP-ошибка с этим кодом и телом {'error': {'message': 'x'}};
    - Exception (httpx.ReadTimeout, httpx.ConnectError) — поднимается из транспорта.
    Пустая очередь — 500: модель без сценария считается упавшей.
    calls хранит тело каждого запроса как dict — по нему проверяется,
    что ушло в модель (маскировка, tool-сообщения).
    """

    def __init__(self, script: dict[str, list] | None = None) -> None:
        self.calls: list[dict] = []
        self.script: dict[str, list] = {name: list(queue) for name, queue in (script or {}).items()}

    def _handle(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content or b"{}")
        self.calls.append(body)
        queue = self.script.get(body.get("model"), [])
        if not queue:
            return httpx.Response(500, json={"error": {"message": "x"}}, request=request)
        item = queue.pop(0)
        if isinstance(item, Exception):
            if isinstance(item, httpx.RequestError):
                item.request = request
            raise item
        if isinstance(item, int):
            return httpx.Response(item, json={"error": {"message": "x"}}, request=request)
        return httpx.Response(200, json=item, request=request)

    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self._handle)

    def http_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(transport=self.transport())


def message_texts(call: dict) -> list[str]:
    """Все текстовые content из тела запроса — для проверки маскировки."""
    return [m.get("content") or "" for m in call.get("messages", []) if isinstance(m.get("content"), str)]
