"""Клиент платформы для диагностики (S5): два новых адреса узкого ключа помощника.

Проверяется контракт: пара «человек, организация» уходит параметрами, ключ — в заголовке, 404 — это «нет такого»,
а не сбой; кривое тело — сбой, а не выдуманный ответ. Сети нет: MockTransport.
"""

from __future__ import annotations

import json

import httpx
import pytest

from src.config import get_settings
from src.integrations.providers import ProviderUnavailable

BASE = "http://platform.test"
KEY = "assistant-read-key-for-run"

INTEGRATIONS = {"channex": {"state": "READY", "categories": {"mapped": 5, "total": 5}, "problems": []}}
RESERVATION = {"number": "R-42", "status": "CONFIRMED", "items": [], "problems": []}


class Platform:
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


async def test_integration_health_goes_with_the_pair_and_the_key(monkeypatch) -> None:
    platform = Platform({"/assistant/integrations": (200, INTEGRATIONS)})
    body = await _provider(monkeypatch, platform).integration_health(user_id="42", org_id="7")
    request = platform.requests[0]
    assert request.headers.get("x-wetop-service-key") == KEY
    assert request.url.params["userId"] == "42" and request.url.params["organizationId"] == "7"
    assert body == INTEGRATIONS


async def test_not_connected_and_not_member_are_distinct(monkeypatch) -> None:
    assert (await _provider(monkeypatch, Platform({"/assistant/integrations": (200, {"channex": None})})).integration_health(user_id="42", org_id="7")) == {"channex": None}
    assert (await _provider(monkeypatch, Platform({})).integration_health(user_id="42", org_id="7")) is None


async def test_reservation_status_sends_the_number_and_treats_404_as_none(monkeypatch) -> None:
    platform = Platform({"/assistant/reservation": (200, RESERVATION)})
    provider = _provider(monkeypatch, platform)
    assert await provider.reservation_status(user_id="42", org_id="7", number="R-42") == RESERVATION
    assert platform.requests[0].url.params["number"] == "R-42"
    assert await _provider(monkeypatch, Platform({})).reservation_status(user_id="42", org_id="7", number="R-404") is None


@pytest.mark.parametrize("body", [{"message": "x"}, ["список"], {"number": 1, "items": []}])
async def test_broken_bodies_are_unavailability_not_answers(monkeypatch, body) -> None:
    with pytest.raises(ProviderUnavailable):
        await _provider(monkeypatch, Platform({"/assistant/reservation": (200, body)})).reservation_status(user_id="42", org_id="7", number="R-42")
    with pytest.raises(ProviderUnavailable):
        await _provider(monkeypatch, Platform({"/assistant/integrations": (200, ["список"])})).integration_health(user_id="42", org_id="7")


def test_the_support_instance_gets_diagnostics(monkeypatch) -> None:
    monkeypatch.setenv("INTEGRATION_MODE", "wetop")
    monkeypatch.setenv("INTEGRATION_BASE_URL", BASE)
    monkeypatch.setenv("INTEGRATION_API_KEY", KEY)
    monkeypatch.setenv("BOT_ROLE", "support")
    get_settings.cache_clear()
    from src.integrations.factory import build_providers

    providers = build_providers(get_settings(), http_client=Platform({}).client())
    assert providers.diagnostics is not None
    monkeypatch.setenv("BOT_ROLE", "seller")
    get_settings.cache_clear()
    assert build_providers(get_settings(), http_client=Platform({}).client()).diagnostics is None
