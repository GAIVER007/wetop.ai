"""Страйки инъекций и блокировка диалога (слой 4).

Срабатывание не блокирует сразу: три страйка в окне, и только потом диалог
и адрес уходят в блок. Три попытки — плата за ложные срабатывания: живой
человек со странным вопросом не должен быть отрезан с первого раза.

Ключи в Redis:
  guard:strikes:{conversation_id} — счётчик, живёт окно
  guard:blocked:{conversation_id} — метка блока, живёт block_ttl
Алерт оператору о блокировке — шаг 8 (outbox): здесь только blocked=True,
решение принимает вызывающий код.
"""

from dataclasses import dataclass

from redis.asyncio import Redis

from src.db.ip_block import block_ip


@dataclass
class StrikeResult:
    count: int
    blocked: bool


def _strikes_key(conversation_id: str) -> str:
    return f"guard:strikes:{conversation_id}"


def _blocked_key(conversation_id: str) -> str:
    return f"guard:blocked:{conversation_id}"


async def add_strike(
    redis: Redis,
    *,
    conversation_id: str,
    ip: str | None,
    limit: int,
    window_seconds: int,
    block_ttl_seconds: int,
) -> StrikeResult:
    """Засчитывает страйк; при count >= limit блокирует диалог и адрес.

    EXPIRE ставится только на первом инкременте: окно отсчитывается от
    первого страйка, а не сдвигается каждым новым, иначе редкие странные
    вопросы копились бы бесконечно.
    """
    key = _strikes_key(conversation_id)
    count = int(await redis.incr(key))
    if count == 1:
        await redis.expire(key, window_seconds)

    blocked = count >= limit
    if blocked:
        await redis.set(_blocked_key(conversation_id), "1", ex=block_ttl_seconds)
        if ip:
            await block_ip(redis, ip, block_ttl_seconds)
    return StrikeResult(count=count, blocked=blocked)


async def is_conversation_blocked(redis: Redis, conversation_id: str) -> bool:
    return bool(await redis.exists(_blocked_key(conversation_id)))


async def clear_strikes(redis: Redis, conversation_id: str) -> None:
    """Сброс счётчика и метки блока диалога (разблокировка оператором).

    Блок адреса не снимается: он общий для всех диалогов с этого ip,
    для него есть ip_block.unblock_ip.
    """
    await redis.delete(_strikes_key(conversation_id), _blocked_key(conversation_id))
