"""Таблица «номер, на который звонили -> организация и агент».

Один воркер обслуживает много объектов. Звонок привязывается к agent_id по
номеру. Неизвестный номер не получает разговора: чужой звонок не должен
попасть к чужому продавцу (изоляция агентов, apps/ai-seller/AGENTS.md).
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass

from voice.phone import normalize_e164


class NumberMapError(ValueError):
    """Сломанная настройка. Падаем при старте, а не посреди звонка."""


@dataclass(frozen=True)
class Route:
    organization_id: str
    agent_id: str


def _uuid(value: object, what: str) -> str:
    try:
        return str(uuid.UUID(str(value)))
    except (ValueError, AttributeError):
        raise NumberMapError(f"{what}: не UUID") from None


class NumberMap:
    def __init__(self, routes: dict[str, Route]) -> None:
        self._routes = routes

    @classmethod
    def from_json(cls, text: str | None) -> "NumberMap":
        if not text or not text.strip():
            return cls({})
        try:
            data = json.loads(text)
        except ValueError:
            raise NumberMapError("VOICE_NUMBER_MAP: не JSON") from None
        if not isinstance(data, dict):
            raise NumberMapError("VOICE_NUMBER_MAP: ожидался объект")
        routes: dict[str, Route] = {}
        for number, row in data.items():
            key = normalize_e164(number)
            if key is None:
                raise NumberMapError("VOICE_NUMBER_MAP: ключ не номер")
            if key in routes:
                raise NumberMapError("VOICE_NUMBER_MAP: номер повторяется")
            if not isinstance(row, dict):
                raise NumberMapError("VOICE_NUMBER_MAP: строка не объект")
            routes[key] = Route(
                organization_id=_uuid(row.get("organization_id"), "organization_id"),
                agent_id=_uuid(row.get("agent_id"), "agent_id"),
            )
        return cls(routes)

    def __len__(self) -> int:
        return len(self._routes)

    def allows(self, route: Route) -> bool:
        """Пара организация и агент есть в настройке: чужую пару не принимаем."""
        return route in self._routes.values()

    def sole_route(self) -> Route | None:
        """Единственный маршрут, если номер один: чужому объекту достаться некому."""
        return next(iter(self._routes.values())) if len(self._routes) == 1 else None

    def resolve(self, dialed: object) -> Route | None:
        key = normalize_e164(dialed)
        return self._routes.get(key) if key else None


def route_from_metadata(meta: object) -> Route | None:
    """Маршрут из metadata правила маршрутизации (его задаёт владелец в панели VideoSDK)."""
    if not isinstance(meta, dict):
        return None
    try:
        return Route(
            organization_id=_uuid(meta.get("organization_id"), "organization_id"),
            agent_id=_uuid(meta.get("agent_id"), "agent_id"),
        )
    except NumberMapError:
        return None


def decide_route(meta: object, numbers: NumberMap) -> Route | None:
    """Маршрут звонка. Закрыто по умолчанию.

    Нет metadata: единственный настроенный маршрут (однообъектный режим).
    Есть metadata, но она битая или её пары нет в настройке: отказ, без запасного пути,
    иначе звонок чужого объекта достался бы первому.
    """
    if isinstance(meta, str):
        text = meta.strip()
        if text in ("", "null"):
            meta = None
        else:
            try:
                meta = json.loads(text)
            except ValueError:
                return None
    if meta is None or meta == {}:
        return numbers.sole_route()
    route = route_from_metadata(meta)
    if route is None or not numbers.allows(route):
        return None
    return route
