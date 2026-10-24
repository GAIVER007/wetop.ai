"""Бронь гостиницы по телефону: клиент платформы, инструменты, профиль. Гости и телефоны вымышленные."""

import httpx
import pytest

from voice.booking_client import BookingRefused, BookingUnavailable, VoiceBooking
from voice.journal import CallJournal
from voice.numbers import Route
from voice.profile import VoiceProfile, build_instructions
from voice.tools import VoiceTools

AGENT = "22222222-2222-4222-8222-222222222222"
INTENT = "33333333-3333-4333-8333-333333333333"
ROUTE = Route(organization_id="11111111-1111-4111-8111-111111111111", agent_id=AGENT)

AVAILABILITY = {
    "arrivalDate": "2026-11-10", "departureDate": "2026-11-12", "nights": 2, "adults": 2, "currency": "KZT",
    "checkInTime": "14:00", "checkOutTime": "12:00",
    "categories": [
        {"code": "STD", "name": "Стандарт", "free": "yes", "totalMinor": "3000000"},
        {"code": "LUX", "name": "Люкс", "free": "no", "totalMinor": None},
    ],
}
QUOTE = {
    "intent": INTENT, "expiresAt": "x", "categoryName": "Стандарт", "arrivalDate": "2026-11-10",
    "departureDate": "2026-11-12", "nights": 2, "adults": 2, "totalMinor": "3000000", "currency": "KZT",
    "checkInTime": "14:00", "checkOutTime": "12:00",
}
BOOKED = {
    "confirmationNumber": "WT-1", "status": "CONFIRMED", "categoryName": "Стандарт", "arrivalDate": "2026-11-10",
    "departureDate": "2026-11-12", "nights": 2, "adults": 2, "totalMinor": "3000000", "currency": "KZT",
    "replay": False, "pendingApproval": True,
}


class Recorder:
    def __init__(self, routes=None):
        self.calls = []
        self.routes = routes or {}

    def __call__(self, req: httpx.Request):
        body = req.content.decode() if req.content else ""
        self.calls.append((req.method, req.url.path, dict(req.url.params), body, req.headers.get("x-wetop-service-key")))
        kind = self.routes.get((req.method, req.url.path), (200, {}))
        return httpx.Response(kind[0], json=kind[1])


def _client(rec):
    return VoiceBooking(
        base_url="https://wetop.test", read_key="read-k", book_key="book-k",
        http=httpx.AsyncClient(transport=httpx.MockTransport(rec)),
    )


# ---- клиент платформы

async def test_availability_uses_read_key_and_agent_call_in_query_not_in_url_secret():
    rec = Recorder({("GET", "/voice/availability"): (200, AVAILABILITY)})
    data = await _client(rec).availability(AGENT, "call-1", "2026-11-10", "2026-11-12", 2)
    assert data == AVAILABILITY
    method, path, params, _, key = rec.calls[0]
    assert (method, path, key) == ("GET", "/voice/availability", "read-k")
    assert params["agent"] == AGENT and params["call"] == "call-1"


async def test_quote_and_confirm_use_the_booking_key():
    rec = Recorder({("POST", "/voice/booking-quotes"): (201, QUOTE), ("POST", "/voice/booking-quotes/confirm"): (200, BOOKED)})
    c = _client(rec)
    assert await c.quote(AGENT, "call-1", "STD", "2026-11-10", "2026-11-12", 2) == QUOTE
    assert await c.confirm(AGENT, "call-1", INTENT, {"firstName": "Тест", "lastName": "Тестов", "phone": "+77001112233"}) == BOOKED
    assert [k for *_, k in rec.calls] == ["book-k", "book-k"]
    assert '"consent":true' in rec.calls[1][3].replace(" ", "")


@pytest.mark.parametrize("status", [400, 404, 409, 422, 429])
async def test_refusal_statuses_are_refusals_without_server_text(status):
    rec = Recorder({("POST", "/voice/booking-quotes"): (status, {"message": "секретный текст сервера"})})
    with pytest.raises(BookingRefused) as err:
        await _client(rec).quote(AGENT, "call-1", "STD", "2026-11-10", "2026-11-12", 2)
    assert "секретный" not in str(err.value)


@pytest.mark.parametrize("status", [401, 403, 500, 503])
async def test_other_failures_are_unavailable(status):
    rec = Recorder({("GET", "/voice/availability"): (status, {})})
    with pytest.raises(BookingUnavailable):
        await _client(rec).availability(AGENT, "call-1", "2026-11-10", "2026-11-12", 2)


