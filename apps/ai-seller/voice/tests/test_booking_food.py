"""Бронь стола в ресторане по телефону: клиент платформы, инструменты, профиль. Гости и телефоны вымышленные."""

import httpx
import pytest

from voice.booking_client import BookingRefused, BookingUnavailable, VoiceBooking
from voice.journal import CallJournal
from voice.numbers import Route
from voice.profile import VoiceProfile, build_instructions
from voice.tools import VoiceTools

AGENT = "22222222-2222-4222-8222-222222222222"
QUOTE = "88888888-8888-4888-8888-888888888888"
ROUTE = Route(organization_id="11111111-1111-4111-8111-111111111111", agent_id=AGENT)

FREE = {"ok": True, "date": "2026-11-10", "time": "19:00", "partySize": 4, "period": "Ужин"}
BUSY = {"ok": False, "reason": "На это время свободных столов нет", "date": "2026-11-10", "time": "19:00", "partySize": 4}
QUOTED = {"quote": QUOTE, "expiresAt": "x", "date": "2026-11-10", "time": "19:00", "partySize": 4, "period": "Ужин"}
BOOKED = {"status": "BOOKED", "date": "2026-11-10", "time": "19:00", "partySize": 4, "pendingApproval": True}


class Recorder:
    def __init__(self, routes):
        self.calls, self.routes = [], routes

    def __call__(self, req: httpx.Request):
        self.calls.append((req.method, req.url.path, dict(req.url.params), req.content.decode() if req.content else "", req.headers.get("x-wetop-service-key")))
        status, body = self.routes.get((req.method, req.url.path), (200, {}))
        return httpx.Response(status, json=body)


async def test_food_client_uses_read_key_for_check_and_book_key_for_writes():
    rec = Recorder({("GET", "/voice/food-availability"): (200, FREE), ("POST", "/voice/booking-quotes"): (201, QUOTED),
                    ("POST", "/voice/booking-quotes/confirm"): (200, BOOKED)})
    c = VoiceBooking(base_url="https://wetop.test", read_key="read-k", book_key="book-k", http=httpx.AsyncClient(transport=httpx.MockTransport(rec)))
    assert await c.food_availability(AGENT, "call-1", "2026-11-10", "19:00", 4) == FREE
    assert await c.food_quote(AGENT, "call-1", "2026-11-10", "19:00", 4) == QUOTED
    assert await c.food_confirm(AGENT, "call-1", QUOTE, {"name": "Тест", "phone": "+77001112233", "comment": "у окна"}) == BOOKED
    assert [k for *_, k in rec.calls] == ["read-k", "book-k", "book-k"]
    assert rec.calls[0][2]["party"] == "4"
    assert '"party":4' in rec.calls[1][3].replace(" ", "")


class FakeBooking:
    def __init__(self, check=FREE, fail=None):
        self.check, self.fail, self.calls = check, fail, []

    async def _do(self, name, *args, result):
        self.calls.append((name, *args))
        if self.fail:
            raise self.fail
        return result

    async def food_availability(self, agent, call, date, time, party):
        return await self._do("check", agent, call, date, time, party, result=self.check)

    async def food_quote(self, agent, call, date, time, party):
        return await self._do("quote", agent, call, date, time, party, result=QUOTED)

    async def food_confirm(self, agent, call, quote, guest):
        return await self._do("confirm", agent, call, quote, guest, result=BOOKED)


class NoCatalog:
    pass


def _tools(tmp_path, booking, max_bookings=3):
    profile = VoiceProfile(object_name="Ресторан Тест", vertical="FOOD_SERVICE", booking_enabled=True, booking_max_per_call=max_bookings)
    return VoiceTools(call_id="call-1", route=ROUTE, journal=CallJournal(tmp_path / "c.jsonl"), catalog=NoCatalog(), profile=profile, booking=booking)


