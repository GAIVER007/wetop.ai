"""Честная заглушка внешней системы: режим по умолчанию.

Заглушка ничего не выдумывает и не притворяется успехом: на наличие и цену
отвечает «не знаю», на поиск — «не найдено». Выдуманный ответ дороже
отсутствия ответа: клиент уносит обещание, которого никто не давал, и узнает
об этом на стойке.
"""

from __future__ import annotations

import logging
from datetime import date, datetime

from src.db.base import utcnow
from src.integrations.providers import (
    Availability,
    Customer,
    HealthReport,
    Incident,
    LeadRef,
    OrderStatus,
    Quote,
)

logger = logging.getLogger(__name__)

# Текст пометки для журнала и панели: видно, что ответ дала заглушка.
NO_SOURCE = "нет связи со справочником"


class StubProviders:
    """Реализует все протоколы сразу: на разработке подключать по заглушке
    на каждую роль незачем.

    🔴 Помощник платформы эту заглушку в бою не видит: фабрика в режиме stub
    оставляет incidents и health равными None, и инструменты отвечают «не
    знаю». Заглушка, сказавшая «всё работает», неотличима от незнания —
    а это ровно то, что нельзя показывать человеку с поломанной платформой.
    """

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


    # ─── Помощник платформы ───

    async def recent_for_user(
        self,
        *,
        user_id: str | None,
        org_id: str | None,
        since: datetime,
        limit: int,
    ) -> list[Incident]:
        """Журнала у заглушки нет — пустой список, а не выдуманные ошибки.

        🔴 В журнал ни user_id, ни org_id: это чужие идентификаторы.
        """
        logger.debug("заглушка журнала платформы: происшествий нет")
        return []

    async def search(
        self, *, text: str, since: datetime, limit: int
    ) -> list[Incident]:
        """Поиск по журналу платформы: не найдено — признак, а не исключение."""
        return []

    async def status(self) -> HealthReport:
        """Отвечает «всё работает» только потому, что это заглушка, и говорит
        об этом в журнал. Инструменту такой ответ не достаётся: фабрика
        в режиме stub не подставляет health."""
        logger.info("заглушка состояния платформы: %s", NO_SOURCE)
        return HealthReport(ok=True, degraded=[], checked_at=utcnow())
