"""Server-bound tools for one seller turn. No user-selected scope or global registry swap."""
from __future__ import annotations
import json
import re
import uuid
from functools import wraps
from zoneinfo import ZoneInfo
from src import dependencies
from src.ai.tools import ToolRegistry, ToolSpec, TOOL_FAILED
from src.ai.hotel_tools import build_registry as hotel_registry

CAPS = {
    "HOSPITALITY": {"hotel.availability", "hotel.price", "hotel.booking"},
    "BEAUTY": {"beauty.services"},
    "FOOD_SERVICE": {"food.servicePeriods"},
}


def binding(raw):
    if not isinstance(raw, dict) or set(raw) != {"agentId", "organizationId", "businessId", "locationId",
                                                "vertical", "timezone", "currency", "capabilities"}:
        raise ValueError("invalid context")
    for key in ("agentId", "organizationId", "businessId", "locationId"):
        uuid.UUID(raw[key])
    if raw["agentId"] != dependencies.get_current_agent_id() or raw["organizationId"] != dependencies.get_current_organization_id():
        raise ValueError("foreign context")
    vertical = raw["vertical"]
    if vertical not in CAPS or not isinstance(raw["capabilities"], list) or len(raw["capabilities"]) != len(CAPS[vertical]) or set(raw["capabilities"]) != CAPS[vertical]:
        raise ValueError("invalid capabilities")
    ZoneInfo(raw["timezone"])
    if not isinstance(raw["currency"], str) or not re.fullmatch(r"[A-Z]{3}", raw["currency"]):
        raise ValueError("invalid currency")
    return tuple(raw[k] for k in ("agentId", "organizationId", "businessId", "locationId", "vertical", "timezone", "currency"))


def catalog(raw, expected, vertical):
    if not isinstance(raw, dict) or set(raw) != {"context", "items"} or binding(raw["context"]) != expected:
        raise ValueError("changed catalog scope")
    rows = raw["items"]
    if not isinstance(rows, list):
        raise ValueError("invalid catalog")
    for row in rows:
        fields = ({"name", "category", "durationMinutes", "priceMinor", "currency"} if vertical == "BEAUTY" else
                  {"name", "weekday", "timeFrom", "timeTo", "endsNextDay", "defaultDurationMinutes"})
        if not isinstance(row, dict) or set(row) != fields or not isinstance(row["name"], str) or not row["name"].strip():
            raise ValueError("invalid item")
        if vertical == "BEAUTY":
            if not isinstance(row["priceMinor"], str) or not re.fullmatch(r"\d+", row["priceMinor"]):
                raise ValueError("invalid price")
            if not isinstance(row["currency"], str) or not re.fullmatch(r"[A-Z]{3}", row["currency"]):
                raise ValueError("invalid currency")
            if row["category"] is not None and not isinstance(row["category"], str):
                raise ValueError("invalid category")
            duration = row["durationMinutes"]
        else:
            if type(row["weekday"]) is not int or not 0 <= row["weekday"] <= 6 or type(row["endsNextDay"]) is not bool:
                raise ValueError("invalid period")
            for key in ("timeFrom", "timeTo"):
                if not isinstance(row[key], str) or not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", row[key]):
                    raise ValueError("invalid time")
            duration = row["defaultDurationMinutes"]
        if type(duration) is not int or duration <= 0:
            raise ValueError("invalid duration")
    return json.dumps(rows, ensure_ascii=False)


async def build_vertical_registry(providers_getter, *, booking=None):
    providers = providers_getter()
    # Only an anonymous explicit demo may use legacy non-WETOP tools.
    if getattr(providers, "mode", None) != "wetop":
        if providers.mode == 'stub' and not dependencies.get_current_agent_id() and not dependencies.get_current_organization_id():
            return hotel_registry(providers_getter, booking=booking)
        return ToolRegistry()
    provider = getattr(providers, "availability", None)
    result = ToolRegistry()
    try:
        raw = await provider.agent_context()
        expected = binding(raw)
    except Exception:
        return result
    vertical = raw["vertical"]
    result.system_message = {
        "BEAUTY": "Вы представляете салон красоты. Доступен только каталог услуг. Запись и оплату уточняет администратор.",
        "FOOD_SERVICE": "Вы представляете ресторан. Доступны только периоды обслуживания. Наличие столов и бронь уточняет администратор.",
        "HOSPITALITY": "Вы представляете гостиницу. Используйте только предоставленные гостиничные инструменты.",
    }[vertical]
    if vertical == "FOOD_SERVICE":
        result.system_message += f" Время периодов местное, часовой пояс филиала: {raw["timezone"]}."
    if vertical == "HOSPITALITY":
        source = hotel_registry(providers_getter, booking=booking)
    else:
        source = ToolRegistry()
        async def read_catalog():
            read = provider.beauty_services if vertical == "BEAUTY" else provider.food_service_periods
            return catalog(await read(), expected, vertical)
        source.register(ToolSpec(
            name="get_beauty_services" if vertical == "BEAUTY" else "get_food_service_periods",
            description=("Активные услуги этого салона: цены каталога и длительность. Это не итог записи и не оплата."
                         if vertical == "BEAUTY" else "Периоды обслуживания этого ресторана. weekday: 0=воскресенье, 1=понедельник, 2=вторник, 3=среда, 4=четверг, 5=пятница, 6=суббота. Это не наличие свободных столов."),
            parameters={"type": "object", "properties": {}, "additionalProperties": False},
            handler=read_catalog,
        ))
    def protect(handler):
        @wraps(handler)
        async def guarded(*args, **kwargs):
            try:
                if binding(await provider.agent_context()) != expected:
                    return TOOL_FAILED
                return await handler(*args, **kwargs)
            except Exception:
                return TOOL_FAILED
        return guarded
    for name in source.names:
        spec = source.get(name)
        result.register(ToolSpec(name=spec.name, description=spec.description, parameters=spec.parameters,
                                 handler=protect(spec.handler)))
    return result
