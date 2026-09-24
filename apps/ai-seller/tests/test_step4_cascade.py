"""Шаг 4: каскад моделей. Падение ступени переключает на следующую и видно
в журнале; отказ определяется по телу, а не по коду; исключение наружу
не выходит ни при каком отказе."""

import logging

import httpx
import pytest

from src.ai.llm import CascadeClient
from tests.llm_fakes import EMERGENCY, FALLBACK, PRIMARY, ScriptedRouter, chat_response, llm_env

MESSAGES = [{"role": "user", "content": "Здравствуйте, сколько стоит?"}]
GOOD = '{"reply": "Здравствуйте! Подскажу по ценам.", "needs_human": false}'


def make_client(monkeypatch: pytest.MonkeyPatch, script: dict) -> tuple[CascadeClient, ScriptedRouter]:
    settings = llm_env(monkeypatch)
    router = ScriptedRouter(script)
    return CascadeClient(settings, http_client=router.http_client()), router


async def test_primary_500_switches_to_fallback(monkeypatch, caplog) -> None:
    caplog.set_level(logging.WARNING)
    client, router = make_client(
        monkeypatch, {PRIMARY: [500], FALLBACK: [chat_response(GOOD, model=FALLBACK)]}
    )
    result = await client.generate(MESSAGES)
    assert result.ok
    assert result.model == FALLBACK
    assert result.parsed is not None and result.parsed.reply.startswith("Здравствуйте")
    assert result.attempts[0].model == PRIMARY
    assert result.attempts[0].outcome == "http_error"
    assert result.attempts[1].outcome == "ok"
    assert result.tokens_used == 42
    assert "переключение" in caplog.text
    assert [c["model"] for c in router.calls] == [PRIMARY, FALLBACK]


async def test_primary_500_and_fallback_timeout_reach_emergency(monkeypatch) -> None:
    client, router = make_client(
        monkeypatch,
        {
            PRIMARY: [500],
            FALLBACK: [httpx.ReadTimeout("медленно")],
            EMERGENCY: [chat_response(GOOD, model=EMERGENCY)],
        },
    )
    result = await client.generate(MESSAGES)
    assert result.ok
    assert result.model == EMERGENCY
    assert [a.outcome for a in result.attempts] == ["http_error", "timeout", "ok"]


async def test_all_models_fail_no_exception(monkeypatch, caplog) -> None:
    caplog.set_level(logging.ERROR)
    client, router = make_client(monkeypatch, {PRIMARY: [500], FALLBACK: [500], EMERGENCY: [500]})
    result = await client.generate(MESSAGES)
    assert result.ok is False
    assert result.error == "all_models_failed"
    assert result.text == ""
    assert result.parsed is None
    assert len(result.attempts) == 3
    assert "все ступени" in caplog.text


async def test_timeout_does_not_break_the_turn(monkeypatch) -> None:
    client, _ = make_client(
        monkeypatch,
        {PRIMARY: [httpx.ReadTimeout("t")], FALLBACK: [chat_response(GOOD, model=FALLBACK)]},
    )
    result = await client.generate(MESSAGES)
    assert result.ok
    assert result.attempts[0].outcome == "timeout"


async def test_connection_error_is_an_outcome_not_exception(monkeypatch) -> None:
    client, _ = make_client(
        monkeypatch,
        {PRIMARY: [httpx.ConnectError("нет связи")], FALLBACK: [chat_response(GOOD, model=FALLBACK)]},
    )
    result = await client.generate(MESSAGES)
    assert result.ok
    assert result.attempts[0].outcome == "connection"


async def test_refusal_in_200_body_moves_to_next_model(monkeypatch) -> None:
    client, _ = make_client(
        monkeypatch,
        {
            PRIMARY: [chat_response(None, model=PRIMARY, refusal="Не могу помочь")],
            FALLBACK: [chat_response(GOOD, model=FALLBACK)],
        },
    )
    result = await client.generate(MESSAGES)
    assert result.ok and result.model == FALLBACK
    assert result.attempts[0].outcome == "refusal"


async def test_content_filter_finish_reason_is_refusal(monkeypatch) -> None:
    client, _ = make_client(
        monkeypatch,
        {
            PRIMARY: [chat_response("", model=PRIMARY, finish_reason="content_filter")],
            FALLBACK: [chat_response(GOOD, model=FALLBACK)],
        },
    )
    result = await client.generate(MESSAGES)
    assert result.ok and result.model == FALLBACK
    assert result.attempts[0].outcome == "refusal"


async def test_empty_content_in_200_moves_to_next_model(monkeypatch) -> None:
    client, _ = make_client(
        monkeypatch,
        {PRIMARY: [chat_response(None, model=PRIMARY)], FALLBACK: [chat_response(GOOD, model=FALLBACK)]},
    )
    result = await client.generate(MESSAGES)
    assert result.ok and result.model == FALLBACK
    assert result.attempts[0].outcome == "empty"


