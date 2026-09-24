"""Два рубежа против лавины алертов. Ни один не заменяет другой.

Рубеж 1 — окно молчания на КЛЮЧ алерта (silenced): один инцидент без него
даёт сотни писем за ночь.

🔴 Рубеж 2 — предел на ВИД события (flood_check). Ключ вида
'llm_down:{диалог}' у каждого диалога свой, дедуп его не схлопывает, и
массовые одинаковые отказы дают шторм: на живом прогоне владельцу ушло
334 сообщения за две минуты. Поэтому предел считается по event_type,
а не по dedup_key.

⚠️ Оба рубежа открываются при сбое Redis: лишний алерт стоит дешевле
пропущенного. Молчание — худший исход из всех.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

SEEN_PREFIX = "alert:seen:"
FLOOD_PREFIX = "alerts:flood:"
HOUR_SECONDS = 3600


async def silenced(redis, dedup_key: str, window_seconds: int) -> bool:
    """True — этот же инцидент уже отправляли в окне молчания.

    SET NX EX: ключ ставит тот, кто первым пришёл, остальные в окне молчат.
    Сбой Redis — возвращаем False: лучше повтор алерта, чем тишина.
    """
    try:
        placed = await redis.set(dedup_key, "1", nx=True, ex=max(int(window_seconds), 1))
    except Exception:
        logger.exception("дедуп алерта недоступен, ключ %s: пропускаем алерт", dedup_key)
        return False
    return not placed


@dataclass(frozen=True)
class FloodVerdict:
    """Итог проверки потока.

    allowed — алерт выпускается; count — который он по счёту в окне;
    first_suppressed — ровно на первом подавленном, и только на нём
    выпускается одно сообщение «поток подавлен».
    """

    allowed: bool
    count: int
    first_suppressed: bool


async def flood_check(
    redis, event_type: str, *, limit: int, window_seconds: int = HOUR_SECONDS
) -> FloodVerdict:
    """Счётчик однотипных алертов в окне: не больше limit за window_seconds.

    🔴 Ключ по ВИДУ события, а не по dedup_key: ключ с идентификатором
    диалога у каждого диалога свой и шторм не ловит.
    🔴 Окно ставится вместе с созданием ключа (SET NX EX), а не отдельным
    EXPIRE после INCR: обрыв между двумя операциями оставлял счётчик без TTL,
    и после предела алерты этого вида подавлялись НАВСЕГДА и молча. Окно
    продлевать нечем: SET NX по существующему ключу ничего не делает,
    а потерянный TTL восстанавливается проверкой ниже.
    """
    key = FLOOD_PREFIX + event_type
    window = max(int(window_seconds), 1)
    try:
        await redis.set(key, 0, nx=True, ex=window)
        count = int(await redis.incr(key))
        if await redis.ttl(key) < 0:
            await redis.expire(key, window)
    except Exception:
        # Считать нечем — пропускаем: подавить алерт из-за сбоя Redis хуже,
        # чем пережить лишнее сообщение.
        logger.exception("счётчик потока недоступен, вид %s: пропускаем алерт", event_type)
        return FloodVerdict(allowed=True, count=0, first_suppressed=False)
    return FloodVerdict(
        allowed=count <= limit,
        count=count,
        first_suppressed=count == limit + 1,
    )


def window_for(event_type: str, settings) -> int:
    """Окно молчания в секундах: короткое для срока ответа, длинное для лида.

    Неизвестный вид получает окно срока ответа — разумное умолчание:
    короткое молчание заметнее длинного, а новый вид события лучше
    увидеть лишний раз, чем не увидеть сутки.
    """
    if event_type == "hot_lead":
        return int(settings.alert_dedup_hot_lead_hours) * 3600
    return int(settings.alert_dedup_sla_minutes) * 60