async def test_check_table_says_free_or_the_reason_and_validates_input(tmp_path):
    booking = FakeBooking()
    tools = _tools(tmp_path, booking)
    text = await tools.check_table("2026-11-10", "19:00", 4)
    assert "свободн" in text.lower() and "19:00" in text
    for date, time, guests in (("завтра", "19:00", 4), ("2026-11-10", "7 вечера", 4), ("2026-11-10", "19:00", 0), ("2026-11-10", "19:00", 99)):
        assert "дат" in (await tools.check_table(date, time, guests)).lower() or "гост" in (await tools.check_table(date, time, guests)).lower()
    assert len([c for c in booking.calls if c[0] == "check"]) == 1
    busy = await _tools(tmp_path, FakeBooking(check=BUSY)).check_table("2026-11-10", "19:00", 4)
    assert "нет" in busy.lower()


async def test_quote_table_only_for_the_checked_free_time(tmp_path):
    booking = FakeBooking()
    tools = _tools(tmp_path, booking)
    assert "сначала" in (await tools.quote_table("2026-11-10", "19:00", 4)).lower()
    await tools.check_table("2026-11-10", "19:00", 4)
    assert "сначала" in (await tools.quote_table("2026-11-10", "20:00", 4)).lower()
    assert not [c for c in booking.calls if c[0] == "quote"]
    text = await tools.quote_table("2026-11-10", "19:00", 4)
    assert "19:00" in text and "подтвержд" in text.lower() and "стол" in text.lower()
    # busy time cannot be quoted
    busy = _tools(tmp_path, FakeBooking(check=BUSY))
    await busy.check_table("2026-11-10", "19:00", 4)
    assert "сначала" in (await busy.quote_table("2026-11-10", "19:00", 4)).lower()


async def test_confirm_table_needs_agreement_name_phone_and_sends_comment(tmp_path):
    booking = FakeBooking()
    tools = _tools(tmp_path, booking)
    assert "предложени" in (await tools.confirm_table("Тест", "+77001112233", "", True)).lower()
    await tools.check_table("2026-11-10", "19:00", 4)
    await tools.quote_table("2026-11-10", "19:00", 4)
    assert "соглас" in (await tools.confirm_table("Тест", "+77001112233", "", False)).lower()
    assert "имя" in (await tools.confirm_table("", "+77001112233", "", True)).lower()
    assert "телефон" in (await tools.confirm_table("Тест", "12", "", True)).lower()
    assert not [c for c in booking.calls if c[0] == "confirm"]
    text = await tools.confirm_table("Тест", "8 700 111 22 33", "у окна, детский стул", True)
    sent = [c for c in booking.calls if c[0] == "confirm"][0]
    assert sent[3] == QUOTE and sent[4] == {"name": "Тест", "phone": "+77001112233", "comment": "у окна, детский стул"}
    assert "администратор" in text.lower() and "стол" in text.lower()
    again = await tools.confirm_table("Тест", "+77001112233", "", True)
    assert len([c for c in booking.calls if c[0] == "confirm"]) == 1
    assert "предложени" in again.lower()


async def test_refusals_and_outages_and_limit(tmp_path):
    for fail, needle in ((BookingRefused("x"), "недоступ"), (BookingUnavailable("x"), "администратор")):
        assert needle in (await _tools(tmp_path, FakeBooking(fail=fail)).check_table("2026-11-10", "19:00", 4)).lower()
    booking = FakeBooking()
    tools = _tools(tmp_path, booking, max_bookings=1)
    for _ in range(2):
        await tools.check_table("2026-11-10", "19:00", 4)
        await tools.quote_table("2026-11-10", "19:00", 4)
        text = await tools.confirm_table("Тест", "+77001112233", "", True)
    assert len([c for c in booking.calls if c[0] == "confirm"]) == 1
    assert "администратор" in text.lower()


def test_instructions_for_restaurant_booking_only_when_on():
    off = build_instructions(VoiceProfile(object_name="Р", vertical="FOOD_SERVICE"), "")
    on = build_instructions(VoiceProfile(object_name="Р", vertical="FOOD_SERVICE", booking_enabled=True), "")
    assert "confirm_table" not in off and "confirm_table" in on and "check_table" in on
    assert "не оформляй запись, бронь" not in on
    assert "get_service_hours" in on
