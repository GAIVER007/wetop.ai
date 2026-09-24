"""Шаг 5: занятый замок ставит сообщение в очередь, а не мимо.
Ранний выход молча терял бы реплики клиента."""

import json

import pytest

from src.channels.sender import SendResult
from tests.engine_fakes import (  # noqa: F401 — фикстура engine_env
    MemorySender,
    ScriptedLlm,
    engine_env,
    incoming,
    load_messages,
    reply,
    roles,
    seed_conversation,
)


class _SpySender(MemorySender):
    """Отправитель с крючком: выполняется посреди хода, пока замок наш."""

    def __init__(self, hook) -> None:
        super().__init__()
        self._hook = hook

    async def send(self, *, channel: str, external_id: str, text: str) -> SendResult:
        await self._hook()
        return await super().send(channel=channel, external_id=external_id, text=text)


class _BusyOnceRedis:
    """Redis, у которого первый SET NX замка «занят» другим воркером,
    а к повторной попытке замок уже свободен: окно гонки между RPUSH
    и снятием чужого замка."""

    def __init__(self, real) -> None:
        self._real = real
        self.refused = 0

    def __getattr__(self, name):
        return getattr(self._real, name)

    async def set(self, key, value, **kwargs):
        if kwargs.get("nx") and str(key).startswith("lock:conv:") and self.refused == 0:
            self.refused += 1
            return None
        return await self._real.set(key, value, **kwargs)


async def test_busy_lock_queues_then_drains(engine_env) -> None:
    conversation_id = await seed_conversation(engine_env.sessionmaker)
    lock_key = f"lock:conv:{conversation_id}"
    queue_key = f"queue:conv:{conversation_id}"
    sender = MemorySender()
    engine = engine_env.engine(sender=sender, llm=ScriptedLlm([reply("Отвечаю.")]))

    # Замок держит «другой воркер».
    await engine_env.redis.set(lock_key, "1")
    queued = await engine.process_message(incoming("Первое сообщение"))
    assert queued.status == "queued"
    assert queued.conversation_id == conversation_id
    assert sender.sent == []
    assert await engine_env.redis.llen(queue_key) == 1
    raw = await engine_env.redis.lindex(queue_key, 0)
    payload = json.loads(raw)
    assert payload["text"] == "Первое сообщение"
    assert payload["external_id"] == "1001"

    # Замок отпущен, приходит новое сообщение: обрабатываются оба.
    await engine_env.redis.delete(lock_key)
    outcome = await engine.process_message(incoming("Второе сообщение"))
    assert outcome.status == "replied"
    assert len(sender.sent) == 2
    assert await engine_env.redis.llen(queue_key) == 0
    assert await engine_env.redis.exists(lock_key) == 0

    messages = await load_messages(engine_env.sessionmaker, conversation_id)
    assert roles(messages).count("user") == 2
    assert roles(messages).count("assistant") == 2
    assert {m.content for m in messages if m.role.value == "user"} == {
        "Первое сообщение",
        "Второе сообщение",
    }


async def test_lock_released_after_turn(engine_env) -> None:
    engine = engine_env.engine(llm=ScriptedLlm([reply("Да.")]))
    outcome = await engine.process_message(incoming("Есть места?"))
    assert outcome.status == "replied"
    assert await engine_env.redis.exists(f"lock:conv:{outcome.conversation_id}") == 0


async def test_lock_released_after_llm_failure(engine_env) -> None:
    """Сбой модели не оставляет замок висеть: иначе диалог встанет на минуту."""
    engine = engine_env.engine(llm=ScriptedLlm([RuntimeError("модель легла")]))
    outcome = await engine.process_message(incoming("Есть места?"))
    assert await engine_env.redis.exists(f"lock:conv:{outcome.conversation_id}") == 0


async def test_foreign_lock_is_not_released(engine_env) -> None:
    """Замок истёк посреди хода и его взял другой воркер: наш finally не должен снимать чужой."""
    conversation_id = await seed_conversation(engine_env.sessionmaker)
    lock_key = f"lock:conv:{conversation_id}"

    async def steal_lock() -> None:
        await engine_env.redis.set(lock_key, "other-worker")

    sender = _SpySender(steal_lock)
    engine = engine_env.engine(sender=sender, llm=ScriptedLlm([reply("Да.")]))
    outcome = await engine.process_message(incoming("Есть места?"))
    assert outcome.status == "replied"
    assert await engine_env.redis.get(lock_key) == b"other-worker"


async def test_lock_ttl_covers_cascade(engine_env) -> None:
    """Минуты мало: каскад из трёх моделей по таймауту на попытку и раунды инструментов дольше."""
    conversation_id = await seed_conversation(engine_env.sessionmaker)
    lock_key = f"lock:conv:{conversation_id}"
    seen: list[int] = []

    async def read_ttl() -> None:
        seen.append(await engine_env.redis.ttl(lock_key))

    engine = engine_env.engine(sender=_SpySender(read_ttl), llm=ScriptedLlm([reply("Да.")]))
    await engine.process_message(incoming("Есть места?"))
    assert seen and seen[0] > 60


async def test_queued_while_lock_released_is_drained_by_pusher(engine_env) -> None:
    """Гонка: замок был занят при первой попытке, но свободен уже к RPUSH.
    Сообщение не должно лежать в очереди до следующего входящего."""
    conversation_id = await seed_conversation(engine_env.sessionmaker)
    redis = _BusyOnceRedis(engine_env.redis)
    sender = MemorySender()
    engine = engine_env.engine(sender=sender, llm=ScriptedLlm([reply("Отвечаю.")]))
    engine._redis = redis  # подмена только замка/очереди: остальное — тот же fakeredis

    outcome = await engine.process_message(incoming("Первое сообщение"))
    assert outcome.status == "queued"
    assert redis.refused == 1
    assert sender.texts == ["Отвечаю."]
    assert await engine_env.redis.llen(f"queue:conv:{conversation_id}") == 0
    assert await engine_env.redis.exists(f"lock:conv:{conversation_id}") == 0
    messages = await load_messages(engine_env.sessionmaker, conversation_id)
    assert roles(messages) == ["user", "assistant"]


async def test_lock_released_when_recording_client_message_fails(engine_env, monkeypatch: pytest.MonkeyPatch) -> None:
    """Сбой сразу после захвата (запись реплики клиента) не должен оставлять замок до TTL."""
    import src.ai.engine as engine_module

    conversation_id = await seed_conversation(engine_env.sessionmaker)

    class Boom:
        def __init__(self, *args, **kwargs) -> None:
            raise RuntimeError("история недоступна")

    monkeypatch.setattr(engine_module, "Message", Boom)
    engine = engine_env.engine(llm=ScriptedLlm([reply("Да.")]))
    outcome = await engine.process_message(incoming("Есть места?"))
    assert outcome.status == "error"
    assert await engine_env.redis.exists(f"lock:conv:{conversation_id}") == 0
