from datetime import datetime, timezone

import httpx
import pytest

from voice.journal import CallState
from voice.numbers import Route
from voice.outbox import Outbox
from voice.platform import (
    PlatformClient,
    PlatformEvents,
    ProfileNotFound,
    ProfileUnavailable,
    SendResult,
)

ROUTE = Route(
    organization_id="11111111-1111-4111-8111-111111111111",
    agent_id="22222222-2222-4222-8222-222222222222",
)
T0 = datetime(2026, 10, 22, 9, 0, 0, tzinfo=timezone.utc)


def _client(handler):
    return PlatformClient(
        base_url="https://wetop.test",
        key="k-test",
        http=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )


@pytest.mark.parametrize(
    "status, expected",
    [
        (200, SendResult.OK),
        (201, SendResult.OK),
        (400, SendResult.REJECT),
        (404, SendResult.RETRY_LIMITED),
        (422, SendResult.RETRY_LIMITED),
        (401, SendResult.RETRY),
        (403, SendResult.RETRY),
        (408, SendResult.RETRY),
        (429, SendResult.RETRY),
        (500, SendResult.RETRY),
        (503, SendResult.RETRY),
    ],
)
async def test_send_event_classifies_status(status, expected):
    c = _client(lambda r: httpx.Response(status, json={}))
    assert await c.send_event({"a": 1}) is expected


async def test_send_event_network_error_is_retry_without_leaking_details():
    def boom(req):
        raise httpx.ConnectError("secret-host")

    assert await _client(boom).send_event({"a": 1}) is SendResult.RETRY


async def test_send_event_sends_key_in_header_and_json_body_only():
    seen = {}

    def handler(req: httpx.Request):
        seen["key"] = req.headers.get("x-wetop-service-key")
        seen["url"] = str(req.url)
        seen["path"] = req.url.path
        seen["body"] = req.content.decode()
        return httpx.Response(201, json={"ok": True})

    await _client(handler).send_event({"externalCallId": "room-1"})
    assert seen["key"] == "k-test"
    assert seen["path"] == "/voice/events"
    assert "k-test" not in seen["url"]
    assert "room-1" in seen["body"]


PROFILE = {
    "agentId": ROUTE.agent_id,
    "organizationId": ROUTE.organization_id,
    "objectName": "Салон Тест",
    "greetingTail": "Работаем до 20 часов.",
    "voiceName": "Leda",
    "handoffPhone": "+77009990000",
}


async def test_get_profile_parses_response():
    seen = {}

    def handler(req: httpx.Request):
        seen["agent"] = req.url.params.get("agent")
        seen["path"] = req.url.path
        return httpx.Response(200, json=PROFILE)

    p = await _client(handler).get_profile(ROUTE.agent_id)
    assert seen == {"agent": ROUTE.agent_id, "path": "/voice/profile"}
    assert p.organization_id == ROUTE.organization_id
    assert p.object_name == "Салон Тест"
    assert p.greeting_tail == "Работаем до 20 часов."
    assert p.handoff_phone == "+77009990000"


@pytest.mark.parametrize("status", [404, 422])
async def test_get_profile_unknown_agent_is_not_found(status):
    with pytest.raises(ProfileNotFound):
        await _client(lambda r: httpx.Response(status, json={})).get_profile(ROUTE.agent_id)


@pytest.mark.parametrize(
    "response",
    [httpx.Response(500, json={}), httpx.Response(401, json={}), httpx.Response(200, text="x"), httpx.Response(200, json={"agentId": "x"})],
)
async def test_get_profile_other_failures_are_unavailable(response):
    with pytest.raises(ProfileUnavailable):
        await _client(lambda r: response).get_profile(ROUTE.agent_id)


def _events(tmp_path):
    box = Outbox(tmp_path / "ob", now=lambda: T0)
    return PlatformEvents(box, now=lambda: T0), box


def _payloads(box):
    out = []
    while (item := box.take_due()) is not None:
        out.append(item.payload)
        item.ack()
    return out


def test_state_event_payload(tmp_path):
    ev, box = _events(tmp_path)
    ev.state("room-1", ROUTE, CallState.RECEIVED, caller_masked="***2233", dialed="+77009990000")
    [p] = _payloads(box)
    assert p == {
        "agentId": ROUTE.agent_id,
        "externalCallId": "room-1",
        "state": "RECEIVED",
        "occurredAt": "2026-10-22T09:00:00+00:00",
        "callerMasked": "***2233",
        "dialedNumber": "+77009990000",
    }


def test_optional_fields_are_omitted_when_empty(tmp_path):
    ev, box = _events(tmp_path)
    ev.state("room-1", ROUTE, CallState.ENDED, end_reason="hangup")
    [p] = _payloads(box)
    assert p["endReason"] == "hangup"
    assert "callerMasked" not in p and "errorCode" not in p


def test_callback_rides_on_answered_state_with_full_phone(tmp_path):
    ev, box = _events(tmp_path)
    ev.callback("room-1", ROUTE, "+77001112233", "Айдана", "окрашивание")
    [p] = _payloads(box)
    assert p["state"] == "ANSWERED"
    assert p["callback"] == {"phone": "+77001112233", "name": "Айдана", "note": "окрашивание"}


def test_transfer_event(tmp_path):
    ev, box = _events(tmp_path)
    ev.transfer("room-1", ROUTE)
    [p] = _payloads(box)
    assert p["state"] == "ANSWERED" and p["transferRequested"] is True


def test_unwritable_outbox_does_not_raise_into_the_call(tmp_path):
    (tmp_path / "ob").write_text("file")
    ev, _ = _events(tmp_path)
    ev.state("room-1", ROUTE, CallState.RECEIVED)
