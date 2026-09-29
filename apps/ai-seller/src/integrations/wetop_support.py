"""Помощник платформы поверх клиента WETOP (ТЗ интеграции, Б1 поверх П4; С5).

Вынесено из wetop.py, чтобы каждый файл читался целиком (предел ~300 строк):
здесь всё, что нужно только роли support, — ошибки человека, состояние
платформы и карточка организации для техподдержки (Q-187). Ключ этих
запросов — ASSISTANT_READ_KEY платформы (у бота он в INTEGRATION_API_KEY);
`_request` даёт основной класс (`WetopProviders`).
"""

from __future__ import annotations

import logging
from datetime import datetime

from src.integrations.providers import HealthReport, Incident, ProviderUnavailable
from src.integrations.wetop_parse import parse_health, parse_incident, pick

logger = logging.getLogger(__name__)

PATH_ERRORS = "/assistant/errors"
PATH_GUARD_STATUS = "/guard/status"
# С5: карточка организации — второй адрес узкого ключа помощника.
PATH_ORGANIZATION = "/assistant/organization"
# S4: контекст обратившегося — третий адрес узкого ключа помощника.
PATH_REQUESTER = "/assistant/requester"
# S5: диагностика — четвёртый и пятый адреса узкого ключа помощника.
PATH_INTEGRATIONS = "/assistant/integrations"
PATH_RESERVATION = "/assistant/reservation"


class WetopSupportMixin:
    async def recent_for_user(
        self, *, user_id: str | None, org_id: str | None, since: datetime, limit: int
    ) -> list[Incident]:
        """Ошибки, которые видел этот человек. Спрашиваем только о подписанном:
        userId и organizationId обязательны и в контракте платформы."""
        if not user_id or not org_id:
            return []
        body = await self._request(
            "GET",
            PATH_ERRORS,
            params={
                "userId": user_id,
                "organizationId": org_id,
                "since": since.isoformat(),
                "limit": limit,
            },
        )
        # Обёртка «items», а не «errors»: поле errors проверка тела считает
        # признаком отказа, и каждый удачный ответ читался бы как сбой.
        items = body.get("items")
        if not isinstance(items, list):
            raise ProviderUnavailable("bad_body")
        out: list[Incident] = []
        for item in items:
            incident = parse_incident(item)
            if incident is None:
                # Кривая запись не роняет ответ: остальные ошибки человеку нужнее.
                logger.warning("wetop %s: запись без времени или текста пропущена", PATH_ERRORS)
                continue
            out.append(incident)
        return out[:limit]

    async def search(self, *, text: str, since: datetime, limit: int) -> list[Incident]:
        """Поиска по журналу у платформы нет: честно пусто, а не догадка."""
        return []

    async def status(self) -> HealthReport:
        """Состояние из сторожа платформы. 🔴 Берём только «в порядке или нет»
        и короткий список сбоев: в ответе сторожа есть адреса получателей
        оповещений, и пользователю помощника они уходить не должны."""
        return parse_health(await self._request("GET", PATH_GUARD_STATUS))

    async def organization_card(self, organization_id: str) -> dict | None:
        """Карточка организации для техподдержки (С5, Q-187): название, статус,
        срок расширения — денег и гостей в ней нет. 404 — None: «не наш
        клиент» отличается от сбоя платформы."""
        try:
            body = await self._request("GET", PATH_ORGANIZATION, params={"id": organization_id})
        except ProviderUnavailable as failure:
            if str(failure) == "api_error_404":
                return None
            raise
        name = pick(body, ("name",))
        if not isinstance(name, str) or not name.strip():
            raise ProviderUnavailable("bad_body")
        return body

    async def requester_context(self, *, user_id: str, org_id: str) -> dict | None:
        """Контекст обратившегося (S4). Пара — из подписи посетителя; платформа сверяет её с членством.
        404 — такого сотрудника в организации нет: это не сбой платформы, а «нет такого»."""
        try:
            body = await self._request(
                "GET", PATH_REQUESTER, params={"userId": user_id, "organizationId": org_id}
            )
        except ProviderUnavailable as failure:
            if str(failure) == "api_error_404":
                return None
            raise
        if not isinstance(body.get("requester"), dict) or not isinstance(body.get("account"), dict):
            raise ProviderUnavailable("bad_body")
        return body

    async def integration_health(self, *, user_id: str, org_id: str) -> dict | None:
        """Состояние каналов продаж организации (S5). 404 — обратившегося в организации нет."""
        try:
            body = await self._request(
                "GET", PATH_INTEGRATIONS, params={"userId": user_id, "organizationId": org_id}
            )
        except ProviderUnavailable as failure:
            if str(failure) == "api_error_404":
                return None
            raise
        if "channex" not in body:
            raise ProviderUnavailable("bad_body")
        return body

    async def reservation_status(self, *, user_id: str, org_id: str, number: str) -> dict | None:
        """Бронь по номеру среди объектов организации (S5). 404 — нет такой (чужая или несуществующая — одинаково)."""
        try:
            body = await self._request(
                "GET",
                PATH_RESERVATION,
                params={"userId": user_id, "organizationId": org_id, "number": number},
            )
        except ProviderUnavailable as failure:
            if str(failure) == "api_error_404":
                return None
            raise
        if not isinstance(body.get("number"), str) or not isinstance(body.get("items"), list):
            raise ProviderUnavailable("bad_body")
        return body
