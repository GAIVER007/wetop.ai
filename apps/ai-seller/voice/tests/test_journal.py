import json
from datetime import datetime, timezone

from voice.journal import CallJournal, CallState
from voice.numbers import Route

ROUTE = Route(
    organization_id="11111111-1111-4111-8111-111111111111",
    agent_id="22222222-2222-4222-8222-222222222222",
)
T0 = datetime(2026, 10, 22, 9, 0, 0, tzinfo=timezone.utc)


def _journal(tmp_path):
    return CallJournal(tmp_path / "calls.jsonl", now=lambda: T0)


def _lines(tmp_path):
    return [json.loads(x) for x in (tmp_path / "calls.jsonl").read_text().splitlines()]


def test_record_writes_event_with_app_timestamp_and_scope(tmp_path):
    j = _journal(tmp_path)
    assert j.record("call-1", CallState.RECEIVED, route=ROUTE, caller="+77001112233") is True
    [row] = _lines(tmp_path)
    assert row["call_id"] == "call-1"
    assert row["state"] == "RECEIVED"
    assert row["received_at"] == "2026-10-22T09:00:00+00:00"
    assert row["organization_id"] == ROUTE.organization_id
    assert row["agent_id"] == ROUTE.agent_id


def test_caller_phone_is_masked_never_written_whole(tmp_path):
    j = _journal(tmp_path)
    j.record("call-1", CallState.RECEIVED, route=ROUTE, caller="+77001112233")
    raw = (tmp_path / "calls.jsonl").read_text()
    assert "7001112233" not in raw
    assert "***2233" in raw


def test_same_call_and_state_is_idempotent(tmp_path):
    j = _journal(tmp_path)
    assert j.record("call-1", CallState.ANSWERED, route=ROUTE) is True
    assert j.record("call-1", CallState.ANSWERED, route=ROUTE) is False
    assert len(_lines(tmp_path)) == 1


def test_idempotency_survives_restart(tmp_path):
    _journal(tmp_path).record("call-1", CallState.ENDED, route=ROUTE)
    again = _journal(tmp_path)
    assert again.record("call-1", CallState.ENDED, route=ROUTE) is False


def test_event_key_allows_several_callbacks_in_one_call(tmp_path):
    j = _journal(tmp_path)
    assert j.record("call-1", CallState.CALLBACK, route=ROUTE, key="+77001112233") is True
    assert j.record("call-1", CallState.CALLBACK, route=ROUTE, key="+77001112233") is False
    assert j.record("call-1", CallState.CALLBACK, route=ROUTE, key="+77004445566") is True


def test_rejected_call_without_route_is_still_recorded(tmp_path):
    j = _journal(tmp_path)
    j.record("call-9", CallState.REJECTED, route=None, caller="+77001112233", error="unknown_number")
    [row] = _lines(tmp_path)
    assert row["state"] == "REJECTED"
    assert row["organization_id"] is None
    assert row["error"] == "unknown_number"


def test_events_for_returns_only_that_call(tmp_path):
    j = _journal(tmp_path)
    j.record("a", CallState.RECEIVED, route=ROUTE)
    j.record("b", CallState.RECEIVED, route=ROUTE)
    assert [e["call_id"] for e in j.events_for("a")] == ["a"]


def test_unwritable_journal_does_not_raise_into_the_call(tmp_path):
    j = CallJournal(tmp_path / "missing-dir" / "x" / "calls.jsonl", now=lambda: T0)
    j.path.parent.parent.write_text("a file, not a directory")
    assert j.record("call-1", CallState.RECEIVED, route=ROUTE) is False


def test_extra_fields_cannot_override_core_keys(tmp_path):
    j = _journal(tmp_path)
    j.record("call-1", CallState.RECEIVED, route=ROUTE, received_at="1999", organization_id="evil")
    [row] = _lines(tmp_path)
    assert row["organization_id"] == ROUTE.organization_id
    assert row["received_at"].startswith("2026-10-22")


def test_append_after_torn_line_does_not_glue_records(tmp_path):
    path = tmp_path / "calls.jsonl"
    path.write_text('{"call_id": "old", "state": "RECEIVED"', encoding="utf-8")
    j = CallJournal(path, now=lambda: T0)
    assert j.record("call-1", CallState.RECEIVED, route=ROUTE) is True
    assert [e["call_id"] for e in j.events_for("call-1")] == ["call-1"]


def test_journal_file_is_private(tmp_path):
    import stat

    _journal(tmp_path).record("call-1", CallState.RECEIVED, route=ROUTE)
    mode = stat.S_IMODE((tmp_path / "calls.jsonl").stat().st_mode)
    assert mode & 0o077 == 0
