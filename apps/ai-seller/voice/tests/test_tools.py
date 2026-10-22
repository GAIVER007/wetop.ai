import json
from datetime import datetime, timezone

import pytest

from voice.journal import CallJournal
from voice.numbers import Route
from voice.profile import VoiceProfile
from voice.tools import VoiceTools
from voice.wetop_client import CatalogUnavailable

ROUTE = Route(
    organization_id="11111111-1111-4111-8111-111111111111",
    agent_id="22222222-2222-4222-8222-222222222222",
)
T0 = datetime(2026, 10, 22, 9, 0, 0, tzinfo=timezone.utc)
ITEMS = [{"name": "Стрижка", "category": "Волосы", "durationMinutes": 60, "priceMinor": "500000", "currency": "KZT"}]


class FakeCatalog:
    def __init__(self, items=None, fail=False):
        self.items, self.fail, self.calls = items, fail, 0

    async def beauty_services(self, agent_id):
        self.calls += 1
        assert agent_id == ROUTE.agent_id
        if self.fail:
            raise CatalogUnavailable("timeout")
        return self.items


def _tools(tmp_path, catalog=None, handoff="+77009990000", transfer=None):
    journal = CallJournal(tmp_path / "calls.jsonl", now=lambda: T0)
    return VoiceTools(
        call_id="call-1",
        route=ROUTE,
        journal=journal,
        catalog=catalog or FakeCatalog(ITEMS),
        profile=VoiceProfile(object_name="Салон Тест", handoff_number=handoff),
        transfer=transfer,
    ), journal


def _states(journal):
    return [e["state"] for e in journal.events_for("call-1")]


async def test_services_text_has_name_duration_and_price_from_catalog(tmp_path):
    tools, _ = _tools(tmp_path)
    text = await tools.get_services()
    assert "Стрижка" in text and "60" in text
    assert "5000" in text.replace(" ", "")
    assert "KZT" in text or "тенге" in text


async def test_services_do_not_sum_or_invent(tmp_path):
    tools, _ = _tools(tmp_path, FakeCatalog(ITEMS * 2))
    text = await tools.get_services()
    assert "10000" not in text.replace(" ", "")


async def test_catalog_failure_gives_neutral_phrase_not_error_text(tmp_path):
    tools, _ = _tools(tmp_path, FakeCatalog(fail=True))
    text = await tools.get_services()
    assert "администратор" in text.lower()
    assert "timeout" not in text and "CatalogUnavailable" not in text


async def test_empty_catalog_is_not_zero_prices(tmp_path):
    tools, _ = _tools(tmp_path, FakeCatalog([]))
    assert "администратор" in (await tools.get_services()).lower()


async def test_callback_is_journaled_once_per_phone(tmp_path):
    tools, journal = _tools(tmp_path)
    first = await tools.request_callback("Айдана", "8 700 111 22 33", "хочу окрашивание")
    again = await tools.request_callback("Айдана", "+77001112233", "хочу окрашивание")
    assert "записана" in first.lower() and "уже" not in first.lower()
    assert "уже" in again.lower()
    assert _states(journal).count("CALLBACK") == 1
    assert "7001112233" not in (tmp_path / "calls.jsonl").read_text()


async def test_callback_with_bad_phone_asks_again_and_writes_nothing(tmp_path):
    tools, journal = _tools(tmp_path)
    text = await tools.request_callback("Айдана", "123", "")
    assert "номер" in text.lower()
    assert _states(journal) == []


async def test_callback_note_is_trimmed(tmp_path):
    tools, journal = _tools(tmp_path)
    await tools.request_callback("А", "+77001112233", "я" * 5000)
    [event] = journal.events_for("call-1")
    assert len(event["note"]) <= 500


async def test_transfer_calls_back_with_call_id_and_handoff_number(tmp_path):
    seen = []

    async def transfer(call_id, number):
        seen.append((call_id, number))
        return True

    tools, journal = _tools(tmp_path, transfer=transfer)
    text = await tools.transfer_to_human()
    assert seen == [("call-1", "+77009990000")]
    assert "перевожу" in text.lower()
    assert "TRANSFER" in _states(journal)


async def test_transfer_without_number_does_not_promise(tmp_path):
    tools, journal = _tools(tmp_path, handoff=None, transfer=None)
    text = await tools.transfer_to_human()
    assert "перевожу" not in text.lower()
    assert "администратор" in text.lower()


@pytest.mark.parametrize("mode", ["false", "raises"])
async def test_transfer_failure_is_neutral(tmp_path, mode):
    async def transfer(call_id, number):
        if mode == "raises":
            raise RuntimeError("secret detail")
        return False

    tools, _ = _tools(tmp_path, transfer=transfer)
    text = await tools.transfer_to_human()
    assert "secret detail" not in text
    assert "перевожу" not in text.lower()


async def test_callback_full_phone_goes_only_to_private_callbacks_file(tmp_path):
    tools, journal = _tools(tmp_path)
    await tools.request_callback("Айдана", "8 700 111 22 33", "окрашивание")
    assert "7001112233" not in (tmp_path / "calls.jsonl").read_text()
    cb = tmp_path / "calls.callbacks.jsonl"
    row = json.loads(cb.read_text().splitlines()[0])
    assert row["phone"] == "+77001112233" and row["call_id"] == "call-1"
    import stat

    assert stat.S_IMODE(cb.stat().st_mode) & 0o077 == 0


async def test_callback_not_promised_when_callback_file_cannot_be_written(tmp_path):
    tools, _ = _tools(tmp_path)
    (tmp_path / "calls.callbacks.jsonl").mkdir()
    text = await tools.request_callback("А", "+77001112233", "")
    assert "не удалось" in text.lower() or "уточнит" in text.lower()
    assert "передана администратору" not in text.lower()


async def test_callbacks_are_capped_per_call(tmp_path):
    tools, journal = _tools(tmp_path)
    for i in range(6):
        await tools.request_callback("А", f"+7700111223{i}", "")
    assert _states(journal).count("CALLBACK") == 3


async def test_transfer_only_once_per_call(tmp_path):
    calls = []

    async def transfer(call_id, number):
        calls.append(number)
        return True

    tools, _ = _tools(tmp_path, transfer=transfer)
    await tools.transfer_to_human()
    await tools.transfer_to_human()
    assert len(calls) == 1


async def test_negative_or_bad_price_is_not_spoken(tmp_path):
    bad = [{"name": "Укладка", "durationMinutes": 30, "priceMinor": "-500", "currency": "KZT"}]
    tools, _ = _tools(tmp_path, FakeCatalog(bad))
    text = await tools.get_services()
    assert "-" not in text.split("Укладка")[1]
