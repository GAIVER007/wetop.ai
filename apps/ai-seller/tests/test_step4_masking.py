"""Шаг 4: маскировка персональных данных стоит ОДИН раз ДО каскада.
Запасная ступень получает те же замаскированные сообщения, что и основная.
Номер и почта вымышленные: +7 701 000 00 00, example.com."""

import json

import pytest

from src.ai.context import mask_messages
from src.ai.llm import CascadeClient
from src.security.pii import normalize_phone
from tests.llm_fakes import FALLBACK, PRIMARY, ScriptedRouter, chat_response, llm_env, message_texts

PHONE = "+7 701 000 00 00"
EMAIL = "ivan@example.com"
GOOD = '{"reply": "Спасибо, [NAME_1], записал [PHONE_1]"}'

MESSAGES = [
    {"role": "system", "content": "Ты продавец."},
    {"role": "user", "content": f"Меня зовут Иван, мой номер {PHONE}"},
    {"role": "assistant", "content": f"Записал {PHONE}, спасибо."},
    {"role": "user", "content": f"Почта {EMAIL}, звоните на {PHONE}"},
]


def _no_raw_phone(call: dict) -> None:
    body = json.dumps(call, ensure_ascii=False)
    assert PHONE not in body
    assert "701 000 00 00" not in body
    assert EMAIL not in body


async def test_both_cascade_steps_get_masked_messages(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = llm_env(monkeypatch)
    router = ScriptedRouter({PRIMARY: [500], FALLBACK: [chat_response(GOOD, model=FALLBACK)]})
    client = CascadeClient(settings, http_client=router.http_client())

    result = await client.generate(MESSAGES, use_tools=False)

    assert result.ok and result.model == FALLBACK
    assert len(router.calls) == 2
    for call in router.calls:
        _no_raw_phone(call)
        assert any("[PHONE_1]" in text for text in message_texts(call))
        assert any("[EMAIL_1]" in text for text in message_texts(call))
    # Обе ступени получили байт в байт одно и то же.
    assert router.calls[0]["messages"] == router.calls[1]["messages"]
    # Таблица меток возвращается движку; обратная подстановка — не здесь.
    assert normalize_phone(result.mapping["[PHONE_1]"]) == "77010000000"
    assert result.mapping["[EMAIL_1]"] == EMAIL
    assert "[PHONE_1]" in result.text


async def test_same_phone_in_history_and_message_is_one_label(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = llm_env(monkeypatch)
    router = ScriptedRouter({PRIMARY: [chat_response(GOOD, model=PRIMARY)]})
    client = CascadeClient(settings, http_client=router.http_client())

    result = await client.generate(MESSAGES, use_tools=False)

    assert result.ok
    body = json.dumps(router.calls[0], ensure_ascii=False)
    assert "[PHONE_1]" in body
    assert "[PHONE_2]" not in body
    phone_labels = [label for label in result.mapping if label.startswith("[PHONE_")]
    assert phone_labels == ["[PHONE_1]"]


async def test_allowlisted_company_phone_goes_as_is(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = llm_env(monkeypatch, PII_ALLOWLIST_PHONES=PHONE)
    router = ScriptedRouter({PRIMARY: [chat_response(GOOD, model=PRIMARY)]})
    client = CascadeClient(settings, http_client=router.http_client())
    messages = [{"role": "user", "content": f"Ваш номер {PHONE}, верно?"}]

    result = await client.generate(messages, use_tools=False)

    assert result.ok
    body = json.dumps(router.calls[0], ensure_ascii=False)
    assert PHONE in body
    assert "[PHONE_" not in body
    assert not any(label.startswith("[PHONE_") for label in result.mapping)


def test_mask_messages_shared_table_and_no_mutation() -> None:
    original = [
        {"role": "user", "content": f"Номер {PHONE}"},
        {"role": "tool", "tool_call_id": "c1", "content": f"Клиент: {PHONE}, {EMAIL}"},
        {"role": "user", "content": f"Ещё раз: {PHONE}"},
    ]
    snapshot = json.dumps(original, ensure_ascii=False)

    masked, mapping = mask_messages(original, allowlist_phones=[], allowlist_emails=[])

    assert json.dumps(original, ensure_ascii=False) == snapshot
    assert masked is not original
    contents = [m["content"] for m in masked]
    assert all(PHONE not in c for c in contents)
    # Один номер везде — одна метка, в том числе в tool-сообщении.
    assert all("[PHONE_1]" in c for c in contents)
    assert "[EMAIL_1]" in contents[1]
    assert masked[1]["tool_call_id"] == "c1"
    assert normalize_phone(mapping["[PHONE_1]"]) == "77010000000"
    assert mapping["[EMAIL_1]"] == EMAIL


def test_mask_messages_respects_allowlist() -> None:
    messages = [{"role": "user", "content": f"Пишите на {EMAIL} или {PHONE}"}]
    masked, mapping = mask_messages(messages, allowlist_phones=[PHONE], allowlist_emails=[EMAIL])
    assert masked[0]["content"] == messages[0]["content"]
    assert mapping == {}


async def test_tool_result_is_masked_with_shared_table(monkeypatch: pytest.MonkeyPatch) -> None:
    """Инструмент вернул ПД клиента — во второй запрос той же ступени уходят
    метки, а не цифры, и метка попадает в mapping для движка."""
    from src.ai.tools import ToolRegistry, ToolSpec
    from tests.llm_fakes import tool_call

    settings = llm_env(monkeypatch)

    async def get_client(order: str) -> str:
        return f"Заказ {order}: телефон {PHONE}, почта {EMAIL}"

    registry = ToolRegistry()
    registry.register(
        ToolSpec(name="get_client", description="Карточка", parameters={"type": "object"}, handler=get_client)
    )
    router = ScriptedRouter(
        {
            PRIMARY: [
                chat_response(
                    None,
                    model=PRIMARY,
                    tool_calls=[tool_call("c1", "get_client", {"order": "17"})],
                    finish_reason="tool_calls",
                ),
                chat_response(GOOD, model=PRIMARY),
            ]
        }
    )
    client = CascadeClient(settings, http_client=router.http_client(), tools=registry)

    result = await client.generate([{"role": "user", "content": f"Мой номер {PHONE}, что с заказом 17?"}])

    assert result.ok and len(router.calls) == 2
    for call in router.calls:
        _no_raw_phone(call)
    tool_messages = [m for m in router.calls[1]["messages"] if m["role"] == "tool"]
    assert tool_messages and "[PHONE_1]" in tool_messages[0]["content"]
    assert "[EMAIL_1]" in tool_messages[0]["content"]
    assert "[PHONE_2]" not in json.dumps(router.calls[1], ensure_ascii=False)
    assert normalize_phone(result.mapping["[PHONE_1]"]) == "77010000000"
    assert result.mapping["[EMAIL_1]"] == EMAIL
