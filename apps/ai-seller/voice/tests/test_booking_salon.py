"""Запись в салон по телефону: клиент платформы, инструменты, профиль. Клиенты и телефоны вымышленные."""

import httpx
import pytest

from voice.booking_client import BookingRefused, BookingUnavailable, VoiceBooking
from voice.journal import CallJournal
from voice.numbers import Route
from voice.profile import VoiceProfile, build_instructions
from voice.tools import VoiceTools

AGENT = "22222222-2222-4222-8222-222222222222"
SERVICE = "55555555-5555-4555-8555-555555555555"
MASTER = "66666666-6666-4666-8666-666666666666"
OTHER = "77777777-7777-4777-8777-777777777777"
QUOTE = "88888888-8888-4888-8888-888888888888"
ROUTE = Route(organization_id="11111111-1111-4111-8111-111111111111", agent_id=AGENT)
SLOT = "2026-11-10T05:00:00.000Z"

CATALOG = {
    "timezone": "Asia/Almaty", "currency": "KZT",
    "services": [
        {"id": SERVICE, "name": "Стрижка", "durationMinutes": 60, "priceMinor": "500000",
         "masters": [{"id": MASTER, "name": "Алия"}, {"id": OTHER, "name": "Мария"}]},
    ],
}
SLOTS = {
    "date": "2026-11-10",
    "service": {"id": SERVICE, "name": "Стрижка", "durationMinutes": 60, "priceMinor": "500000", "currency": "KZT"},
    "masters": [{"id": MASTER, "name": "Алия"}, {"id": OTHER, "name": "Мария"}],
    "slots": [{"startsAt": SLOT, "time": "10:00", "masterIds": [MASTER, OTHER]},
              {"startsAt": "2026-11-10T06:00:00.000Z", "time": "11:00", "masterIds": [OTHER]}],
}
QUOTED = {"quote": QUOTE, "expiresAt": "x", "service": "Стрижка", "master": "любой свободный", "startsAt": SLOT,
          "time": "10:00", "date": "2026-11-10", "priceMinor": "500000", "currency": "KZT"}
BOOKED = {"status": "BOOKED", "service": "Стрижка", "master": "Алия", "startsAt": SLOT, "priceMinor": "500000",
          "currency": "KZT", "pendingApproval": True}


class Recorder:
    def __init__(self, routes):
        self.calls, self.routes = [], routes

    def __call__(self, req: httpx.Request):
        self.calls.append((req.method, req.url.path, dict(req.url.params), req.content.decode() if req.content else "", req.headers.get("x-wetop-service-key")))
        status, body = self.routes.get((req.method, req.url.path), (200, {}))
        return httpx.Response(status, json=body)


def _client(rec):
    return VoiceBooking(base_url="https://wetop.test", read_key="read-k", book_key="book-k",
                        http=httpx.AsyncClient(transport=httpx.MockTransport(rec)))


async def test_salon_reads_use_read_key_and_writes_use_book_key():
    rec = Recorder({("GET", "/voice/beauty-catalog"): (200, CATALOG), ("GET", "/voice/beauty-slots"): (200, SLOTS),
                    ("POST", "/voice/booking-quotes"): (201, QUOTED), ("POST", "/voice/booking-quotes/confirm"): (200, BOOKED)})
    c = _client(rec)
    assert await c.beauty_catalog(AGENT, "call-1") == CATALOG
    assert await c.beauty_slots(AGENT, "call-1", SERVICE, "2026-11-10", MASTER) == SLOTS
    assert await c.beauty_quote(AGENT, "call-1", SERVICE, None, SLOT) == QUOTED
    assert await c.beauty_confirm(AGENT, "call-1", QUOTE, {"name": "Тест", "phone": "+77001112233", "comment": "без мытья"}) == BOOKED
    assert [k for *_, k in rec.calls] == ["read-k", "read-k", "book-k", "book-k"]
    assert rec.calls[1][2]["employee"] == MASTER
    assert '"consent":true' in rec.calls[3][3].replace(" ", "")


class FakeBooking:
    def __init__(self, fail=None, slots=SLOTS):
        self.fail, self.slots, self.calls = fail, slots, []

    async def _do(self, name, *args, result):
        self.calls.append((name, *args))
        if self.fail:
            raise self.fail
        return result

    async def beauty_catalog(self, agent, call):
        return await self._do("catalog", agent, call, result=CATALOG)

    async def beauty_slots(self, agent, call, service, date, employee):
        return await self._do("slots", agent, call, service, date, employee, result=self.slots)

    async def beauty_quote(self, agent, call, service, employee, starts_at):
        return await self._do("quote", agent, call, service, employee, starts_at, result=QUOTED)

    async def beauty_confirm(self, agent, call, quote, guest):
        return await self._do("confirm", agent, call, quote, guest, result=BOOKED)


class NoCatalog:
    pass


def _tools(tmp_path, booking, max_bookings=3):
    profile = VoiceProfile(object_name="Салон Тест", vertical="BEAUTY", booking_enabled=True, booking_max_per_call=max_bookings)
    return VoiceTools(call_id="call-1", route=ROUTE, journal=CallJournal(tmp_path / "c.jsonl"), catalog=NoCatalog(), profile=profile, booking=booking)


