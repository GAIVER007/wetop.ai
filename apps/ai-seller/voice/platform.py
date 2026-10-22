"""Клиент API платформы для голосового воркера: отправка событий и профиль агента.

Ключ уходит заголовком `x-wetop-service-key`, не адресом. Тексты ошибок не несут адресов, ключей и тел ответов.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Callable

import httpx

from voice.journal import CallState
from voice.numbers import Route
from voice.outbox import Outbox

logger = logging.getLogger(__name__)

VERTICALS = ("HOSPITALITY", "BEAUTY", "FOOD_SERVICE")
KEY_HEADER = "x-wetop-service-key"
PATH_EVENTS = "/voice/events"
PATH_PROFILE = "/voice/profile"


class SendResult(str, Enum):
    OK = "ok"
    RETRY = "retry"
    # 404 и 422 бывают от выкладки без маршрута, неверного адреса или агента без филиала: повторяем ограниченно, потом откладываем
    RETRY_LIMITED = "retry_limited"
    REJECT = "reject"


class ProfileNotFound(Exception):
    """Платформа не знает такого агента или у него нет филиала: разговора не будет."""


class ProfileUnavailable(Exception):
    """Платформа не ответила: можно работать с профилем из окружения."""


@dataclass(frozen=True)
class ProfileData:
    agent_id: str
    organization_id: str
    vertical: str
    object_name: str
    greeting_tail: str
    voice_name: str
    handoff_phone: str | None


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class PlatformClient:
    def __init__(
        self, *, base_url: str, key: str, http: httpx.AsyncClient, timeout: float = 8.0, profile_timeout: float = 4.0
    ) -> None:
        self._base = base_url.rstrip("/")
        self._key = key
        self._http = http
        self._timeout = timeout
        self._profile_timeout = profile_timeout

    async def send_event(self, payload: dict) -> SendResult:
        try:
            response = await self._http.post(
                f"{self._base}{PATH_EVENTS}", json=payload, headers={KEY_HEADER: self._key}, timeout=self._timeout
            )
        except Exception as exc:  # noqa: BLE001 - текст исключения несёт адрес
            logger.warning("события: нет связи с платформой (%s)", type(exc).__name__)
            return SendResult.RETRY
        status = response.status_code
        if status in (200, 201):
            return SendResult.OK
        if status in (401, 403):
            # ключ не принят: это настройка, а не вина события. События ждут, пока владелец исправит ключ
            logger.error("события: платформа не приняла ключ (код %s)", status)
            return SendResult.RETRY
        if status in (404, 422):
            logger.error("события: платформа ответила %s, событие будет повторено ограниченно", status)
            return SendResult.RETRY_LIMITED
        if status in (408, 429) or status >= 500:
            return SendResult.RETRY
        logger.error("события: платформа отвергла событие (код %s)", status)
        return SendResult.REJECT

    async def get_profile(self, agent_id: str) -> ProfileData:
        try:
            response = await self._http.get(
                f"{self._base}{PATH_PROFILE}",
                params={"agent": agent_id},
                headers={KEY_HEADER: self._key},
                timeout=self._profile_timeout,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("профиль: нет связи с платформой (%s)", type(exc).__name__)
            raise ProfileUnavailable("connection") from None
        if response.status_code in (404, 422):
            raise ProfileNotFound(str(response.status_code))
        if response.status_code in (401, 403):
            logger.error("профиль: платформа не приняла ключ (код %s)", response.status_code)
        if response.status_code != 200:
            raise ProfileUnavailable(f"status_{response.status_code}")
        try:
            body = response.json()
            vertical = body["vertical"]
            if vertical not in VERTICALS:
                raise ValueError("vertical")
            return ProfileData(
                agent_id=str(body["agentId"]),
                organization_id=str(body["organizationId"]),
                vertical=vertical,
                object_name=str(body["objectName"]),
                greeting_tail=str(body.get("greetingTail") or ""),
                voice_name=str(body.get("voiceName") or "Leda"),
                handoff_phone=body.get("handoffPhone") or None,
            )
        except (ValueError, KeyError, TypeError):
            raise ProfileUnavailable("bad_body") from None


class PlatformEvents:
    """Складывает события звонка в очередь. Не бросает исключений: звонок важнее отчётности."""

    def __init__(self, outbox: Outbox, *, now: Callable[[], datetime] = _utc_now) -> None:
        self._outbox = outbox
        self._now = now

    def _put(self, call_id: str, route: Route, state: CallState, extra: dict) -> None:
        payload = {
            "agentId": route.agent_id,
            "externalCallId": call_id,
            "state": state.value,
            "occurredAt": self._now().isoformat(),
            **{k: v for k, v in extra.items() if v not in (None, "")},
        }
        self._outbox.enqueue(payload)

    def state(
        self,
        call_id: str,
        route: Route,
        state: CallState,
        *,
        caller_masked: str | None = None,
        dialed: str | None = None,
        end_reason: str | None = None,
        error_code: str | None = None,
    ) -> None:
        self._put(
            call_id, route, state,
            {"callerMasked": caller_masked, "dialedNumber": dialed, "endReason": end_reason, "errorCode": error_code},
        )

    def callback(self, call_id: str, route: Route, phone: str, name: str, note: str) -> None:
        self._put(call_id, route, CallState.ANSWERED, {"callback": {"phone": phone, "name": name, "note": note}})

    def transfer(self, call_id: str, route: Route) -> None:
        self._put(call_id, route, CallState.ANSWERED, {"transferRequested": True})