async def test_network_error_is_unavailable_without_address():
    def boom(req):
        raise httpx.ConnectError("https://wetop.test secret")

    c = VoiceBooking(base_url="https://wetop.test", read_key="r", book_key="b", http=httpx.AsyncClient(transport=httpx.MockTransport(boom)))
    with pytest.raises(BookingUnavailable) as err:
        await c.quote(AGENT, "call-1", "STD", "2026-11-10", "2026-11-12", 2)
    assert "wetop.test" not in str(err.value)


# ---- инструменты

class FakeBooking:
    def __init__(self, availability=AVAILABILITY, quote=QUOTE, booked=BOOKED, fail=None):
        self.availability_data, self.quote_data, self.booked, self.fail = availability, quote, booked, fail
        self.calls = []

    async def availability(self, agent, call, arrival, departure, adults):
        self.calls.append(("availability", agent, call, arrival, departure, adults))
        if self.fail:
            raise self.fail
        return self.availability_data

    async def quote(self, agent, call, category, arrival, departure, adults):
        self.calls.append(("quote", agent, call, category, arrival, departure, adults))
        if self.fail:
            raise self.fail
        return self.quote_data

    async def confirm(self, agent, call, intent, guest):
        self.calls.append(("confirm", agent, call, intent, guest))
        if self.fail:
            raise self.fail
        return self.booked


class NoCatalog:
    pass


def _tools(tmp_path, booking, max_bookings=3):
    journal = CallJournal(tmp_path / "calls.jsonl")
    profile = VoiceProfile(object_name="Гостиница Тест", vertical="HOSPITALITY", booking_enabled=True, booking_max_per_call=max_bookings)
    return VoiceTools(call_id="call-1", route=ROUTE, journal=journal, catalog=NoCatalog(), profile=profile, booking=booking)


async def test_availability_text_names_free_and_busy_categories_with_platform_price(tmp_path):
    tools = _tools(tmp_path, FakeBooking())
    text = await tools.check_availability("2026-11-10", "2026-11-12", 2)
    assert "Стандарт" in text and "30000" in text.replace(" ", "")
    assert "Люкс" in text and "нет" in text.lower()


async def test_quote_only_from_categories_offered_in_this_call(tmp_path):
    booking = FakeBooking()
    tools = _tools(tmp_path, booking)
    assert "сначала" in (await tools.quote_stay("Стандарт", "2026-11-10", "2026-11-12", 2)).lower()
    assert not [c for c in booking.calls if c[0] == "quote"]
    await tools.check_availability("2026-11-10", "2026-11-12", 2)
    text = await tools.quote_stay("Стандарт", "2026-11-10", "2026-11-12", 2)
    assert "30000" in text.replace(" ", "") and "подтвержд" in text.lower()
    # платформе уходит код категории из выдачи, а не слова модели
    assert booking.calls[-1][3] == "STD"


async def test_busy_category_cannot_be_quoted(tmp_path):
    booking = FakeBooking()
    tools = _tools(tmp_path, booking)
    await tools.check_availability("2026-11-10", "2026-11-12", 2)
    text = await tools.quote_stay("Люкс", "2026-11-10", "2026-11-12", 2)
    assert "недоступ" in text.lower()
    assert not [c for c in booking.calls if c[0] == "quote"]


async def test_confirm_needs_agreement_and_a_quote(tmp_path):
    booking = FakeBooking()
    tools = _tools(tmp_path, booking)
    assert "предложени" in (await tools.confirm_booking("Тест", "Тестов", "+77001112233", True)).lower()
    await tools.check_availability("2026-11-10", "2026-11-12", 2)
    await tools.quote_stay("Стандарт", "2026-11-10", "2026-11-12", 2)
    assert "соглас" in (await tools.confirm_booking("Тест", "Тестов", "+77001112233", False)).lower()
    assert not [c for c in booking.calls if c[0] == "confirm"]


async def test_confirm_sends_intent_from_the_quote_and_reports_pending(tmp_path):
    booking = FakeBooking()
    tools = _tools(tmp_path, booking)
    await tools.check_availability("2026-11-10", "2026-11-12", 2)
    await tools.quote_stay("Стандарт", "2026-11-10", "2026-11-12", 2)
    text = await tools.confirm_booking("Тест", "Тестов", "8 700 111 22 33", True)
    sent = [c for c in booking.calls if c[0] == "confirm"][0]
    assert sent[3] == INTENT
    assert sent[4]["phone"] == "+77001112233"
    assert "WT-1" in text and "подтвержд" in text.lower() and "администратор" in text.lower()
    # повторное «да» без новой котировки не создаёт вторую бронь
    again = await tools.confirm_booking("Тест", "Тестов", "+77001112233", True)
    assert len([c for c in booking.calls if c[0] == "confirm"]) == 1
    assert "предложени" in again.lower()


