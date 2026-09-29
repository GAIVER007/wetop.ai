"""S4: контекст обратившегося для WETOP Support (plans/ai-agents-s4-requester-context-2026-09-29.md).

Три инструмента без параметров: кто пишет, статус аккаунта, права. Организацию и человека берёт только подпись
посетителя; то, что модель передала аргументом, до платформы не доходит. Аноним — «не вошли», платформа не вызывается.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx
import pytest

from src.ai.support_tools import UNKNOWN, build_registry
from src.integrations.wetop import PATH_REQUESTER_CONTEXT, WetopProviders

USER = "0b6c3c1e-4f4e-4a53-9b7e-2f1d7a9c0a11"
ORG = "5d2f1a9e-8c7b-4e3a-a1f0-6b9c2d4e8f00"
FOREIGN = "9f8e7d6c-5b4a-4392-8171-000000000000"

CONTEXT = {
    "user": {"name": "Аня Тестова", "email": "a***@example.kz"},
    "role": {"code": "STAFF", "label": "Администратор"},
    "organization": {"name": "Тестовый отель", "status": "ACTIVE"},
    "businesses": [
        {
            "name": "Тестовый бизнес",
            "vertical": "HOSPITALITY",
            "status": "ACTIVE",
            "locations": [{"name": "Филиал 1", "status": "ACTIVE"}],
        }
    ],
    "subscription": {
        "aiSeller": {
            "access": "active",
            "activeUntil": "2026-12-31T00:00:00.000Z",
            "summary": "Расширение «ИИ-продавец» действует до 31.12.2026.",
        }
    },
    "permissions": {
        "allowed": [{"code": "desk", "label": "Работа с гостями"}],
        "denied": [{"code": "refunds", "label": "Возврат оплаты и сторно"}],
        "humanOnly": ["возврат оплаты и сторно начислений"],
    },
}


@dataclass
class Visitor:
    signed: bool
    user_id: str | None = None
    org_id: str | None = None


class FakeRequesters:
    def __init__(self, context: dict | None = CONTEXT, fail: bool = False) -> None:
        self.context, self.fail, self.asked = context, fail, []

    async def requester_context(self, *, user_id: str, org_id: str) -> dict | None:
        self.asked.append((user_id, org_id))
        if self.fail:
            raise RuntimeError("недоступно")
        return self.context


class P:
    def __init__(self, requesters) -> None:
        self.requesters = requesters


def _tool(name: str, requesters, visitor: Visitor | None):
    registry = build_registry(
        lambda: P(requesters),
        settings_getter=lambda: object(),
        visitor_getter=lambda: visitor,
    )
    spec = registry.get(name)
    assert spec is not None, f"инструмента {name} нет в реестре"
    return spec


NAMES = ["get_requester_context", "get_account_status", "get_permissions"]
SIGNED = Visitor(signed=True, user_id=USER, org_id=ORG)


@pytest.mark.parametrize("name", NAMES)
def test_tools_take_no_parameters_from_the_model(name: str) -> None:
    spec = _tool(name, FakeRequesters(), SIGNED)
    assert spec.parameters["properties"] == {}
    assert spec.parameters["required"] == []


@pytest.mark.parametrize("name", NAMES)
async def test_identity_comes_only_from_the_signature(name: str) -> None:
    requesters = FakeRequesters()
    await _tool(name, requesters, SIGNED).handler(organization_id=FOREIGN, user_id="someone-else")
    assert requesters.asked == [(USER, ORG)]


@pytest.mark.parametrize("name", NAMES)
async def test_anonymous_gets_nothing_and_the_platform_is_not_called(name: str) -> None:
    requesters = FakeRequesters()
    for visitor in (Visitor(signed=False), Visitor(signed=True, user_id=None, org_id=ORG), Visitor(True, USER, None), None):
        text = await _tool(name, requesters, visitor).handler()
        assert "не вошли" in text
    assert requesters.asked == []


@pytest.mark.parametrize("name", NAMES)
async def test_failures_and_unknown_pairs_are_an_honest_unknown(name: str) -> None:
    assert await _tool(name, FakeRequesters(fail=True), SIGNED).handler() == UNKNOWN
    assert await _tool(name, FakeRequesters(context=None), SIGNED).handler() == UNKNOWN
    assert await _tool(name, None, SIGNED).handler() == UNKNOWN


async def test_requester_context_says_who_writes_without_secrets() -> None:
    text = await _tool("get_requester_context", FakeRequesters(), SIGNED).handler()
    for part in ("Аня Тестова", "Администратор", "Тестовый отель", "Тестовый бизнес", "Филиал 1", "Hospitality"):
        assert part in text
    assert "a***@example.kz" in text
    assert USER not in text and ORG not in text


async def test_account_status_names_organization_and_subscription() -> None:
    text = await _tool("get_account_status", FakeRequesters(), SIGNED).handler()
    assert "Тестовый отель" in text and "ACTIVE" not in text
    assert "действует до 31.12.2026" in text


async def test_permissions_list_allowed_denied_and_human_only() -> None:
    text = await _tool("get_permissions", FakeRequesters(), SIGNED).handler()
    assert "Работа с гостями" in text
    assert "Возврат оплаты и сторно" in text
    assert "только человек" in text and "возврат оплаты и сторно начислений" in text
    assert "Выдать права" in text or "не выдаёт права" in text


# ── провайдер: дверь платформы ────────────────────────────────────────────────


def _provider(handler) -> WetopProviders:
    from src.config import get_settings

    settings = get_settings().model_copy(
        update={
            "integration_mode": "wetop",
            "integration_base_url": "https://wetop.example.com",
            "integration_api_key": "assistant-read-key",
        }
    )
    return WetopProviders(settings, httpx.AsyncClient(transport=httpx.MockTransport(handler)))


async def test_the_provider_asks_the_platform_door_with_the_signed_pair() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=CONTEXT)

    body = await _provider(handler).requester_context(user_id=USER, org_id=ORG)
    assert seen[0].url.path == PATH_REQUESTER_CONTEXT == "/assistant/requester-context"
    assert seen[0].url.params["userId"] == USER and seen[0].url.params["organizationId"] == ORG
    assert seen[0].headers["x-wetop-service-key"] == "assistant-read-key"
    assert body is not None and body["organization"]["name"] == "Тестовый отель"


async def test_the_provider_returns_none_when_the_platform_does_not_know_the_pair() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"message": "нет"})

    assert await _provider(handler).requester_context(user_id=USER, org_id=FOREIGN) is None
