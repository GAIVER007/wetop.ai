"""Шаг 5: заявка не создаётся без имени и телефона; бот спрашивает сам,
но не зацикливается; телефон в лид попадает только из извлечения, не из
догадки модели."""

from src.ai.lead import (
    ASK_TEXTS,
    REFUSAL_ACK,
    contact_refused,
    is_complete,
    merge_contacts,
    merge_model_lead,
    needs_ask,
    reply_already_asks,
)
from src.ai.schemas import LeadFields
from src.db.base import FunnelStage
from src.security.pii import Contacts
from tests.engine_fakes import (  # noqa: F401 — фикстура engine_env
    MemorySender,
    RecordingHook,
    ScriptedLlm,
    engine_env,
    incoming,
    load_conversation,
    reply,
)

PHONE = "77010000000"  # +7 701 000 00 00, вымышленный


def _asks_in(texts: list[str]) -> list[str]:
    return [t for t in texts if any(ask in t for ask in ASK_TEXTS.values())]


# ─── Чистые функции ───


def test_merge_contacts_first_phone_and_no_overwrite() -> None:
    lead = merge_contacts({}, Contacts(("77010000000", "77020000000"), ("a@example.com",), ("@user_one",)))
    assert lead["phone"] == "77010000000"
    assert lead["email"] == "a@example.com"
    assert lead["handle"] == "@user_one"
    again = merge_contacts(lead, Contacts(("77030000000",), (), ()))
    assert again["phone"] == "77010000000"


def test_merge_model_lead_ignores_phone_and_email_from_model() -> None:
    model_lead = LeadFields(name="Асель", phone="+7 999 000 00 00", email="x@example.com", interest="студия")
    lead = merge_model_lead({}, model_lead, None)
    assert lead["name"] == "Асель"
    assert lead.get("phone") is None
    assert lead.get("email") is None
    assert lead["interest"] == "студия"


def test_merge_model_lead_name_from_channel_when_model_silent() -> None:
    lead = merge_model_lead({}, None, "Асель")
    assert lead["name"] == "Асель"
    assert merge_model_lead({"name": "Дана"}, LeadFields(name="Асель"), None)["name"] == "Дана"


def test_is_complete_requires_name_and_phone() -> None:
    assert not is_complete({})
    assert not is_complete({"name": "Асель"})
    assert not is_complete({"phone": PHONE})
    assert is_complete({"name": "Асель", "phone": PHONE})


def test_contact_refused_phrases() -> None:
    # Глагол передачи рядом с «номер/телефон» — отказ и без просьбы бота.
    for text in ("не дам номер", "Не хочу оставлять телефон", "не буду писать номер"):
        assert contact_refused(text), text
        assert contact_refused(text, asked=True), text
    # Короткие формы — отказ только в ответ на просьбу: иначе это про комнату или планы.
    for text in ("без телефона", "позже напишу"):
        assert contact_refused(text, asked=True), text
        assert not contact_refused(text), text
    assert not contact_refused("без телефона в номере")
    assert not contact_refused("позже напишу, какой номер выбрал")
    assert not contact_refused("мой номер +7 701 000 00 00")
    assert not contact_refused("сколько стоит студия?")


def test_needs_ask_rules() -> None:
    assert needs_ask({}, turn_index=0) is None  # первый ход — не просим
    assert needs_ask({}, turn_index=1) == "both"
    assert needs_ask({"name": "Асель"}, turn_index=1) == "phone"
    assert needs_ask({"phone": PHONE}, turn_index=1) == "name"
    assert needs_ask({"name": "Асель", "phone": PHONE}, turn_index=1) is None
    assert needs_ask({"contact_refused": True}, turn_index=1) is None
    assert needs_ask({"asks": 2}, turn_index=1) is None
    assert needs_ask({"asks": 2}, turn_index=1, max_asks=3) == "both"


def test_reply_already_asks() -> None:
    assert reply_already_asks("Как вас зовут?", "name")
    assert reply_already_asks("Подскажите номер телефона?", "phone")
    assert not reply_already_asks("Студия стоит 20 000 тенге в сутки.", "both")


# ─── Прогон через движок ───


