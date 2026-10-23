from datetime import datetime, timedelta, timezone

from voice.flusher import MAX_LIMITED_ATTEMPTS, backoff_seconds, drain, flush_once
from voice.outbox import Outbox
from voice.platform import SendResult

T0 = datetime(2026, 10, 22, 9, 0, 0, tzinfo=timezone.utc)


class Clock:
    def __init__(self):
        self.t = T0

    def __call__(self):
        return self.t

    def advance(self, seconds):
        self.t += timedelta(seconds=seconds)


class FakeClient:
    def __init__(self, results):
        self.results = list(results)
        self.sent = []

    async def send_event(self, payload):
        self.sent.append(payload)
        return self.results.pop(0) if self.results else SendResult.OK


def _box(tmp_path, clock=None):
    return Outbox(tmp_path / "ob", now=clock or Clock())


async def test_sends_all_in_order_and_empties_queue(tmp_path):
    box = _box(tmp_path)
    for n in range(3):
        box.enqueue({"n": n})
    client = FakeClient([])
    stats = await flush_once(box, client)
    assert [p["n"] for p in client.sent] == [0, 1, 2]
    assert (stats.sent, stats.retried, stats.rejected) == (3, 0, 0)
    assert box.pending_count() == 0


async def test_retry_stops_the_pass_and_keeps_the_rest(tmp_path):
    box = _box(tmp_path)
    for n in range(3):
        box.enqueue({"n": n})
    client = FakeClient([SendResult.OK, SendResult.RETRY])
    stats = await flush_once(box, client)
    assert (stats.sent, stats.retried) == (1, 1)
    assert [p["n"] for p in client.sent] == [0, 1]  # третье не трогали
    assert box.pending_count() == 2


async def test_reject_goes_aside_and_pass_continues(tmp_path):
    box = _box(tmp_path)
    box.enqueue({"n": 0})
    box.enqueue({"n": 1})
    client = FakeClient([SendResult.REJECT, SendResult.OK])
    stats = await flush_once(box, client)
    assert (stats.sent, stats.rejected) == (1, 1)
    assert box.rejected_count() == 1 and box.pending_count() == 0


async def test_failed_item_waits_backoff_before_next_try(tmp_path):
    clock = Clock()
    box = _box(tmp_path, clock)
    box.enqueue({"n": 0})
    client = FakeClient([SendResult.RETRY, SendResult.OK])
    await flush_once(box, client)
    again = await flush_once(box, client)
    assert again.sent == 0 and len(client.sent) == 1  # ещё рано
    clock.advance(backoff_seconds(1) + 1)
    done = await flush_once(box, client)
    assert done.sent == 1 and box.pending_count() == 0


def test_backoff_grows_and_is_capped():
    values = [backoff_seconds(n) for n in range(0, 12)]
    assert values == sorted(values)
    assert values[0] >= 1
    assert max(values) <= 900


async def test_drain_stops_after_one_failed_pass_and_keeps_events(tmp_path):
    box = _box(tmp_path)
    box.enqueue({"n": 0})
    client = FakeClient([SendResult.RETRY] * 50)
    await drain(box, client, timeout_seconds=5, pause_seconds=0.01)
    assert box.pending_count() == 1
    assert len(client.sent) == 1  # не долбим лежащий API и не держим слот воркера


async def test_drain_returns_at_once_when_nothing_is_due(tmp_path):
    clock = Clock()
    box = _box(tmp_path, clock)
    box.enqueue({"n": 0})
    await flush_once(box, FakeClient([SendResult.RETRY]))  # ушло в ожидание повтора
    client = FakeClient([])
    await drain(box, client, timeout_seconds=5, pause_seconds=0.01)
    assert client.sent == []


async def test_not_found_is_retried_a_bounded_number_of_times_then_shelved(tmp_path):
    clock = Clock()
    box = _box(tmp_path, clock)
    box.enqueue({"n": 0})
    client = FakeClient([SendResult.RETRY_LIMITED] * (MAX_LIMITED_ATTEMPTS + 5))
    for _ in range(MAX_LIMITED_ATTEMPTS + 2):
        await flush_once(box, client)
        clock.advance(backoff_seconds(20) + 1)
    assert len(client.sent) == MAX_LIMITED_ATTEMPTS
    assert box.pending_count() == 0 and box.rejected_count() == 1


async def test_not_found_that_recovers_is_delivered(tmp_path):
    clock = Clock()
    box = _box(tmp_path, clock)
    box.enqueue({"n": 0})
    client = FakeClient([SendResult.RETRY_LIMITED, SendResult.RETRY_LIMITED, SendResult.OK])
    for _ in range(3):
        await flush_once(box, client)
        clock.advance(backoff_seconds(20) + 1)
    assert box.pending_count() == 0 and box.rejected_count() == 0