async def test_error_body_with_200_is_a_failure(monkeypatch) -> None:
    # Роутер отдаёт ошибку в теле с кодом 200: сервер жив, ответа нет.
    client, _ = make_client(
        monkeypatch,
        {
            PRIMARY: [chat_response('{"error": {"message": "quota"}}', model=PRIMARY)],
            FALLBACK: [chat_response(GOOD, model=FALLBACK)],
        },
    )
    result = await client.generate(MESSAGES)
    assert result.ok and result.model == FALLBACK
    assert result.attempts[0].outcome == "invalid"


async def test_no_choices_in_200_is_invalid(monkeypatch) -> None:
    client, _ = make_client(
        monkeypatch,
        {
            PRIMARY: [{"id": "x", "object": "chat.completion", "created": 1, "model": PRIMARY, "choices": []}],
            FALLBACK: [chat_response(GOOD, model=FALLBACK)],
        },
    )
    result = await client.generate(MESSAGES)
    assert result.ok and result.model == FALLBACK
    assert result.attempts[0].outcome == "invalid"


async def test_not_configured_without_key_or_url(monkeypatch) -> None:
    settings = llm_env(monkeypatch, LLM_API_KEY="", LLM_BASE_URL="")
    router = ScriptedRouter({PRIMARY: [chat_response(GOOD, model=PRIMARY)]})
    client = CascadeClient(settings, http_client=router.http_client())
    result = await client.generate(MESSAGES)
    assert result.ok is False
    assert result.error == "llm_not_configured"
    assert router.calls == []


async def test_no_models_is_not_configured(monkeypatch) -> None:
    settings = llm_env(monkeypatch, LLM_MODEL="", LLM_MODEL_FALLBACK="", LLM_MODEL_EMERGENCY="")
    router = ScriptedRouter()
    client = CascadeClient(settings, http_client=router.http_client())
    result = await client.generate(MESSAGES)
    assert result.ok is False and result.error == "llm_not_configured"
    assert router.calls == []


async def test_request_carries_settings(monkeypatch) -> None:
    client, router = make_client(monkeypatch, {PRIMARY: [chat_response(GOOD, model=PRIMARY)]})
    result = await client.generate(MESSAGES, use_tools=False)
    assert result.ok
    body = router.calls[0]
    assert body["model"] == PRIMARY
    assert body["temperature"] == pytest.approx(0.2)
    assert body["max_tokens"] == 1024
    assert "tools" not in body


async def test_exception_after_create_switches_to_fallback(monkeypatch, caplog) -> None:
    """Сбой разбора одной ступени — исход invalid и следующая модель,
    а не обрыв всего каскада."""
    import src.ai.llm as llm_module

    def boom(message):
        raise RuntimeError("сломался разбор")

    monkeypatch.setattr(llm_module, "_assistant_message", boom)
    from src.ai.tools import ToolRegistry, ToolSpec
    from tests.llm_fakes import tool_call

    async def noop(**kwargs) -> str:
        return "ok"

    registry = ToolRegistry()
    registry.register(ToolSpec(name="noop", description="", parameters={"type": "object"}, handler=noop))
    settings = llm_env(monkeypatch)
    router = ScriptedRouter(
        {
            PRIMARY: [
                chat_response(
                    None, model=PRIMARY, tool_calls=[tool_call("c", "noop", {})], finish_reason="tool_calls"
                )
            ],
            FALLBACK: [chat_response(GOOD, model=FALLBACK)],
        }
    )
    client = CascadeClient(settings, http_client=router.http_client(), tools=registry)
    result = await client.generate(MESSAGES)
    assert result.ok and result.model == FALLBACK
    assert result.attempts[0].outcome == "invalid"
    assert "все ступени" not in caplog.text


async def test_length_truncated_json_switches_to_fallback(monkeypatch) -> None:
    # Обрезанный по max_tokens JSON — не ответ, а огрызок: следующая ступень.
    client, _ = make_client(
        monkeypatch,
        {
            PRIMARY: [chat_response('{"reply": "Здравствуйте, стол стоит', model=PRIMARY, finish_reason="length")],
            FALLBACK: [chat_response(GOOD, model=FALLBACK)],
        },
    )
    result = await client.generate(MESSAGES)
    assert result.ok and result.model == FALLBACK
    assert result.attempts[0].outcome == "invalid"


async def test_length_with_closed_json_is_ok(monkeypatch) -> None:
    client, _ = make_client(monkeypatch, {PRIMARY: [chat_response(GOOD, model=PRIMARY, finish_reason="length")]})
    result = await client.generate(MESSAGES)
    assert result.ok and result.model == PRIMARY


async def test_router_url_not_logged_on_info(monkeypatch, caplog) -> None:
    # httpx пишет полный URL запроса на INFO; в нём бывает токен.
    caplog.set_level(logging.INFO)
    client, _ = make_client(monkeypatch, {PRIMARY: [chat_response(GOOD, model=PRIMARY)]})
    result = await client.generate(MESSAGES)
    assert result.ok
    assert "router.test" not in caplog.text
