"""S5: диагностика для WETOP Support — каналы, бронь по номеру, сводка «с чего начать».

Главное свойство — как в S4: аргументов «кто» и «какая организация» у инструментов нет, область берётся из подписи
посетителя. Модели уходит текст по белому списку: лишние поля сервера (ключи, адреса, имя гостя, заметки) до неё не
доходят. Люди, организации и брони вымышленные.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pytest

from src.ai.support_tools import NOT_SIGNED, UNKNOWN, build_registry
from src.ai.tools import TOOL_BAD_ARGS
from src.integrations.providers import Providers, ProviderUnavailable
from tests.support_fakes import (
    ORG_ID,
    USER_ID,
    FakeHealth,
    FakeIncidents,
    anon_visitor,
    call_tool,
    incident,
    signed_visitor,
    support_settings,
)

DIAGNOSTIC_TOOLS = ("get_integration_health", "get_reservation_status", "get_workspace_health")

CONNECTED = {
    "channex": {
        "state": "ATTENTION",
        "categories": {"mapped": 4, "total": 5},
        "ratePlansMapped": 2,
        "lastEventAgeMinutes": 7,
        "outbox": {"pending": 1, "failed": 0, "oldestPendingMinutes": 45},
        "webhook": {"suspect": True, "reachable": False},
        "problems": ["CATEGORIES_UNMAPPED", "WEBHOOK_SUSPECT", "WEBHOOK_UNREACHABLE", "OUTBOX_STUCK"],
    }
}

RESERVATION = {
    "number": "R-42",
    "status": "CONFIRMED",
    "arrivalDate": "2099-10-02",
    "departureDate": "2099-10-05",
    "nights": 3,
    "source": "OTA",
    "channel": "Booking.com",
    "guests": {"adults": 2, "children": 1},
    "items": [
        {"category": "Стандарт", "status": "CONFIRMED", "unitAssigned": True, "unitCode": "R07", "housekeeping": "INSPECTED"},
        {"category": "Койка", "status": "CONFIRMED", "unitAssigned": False, "unitCode": None, "housekeeping": None},
    ],
    "problems": ["UNASSIGNED_ITEMS"],
}

ACCOUNT_CONTEXT = {
    "requester": {"ref": "u_abc123", "role": "owner", "kind": "TENANT_USER"},
    "organization": {"displayName": "Гостиница А"},
    "scope": "ORGANIZATION",
    "businesses": [],
    "account": {"status": "ACTIVE", "canMutate": True, "trialEndsAt": None, "reasonCode": None},
    "permissions": {},
}


@dataclass
class FakeDiagnostics:
    integration: dict | None = field(default_factory=lambda: dict(CONNECTED))
    reservations: dict[str, dict] = field(default_factory=lambda: {"R-42": dict(RESERVATION)})
    fail: bool = False
    calls: list[tuple[str, dict]] = field(default_factory=list)

    async def integration_health(self, *, user_id: str, org_id: str) -> dict | None:
        self.calls.append(("integration_health", {"user_id": user_id, "org_id": org_id}))
        if self.fail:
            raise ProviderUnavailable("платформа недоступна")
        return self.integration

    async def reservation_status(self, *, user_id: str, org_id: str, number: str) -> dict | None:
        self.calls.append(("reservation_status", {"user_id": user_id, "org_id": org_id, "number": number}))
        if self.fail:
            raise ProviderUnavailable("платформа недоступна")
        return self.reservations.get(number)


class FakeRequesters:
    def __init__(self, result: dict | None = ACCOUNT_CONTEXT) -> None:
        self.result = result

    async def requester_context(self, *, user_id: str, org_id: str) -> dict | None:
        return self.result


def providers(*, diagnostics=None, health=None, requesters=None, incidents=None) -> Providers:
    return Providers(
        orders=None, customers=None, availability=None, leads=None, mode="fake",
        incidents=incidents, health=health, requesters=requesters, diagnostics=diagnostics,
    )


def registry(source: Providers, visitor=None):
    settings = support_settings()
    return build_registry(lambda: source, settings_getter=lambda: settings, visitor_getter=lambda: visitor)


SIGNED = signed_visitor()


# ─── Реестр и область ───


def test_diagnostic_tools_are_registered() -> None:
    names = [spec["function"]["name"] for spec in registry(providers()).specs_for_openai()]
    for name in DIAGNOSTIC_TOOLS:
        assert name in names


def test_tools_have_no_scope_arguments() -> None:
    specs = {spec["function"]["name"]: spec["function"]["parameters"] for spec in registry(providers()).specs_for_openai()}
    for name in DIAGNOSTIC_TOOLS:
        keys = set(specs[name].get("properties", {}))
        assert keys <= {"number"}, name
        for banned in ("organization", "user", "tenant", "business", "location", "scope"):
            assert not any(banned in key.lower() for key in keys), (name, keys)


@pytest.mark.asyncio
async def test_model_cannot_pass_foreign_organization() -> None:
    diagnostics = FakeDiagnostics()
    reg = registry(providers(diagnostics=diagnostics), SIGNED)
    assert await call_tool(reg, "get_integration_health", organization_id="other") == TOOL_BAD_ARGS
    assert await call_tool(reg, "get_reservation_status", number="R-42", org_id="other") == TOOL_BAD_ARGS
    assert await call_tool(reg, "get_workspace_health", user_id="99") == TOOL_BAD_ARGS
    assert diagnostics.calls == []


@pytest.mark.asyncio
@pytest.mark.parametrize("tool,args", [("get_integration_health", {}), ("get_reservation_status", {"number": "R-42"}), ("get_workspace_health", {})])
async def test_anonymous_visitor_is_refused(tool: str, args: dict) -> None:
    diagnostics = FakeDiagnostics()
    reg = registry(providers(diagnostics=diagnostics, health=FakeHealth(), requesters=FakeRequesters()), anon_visitor())
    assert await call_tool(reg, tool, **args) == NOT_SIGNED
    assert diagnostics.calls == []


# ─── Каналы ───


@pytest.mark.asyncio
async def test_integration_health_goes_with_the_signed_pair_and_speaks_words() -> None:
    diagnostics = FakeDiagnostics()
    text = await call_tool(registry(providers(diagnostics=diagnostics), SIGNED), "get_integration_health")
    assert diagnostics.calls == [("integration_health", {"user_id": USER_ID, "org_id": ORG_ID})]
    for expected in ("требует внимания", "4 из 5", "тарифов сопоставлено: 2", "7 мин", "ждут 1", "45 мин", "под подозрением", "адрес webhook недоступен"):
        assert expected in text, (expected, text)


@pytest.mark.asyncio
async def test_integration_not_connected_is_said_plainly() -> None:
    text = await call_tool(registry(providers(diagnostics=FakeDiagnostics(integration={"channex": None})), SIGNED), "get_integration_health")
    assert "не подключены" in text
    assert "внимания" not in text


@pytest.mark.asyncio
async def test_integration_extra_server_fields_never_reach_the_model() -> None:
    leaky = {"channex": {**CONNECTED["channex"], "apiKey": "sk-secret-123", "callbackUrl": "https://hook.example/x", "propertyId": "prop-uuid"}}
    text = await call_tool(registry(providers(diagnostics=FakeDiagnostics(integration=leaky)), SIGNED), "get_integration_health")
    for banned in ("sk-secret", "hook.example", "prop-uuid", "apiKey"):
        assert banned not in text


@pytest.mark.asyncio
async def test_integration_failures_are_unknown_not_healthy() -> None:
    assert await call_tool(registry(providers(diagnostics=FakeDiagnostics(fail=True)), SIGNED), "get_integration_health") == UNKNOWN
    assert await call_tool(registry(providers(diagnostics=None), SIGNED), "get_integration_health") == UNKNOWN
    not_member = await call_tool(registry(providers(diagnostics=FakeDiagnostics(integration=None)), SIGNED), "get_integration_health")
    assert "не нашёл вас" in not_member


# ─── Бронь ───


@pytest.mark.asyncio
async def test_reservation_number_is_validated_before_the_platform_is_asked() -> None:
    diagnostics = FakeDiagnostics()
    reg = registry(providers(diagnostics=diagnostics), SIGNED)
    for bad in ("R 42", "", "x" * 41, "R-42; drop"):
        text = await call_tool(reg, "get_reservation_status", number=bad)
        assert "номер брони" in text.lower() and "R-42" not in text
    assert diagnostics.calls == []


@pytest.mark.asyncio
async def test_reservation_status_text_has_facts_and_nothing_personal() -> None:
    diagnostics = FakeDiagnostics(reservations={"R-42": {**RESERVATION, "primaryGuest": {"label": "Тестовый Гость", "phone": "+77770000000"}, "notes": "позвонить", "id": "res-uuid"}})
    text = await call_tool(registry(providers(diagnostics=diagnostics), SIGNED), "get_reservation_status", number="R-42")
    assert diagnostics.calls == [("reservation_status", {"user_id": USER_ID, "org_id": ORG_ID, "number": "R-42"})]
    for expected in ("R-42", "подтверждена", "02.10.2099", "05.10.2099", "3 ноч", "Booking.com", "2 взр", "1 реб", "Стандарт", "R07", "проверена", "Койка", "ячейка не назначена", "без ячейки"):
        assert expected in text, (expected, text)
    for banned in ("Тестовый", "7777", "позвонить", "res-uuid"):
        assert banned not in text


@pytest.mark.asyncio
async def test_reservation_not_found_and_failures() -> None:
    reg = registry(providers(diagnostics=FakeDiagnostics()), SIGNED)
    assert "не нашёл бронь" in await call_tool(reg, "get_reservation_status", number="R-404")
    assert await call_tool(registry(providers(diagnostics=FakeDiagnostics(fail=True)), SIGNED), "get_reservation_status", number="R-42") == UNKNOWN


# ─── Сводка ───


@pytest.mark.asyncio
async def test_workspace_health_composes_account_platform_channels_and_errors() -> None:
    incidents = FakeIncidents(items=[incident(), incident(minutes_ago=30, summary="не открылся отчёт", section="Отчёты")])
    source = providers(diagnostics=FakeDiagnostics(), health=FakeHealth(), requesters=FakeRequesters(), incidents=incidents)
    text = await call_tool(registry(source, SIGNED), "get_workspace_health")
    for expected in ("Аккаунт: ACTIVE", "Платформа: всё работает", "Каналы: требует внимания", "Ошибок за 24 ч: 2"):
        assert expected in text, (expected, text)
    assert incidents.args_of("recent_for_user")[0]["user_id"] == USER_ID


@pytest.mark.asyncio
async def test_workspace_health_survives_partial_failures() -> None:
    source = providers(diagnostics=FakeDiagnostics(fail=True), health=FakeHealth(fail=True), requesters=FakeRequesters(), incidents=FakeIncidents())
    text = await call_tool(registry(source, SIGNED), "get_workspace_health")
    assert "Аккаунт: ACTIVE" in text
    assert f"Платформа: {UNKNOWN}" in text
    assert f"Каналы: {UNKNOWN}" in text
    assert "ошибок у вас не записано" in text
