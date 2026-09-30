"""Дедуп входящих сообщений (слой 0).

Ловит не атаку, а двойную доставку от канала: без него клиент получает два
одинаковых ответа и решает, что бот сломался. Состояние в Redis на короткий
TTL, ключ — канал, агент, внешний id отправителя и хеш текста.

🔴 Агент в ключе обязателен у продавца (SA2.5; до неё — организация, Э4): у WhatsApp
внешний id — телефон гостя, один на все гостиницы, и одно «Здравствуйте» в две
гостиницы за минуту второй не доходило (проверка 26.09); двум агентам одной
организации оно тоже должно дойти обоим. Без агента (помощник) — ключ прежний.
Смена префикса при выкладке SA2.5 допускает один повтор сообщения в окне дедупа (минуты).
"""

import hashlib

from redis.asyncio import Redis


def _dedup_key(channel: str, external_id: str, text: str, agent_id: str | None = None) -> str:
    # strip(): каналы иногда дописывают перевод строки при повторной доставке,
    # и без обрезки один и тот же текст давал бы два разных хеша.
    digest = hashlib.sha256(text.strip().encode("utf-8")).hexdigest()[:32]
    if agent_id:
        return f"dedup:{channel}:agent:{agent_id}:{external_id}:{digest}"
    return f"dedup:{channel}:{external_id}:{digest}"


async def is_duplicate(
    redis: Redis,
    *,
    channel: str,
    external_id: str,
    text: str,
    ttl_seconds: int,
    agent_id: str | None = None,
) -> bool:
    """True — такое сообщение от этого отправителя уже видели в окне ttl.

    SET NX EX — одна атомарная операция: два воркера, получившие дубль
    одновременно, не пройдут оба (проверка и запись раздельно — пройдут).
    external_id всегда строкой: приводится на границе с каналом, не здесь.
    """
    key = _dedup_key(channel, str(external_id), text, agent_id)
    created = await redis.set(key, "1", nx=True, ex=ttl_seconds)
    return not created
