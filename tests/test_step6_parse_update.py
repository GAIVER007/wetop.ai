"""Шаг 6: разбор обновления Telegram во входящее сообщение движка.

Внешние идентификаторы — строкой сразу при разборе: Telegram шлёт chat.id
числом, а в базе и в движке он всегда строка (AGENTS.md).
"""

from __future__ import annotations

from datetime import timezone

from src.ai.engine import IncomingMessage
from src.channels.telegram import CONSENT_CALLBACK, CallbackEvent, parse_update
from tests.telegram_fakes import callback_update, message_update


def test_message_becomes_incoming_with_string_external_id() -> None:
    incoming = parse_update(message_update(chat_id=12345, text="Есть места?"))
    assert isinstance(incoming, IncomingMessage)
    assert incoming.channel == "telegram"
    assert incoming.external_id == "12345"
    assert isinstance(incoming.external_id, str)
    assert incoming.text == "Есть места?"
    assert incoming.ip is None
    assert incoming.received_at.tzinfo is not None
    assert incoming.received_at.utcoffset() == timezone.utc.utcoffset(None)


def test_start_command_becomes_greeting() -> None:
    incoming = parse_update(message_update(text="/start"))
    assert isinstance(incoming, IncomingMessage)
    assert incoming.text == "Здравствуйте"


def test_photo_without_text_is_ignored() -> None:
    assert parse_update(message_update(text=None, photo=True)) is None


def test_message_without_text_is_ignored() -> None:
    assert parse_update(message_update(text=None)) is None


def test_empty_update_is_ignored() -> None:
    assert parse_update({"update_id": 5}) is None
    assert parse_update({}) is None


def test_callback_query_becomes_callback_event() -> None:
    event = parse_update(callback_update(chat_id=98765, data=CONSENT_CALLBACK, callback_id="cb-42", first_name="Анна"))
    assert isinstance(event, CallbackEvent)
    assert event.callback_id == "cb-42"
    assert event.chat_id == "98765"
    assert isinstance(event.chat_id, str)
    assert event.data == CONSENT_CALLBACK
    assert event.client_name == "Анна"


def test_client_name_from_first_and_last_name() -> None:
    incoming = parse_update(message_update(first_name="Иван", last_name="Петров"))
    assert incoming.client_name == "Иван Петров"


def test_client_name_from_first_name_only() -> None:
    incoming = parse_update(message_update(first_name="Иван", last_name=None))
    assert incoming.client_name == "Иван"


def test_client_name_missing_is_none() -> None:
    incoming = parse_update(message_update(first_name=None))
    assert incoming.client_name is None


def test_consent_callback_constant() -> None:
    assert CONSENT_CALLBACK == "consent:accept"
