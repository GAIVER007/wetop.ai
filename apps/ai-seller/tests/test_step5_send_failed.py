"""Шаг 5: отказ отправки не пишет ответ в историю. Иначе бот считает,
что ответил, и молчит навсегда."""

from src.db.base import MessageRole
from tests.engine_fakes import (  # noqa: F401 — фикстура engine_env
    MemorySender,
    ScriptedLlm,
    engine_env,
    incoming,
    load_conversation,
    load_messages,
    reply,
    roles,
)


async def test_send_failure_keeps_client_message_only(engine_env) -> None:
    sender = MemorySender(fail=True)
    engine = engine_env.engine(sender=sender, llm=ScriptedLlm([reply("Свободные есть.")]))
    outcome = await engine.process_message(incoming("Есть места на выходные?"))

    assert outcome.status == "send_failed"
    assert outcome.conversation_id is not None
    assert sender.sent == []
    messages = await load_messages(engine_env.sessionmaker, outcome.conversation_id)
    assert roles(messages) == ["user"]
    assert messages[0].content == "Есть места на выходные?"
    assert messages[0].sent_by_us is False


async def test_lead_data_saved_even_if_send_failed(engine_env) -> None:
    """Контакт клиента — про клиента, а не про доставку: сохраняется всегда."""
    engine = engine_env.engine(sender=MemorySender(fail=True), llm=ScriptedLlm([reply("Записал.")]))
    outcome = await engine.process_message(incoming("Мой номер +7 701 000 00 00"))
    assert outcome.status == "send_failed"
    conversation = await load_conversation(engine_env.sessionmaker, outcome.conversation_id)
    assert conversation.lead_data.get("phone") == "77010000000"


async def test_retry_with_working_sender_replies(engine_env) -> None:
    """После починки канала следующий вызов отвечает и пишет ответ в историю."""
    broken = engine_env.engine(sender=MemorySender(fail=True), llm=ScriptedLlm([reply("Ответ.")]))
    first = await broken.process_message(incoming("Есть места?"))
    assert first.status == "send_failed"

    sender = MemorySender()
    working = engine_env.engine(sender=sender, llm=ScriptedLlm([reply("Есть, приезжайте.")]))
    second = await working.process_message(incoming("Есть места? Повторяю вопрос."))
    assert second.status == "replied"
    assert second.conversation_id == first.conversation_id
    # Второй ход — движок вправе дописать просьбу о контакте.
    assert sender.texts[0].startswith("Есть, приезжайте.")

    messages = await load_messages(engine_env.sessionmaker, second.conversation_id)
    assert roles(messages) == ["user", "user", "assistant"]
    bot = messages[-1]
    assert bot.role is MessageRole.ASSISTANT
    assert bot.sent_by_us is True
    assert bot.tokens_used == 10
