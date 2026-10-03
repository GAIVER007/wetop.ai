"""Бронь из чата ИИ-продавца (ADR-141, DATA_MODEL §24 платформы).

🔴 Согласие проверяет сервер бота, а не модель: без явного «да» гостя в ЭТОМ ходе бронь не оформляется,
даже если модель вызвала инструмент. Телефон WhatsApp — из канала. Telegram — без брони.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from src.ai.hotel_tools import build_registry
from src.ai.seller_booking import (
    BookingRuntime,
    consent_key,
    explicit_booking_consent,
    pending_key,
)
from src.integrations.providers import ProviderUnavailable
from tests.integration_fakes import tool_call

AGENT = "44444444-4444-4444-8444-444444444444"
CONV = "conv-0001"
OFFER = {
    "intent": "11111111-1111-4111-8111-111111111111",
    "categoryName": "Двойная",
    "arrivalDate": "2026-10-05",
    "departureDate": "2026-10-07",
    "nights": 2,
    "adults": 2,
    "totalMinor": "3000000",
    "currency": "KZT",
    "checkInTime": "14:00",
    "checkOutTime": "12:00",
    "expiresAt": "2026-10-03T12:30:00Z",
}
BOOKED = {
    "confirmationNumber": "CHAT-1",
    "categoryName": "Двойная",
    "arrivalDate": "2026-10-05",
    "departureDate": "2026-10-07",
    "totalMinor": "3000000",
    "currency": "KZT",
}


class FakeRedis:
    def __init__(self) -> None:
        self.data: dict[str, str] = {}

    async def set(self, key, value, ex=None):
        self.data[key] = value

    async def get(self, key):
        return self.data.get(key)

    async def delete(self, key):
        self.data.pop(key, None)


class FakeBooking:
    def __init__(self, conflict_on: set[str] | None = None) -> None:
        self.calls: list[tuple[str, dict]] = []
        self.conflict_on = conflict_on or set()

    async def create_booking_intent(self, **kwargs):
        self.calls.append(("quote", kwargs))
        if "quote" in self.conflict_on:
            raise ProviderUnavailable("conflict")
        return dict(OFFER)

    async def confirm_booking_intent(self, **kwargs):
        self.calls.append(("confirm", kwargs))
        if "confirm" in self.conflict_on:
            raise ProviderUnavailable("conflict")
        return dict(BOOKED)


def incoming(text: str, channel: str = "whatsapp", external_id: str = "77011234567"):
    return SimpleNamespace(
        agent_id=AGENT, channel=channel, external_id=external_id, text=text,
        received_at=datetime(2026, 10, 3, 12, 0, tzinfo=timezone.utc),
    )


def setup(current, provider=None):
    redis = FakeRedis()
    provider = provider or FakeBooking()
    state = {"incoming": current}
    registry = build_registry(
        lambda: SimpleNamespace(availability=provider),
        booking=BookingRuntime(
            redis_getter=lambda: redis,
            incoming_getter=lambda: state["incoming"],
            conversation_getter=lambda: CONV,
            agent_getter=lambda: AGENT,
        ),
    )
    return registry, redis, provider, state


async def call(registry, name: str, **arguments) -> str:
    messages = await registry.dispatch([tool_call("c1", name, json.dumps(arguments, ensure_ascii=False))])
    return messages[0]["content"]


QUOTE_ARGS = {"arrival": "2026-10-05", "departure": "2026-10-07", "guests": 2, "category": "Двойная"}


def test_registry_has_booking_tools_only_when_runtime_given() -> None:
    plain = build_registry(lambda: SimpleNamespace(availability=FakeBooking()))
    assert plain.names == ["check_availability", "get_price"]
    registry, *_ = setup(incoming("хочу забронировать"))
    assert registry.names == ["check_availability", "get_price", "book_quote", "book_confirm"]


@pytest.mark.parametrize("text", ["да", "Да!", "да, бронируйте", "Иә", "yes", "Yes, book it", "好的", "确认"])
def test_explicit_consent_phrases(text: str) -> None:
    assert explicit_booking_consent(text)


@pytest.mark.parametrize("text", ["а сколько?", "наверное да", "да, но позже", "нет", "", None, "давайте подумаю"])
def test_not_consent(text) -> None:
    assert not explicit_booking_consent(text)


async def test_quote_in_telegram_is_refused_without_calling_platform() -> None:
    registry, redis, provider, _ = setup(incoming("хочу забронировать", channel="telegram"))
    text = await call(registry, "book_quote", **QUOTE_ARGS)
    assert "не оформляется" in text
    assert provider.calls == [] and redis.data == {}


async def test_quote_stores_pending_offer_and_tells_the_model_to_ask() -> None:
    registry, redis, provider, _ = setup(incoming("хочу двойную на 5-7 октября"))
    text = await call(registry, "book_quote", **QUOTE_ARGS)
    assert "итого 30 000 KZT" in text and "«да»" in text and "30 минут" in text
    kind, args = provider.calls[0]
    assert kind == "quote" and args["agent"] == AGENT and args["conversation"] == CONV and args["channel"] == "whatsapp"
    assert json.loads(redis.data[pending_key(CONV)])["intent"] == OFFER["intent"]


async def test_confirm_without_offer_or_without_yes_does_not_book() -> None:
    registry, redis, provider, state = setup(incoming("да"))
    assert "нет действующего предложения" in await call(registry, "book_confirm", first_name="А", last_name="Т")
    state["incoming"] = incoming("хочу забронировать")
    await call(registry, "book_quote", **QUOTE_ARGS)
    state["incoming"] = incoming("а сколько стоит завтрак?")
    text = await call(registry, "book_confirm", first_name="Айгерим", last_name="Тестова")
    assert "не сказал явное «да»" in text
    assert [k for k, _ in provider.calls] == ["quote"]


async def test_yes_in_whatsapp_books_with_channel_phone_and_message_key() -> None:
    registry, redis, provider, state = setup(incoming("хочу забронировать"))
    await call(registry, "book_quote", **QUOTE_ARGS)
    state["incoming"] = incoming("Да!")
    text = await call(registry, "book_confirm", first_name="Айгерим", last_name="Тестова")
    assert "номер CHAT-1" in text
    kind, args = provider.calls[-1]
    assert kind == "confirm"
    assert args["intent"] == OFFER["intent"]
    assert args["guest"] == {"firstName": "Айгерим", "lastName": "Тестова", "phone": "+77011234567"}
    assert args["message"] == consent_key(state["incoming"])
    assert pending_key(CONV) not in redis.data


def test_consent_key_same_for_same_message_and_different_for_another() -> None:
    a = incoming("да")
    assert consent_key(a) == consent_key(incoming("да"))
    assert consent_key(a) != consent_key(incoming("да", external_id="77019999999"))


async def test_conflict_drops_offer_and_asks_for_new_quote() -> None:
    registry, redis, provider, state = setup(incoming("хочу"), FakeBooking(conflict_on={"confirm"}))
    await call(registry, "book_quote", **QUOTE_ARGS)
    state["incoming"] = incoming("да")
    text = await call(registry, "book_confirm", first_name="Айгерим", last_name="Тестова")
    assert "больше не действует" in text
    assert pending_key(CONV) not in redis.data


async def test_widget_needs_guest_phone() -> None:
    registry, redis, provider, state = setup(incoming("хочу", channel="widget", external_id="visitor-1"))
    await call(registry, "book_quote", **QUOTE_ARGS)
    state["incoming"] = incoming("да", channel="widget", external_id="visitor-1")
    assert "нужен телефон" in await call(registry, "book_confirm", first_name="А", last_name="Т")
    text = await call(registry, "book_confirm", first_name="Айгерим", last_name="Тестова", phone="+7 701 123 45 67")
    assert "номер CHAT-1" in text
    assert provider.calls[-1][1]["guest"]["phone"] == "+7 701 123 45 67"
