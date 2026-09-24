"""Замок диалога и очередь входящих: один ход на диалог в один момент.

Замок хранит случайный токен хода и снимается только своим: ход может
пережить TTL, и к тому времени замок держит другой воркер — слепой DEL снял
бы чужой. Снимается замок только при пустой очереди и атомарно (WATCH/MULTI):
иначе сообщение, поставленное в очередь между снятием замка и её проверкой,
лежало бы до следующего входящего — «мимо». TTL считается от худшего хода:
все ступени каскада × таймаут попытки × раунды инструментов.
"""

from __future__ import annotations

import logging
import uuid

from redis.exceptions import WatchError

from src.config import Settings

logger = logging.getLogger(__name__)

_TOOL_ROUNDS = 3  # max_tool_rounds по умолчанию в CascadeClient.generate
_TTL_MARGIN_SECONDS = 30  # поиск, отправка, запись
_MIN_TTL_SECONDS = 60


def lock_ttl_seconds(settings: Settings) -> int:
    """Не меньше худшего хода: ступени каскада × таймаут × (раунды + 1) + запас."""
    steps = max(1, len(settings.llm_models))
    worst = steps * settings.llm_timeout_seconds * (_TOOL_ROUNDS + 1) + _TTL_MARGIN_SECONDS
    return max(_MIN_TTL_SECONDS, worst)


def _text(value: str | bytes | None) -> str | None:
    return value.decode() if isinstance(value, bytes) else value


class TurnLock:
    """Замок одного диалога на один ход: lock:conv:{id} и queue:conv:{id}."""

    def __init__(self, redis, conversation_id: uuid.UUID, *, ttl_seconds: int) -> None:
        self._redis = redis
        self._ttl = ttl_seconds
        self.lock_key = f"lock:conv:{conversation_id}"
        self.queue_key = f"queue:conv:{conversation_id}"
        self.token = uuid.uuid4().hex

    async def acquire(self) -> bool:
        return bool(await self._redis.set(self.lock_key, self.token, nx=True, ex=self._ttl))

    async def enqueue(self, payload: str) -> None:
        await self._redis.rpush(self.queue_key, payload)

    async def pop_queued(self) -> str | None:
        return _text(await self._redis.lpop(self.queue_key))

    async def release_if_idle(self) -> bool:
        """DEL своего замка, только если очередь пуста. True — разбор окончен:
        замок снят или уже не наш (истёк, очередь теперь чужая)."""
        return await self._release(only_idle=True)

    async def release(self) -> None:
        """Снять свой замок независимо от очереди — аварийный выход."""
        await self._release(only_idle=False)

    async def _release(self, *, only_idle: bool) -> bool:
        try:
            async with self._redis.pipeline(transaction=True) as pipe:
                await pipe.watch(self.lock_key, self.queue_key)
                if _text(await pipe.get(self.lock_key)) != self.token:
                    logger.warning("замок %s уже не наш: истёк посреди хода", self.lock_key)
                    return True
                if only_idle and await pipe.llen(self.queue_key):
                    return False
                pipe.multi()
                pipe.delete(self.lock_key)
                await pipe.execute()
                return True
        except WatchError:
            # Между проверкой и DEL что-то пришло в очередь: не снимаем, разбираем.
            return False
