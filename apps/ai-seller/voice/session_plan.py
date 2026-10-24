"""Решение о звонке до начала разговора: чей он и с каким профилем (без SDK, тестируется отдельно).

Маршрут берётся из metadata правила маршрутизации; профиль объекта читается с платформы по `agent_id`, и платформа же
подтверждает, что агент существует и принадлежит этой организации. Платформа недоступна: профиль из окружения только
для воркера, настроенного ровно на один маршрут; иначе вежливый отказ без перевода звонка.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from voice.numbers import NumberMap, Route, decide_route
from voice.platform import ProfileNotFound, ProfileUnavailable
from voice.profile import VoiceProfile


@dataclass(frozen=True)
class PlanOk:
    route: Route
    profile: VoiceProfile
    source: Literal["platform", "env"]


@dataclass(frozen=True)
class PlanRejected:
    reason: str


async def plan_call(meta: object, numbers: NumberMap, client, fallback: VoiceProfile) -> PlanOk | PlanRejected:
    route = decide_route(meta, numbers)
    if route is None:
        return PlanRejected("unknown_number")
    try:
        data = await client.get_profile(route.agent_id)
    except ProfileNotFound:
        return PlanRejected("unknown_agent")
    except ProfileUnavailable:
        # Профиль из окружения принадлежит одному объекту. Отдать его можно, только если воркер настроен ровно на этот
        # маршрут; иначе звонок чужого объекта услышал бы чужое имя и ушёл бы на чужого администратора (ревью H1)
        if len(numbers) == 1 and numbers.sole_route() == route:
            return PlanOk(route, fallback, "env")
        return PlanRejected("profile_unavailable")
    if data.agent_id.lower() != route.agent_id.lower():
        return PlanRejected("agent_mismatch")
    if data.organization_id.lower() != route.organization_id.lower():
        return PlanRejected("org_mismatch")
    return PlanOk(route, VoiceProfile.from_api(data), "platform")
