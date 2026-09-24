"""Шаг 5: метки ПД снимаются в движке после ответа модели, а не внутри
слоя модели. Клиент видит свой номер, а не [PHONE_1]."""

from tests.engine_fakes import (  # noqa: F401 — фикстура engine_env
    MemorySender,
    ScriptedLlm,
    engine_env,
    incoming,
    load_messages,
    reply,
)

PHONE_TEXT = "+7 701 000 00 00"


async def test_labels_replaced_before_send(engine_env) -> None:
    sender = MemorySender()
    llm = ScriptedLlm([reply("Перезвоним на [PHONE_1]")], mapping={"[PHONE_1]": PHONE_TEXT})
    engine = engine_env.engine(sender=sender, llm=llm)
    outcome = await engine.process_message(incoming(f"Мой номер {PHONE_TEXT}"))

    assert outcome.status == "replied"
    assert len(sender.sent) == 1
    assert PHONE_TEXT in sender.texts[0]
    assert "[PHONE_1]" not in sender.texts[0]
    assert PHONE_TEXT in outcome.reply
    messages = await load_messages(engine_env.sessionmaker, outcome.conversation_id)
    assert PHONE_TEXT in messages[-1].content


async def test_unknown_label_stays_as_is(engine_env) -> None:
    """Метки без значения в таблице не выдумываются: остаются текстом."""
    sender = MemorySender()
    llm = ScriptedLlm([reply("Напишем на [EMAIL_1]")], mapping={})
    engine = engine_env.engine(sender=sender, llm=llm)
    outcome = await engine.process_message(incoming("Есть места?"))
    assert outcome.status == "replied"
    assert "[EMAIL_1]" in sender.texts[0]
