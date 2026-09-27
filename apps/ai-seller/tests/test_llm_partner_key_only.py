"""Ключ модели только у партнёра (26.09.2026, владелец: «ключ возьму на платформе GPT»).

Владелец вводит ключ во вкладке «Модель» (С2, Q-186), а ключа платформы (LLM_API_KEY) у продавца нет:
адрес роутера и модели — из окружения, ключ — у гостиницы. Раньше клиент каскада создавался только при
ключе платформы, и ключ партнёра не работал вовсе: каждый ход отвечал «модель не настроена».
"""

from __future__ import annotations

from src.ai.llm import CascadeClient
from tests.llm_fakes import PRIMARY, ScriptedRouter, chat_response, llm_env

MESSAGES = [{"role": "user", "content": "Здравствуйте, есть места на завтра?"}]
GOOD = '{"reply": "Здравствуйте! Сейчас проверю.", "needs_human": false}'


async def test_partner_key_works_without_platform_key(monkeypatch) -> None:
    settings = llm_env(monkeypatch, LLM_API_KEY="")
    router = ScriptedRouter({PRIMARY: [chat_response(GOOD, model=PRIMARY)]})
    client = CascadeClient(settings, http_client=router.http_client())
    result = await client.generate(MESSAGES, use_tools=False, api_key="sk-partner")
    assert result.ok
    assert router.authorizations == ["Bearer sk-partner"]


async def test_without_any_key_nothing_is_sent(monkeypatch) -> None:
    settings = llm_env(monkeypatch, LLM_API_KEY="")
    router = ScriptedRouter({PRIMARY: [chat_response(GOOD, model=PRIMARY)]})
    client = CascadeClient(settings, http_client=router.http_client())
    result = await client.generate(MESSAGES, use_tools=False)
    assert result.ok is False and result.error == "llm_not_configured"
    assert router.calls == []


async def test_platform_key_still_serves_turns_without_partner_key(monkeypatch) -> None:
    settings = llm_env(monkeypatch)
    router = ScriptedRouter({PRIMARY: [chat_response(GOOD, model=PRIMARY)]})
    client = CascadeClient(settings, http_client=router.http_client())
    result = await client.generate(MESSAGES, use_tools=False)
    assert result.ok
    assert router.authorizations == ["Bearer test"]
