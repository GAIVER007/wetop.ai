"""С5 «под ключ»: техподдержка видит клиента и подписку (Q-187, рекомендация).

В стойке ничего называть не нужно: подпись виджета уже говорит, из какой
организации пишет человек, — инструмент берёт её организацию. «Назвать ID»
(UUID организации, точное совпадение) — только обращению без подписи.
Наружу — название, статус и срок расширения; денег и гостей в ответе нет.
Возвраты и продление бот не делает и не обещает — заявка владельцу.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

import httpx
import pytest

from src.ai.support_tools import UNKNOWN, build_registry
from src.integrations.wetop import PATH_ORGANIZATION, WetopProviders

ORG = "5d2f1a9e-8c7b-4e3a-a1f0-6b9c2d4e8f00"
FOREIGN = "9f8e7d6c-5b4a-4392-8171-000000000000"

CARD = {
    "id": ORG,
    "name": "Гостиница А",
    "status": "ACTIVE",
    "createdAt": "2026-09-01T00:00:00.000Z",
    "aiSeller": {"access": "active", "status": "PAID", "activeUntil": "2026-12-31", "daysLeft": 97},
}


@dataclass
class Visitor:
    signed: bool
    user_id: str | None = None
    org_id: str | None = None


class FakeSubscriptions:
    def __init__(self, card: dict | None = CARD, fail: bool = False) -> None:
        self.card, self.fail, self.asked = card, fail, []

    async def organization_card(self, organization_id: str) -> dict | None:
        self.asked.append(organization_id)
        if self.fail:
            raise RuntimeError("недоступно")
        return self.card


class P:
    def __init__(self, subs) -> None:
        self.subscriptions = subs


def _tool(subs, visitor: Visitor | None):
    registry = build_registry(
        lambda: P(subs),
        settings_getter=lambda: object(),
        visitor_getter=lambda: visitor,
    )
    handler = registry.get("my_subscription")
    assert handler is not None, "инструмента my_subscription нет в реестре"
    return handler


async def test_signed_visitor_gets_their_own_subscription_by_signature() -> None:
    subs = FakeSubscriptions()
    text = await _tool(subs, Visitor(signed=True, user_id="u1", org_id=ORG)).handler()
    assert subs.asked == [ORG]
    assert "Гостиница А" in text
    assert "31.12.2026" in text or "2026-12-31" in text
    # денег и почт в ответе нет
    assert "₸" not in text and "@" not in text


async def test_a_named_id_of_someone_else_does_not_beat_the_signature() -> None:
    """Подписанный ход: чужой UUID в аргументе не открывает чужую подписку."""
    subs = FakeSubscriptions()
    text = await _tool(subs, Visitor(signed=True, user_id="u1", org_id=ORG)).handler(
        organization_id=FOREIGN
    )
    assert subs.asked == [ORG]
    assert "Гостиница А" in text


async def test_without_a_signature_the_tool_asks_for_the_id_and_uses_it() -> None:
    subs = FakeSubscriptions()
    ask = await _tool(subs, Visitor(signed=False)).handler()
    assert "ID" in ask and subs.asked == []
    text = await _tool(subs, Visitor(signed=False)).handler(organization_id=ORG)
    assert subs.asked == [ORG] and "Гостиница А" in text
    # кривой ID — просьба назвать точный, а не поиск похожего
    bad = await _tool(subs, Visitor(signed=False)).handler(organization_id="hotel-a")
    assert "ID" in bad and subs.asked == [ORG]


async def test_failures_are_an_honest_unknown() -> None:
    assert await _tool(FakeSubscriptions(fail=True), Visitor(True, "u1", ORG)).handler() == UNKNOWN
    assert await _tool(None, Visitor(True, "u1", ORG)).handler() == UNKNOWN
    missing = FakeSubscriptions(card=None)
    text = await _tool(missing, Visitor(signed=False)).handler(organization_id=FOREIGN)
    assert "не наш" in text or "не найдена" in text


async def test_the_expired_extension_is_said_plainly() -> None:
    subs = FakeSubscriptions(
        card={**CARD, "aiSeller": {"access": "expired", "status": "PAID", "activeUntil": "2026-09-01", "daysLeft": None}}
    )
    text = await _tool(subs, Visitor(True, "u1", ORG)).handler()
    assert "истёк" in text or "вышел" in text


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


async def test_the_provider_asks_the_platform_door_with_the_id() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=CARD)

    card = await _provider(handler).organization_card(ORG)
    assert seen[0].url.path == PATH_ORGANIZATION == "/assistant/organization"
    assert seen[0].url.params["id"] == ORG
    assert seen[0].headers["x-wetop-service-key"] == "assistant-read-key"
    assert card is not None and card["name"] == "Гостиница А"


async def test_the_provider_returns_none_for_an_unknown_organization() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"message": "нет такой организации"})

    assert await _provider(handler).organization_card(FOREIGN) is None
