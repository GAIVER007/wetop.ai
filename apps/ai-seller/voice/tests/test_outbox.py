import json
import stat
from datetime import datetime, timedelta, timezone

from voice.outbox import Outbox

T0 = datetime(2026, 10, 22, 9, 0, 0, tzinfo=timezone.utc)


class Clock:
    def __init__(self):
        self.t = T0

    def __call__(self):
        return self.t

    def advance(self, seconds):
        self.t += timedelta(seconds=seconds)


def _box(tmp_path, clock=None, **kw):
    return Outbox(tmp_path / "outbox", now=clock or Clock(), **kw)


def test_enqueue_then_take_returns_payload_fifo(tmp_path):
    box = _box(tmp_path)
    box.enqueue({"n": 1})
    box.enqueue({"n": 2})
    assert box.pending_count() == 2
    first = box.take_due()
    assert first.payload == {"n": 1}
    first.ack()
    second = box.take_due()
    assert second.payload == {"n": 2}
    second.ack()
    assert box.pending_count() == 0
    assert box.take_due() is None


def test_survives_restart(tmp_path):
    _box(tmp_path).enqueue({"n": 1})
    assert _box(tmp_path).take_due().payload == {"n": 1}


def test_claimed_item_is_not_given_out_twice(tmp_path):
    box = _box(tmp_path)
    box.enqueue({"n": 1})
    item = box.take_due()
    assert item is not None
    assert box.take_due() is None
    assert _box(tmp_path).take_due() is None  # другой процесс тоже не видит занятое


def test_retry_keeps_item_with_attempts_and_delay(tmp_path):
    clock = Clock()
    box = _box(tmp_path, clock)
    box.enqueue({"n": 1})
    item = box.take_due()
    item.retry(30)
    assert box.pending_count() == 1
    assert box.take_due() is None  # рано
    clock.advance(31)
    again = box.take_due()
    assert again.payload == {"n": 1}
    assert again.attempts == 1


def test_reject_moves_to_rejected_with_reason_not_lost(tmp_path):
    box = _box(tmp_path)
    box.enqueue({"n": 1})
    box.take_due().reject("http_400")
    assert box.pending_count() == 0
    assert box.rejected_count() == 1
    [row] = [json.loads(p.read_text()) for p in (tmp_path / "outbox" / "rejected").iterdir()]
    assert row["reason"] == "http_400"
    assert row["payload"] == {"n": 1}


def test_abandoned_claim_is_recovered_after_ttl(tmp_path):
    clock = Clock()
    box = _box(tmp_path, clock, claim_ttl_seconds=300)
    box.enqueue({"n": 1})
    box.take_due()  # процесс упал, не подтвердив
    clock.advance(301)
    assert _box(tmp_path, clock, claim_ttl_seconds=300).recover() == 1
    assert _box(tmp_path, clock).take_due().payload == {"n": 1}


def test_files_are_private(tmp_path):
    box = _box(tmp_path)
    box.enqueue({"n": 1})
    for path in (tmp_path / "outbox").iterdir():
        if path.is_file():
            assert stat.S_IMODE(path.stat().st_mode) & 0o077 == 0


def test_enqueue_failure_does_not_raise_and_returns_none(tmp_path):
    (tmp_path / "outbox").write_text("a file, not a directory")
    assert _box(tmp_path).enqueue({"n": 1}) is None


def test_damaged_file_goes_to_rejected_not_blocking_queue(tmp_path):
    box = _box(tmp_path)
    box.enqueue({"n": 1})
    (tmp_path / "outbox").joinpath("0000-broken.json").write_text("{not json")
    box.take_due().ack() if False else None
    got = []
    while (item := box.take_due()) is not None:
        got.append(item.payload)
        item.ack()
    assert got == [{"n": 1}]
    assert box.rejected_count() == 1


def test_unreadable_file_is_skipped_not_shelved_as_damaged(tmp_path):
    import os

    box = _box(tmp_path)
    ident = box.enqueue({"n": 1})
    path = tmp_path / "outbox" / f"{ident}.json"
    os.chmod(path, 0)
    try:
        assert box.take_due() is None
        assert box.rejected_count() == 0
    finally:
        os.chmod(path, 0o600)
    assert box.take_due().payload == {"n": 1}


def test_stale_listing_does_not_resend_before_backoff(tmp_path):
    """Файл перечитывается после занятия: если его уже вернули в очередь с будущим сроком, он не уходит раньше (ревью M3)."""
    clock = Clock()
    box = _box(tmp_path, clock)
    box.enqueue({"n": 1})
    first = box.take_due()
    first.retry(60)
    assert box.take_due() is None


def test_recovered_claim_owner_cannot_overwrite_new_state(tmp_path):
    clock = Clock()
    a = _box(tmp_path, clock, claim_ttl_seconds=300)
    a.enqueue({"n": 1})
    stale = a.take_due()
    clock.advance(301)
    assert a.recover() == 1
    fresh = a.take_due()
    assert fresh is not None
    stale.retry(30)  # старый владелец опоздал: чужую очередь не трогает
    fresh.ack()
    assert a.pending_count() == 0


def test_recover_does_not_overwrite_a_newer_home_file(tmp_path):
    clock = Clock()
    box = _box(tmp_path, clock, claim_ttl_seconds=300)
    box.enqueue({"n": 1})
    item = box.take_due()
    item.retry(10)  # запись нового состояния уже сделана, старая занятая копия не удалена (падение между шагами)
    leftover = tmp_path / "outbox" / (item._home.name + f".{int(clock().timestamp())}.sending")
    leftover.write_text(json.dumps({"payload": {"n": 1}, "attempts": 0, "next_at": None, "created_at": ""}))
    clock.advance(301)
    box.recover()
    again = Outbox(tmp_path / "outbox", now=clock)
    assert again.pending_count() == 1
    assert again.take_due().attempts == 1  # осталось новое состояние


def test_requeue_rejected_returns_events_to_the_queue(tmp_path):
    box = _box(tmp_path)
    box.enqueue({"n": 1})
    box.take_due().reject("rejected_by_api")
    assert box.requeue_rejected() == 1
    assert box.rejected_count() == 0
    item = box.take_due()
    assert item.payload == {"n": 1} and item.attempts == 0


def test_outbox_directory_is_private_even_if_it_existed(tmp_path):
    import os

    d = tmp_path / "outbox"
    d.mkdir(mode=0o755)
    _box(tmp_path).enqueue({"n": 1})
    assert stat.S_IMODE(os.stat(d).st_mode) & 0o077 == 0
