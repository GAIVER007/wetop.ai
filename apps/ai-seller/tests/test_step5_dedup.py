"""Шаг 5: двойная доставка от канала обрабатывается один раз."""

from tests.engine_fakes import (  # noqa: F401 — фикстура engine_env
    MemorySender,
    ScriptedLlm,
    engine_env,
    incoming,
    load_messages,
    reply,
    roles,
)


async def test_same_message_twice_is_duplicate(engine_env) -> None:
    sender = MemorySender()
    llm = ScriptedLlm([reply("Есть.")])
    engine = engine_env.engine(sender=sender, llm=llm)

    first = await engine.process_message(incoming("Есть свободные места?"))
    second = await engine.process_message(incoming("Есть свободные места?"))

    assert first.status == "replied"
    assert second.status == "duplicate"
    assert second.reply is None
    assert llm.calls == 1
    assert len(sender.sent) == 1
    messages = await load_messages(engine_env.sessionmaker, first.conversation_id)
    assert roles(messages) == ["user", "assistant"]


async def test_different_text_is_not_duplicate(engine_env) -> None:
    sender = MemorySender()
    engine = engine_env.engine(sender=sender, llm=ScriptedLlm([reply("Есть.")]))
    await engine.process_message(incoming("Есть места?"))
    outcome = await engine.process_message(incoming("А на неделю?"))
    assert outcome.status == "replied"
    assert len(sender.sent) == 2


async def test_same_text_from_other_client_is_not_duplicate(engine_env) -> None:
    """Дедуп по отправителю: два клиента с одинаковым вопросом — два ответа."""
    sender = MemorySender()
    engine = engine_env.engine(sender=sender, llm=ScriptedLlm([reply("Есть.")]))
    await engine.process_message(incoming("Есть места?", external_id="1001"))
    outcome = await engine.process_message(incoming("Есть места?", external_id="1002"))
    assert outcome.status == "replied"
    assert len(sender.sent) == 2