async def test_no_name_no_phone_hook_never_called_and_bot_asks(engine_env) -> None:
    """Четыре хода без имени и номера: заявки нет, просьба есть, но не больше двух."""
    hook = RecordingHook()
    sender = MemorySender()
    llm = ScriptedLlm([reply("Студия свободна."), reply("Заезд с 14:00."), reply("Есть парковка."), reply("Да.")])
    engine = engine_env.engine(sender=sender, llm=llm, lead_hook=hook)
    for text in ("Есть студия?", "Во сколько заезд?", "Парковка есть?", "Можно с котом?"):
        outcome = await engine.process_message(incoming(text))
        assert outcome.status == "replied"

    assert hook.calls == []
    asks = _asks_in(sender.texts)
    assert 1 <= len(asks) <= 2
    assert any("обращаться" in t or "имя" in t or "зовут" in t for t in asks)
    assert any("номер" in t or "телефон" in t for t in asks)
    # Первый ход — без просьбы.
    assert sender.texts[0] == "Студия свободна."


async def test_refusal_acknowledged_once_and_no_more_asks(engine_env) -> None:
    sender = MemorySender()
    engine = engine_env.engine(sender=sender, llm=ScriptedLlm([reply("Хорошо.")]))
    await engine.process_message(incoming("Есть студия?"))
    refused = await engine.process_message(incoming("не дам номер"))
    assert REFUSAL_ACK in refused.reply
    assert refused.reply.count(REFUSAL_ACK) == 1

    for text in ("А заезд когда?", "Парковка есть?", "Есть лифт?"):
        outcome = await engine.process_message(incoming(text))
        assert not _asks_in([outcome.reply]), outcome.reply
        assert REFUSAL_ACK not in outcome.reply
    conversation = await load_conversation(engine_env.sessionmaker, refused.conversation_id)
    assert conversation.lead_data.get("contact_refused") is True


async def test_hook_called_once_with_extracted_phone(engine_env) -> None:
    hook = RecordingHook()
    llm = ScriptedLlm([reply("Записал, спасибо.", lead=LeadFields(name="Асель"))])
    engine = engine_env.engine(llm=llm, lead_hook=hook)

    first = await engine.process_message(incoming("Меня зовут Асель, мой номер +7 701 000 00 00"))
    assert first.status == "replied"
    assert len(hook.calls) == 1
    conversation_id, lead = hook.calls[0]
    assert conversation_id == first.conversation_id
    assert lead["name"] == "Асель"
    assert lead["phone"] == PHONE

    second = await engine.process_message(incoming("Повторю номер: +7 701 000 00 00"))
    assert second.status == "replied"
    assert len(hook.calls) == 1

    conversation = await load_conversation(engine_env.sessionmaker, first.conversation_id)
    assert conversation.lead_data["phone"] == PHONE
    assert conversation.lead_data.get("lead_created_at")
    assert conversation.funnel_stage != FunnelStage.NEW


async def test_model_phone_guess_is_ignored(engine_env) -> None:
    """Телефон из догадки модели в лид не попадает: заявки нет."""
    hook = RecordingHook()
    llm = ScriptedLlm([reply("Приятно познакомиться.", lead=LeadFields(name="Асель", phone="+7 999 000 00 00"))])
    engine = engine_env.engine(llm=llm, lead_hook=hook)
    outcome = await engine.process_message(incoming("Меня зовут Асель"))
    assert outcome.status == "replied"
    assert hook.calls == []
    conversation = await load_conversation(engine_env.sessionmaker, outcome.conversation_id)
    assert conversation.lead_data.get("phone") is None
    assert conversation.lead_data.get("name") == "Асель"


async def test_name_from_channel_completes_lead(engine_env) -> None:
    hook = RecordingHook()
    engine = engine_env.engine(llm=ScriptedLlm([reply("Спасибо.")]), lead_hook=hook)
    outcome = await engine.process_message(incoming("Мой номер +7 701 000 00 00", client_name="Дана"))
    assert outcome.status == "replied"
    assert len(hook.calls) == 1
    assert hook.calls[0][1]["name"] == "Дана"
    assert hook.calls[0][1]["phone"] == PHONE
