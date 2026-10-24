"""Чтение справочников объекта из WETOP (те же адреса /bot/*, что у текстового продавца)."""

from __future__ import annotations

import logging

import httpx

logger = logging.getLogger(__name__)

# Заголовок узкого ключа: платформа читает служебные ключи из него.
# Ключ уходит заголовком, а не параметром адреса: адреса пишутся в журналы прокси.
KEY_HEADER = "x-wetop-service-key"
PATH_BEAUTY_SERVICES = "/bot/beauty-services"
PATH_FOOD_PERIODS = "/bot/food-service-periods"


class CatalogUnavailable(Exception):
    """Справочник не ответил. Текст не несёт адресов и ключей."""


class WetopCatalog:
    def __init__(self, *, base_url: str, service_key: str, http: httpx.AsyncClient, timeout: float = 5.0) -> None:
        self._base = base_url.rstrip("/")
        self._key = service_key
        self._http = http
        self._timeout = timeout

    async def beauty_services(self, agent_id: str) -> list[dict]:
        return await self._items(PATH_BEAUTY_SERVICES, agent_id)

    async def food_service_periods(self, agent_id: str) -> list[dict]:
        return await self._items(PATH_FOOD_PERIODS, agent_id)

    async def _items(self, path: str, agent_id: str) -> list[dict]:
        try:
            response = await self._http.get(
                f"{self._base}{path}",
                params={"agent": agent_id},
                headers={KEY_HEADER: self._key},
                timeout=self._timeout,
            )
        except httpx.TimeoutException:
            raise CatalogUnavailable("timeout") from None
        except Exception as exc:  # noqa: BLE001 - текст исключения несёт адрес
            logger.warning("каталог: отказ соединения (%s)", type(exc).__name__)
            raise CatalogUnavailable("connection") from None
        try:
            body = response.json()
        except ValueError:
            raise CatalogUnavailable("bad_body") from None
        # Отказ определяется по телу: код 200 с ошибкой внутри тоже отказ.
        if response.status_code >= 400 or not isinstance(body, dict) or body.get("error"):
            raise CatalogUnavailable(f"status_{response.status_code}")
        items = body.get("items")
        if not isinstance(items, list):
            raise CatalogUnavailable("bad_items")
        return items
