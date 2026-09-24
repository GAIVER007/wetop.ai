"""Шаг 7: движок и запись заявки наружу.

🔴 Главное утверждение файла: внешняя система не управляет диалогом.
Её сбой стоит одной строки в reasons и алерта оператору, но клиент
получает ответ всегда, и заявка не теряется — попытка повторяется.

Алерт здесь проверяется перехватом write_alert (фикстура alert_spy), а не
чтением outbox: причина — в docstring AlertSpy. Строку в outbox проверяют
тесты LeadWriter.
"""

from __future__ import annotations

import pytest

from src.ai.schemas import LeadFields
from src.integrations.lead_writer import natural_key
from tests.engine_fakes import (  # noqa: F401 — фикстура engine_env
    MemorySender,
    ScriptedLlm,
    engine_env,
    incoming,
    load_conversation,
    reply,
)
from tests.integration_fakes import (  # noqa: F401 — фикстура alert_spy
    NAME,
    PHONE,
    PHONE_TYPED,
    FakeProviders,
    alert_spy,
)

FIRST = f"Меня зовут {NAME}, мой номер {PHONE_TYPED}"


def _writer(engine_env, providers: FakeProviders, facade=None):
    from src.integrations.lead_writer import LeadWriter

    resolved = facade if facade is not None else providers.as_providers()
    return LeadWriter(
        sessionmaker=engine_env.sessionmaker,
        redis=engine_env.redis,
        providers_getter=lambda: resolved,
        settings=engine_env.settings,
    )


async def test_lead_written_once_and_client_gets_a_normal_reply(engine_env, alert_spy) -> None:
    providers = FakeProviders()
    sender = MemorySender()
    llm = ScriptedLlm([reply("Записал, спасибо.", lead=LeadFields(name=NAME))])
    engine = engine_env.engine(sender=sender, llm=llm, lead_hook=_writer(engine_env, providers))

    outcome = await engine.process_message(incoming(FIRST))

    assert outcome.status == "replied"
    assert "lead_hook_failed" not in outcome.reasons
    assert sender.texts and "Записал" in sender.texts[0]
    assert providers.count("create_lead") == 1
    assert alert_spy.keys_like("hotlead:")

    conversation = await load_conversation(engine_env.sessionmaker, outcome.conversation_id)
    assert conversation.lead_data.get("lead_created_at")

    # Второй ход того же диалога наружу уже не ходит и второго алерта не даёт.
    second = await engine.process_message(incoming("А парковка есть?"))
    assert second.status == "replied"
    assert providers.count("create_lead") == 1
    assert len(alert_spy.calls) == 1


async def test_provider_failure_does_not_break_the_dialog(engine_env, alert_spy) -> None:
    """🔴 Внешняя система легла — клиент этого не замечает."""
    providers = FakeProviders(raise_on={"create_lead"})
    sender = MemorySender()
    llm = ScriptedLlm([reply("Записал, спасибо.", lead=LeadFields(name=NAME))])
    engine = engine_env.engine(sender=sender, llm=llm, lead_hook=_writer(engine_env, providers))

    outcome = await engine.process_message(incoming(FIRST))

    assert outcome.status == "replied"
    assert "lead_hook_failed" in outcome.reasons
    assert "Записал" in sender.texts[0]
    for word in ("ошибк", "exception", "traceback", "недоступ"):
        assert word not in sender.texts[0].lower()

    conversation = await load_conversation(engine_env.sessionmaker, outcome.conversation_id)
    assert not conversation.lead_data.get("lead_created_at"), "ход пометил заявку созданной, а её нет"

    assert alert_spy.keys_like("leadfail:"), "оператор не узнал о потерянной заявке"
    for body in alert_spy.bodies:
        assert NAME not in body and PHONE not in body.replace(" ", "")


async def test_retry_on_next_turn_after_provider_recovers(engine_env, alert_spy) -> None:
    """Попытка повторяется сама: клиенту не надо снова диктовать номер."""
    providers = FakeProviders(raise_on={"create_lead"})
    llm = ScriptedLlm([reply("Записал.", lead=LeadFields(name=NAME))])
    engine = engine_env.engine(llm=llm, lead_hook=_writer(engine_env, providers))

    first = await engine.process_message(incoming(FIRST))
    assert "lead_hook_failed" in first.reasons

    providers.fix()
    second = await engine.process_message(incoming("Жду ответа"))

    assert second.status == "replied"
    assert "lead_hook_failed" not in second.reasons
    assert providers.count("create_lead") == 2  # неудачная и удачная
    key, payload = providers.args_of("create_lead")[1]
    assert key == natural_key(first.conversation_id, {"phone": PHONE})
    assert payload["phone"] == PHONE
    assert alert_spy.keys == [f"leadfail:{key}", f"hotlead:{key}"]

    conversation = await load_conversation(engine_env.sessionmaker, first.conversation_id)
    assert conversation.lead_data.get("lead_created_at")


async def test_no_lead_sink_keeps_the_dialog_alive(engine_env, alert_spy) -> None:
    """Приёмника заявок нет вовсе: диалог идёт, лид ждёт следующей попытки."""
    providers = FakeProviders()
    sender = MemorySender()
    engine = engine_env.engine(
        sender=sender,
        llm=ScriptedLlm([reply("Хорошо.", lead=LeadFields(name=NAME))]),
        lead_hook=_writer(engine_env, providers, facade=providers.without_leads()),
    )
    outcome = await engine.process_message(incoming(FIRST))

    assert outcome.status == "replied"
    assert "lead_hook_failed" in outcome.reasons
    assert sender.texts
    assert alert_spy.calls, "о ненастроенном приёмнике заявок никто не узнал"
    assert "lead_no_provider" in " ".join(alert_spy.keys + alert_spy.bodies)
    conversation = await load_conversation(engine_env.sessionmaker, outcome.conversation_id)
    assert not conversation.lead_data.get("lead_created_at")


async def test_incomplete_lead_never_reaches_the_external_system(engine_env, alert_spy) -> None:
    """Без телефона заявки нет: звонить будет некуда."""
    providers = FakeProviders()
    engine = engine_env.engine(
        llm=ScriptedLlm([reply("Приятно познакомиться.", lead=LeadFields(name=NAME))]),
        lead_hook=_writer(engine_env, providers),
    )
    outcome = await engine.process_message(incoming(f"Меня зовут {NAME}"))
    assert outcome.status == "replied"
    assert providers.calls == []
    assert alert_spy.calls == []


@pytest.mark.parametrize("word", ["ошибк", "exception", "traceback", "unavailable"])
async def test_reply_text_is_clean_of_technical_words(engine_env, alert_spy, word: str) -> None:
    providers = FakeProviders(raise_on={"create_lead"})
    sender = MemorySender()
    engine = engine_env.engine(
        sender=sender,
        llm=ScriptedLlm([reply("Записал, спасибо.", lead=LeadFields(name=NAME))]),
        lead_hook=_writer(engine_env, providers),
    )
    await engine.process_message(incoming(FIRST))
    assert word not in " ".join(sender.texts).lower()
