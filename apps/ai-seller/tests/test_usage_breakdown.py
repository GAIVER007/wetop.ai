"""Разбивка расхода и кэш входа (plans/seller-cost-controls-2026-09-26.md, п. 4, решение Р2).

Цена ИИ-продавца считается от расхода гостиницы (ментор 26.09). Одной суммы
токенов для цены мало: вход, его кэшированная часть и выход стоят по-разному.
Теперь у ответа бота пишутся модель, входные, кэшированные и выходные токены
(миграция 0005); сумма tokens_used остаётся как была — на ней дневной предел.

Метка кэша Anthropic на постоянной части промпта (первое системное сообщение)
— по настройке LLM_PROMPT_CACHE_MARK, по умолчанию выключена: понимает ли её
роутер, заранее не известно, а непонятая метка превращает ступень Claude в отказ.
OpenAI, Gemini и DeepSeek кэшируют префикс сами, им метка не нужна.

🔴 До кода красный: разбивки нет ни в ответе каскада, ни в базе.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic import command
from sqlalchemy import create_engine, inspect

from src.ai.engine_types import IncomingMessage
from src.ai.llm import CascadeClient, LlmResult
from src.config import Settings
from src.db.base import MessageRole, utcnow
from src.db.models import Message
from tests.dashboard_fakes import _all, seed_org, sync_db  # noqa: F401 — sync_db идёт фикстурой
from tests.engine_fakes import engine_env, reply  # noqa: F401
from tests.llm_fakes import PRIMARY, ScriptedRouter, chat_response, llm_env, tool_call
from tests.test_step4_tools import registry_with_price

ROOT = Path(__file__).resolve().parent.parent
ORG = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa"
GOOD = '{"reply": "Здравствуйте! Места есть.", "needs_human": false}'
CLAUDE = "anthropic/claude-test"
SYSTEM = "Ты продавец гостиницы. Правила: отвечай коротко."
MESSAGES = [
    {"role": "system", "content": SYSTEM},
    {"role": "system", "content": "Факты: завтрак включён."},
    {"role": "user", "content": "Есть места?"},
]
USAGE_COLUMNS = {"llm_model", "tokens_input", "tokens_cached", "tokens_output"}


def _with_usage(body: dict, *, prompt: int, completion: int, cached: int | None) -> dict:
    usage: dict = {"prompt_tokens": prompt, "completion_tokens": completion, "total_tokens": prompt + completion}
    if cached is not None:
        usage["prompt_tokens_details"] = {"cached_tokens": cached}
    return {**body, "usage": usage}


# ─── Каскад: разбивка из ответа поставщика ───


async def test_the_cascade_returns_model_input_cached_and_output(monkeypatch) -> None:
    settings = llm_env(monkeypatch)
    body = _with_usage(chat_response(GOOD, model=PRIMARY), prompt=1200, completion=80, cached=1024)
    router = ScriptedRouter({PRIMARY: [body]})
    result = await CascadeClient(settings, http_client=router.http_client()).generate(MESSAGES, use_tools=False)
    assert result.ok and result.model == PRIMARY
    assert (result.tokens_input, result.tokens_cached, result.tokens_output) == (1200, 1024, 80)
    assert result.tokens_used == 1280, "сумма — как раньше: на ней дневной предел"


async def test_tool_rounds_add_up(monkeypatch) -> None:
    settings = llm_env(monkeypatch)
    registry, _ = registry_with_price()
    first = _with_usage(
        chat_response(None, model=PRIMARY, tool_calls=[tool_call("c1", "get_price", {"item": "стол"})],
                      finish_reason="tool_calls"),
        prompt=100, completion=10, cached=50,
    )
    second = _with_usage(chat_response(GOOD, model=PRIMARY), prompt=150, completion=20, cached=100)
    router = ScriptedRouter({PRIMARY: [first, second]})
    cascade = CascadeClient(settings, http_client=router.http_client(), tools=registry)
    result = await cascade.generate(MESSAGES)
    assert result.ok
    assert (result.tokens_input, result.tokens_cached, result.tokens_output) == (250, 150, 30)
    assert result.tokens_used == 280


async def test_without_details_the_cached_part_stays_unknown(monkeypatch) -> None:
    settings = llm_env(monkeypatch)
    body = _with_usage(chat_response(GOOD, model=PRIMARY), prompt=300, completion=40, cached=None)
    router = ScriptedRouter({PRIMARY: [body]})
    result = await CascadeClient(settings, http_client=router.http_client()).generate(MESSAGES, use_tools=False)
    assert (result.tokens_input, result.tokens_cached, result.tokens_output) == (300, None, 40)


# ─── Движок: разбивка ложится в ответ бота ───


class _UsageLlm:
    async def generate(self, messages, *, use_tools=True, **kwargs) -> LlmResult:
        parsed = reply("Здравствуйте! Места есть.")
        return LlmResult(ok=True, text=parsed.reply, parsed=parsed, model="openai/gpt-test", mapping={},
                         tokens_used=1280, tokens_input=1200, tokens_cached=1024, tokens_output=80)


async def test_the_engine_writes_the_breakdown_to_the_bot_reply(engine_env, sync_db) -> None:  # noqa: F811
    seed_org(sync_db, ORG, prompt="Ты продавец гостиницы.")
    outcome = await engine_env.engine(llm=_UsageLlm()).process_message(
        IncomingMessage(channel="widget", external_id="guest-u1", text="Есть места?",
                        received_at=utcnow(), organization_id=ORG, agent_id=ORG)
    )
    assert outcome.status == "replied", outcome
    rows = _all(sync_db, sa.select(Message).where(Message.conversation_id == outcome.conversation_id))
    bot = [m for m in rows if m.role == MessageRole.ASSISTANT]
    assert len(bot) == 1
    assert (bot[0].llm_model, bot[0].tokens_input, bot[0].tokens_cached, bot[0].tokens_output) == (
        "openai/gpt-test", 1200, 1024, 80,
    )
    assert bot[0].tokens_used == 1280
    guest = [m for m in rows if m.role == MessageRole.USER]
    assert guest[0].llm_model is None and guest[0].tokens_input is None, "у реплики гостя расхода нет"


# ─── Метка кэша Anthropic ───


async def _sent_messages(monkeypatch, *, model: str, mark: str | None, messages=MESSAGES) -> list[dict]:
    env = {"LLM_MODEL": model}
    if mark is not None:
        env["LLM_PROMPT_CACHE_MARK"] = mark
    settings = llm_env(monkeypatch, **env)
    router = ScriptedRouter({model: [chat_response(GOOD, model=model)]})
    result = await CascadeClient(settings, http_client=router.http_client()).generate(messages, use_tools=False)
    assert result.ok
    return router.calls[0]["messages"]


async def test_the_cache_mark_is_off_by_default(monkeypatch) -> None:
    sent = await _sent_messages(monkeypatch, model=CLAUDE, mark=None)
    assert sent[0]["content"] == SYSTEM
    assert "cache_control" not in str(sent)


async def test_with_the_mark_on_claude_gets_it_on_the_constant_prefix_only(monkeypatch) -> None:
    sent = await _sent_messages(monkeypatch, model=CLAUDE, mark="true")
    assert sent[0]["role"] == "system"
    assert sent[0]["content"] == [{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}}]
    assert sent[1]["content"] == "Факты: завтрак включён.", "знания меняются от вопроса — метка не на них"
    assert sent[2]["content"] == "Есть места?"


async def test_with_the_mark_on_other_vendors_are_untouched(monkeypatch) -> None:
    sent = await _sent_messages(monkeypatch, model=PRIMARY, mark="true")
    assert sent[0]["content"] == SYSTEM


async def test_the_marked_prefix_is_still_masked(monkeypatch) -> None:
    """Метка ставится после маскировки: текст внутри метки — с метками ПД."""
    phone = "+7 701 111 22 33"
    messages = [{"role": "system", "content": f"Звоните администратору {phone}."}, MESSAGES[2]]
    sent = await _sent_messages(monkeypatch, model=CLAUDE, mark="true", messages=messages)
    text = sent[0]["content"][0]["text"]
    assert "701" not in text and "PHONE" in text, text


# ─── Настройка и миграция ───


def test_the_mark_setting_is_off_and_in_the_template() -> None:
    assert Settings.model_fields["llm_prompt_cache_mark"].default is False
    text = (ROOT / "env.example").read_text(encoding="utf-8")
    values = dict(re.findall(r"^([A-Z_0-9]+)=([^\s#]*)", text, re.MULTILINE))
    assert values.get("LLM_PROMPT_CACHE_MARK") == "false"


def _message_columns(url: str) -> set[str]:
    engine = create_engine(url)
    try:
        return {c["name"] for c in inspect(engine).get_columns("messages")}
    finally:
        engine.dispose()


def test_the_migration_adds_and_removes_the_columns(migrated_db: str, alembic_config) -> None:
    assert USAGE_COLUMNS <= _message_columns(migrated_db)
    command.downgrade(alembic_config, "0004")
    assert not (USAGE_COLUMNS & _message_columns(migrated_db)), "down снимает колонки"
    assert "tokens_used" in _message_columns(migrated_db)
    command.upgrade(alembic_config, "heads")  # две головы: 0011 и 0012
    assert USAGE_COLUMNS <= _message_columns(migrated_db)


@pytest.mark.parametrize("column", sorted(USAGE_COLUMNS))
def test_the_reference_schema_lists_the_column(column: str) -> None:
    """shema-bd.sql — справочная схема ядра: колонка есть и там."""
    schema = (ROOT / "shema-bd.sql").read_text(encoding="utf-8")
    block = schema.split("CREATE TABLE messages", 1)[1].split(");", 1)[0]
    assert re.search(rf"^\s+{column}\s", block, re.MULTILINE), column