async def test_confirmed_without_pending_flag_is_stated_as_confirmed(tmp_path):
    booking = FakeBooking(booked={**BOOKED, "pendingApproval": False})
    tools = _tools(tmp_path, booking)
    await tools.check_availability("2026-11-10", "2026-11-12", 2)
    await tools.quote_stay("Стандарт", "2026-11-10", "2026-11-12", 2)
    text = await tools.confirm_booking("Тест", "Тестов", "+77001112233", True)
    assert "администратор" not in text.lower() or "подтверждена" in text.lower()


async def test_bad_phone_or_names_do_not_reach_the_platform(tmp_path):
    booking = FakeBooking()
    tools = _tools(tmp_path, booking)
    await tools.check_availability("2026-11-10", "2026-11-12", 2)
    await tools.quote_stay("Стандарт", "2026-11-10", "2026-11-12", 2)
    assert "телефон" in (await tools.confirm_booking("Тест", "Тестов", "123", True)).lower()
    assert "имя" in (await tools.confirm_booking("", "Тестов", "+77001112233", True)).lower()
    assert not [c for c in booking.calls if c[0] == "confirm"]


@pytest.mark.parametrize("arrival,departure,adults", [("завтра", "2026-11-12", 2), ("2026-11-12", "2026-11-10", 2), ("2026-11-10", "2026-11-12", 0), ("2026-11-10", "2026-11-12", 50)])
async def test_bad_dates_or_guests_are_rejected_before_the_platform(tmp_path, arrival, departure, adults):
    booking = FakeBooking()
    tools = _tools(tmp_path, booking)
    text = await tools.check_availability(arrival, departure, adults)
    assert booking.calls == []
    assert "дат" in text.lower() or "гост" in text.lower()


async def test_refusal_gives_neutral_phrase_and_unavailable_goes_to_admin(tmp_path):
    for fail, needle in ((BookingRefused("x"), "недоступ"), (BookingUnavailable("x"), "администратор")):
        tools = _tools(tmp_path, FakeBooking(fail=fail))
        text = await tools.check_availability("2026-11-10", "2026-11-12", 2)
        assert needle in text.lower()
        assert "x" != text


async def test_worker_side_limit_of_bookings_per_call(tmp_path):
    booking = FakeBooking()
    tools = _tools(tmp_path, booking, max_bookings=1)
    for _ in range(2):
        await tools.check_availability("2026-11-10", "2026-11-12", 2)
        await tools.quote_stay("Стандарт", "2026-11-10", "2026-11-12", 2)
        text = await tools.confirm_booking("Тест", "Тестов", "+77001112233", True)
    assert len([c for c in booking.calls if c[0] == "confirm"]) == 1
    assert "администратор" in text.lower()


async def test_without_booking_client_tools_say_it_is_unavailable(tmp_path):
    journal = CallJournal(tmp_path / "calls.jsonl")
    tools = VoiceTools(call_id="call-1", route=ROUTE, journal=journal, catalog=NoCatalog(), profile=VoiceProfile(object_name="Г", vertical="HOSPITALITY"))
    assert "администратор" in (await tools.check_availability("2026-11-10", "2026-11-12", 2)).lower()


# ---- профиль и инструкции

def test_hotel_instructions_change_only_when_booking_is_enabled():
    off = build_instructions(VoiceProfile(object_name="Г", vertical="HOSPITALITY"), "")
    on = build_instructions(VoiceProfile(object_name="Г", vertical="HOSPITALITY", booking_enabled=True), "")
    assert "check_availability" not in off and "confirm_booking" in on
    assert "явное согласие" in on.lower() or "явное «да»" in on.lower()
    # правило «бронь не оформляй» заменено, суммы по-прежнему не считаем
    assert "не оформляй запись, бронь" not in on
    assert "не считай" in on.lower()


def test_other_verticals_never_get_booking_text():
    for vertical in ("BEAUTY", "FOOD_SERVICE"):
        text = build_instructions(VoiceProfile(object_name="О", vertical=vertical, booking_enabled=True), "")
        assert "confirm_booking" not in text
