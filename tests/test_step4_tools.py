"""Шаг 4: инструменты. Реестр отдаёт описания в формате OpenAI, диспетчер
никогда не поднимает исключение — модель получает нейтральную строку."""

import json
from types import SimpleNamespace

import pytest

from src.ai.llm import CascadeClient
from src.ai.tools import ToolRegistry, ToolSpec
from tests.llm_fakes import PRIMARY, ScriptedRouter, chat_response, llm_env, tool_call

PRICE_SCHEMA = {
    "type": "object",
    "properties": {"item": {"type": "string", "description": "название товара"}},
    "required": ["item"],
}
FINAL = '{"reply": "Стоимость уточнит менеджер.", "needs_human": false}'


def fake_call(call_id: str, name: str, arguments: str) -> SimpleNamespace:
    """Объект вызова как в ответе SDK: .id, .function.name, .function.arguments."""
    return SimpleNamespace(id=call_id, function=SimpleNamespace(name=name, arguments=arguments))


def registry_with_price() -> tuple[ToolRegistry, list[dict]]:
    seen: list[dict] = []

    async def get_price(item: str) -> str:
        seen.append({"item": item})
        return f"{item}: есть в наличии"

    registry = ToolRegistry()
    registry.register(ToolSpec(name="get_price", description="Наличие товара", parameters=PRICE_SCHEMA, handler=get_price))
    return registry, seen


def test_specs_for_openai_format() -> None:
    registry, _ = registry_with_price()
    specs = registry.specs_for_openai()
    assert specs == [
        {
            "type": "function",
            "function": {"name": "get_price", "description": "Наличие товара", "parameters": PRICE_SCHEMA},
        }
    ]
    assert registry.names == ["get_price"]
    assert ToolRegistry().specs_for_openai() == []


def test_duplicate_name_rejected() -> None:
    registry, _ = registry_with_price()

    async def other(item: str) -> str:
        return ""

    with pytest.raises(ValueError):
        registry.register(ToolSpec(name="get_price", description="дубль", parameters=PRICE_SCHEMA, handler=other))


async def test_dispatch_returns_tool_messages() -> None:
    registry, seen = registry_with_price()
    result = await registry.dispatch([fake_call("c1", "get_price", json.dumps({"item": "стул"}))])
    assert result == [{"role": "tool", "tool_call_id": "c1", "content": "стул: есть в наличии"}]
    assert seen == [{"item": "стул"}]


async def test_unknown_tool_is_neutral_string() -> None:
    registry, _ = registry_with_price()
    result = await registry.dispatch([fake_call("c2", "delete_everything", "{}")])
    assert result == [{"role": "tool", "tool_call_id": "c2", "content": "инструмент недоступен"}]


async def test_bad_json_arguments() -> None:
    registry, seen = registry_with_price()
    result = await registry.dispatch([fake_call("c3", "get_price", "{не json")])
    assert result[0]["content"] == "неверные аргументы"
    assert seen == []


async def test_handler_exception_is_swallowed() -> None:
    async def broken(item: str) -> str:
        raise RuntimeError("секретная трассировка")

    registry = ToolRegistry()
    registry.register(ToolSpec(name="broken", description="", parameters=PRICE_SCHEMA, handler=broken))
    result = await registry.dispatch([fake_call("c4", "broken", '{"item": "x"}')])
    assert result[0]["content"] == "инструмент временно недоступен"
    assert "секретная" not in result[0]["content"]


async def test_tool_round_trip_through_cascade(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = llm_env(monkeypatch)
    registry, seen = registry_with_price()
    router = ScriptedRouter(
        {
            PRIMARY: [
                chat_response(
                    None,
                    model=PRIMARY,
                    tool_calls=[tool_call("call_1", "get_price", {"item": "стол"})],
                    finish_reason="tool_calls",
                ),
                chat_response(FINAL, model=PRIMARY),
            ]
        }
    )
    client = CascadeClient(settings, http_client=router.http_client(), tools=registry)

    result = await client.generate([{"role": "user", "content": "Есть ли стол?"}])

    assert result.ok and result.model == PRIMARY
    assert result.parsed is not None and result.parsed.reply == "Стоимость уточнит менеджер."
    assert seen == [{"item": "стол"}]
    assert len(router.calls) == 2
    assert router.calls[0]["tools"] == registry.specs_for_openai()
    second = router.calls[1]["messages"]
    tool_messages = [m for m in second if m["role"] == "tool"]
    assert tool_messages == [{"role": "tool", "tool_call_id": "call_1", "content": "стол: есть в наличии"}]
    assistant = [m for m in second if m["role"] == "assistant" and m.get("tool_calls")]
    assert assistant and assistant[0]["tool_calls"][0]["id"] == "call_1"
    assert second.index(assistant[0]) < second.index(tool_messages[0])


async def test_too_many_tool_rounds_is_tool_error(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = llm_env(monkeypatch)
    registry, _ = registry_with_price()
    looping = chat_response(
        None, model=PRIMARY, tool_calls=[tool_call("c", "get_price", {"item": "x"})], finish_reason="tool_calls"
    )
    router = ScriptedRouter({PRIMARY: [looping] * 6})
    client = CascadeClient(settings, http_client=router.http_client(), tools=registry)

    result = await client.generate([{"role": "user", "content": "x"}], max_tool_rounds=2)

    assert result.ok is False
    assert result.attempts[0].outcome == "tool_error"


async def test_wrong_argument_name_is_bad_args_without_traceback(caplog) -> None:
    import logging

    caplog.set_level(logging.WARNING)
    registry, seen = registry_with_price()
    result = await registry.dispatch([fake_call("c5", "get_price", json.dumps({"itm": "x"}))])
    assert result[0]["content"] == "неверные аргументы"
    assert seen == []
    assert "Traceback" not in caplog.text
    assert "сбой обработчика" not in caplog.text
