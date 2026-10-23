"""Бронь гостиницы по телефону: адреса платформы `/voice/availability` и `/voice/booking-quotes` (без SDK).

Свободное читается ключом приёма событий, котировка и подтверждение пишутся отдельным ключом записи голоса: утечка одного
не открывает другое. Тексты ошибок не несут адресов, ключей и тел ответов: причину модель не слышит.
"""

from __future__ import annotations

import logging

import httpx

logger = logging.getLogger(__name__)

KEY_HEADER = "x-wetop-service-key"
PATH_AVAILABILITY = "/voice/availability"
PATH_QUOTE = "/voice/booking-quotes"
PATH_CONFIRM = "/voice/booking-quotes/confirm"
# Отказ по существу: нет мест, цена не задана, лимит звонка, выключено, чужая котировка. Остальное сбой связи или настройки
REFUSAL_STATUSES = (400, 404, 409, 422, 429)


class BookingRefused(Exception):
    """Платформа отказала по существу: вариант недоступен."""


class BookingUnavailable(Exception):
    """Платформа не ответила или ключ не принят: работает администратор."""


class VoiceBooking:
    def __init__(
        self, *, base_url: str, read_key: str, book_key: str, http: httpx.AsyncClient, timeout: float = 6.0
    ) -> None:
        self._base = base_url.rstrip("/")
        self._read_key = read_key
        self._book_key = book_key
        self._http = http
        self._timeout = timeout

    async def availability(self, agent: str, call: str, arrival: str, departure: str, adults: int) -> dict:
        params = {"agent": agent, "call": call, "arrival": arrival, "departure": departure, "adults": str(adults)}
        return await self._send("GET", PATH_AVAILABILITY, self._read_key, params=params)

    async def quote(self, agent: str, call: str, category: str, arrival: str, departure: str, adults: int) -> dict:
        body = {
            "agent": agent, "call": call, "category": category,
            "arrival": arrival, "departure": departure, "adults": adults,
        }
        return await self._send("POST", PATH_QUOTE, self._book_key, json=body)

    async def confirm(self, agent: str, call: str, intent: str, guest: dict) -> dict:
        body = {"agent": agent, "call": call, "intent": intent, "consent": True, "guest": guest}
        return await self._send("POST", PATH_CONFIRM, self._book_key, json=body)

    async def _send(self, method: str, path: str, key: str, **kwargs) -> dict:
        try:
            response = await self._http.request(
                method, f"{self._base}{path}", headers={KEY_HEADER: key}, timeout=self._timeout, **kwargs
            )
        except Exception as exc:  # noqa: BLE001 - текст исключения несёт адрес
            logger.warning("бронь: нет связи с платформой (%s)", type(exc).__name__)
            raise BookingUnavailable("connection") from None
        status = response.status_code
        if status in REFUSAL_STATUSES:
            raise BookingRefused(f"status_{status}")
        if status not in (200, 201):
            if status in (401, 403):
                logger.error("бронь: платформа не приняла ключ (код %s)", status)
            raise BookingUnavailable(f"status_{status}")
        try:
            body = response.json()
        except ValueError:
            raise BookingUnavailable("bad_body") from None
        if not isinstance(body, dict):
            raise BookingUnavailable("bad_body")
        return body
