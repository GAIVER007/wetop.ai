"""Шаг 5: needs_human от модели — пометка, а не переключение. Бот продолжает
отвечать; режим оператора (owner_takeover) движок не трогает никогда."""

from src.db.base import ConversationMode
from tests.engine_fakes import (  # noqa: F401 — фикстура engine_env
    MemorySender,
    ScriptedLlm,
    engine_env,
    incoming,
    load_conversation,
    reply,
    seed_conversation,
)


async def test_needs_human_marks_conversation_and_bot_keeps_replying(engine_env) -> None:
    sender = MemorySender()
    llm = ScriptedLlm([
        reply("Передам администратору.", needs_human=True, human_reason="жалоба"),
        reply("Заезд с 14:00."),
    ])
    engine = engine_env.engine(sender=sender, llm=llm)

    first = await engine.process_message(incoming("У вас в номере была грязь, хочу вернуть деньги"))
    assert first.status == "replied"
    assert first.needs_human is True
    assert sender.texts == ["Передам администратору."]
    conversation = await load_conversation(engine_env.sessionmaker, first.conversation_id)
    assert conversation.mode is ConversationMode.NEEDS_HUMAN

    second = await engine.process_message(incoming("А во сколько заезд?"))
    assert second.status == "replied"
    assert len(sender.sent) == 2
    assert llm.calls == 2


async def test_owner_takeover_is_never_overridden(engine_env) -> None:
    conversation_id = await seed_conversation(
        engine_env.sessionmaker, mode=ConversationMode.OWNER_TAKEOVER
    )
    engine = engine_env.engine(llm=ScriptedLlm([reply("Ок.", needs_human=True)]))
    outcome = await engine.process_message(incoming("Хочу вернуть деньги"))
    assert outcome.status != "error"
    conversation = await load_conversation(engine_env.sessionmaker, conversation_id)
    assert conversation.mode is ConversationMode.OWNER_TAKEOVER


async def test_without_signal_mode_stays_bot_active(engine_env) -> None:
    engine = engine_env.engine(llm=ScriptedLlm([reply("Есть.")]))
    outcome = await engine.process_message(incoming("Есть места?"))
    assert outcome.needs_human is False
    conversation = await load_conversation(engine_env.sessionmaker, outcome.conversation_id)
    assert conversation.mode is ConversationMode.BOT_ACTIVE
