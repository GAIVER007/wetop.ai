"""Шаг 5: сбой — клиенту нейтральная фраза, в журнал ошибка, исключение
наружу не выходит никогда."""

import logging

import pytest

from src.ai.engine import NEUTRAL_REPLY
from src.knowledge.prompt import PromptMissing
from tests.engine_fakes import (  # noqa: F401 — фикстура engine_env
    MemorySender,
    RaisingSender,
    ScriptedLlm,
    engine_env,
    incoming,
    load_messages,
    reply,
    roles,
)


async def test_llm_failure_sends_neutral_reply(engine_env, caplog) -> None:
    caplog.set_level(logging.ERROR)
    sender = MemorySender()
    engine = engine_env.engine(sender=sender, llm=ScriptedLlm([RuntimeError("секретная причина")]))
    outcome = await engine.process_message(incoming("Есть места?"))

    # Сбой модели — ветка error: регрессия в 'replied' не должна пройти зелёной.
    assert outcome.status == "error"
    assert outcome.reply == NEUTRAL_REPLY
    assert "llm_failed" in outcome.reasons
    assert outcome.needs_human is False
    assert sender.texts == [NEUTRAL_REPLY]
    assert "секретная причина" not in sender.texts[0]
    assert caplog.records, "сбой модели должен попасть в журнал"
    messages = await load_messages(engine_env.sessionmaker, outcome.conversation_id)
    assert roles(messages) == ["user", "assistant"]


async def test_prompt_missing_is_error_with_neutral_reply(engine_env, caplog) -> None:
    caplog.set_level(logging.ERROR)

    def broken_loader() -> str:
        raise PromptMissing("файл системного промпта не найден")

    sender = MemorySender()
    llm = ScriptedLlm([reply("Не должно дойти.")])
    engine = engine_env.engine(sender=sender, llm=llm, prompt_loader=broken_loader)
    outcome = await engine.process_message(incoming("Есть места?"))

    assert outcome.status == "error"
    assert outcome.reply == NEUTRAL_REPLY
    assert "prompt_missing" in outcome.reasons
    assert llm.calls == 0
    assert sender.texts == [NEUTRAL_REPLY]
    assert any(r.levelno >= logging.ERROR for r in caplog.records)


async def test_retriever_failure_still_replies(engine_env, monkeypatch: pytest.MonkeyPatch) -> None:
    async def broken_search(*args, **kwargs):
        raise RuntimeError("база знаний недоступна")

    import src.ai.engine as engine_module
    import src.knowledge.retriever as retriever_module

    monkeypatch.setattr(retriever_module, "search", broken_search)
    monkeypatch.setattr(engine_module, "search", broken_search, raising=False)

    sender = MemorySender()
    llm = ScriptedLlm([reply("Есть студия.")])
    engine = engine_env.engine(sender=sender, llm=llm)
    outcome = await engine.process_message(incoming("Есть места?"))
    assert outcome.status == "replied"
    assert llm.calls == 1
    assert sender.texts == ["Есть студия."]


async def test_sender_exception_never_escapes(engine_env, caplog) -> None:
    caplog.set_level(logging.ERROR)
    engine = engine_env.engine(sender=RaisingSender(), llm=ScriptedLlm([reply("Есть.")]))
    outcome = await engine.process_message(incoming("Есть места?"))
    # Движок вправе поймать исключение отправителя и раньше внешнего try:
    # главное — исключения нет, ответ бота в историю не записан.
    assert outcome.status in ("error", "send_failed")
    assert any(r.levelno >= logging.ERROR for r in caplog.records)
    if outcome.conversation_id is not None:
        messages = await load_messages(engine_env.sessionmaker, outcome.conversation_id)
        assert "assistant" not in roles(messages)
    # Замок отпущен и после исключения.
    if outcome.conversation_id is not None:
        assert await engine_env.redis.exists(f"lock:conv:{outcome.conversation_id}") == 0


async def test_llm_raising_exception_is_error_not_crash(engine_env) -> None:
    """Даже если слой модели нарушит свой контракт и бросит исключение."""

    class ExplodingLlm:
        calls = 0

        async def generate(self, messages, **kwargs):
            raise RuntimeError("взрыв")

    sender = MemorySender()
    engine = engine_env.engine(sender=sender, llm=ExplodingLlm())
    outcome = await engine.process_message(incoming("Есть места?"))
    assert outcome.status == "error"
    assert all("взрыв" not in t for t in sender.texts)
