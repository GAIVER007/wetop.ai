"""Шаг 4: ответ модели разбирается во всех трёх формах — чистый объект,
объект в markdown-обёртке или внутри текста, строка вместо объекта."""

import pytest

from src.ai.schemas import MODEL_REPLY_JSON_SCHEMA, LeadFields, ModelReply, parse_model_json, parse_model_reply

CLEAN = '{"reply": "Здравствуйте! Чем помочь?", "needs_human": false, "funnel_stage": "new"}'
FENCED = "```json\n" + CLEAN + "\n```"
INSIDE_TEXT = "Вот ответ:\n" + CLEAN + "\nНадеюсь, помог."


def test_clean_json() -> None:
    reply = parse_model_reply(CLEAN)
    assert reply.reply == "Здравствуйте! Чем помочь?"
    assert reply.needs_human is False
    assert reply.funnel_stage == "new"


def test_json_in_markdown_fence() -> None:
    reply = parse_model_reply(FENCED)
    assert reply.reply == "Здравствуйте! Чем помочь?"
    assert reply.funnel_stage == "new"


def test_json_inside_text() -> None:
    reply = parse_model_reply(INSIDE_TEXT)
    assert reply.reply == "Здравствуйте! Чем помочь?"


def test_plain_string_is_a_valid_reply() -> None:
    reply = parse_model_reply("  Здравствуйте! Чем помочь?  ")
    assert reply.reply == "Здравствуйте! Чем помочь?"
    assert reply.needs_human is False
    assert reply.lead is None


def test_plain_string_in_fence_is_unwrapped() -> None:
    reply = parse_model_reply("```\nПросто текст\n```")
    assert reply.reply == "Просто текст"


def test_empty_text() -> None:
    assert parse_model_reply("").reply == ""
    assert parse_model_reply("   ").reply == ""


def test_foreign_funnel_stage_becomes_none() -> None:
    reply = parse_model_reply('{"reply": "ок", "funnel_stage": "hot_lead"}')
    assert reply.reply == "ок"
    assert reply.funnel_stage is None


@pytest.mark.parametrize("stage", ["new", "qualifying", "presenting", "objection", "closing", "won", "lost"])
def test_known_funnel_stages_kept(stage: str) -> None:
    assert parse_model_reply(f'{{"reply": "ок", "funnel_stage": "{stage}"}}').funnel_stage == stage


def test_invalid_object_falls_back_to_text() -> None:
    # Объект без reply — не наш контракт: клиенту уходит текст как есть,
    # а не пустота.
    text = '{"needs_human": true, "human_reason": "цена"}'
    reply = parse_model_reply(text)
    assert reply.reply == text
    assert reply.needs_human is False


def test_nested_braces_inside_reply() -> None:
    text = '{"reply": "цена {примерно} 100", "needs_human": false}'
    parsed = parse_model_json(text)
    assert parsed == {"reply": "цена {примерно} 100", "needs_human": False}
    assert parse_model_reply(text).reply == "цена {примерно} 100"


def test_parse_model_json_forms() -> None:
    assert parse_model_json(CLEAN)["reply"] == "Здравствуйте! Чем помочь?"
    assert parse_model_json(FENCED)["needs_human"] is False
    assert parse_model_json(INSIDE_TEXT)["funnel_stage"] == "new"
    assert parse_model_json("просто строка") is None
    assert parse_model_json("[1, 2, 3]") is None
    assert parse_model_json("") is None


def test_lead_fields_and_extra_bag() -> None:
    text = (
        '{"reply": "ок", "needs_human": true, "human_reason": "гарантия", '
        '"lead": {"name": "Иван", "phone": "[PHONE_1]", "extra": {"guests": 2, "dates": "10-12 мая"}, '
        '"unknown_field": 1}, "unknown_top": "x"}'
    )
    reply = parse_model_reply(text)
    assert reply.needs_human is True
    assert reply.human_reason == "гарантия"
    assert isinstance(reply.lead, LeadFields)
    assert reply.lead.name == "Иван"
    assert reply.lead.phone == "[PHONE_1]"
    assert reply.lead.extra == {"guests": 2, "dates": "10-12 мая"}
    assert not hasattr(reply, "unknown_top")


def test_json_schema_has_contract_fields() -> None:
    props = MODEL_REPLY_JSON_SCHEMA["properties"]
    for name in ("reply", "needs_human", "human_reason", "funnel_stage", "lead"):
        assert name in props, name
    assert ModelReply.model_json_schema() == MODEL_REPLY_JSON_SCHEMA


def test_partially_valid_object_keeps_reply() -> None:
    # Число в budget — типичный ответ модели; клиенту не должен уйти сырой JSON.
    text = '{"reply": "Стол стоит по прайсу", "lead": {"budget": 50000}}'
    reply = parse_model_reply(text)
    assert reply.reply == "Стол стоит по прайсу"
    assert reply.lead is not None and reply.lead.budget == "50000"


def test_unrepairable_side_field_still_keeps_reply() -> None:
    text = '{"reply": "Стол стоит по прайсу", "needs_human": "maybe", "lead": {"extra": null}}'
    reply = parse_model_reply(text)
    assert reply.reply == "Стол стоит по прайсу"
    assert reply.needs_human is False
