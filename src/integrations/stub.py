"""Честная заглушка внешней системы: режим по умолчанию.

Заглушка ничего не выдумывает и не притворяется успехом: на наличие и цену
отвечает «не знаю», на поиск — «не найдено». Выдуманный ответ дороже
отсутствия ответа: клиент уносит обещание, которого никто не давал, и узнает
об этом на стойке.
"""

from __future__ import annotations

import logging
from datetime import date

from src.integrations.providers import (
    Availability,
    Customer,
    LeadRef,
    OrderStatus,
    Quote,
)

logger = logging.getLogger(__name__)

# Текст пометки для журнала и панели: видно, что ответ дала заглушка.
NO_SOURCE = "нет связи со справочником"


class StubProviders:
    """Реализует все четыре протокола сразу: на разработке подключать
    четыре разные заглушки незачем."""

    async def check(
        self, arrival: date, departure: date, guests: int, category: str | None
    ) -> Availability:
        """Всегда «не знаю»: заглушка не знает занятости и не угадывает её."""
        return Availability("unknown", NO_SOURCE)

    async def quote(
        self, arrival: date, departure: date, guests: int, category: str
    ) -> Quote | None:
        """None — «не знаю». Цена, названная заглушкой, стала бы обещанием."""
        return None

    async def get_status(self, order_id: str) -> OrderStatus | None:
        """Не найдено — признак, а не исключение."""
        return None

    async def find_by_phone(self, phone: str) -> Customer | None:
        return None

    async def create_lead(self, natural_key: str, payload: dict) -> LeadRef:
        """Заявку никуда не отправляет, но и не теряет: событие уходит
        в журнал, а оператор получит алерт от вызывающего.

        🔴 В журнал ни одного поля заявки: там имя и телефон клиента.
        Только начало ключа (это хеш) и число полей.
        """
        logger.info(
            "заглушка внешней системы: заявка принята, ключ %s…, полей %d",
            natural_key[:8],
            len(payload),
        )
        return LeadRef(external_id="stub:" + natural_key[:16], created=True)