async def _prepared(tmp_path, booking):
    tools = _tools(tmp_path, booking)
    await tools.get_masters()
    await tools.find_slots("Стрижка", "2026-11-10")
    return tools


async def test_masters_text_says_who_does_which_service(tmp_path):
    text = await _tools(tmp_path, FakeBooking()).get_masters()
    assert "Стрижка" in text and "Алия" in text and "Мария" in text and "5000" in text.replace(" ", "")


async def test_slots_need_a_service_from_the_catalog_and_a_valid_date(tmp_path):
    booking = FakeBooking()
    tools = _tools(tmp_path, booking)
    assert "сначала" in (await tools.find_slots("Стрижка", "2026-11-10")).lower()
    await tools.get_masters()
    assert "услуг" in (await tools.find_slots("Космос", "2026-11-10")).lower()
    assert "дат" in (await tools.find_slots("Стрижка", "завтра")).lower()
    assert not [c for c in booking.calls if c[0] == "slots"]
    text = await tools.find_slots("Стрижка", "2026-11-10")
    assert "10:00" in text and "11:00" in text
    assert booking.calls[-1][3:] == (SERVICE, "2026-11-10", None)


async def test_slots_for_a_named_master_pass_the_master_id_from_the_catalog_only(tmp_path):
    booking = FakeBooking()
    tools = _tools(tmp_path, booking)
    await tools.get_masters()
    await tools.find_slots("Стрижка", "2026-11-10", "Алия")
    assert booking.calls[-1][5] == MASTER
    assert "мастер" in (await tools.find_slots("Стрижка", "2026-11-10", "Неизвестная")).lower()


async def test_quote_only_for_time_offered_and_with_master_who_has_it(tmp_path):
    booking = FakeBooking()
    tools = await _prepared(tmp_path, booking)
    assert "время" in (await tools.quote_visit("Стрижка", "15:00")).lower()
    # у Алии 11:00 нет (только у Марии): к Алии на это время не записать
    assert "недоступ" in (await tools.quote_visit("Стрижка", "11:00", "Алия")).lower()
    assert not [c for c in booking.calls if c[0] == "quote"]
    text = await tools.quote_visit("Стрижка", "10:00")
    assert "5000" in text.replace(" ", "") and "подтвержд" in text.lower()
    assert booking.calls[-1][3:] == (SERVICE, None, SLOT)


async def test_quote_to_named_master_sends_master_id(tmp_path):
    booking = FakeBooking()
    tools = await _prepared(tmp_path, booking)
    await tools.quote_visit("Стрижка", "10:00", "Алия")
    assert booking.calls[-1][4] == MASTER


async def test_confirm_needs_agreement_name_phone_and_a_quote_and_sends_comment(tmp_path):
    booking = FakeBooking()
    tools = await _prepared(tmp_path, booking)
    assert "предложени" in (await tools.confirm_visit("Тест", "+77001112233", "", True)).lower()
    await tools.quote_visit("Стрижка", "10:00")
    assert "соглас" in (await tools.confirm_visit("Тест", "+77001112233", "", False)).lower()
    assert "имя" in (await tools.confirm_visit("", "+77001112233", "", True)).lower()
    assert "телефон" in (await tools.confirm_visit("Тест", "123", "", True)).lower()
    assert not [c for c in booking.calls if c[0] == "confirm"]
    text = await tools.confirm_visit("Тест", "8 700 111 22 33", "без мытья головы", True)
    sent = [c for c in booking.calls if c[0] == "confirm"][0]
    assert sent[3] == QUOTE and sent[4] == {"name": "Тест", "phone": "+77001112233", "comment": "без мытья головы"}
    assert "Алия" in text and "администратор" in text.lower()
    again = await tools.confirm_visit("Тест", "+77001112233", "", True)
    assert len([c for c in booking.calls if c[0] == "confirm"]) == 1
    assert "предложени" in again.lower()


async def test_refusals_and_outages_give_neutral_phrases(tmp_path):
    for fail, needle in ((BookingRefused("x"), "недоступ"), (BookingUnavailable("x"), "администратор")):
        tools = _tools(tmp_path, FakeBooking(fail=fail))
        text = await tools.get_masters()
        assert needle in text.lower() and text != "x"


async def test_worker_side_limit_per_call(tmp_path):
    booking = FakeBooking()
    tools = _tools(tmp_path, booking, max_bookings=1)
    await tools.get_masters()
    for _ in range(2):
        await tools.find_slots("Стрижка", "2026-11-10")
        await tools.quote_visit("Стрижка", "10:00")
        text = await tools.confirm_visit("Тест", "+77001112233", "", True)
    assert len([c for c in booking.calls if c[0] == "confirm"]) == 1
    assert "администратор" in text.lower()


def test_instructions_for_salon_booking_only_when_on():
    off = build_instructions(VoiceProfile(object_name="С", vertical="BEAUTY"), "")
    on = build_instructions(VoiceProfile(object_name="С", vertical="BEAUTY", booking_enabled=True), "")
    assert "confirm_visit" not in off and "confirm_visit" in on and "find_slots" in on
    assert "не оформляй запись, бронь" not in on
    assert "get_services" in off
