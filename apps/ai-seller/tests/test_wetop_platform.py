"""Помощник читает у платформы ошибки человека и состояние (ТЗ интеграции, Б1).

Контракт — П4 из ТЗ: узкий ключ в заголовке x-wetop-service-key (так платформа
читает GUARD_READ_KEY, auth.guard.ts), GET /assistant/errors и GET /guard/status.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

import httpx
import pytest

from src.config import get_settings
from src.integrations.providers import ProviderUnavailable

KEY = "assistant-read-key-for-tests"
BASE = "http://platform.test"
SINCE = datetime(2026, 9, 24, 0, 0, tzinfo=timezone.utc)
ERRORS = {
    "items": [
        {"at": "2026-09-24T09:15:00Z", "section": "Брони", "status": 400, "message": "adults — целое ≥ 1"},
        {"at": "2026-09-24T10:02:00Z", "section": "Тарифы", "status": 400,
         "message": "categoryCodes: непустой список кодов категорий"},
    ]
}
STATUS_OK = {
    "running": True, "autofix": False, "propertyLive": True,
    "notifier": {"configured": True, "recipients": ["owner@example.com"]},
    "dbDownSince": None, "lastTick": None,
    "open": {"total": 0, "critical": 0, "escalated": 0, "byClass": {"A": 0, "B": 0, "C": 0}},
}


class Platform:
    """Подменная платформа: отвечает по пути, запоминает запросы."""

    def __init__(self, routes: dict[str, tuple[int, object]]) -> None:
        self.routes = routes
        self.requests: list[httpx.Request] = []

    def client(self) -> httpx.AsyncClient:
        def handle(request: httpx.Request) -> httpx.Response:
            self.requests.append(request)
            code, body = self.routes.get(request.url.path, (404, {"message": "not found"}))
            return httpx.Response(code, content=json.dumps(body).encode(), request=request)

        return httpx.AsyncClient(transport=httpx.MockTransport(handle))


def _provider(monkeypatch, platform: Platform):
    monkeypatch.setenv("INTEGRATION_MODE", "wetop")
    monkeypatch.setenv("INTEGRATION_BASE_URL", BASE)
    monkeypatch.setenv("INTEGRATION_API_KEY", KEY)
    get_settings.cache_clear()
    from src.integrations.wetop import WetopProviders

    return WetopProviders(get_settings(), platform.client())


async def test_own_errors_are_read_with_the_narrow_key(monkeypatch) -> None:
    platform = Platform({"/assistant/errors": (200, ERRORS)})
    incidents = await _provider(monkeypatch, platform).recent_for_user(
        user_id="42", org_id="7", since=SINCE, limit=5
    )

    request = platform.requests[0]
    assert request.headers.get("x-wetop-service-key") == KEY, "платформа читает ключ из этого заголовка"
    assert "authorization" not in {k.lower() for k in request.headers}
    assert request.url.params["userId"] == "42" and request.url.params["organizationId"] == "7"
    assert [i.summary for i in incidents] == [e["message"] for e in ERRORS["items"]]
    assert incidents[0].section == "Брони"


@pytest.mark.parametrize(
    ("code", "body"),
    [(403, {"message": "Ключ читает только своё"}), (500, {"message": "x"}), (200, {"error": "quota"}),
     (200, ["голый", "список"])],
)
async def test_a_refusal_is_unavailability(monkeypatch, code: int, body) -> None:
    """Отказ по телу, а не по коду: 200 с ошибкой внутри — тоже отказ."""
    platform = Platform({"/assistant/errors": (code, body)})
    with pytest.raises(ProviderUnavailable):
        await _provider(monkeypatch, platform).recent_for_user(user_id="42", org_id="7", since=SINCE, limit=5)


async def test_a_broken_item_is_skipped_not_fatal(monkeypatch) -> None:
    platform = Platform({"/assistant/errors": (200, {"items": [{"section": "без времени"}, *ERRORS["items"]]})})
    incidents = await _provider(monkeypatch, platform).recent_for_user(user_id="42", org_id="7", since=SINCE, limit=5)
    assert len(incidents) == 2


async def test_the_limit_is_kept_even_if_the_platform_sends_more(monkeypatch) -> None:
    platform = Platform({"/assistant/errors": (200, ERRORS)})
    incidents = await _provider(monkeypatch, platform).recent_for_user(user_id="42", org_id="7", since=SINCE, limit=1)
    assert len(incidents) == 1


async def test_healthy_platform(monkeypatch) -> None:
    report = await _provider(monkeypatch, Platform({"/guard/status": (200, STATUS_OK)})).status()
    assert report.ok is True and report.degraded == []


async def test_database_down_and_critical_incidents_are_reported(monkeypatch) -> None:
    sick = {**STATUS_OK, "dbDownSince": "2026-09-24T09:00:00Z",
            "open": {**STATUS_OK["open"], "total": 2, "critical": 2}}
    report = await _provider(monkeypatch, Platform({"/guard/status": (200, sick)})).status()
    assert report.ok is False
    assert any("база" in d for d in report.degraded)
    assert any("2" in d for d in report.degraded)


async def test_recipients_of_the_platform_never_reach_the_report(monkeypatch) -> None:
    """В ответе сторожа платформы есть адреса получателей оповещений:
    пользователю помощника они уходить не должны."""
    sick = {**STATUS_OK, "dbDownSince": "2026-09-24T09:00:00Z"}
    report = await _provider(monkeypatch, Platform({"/guard/status": (200, sick)})).status()
    assert "owner@example.com" not in " ".join(report.degraded)


async def test_the_key_never_reaches_the_log(monkeypatch, caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.DEBUG)
    with pytest.raises(ProviderUnavailable):
        await _provider(monkeypatch, Platform({"/assistant/errors": (403, {"message": "нет"})})).recent_for_user(
            user_id="42", org_id="7", since=SINCE, limit=5
        )
    assert KEY not in caplog.text


def test_the_support_instance_gets_incidents_and_health(monkeypatch) -> None:
    from src.integrations.factory import build_providers

    monkeypatch.setenv("INTEGRATION_MODE", "wetop")
    monkeypatch.setenv("INTEGRATION_BASE_URL", BASE)
    monkeypatch.setenv("INTEGRATION_API_KEY", KEY)
    monkeypatch.setenv("BOT_ROLE", "support")
    get_settings.cache_clear()
    providers = build_providers(get_settings(), http_client=Platform({}).client())
    assert providers.incidents is not None and providers.health is not None
