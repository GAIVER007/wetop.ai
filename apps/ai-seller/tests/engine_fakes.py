"""Подмены для тестов движка (шаг 5): отправитель в память, модель по сценарию,
сборка Engine и заготовки диалога в базе.

Фикстура engine здесь, а не в conftest: движок нужен только тестам шага 5,
а общий conftest не должен тянуть src.ai.engine в каждый прогон. Тесты
импортируют engine_env из этого модуля — pytest находит фикстуры
в пространстве имён тестового модуля.
"""

from __future__ import annotations

import uuid
from collections.abc import Callable
from dataclasses import dataclass, field

import pytest
import sqlalchemy as sa

from src.ai.engine import Engine, IncomingMessage
from src.ai.llm import LlmResult
from src.ai.schemas import ModelReply
from src.channels.sender import SendResult
from src.config import Settings, get_settings
from src.db.base import ConversationMode, FunnelStage, utcnow
from src.db.models import Client, Conversation, Message
from src.dependencies import close_resources, get_sessionmaker

CHANNEL = "telegram"
EXTERNAL_ID = "1001"


@dataclass
class MemorySender:
    """Складывает отправленное в список. fail=True — отказ канала:
    по нему проверяется, что ответ бота не попадает в историю."""

    sent: list[tuple[str, str, str]] = field(default_factory=list)
    fail: bool = False

    async def send(self, *, channel: str, external_id: str, text: str) -> SendResult:
        if self.fail:
            return SendResult(ok=False, error="канал недоступен")
        self.sent.append((channel, str(external_id), text))
        return SendResult(ok=True, external_message_id=str(len(self.sent)))

    @property
    def texts(self) -> list[str]:
        return [text for _, _, text in self.sent]


class RaisingSender:
    """Отправитель, который падает исключением: проверка внешнего try/except движка."""

    async def send(self, *, channel: str, external_id: str, text: str) -> SendResult:
        raise RuntimeError("отправитель сломан")


class ScriptedLlm:
    """Модель по сценарию: очередь ModelReply или Exception.

    Exception в очереди — отказ каскада (ok=False), как его отдаёт
    CascadeClient: исключение наружу слой модели не поднимает.
    Последний элемент очереди повторяется, чтобы длинный диалог
    не падал на пустом сценарии.
    """

    def __init__(self, replies: list[ModelReply | Exception], mapping: dict | None = None) -> None:
        self.replies = list(replies)
        self.mapping = mapping or {}
        self.calls = 0
        self.last_messages: list[dict] | None = None
        # С2: ключ модели партнёра, который движок передал на ходе (None — ключ платформы)
        self.last_api_key: str | None = None

    async def generate(self, messages: list[dict], *, use_tools: bool = True, **kwargs: object) -> LlmResult:
        self.calls += 1
        self.last_messages = messages
        key = kwargs.get("api_key")
        self.last_api_key = key if isinstance(key, str) else None
        item = self.replies.pop(0) if len(self.replies) > 1 else self.replies[0]
        if isinstance(item, Exception):
            return LlmResult(ok=False, error="all_models_failed", mapping=dict(self.mapping), attempts=[])
        return LlmResult(
            ok=True,
            text=item.reply,
            parsed=item,
            model="fake",
            attempts=[],
            mapping=dict(self.mapping),
            tokens_used=10,
        )


class RecordingHook:
    """Внешнее действие «заявка»: запоминает вызовы, ничего не делает."""

    def __init__(self) -> None:
        self.calls: list[tuple[uuid.UUID, dict]] = []

    async def __call__(self, conversation_id: uuid.UUID, lead: dict) -> None:
        self.calls.append((conversation_id, dict(lead)))


def reply(text: str, **kwargs) -> ModelReply:
    """Короткая запись ответа модели для сценариев."""
    return ModelReply(reply=text, **kwargs)


def incoming(
    text: str,
    *,
    external_id: str = EXTERNAL_ID,
    channel: str = CHANNEL,
    client_name: str | None = None,
    ip: str | None = None,
) -> IncomingMessage:
    return IncomingMessage(
        channel=channel,
        external_id=external_id,
        text=text,
        received_at=utcnow(),
        client_name=client_name,
        ip=ip,
    )


def make_engine(
    settings: Settings,
    sessionmaker,
    redis,
    *,
    sender=None,
    llm=None,
    embedder,
    prompt_text: str = "Ты продавец.",
    lead_hook=None,
    prompt_loader: Callable[[], str] | None = None,
    channel_markdown: bool = False,
    channel_emoji: bool = False,
) -> Engine:
    """Движок с промптом из строки: файл на диске тестам не нужен.
    prompt_loader задают только тесты сбоя загрузки промпта."""
    return Engine(
        settings=settings,
        sessionmaker=sessionmaker,
        redis=redis,
        sender=sender if sender is not None else MemorySender(),
        llm=llm if llm is not None else ScriptedLlm([reply("Хорошо.")]),
        embedder=embedder,
        prompt_loader=prompt_loader or (lambda: prompt_text),
        lead_hook=lead_hook,
        channel_markdown=channel_markdown,
        channel_emoji=channel_emoji,
    )


# ─── Заготовки и чтение базы: каждая операция в своей сессии ───
# Своя сессия на операцию: сессия теста не должна держать транзакцию
# sqlite, пока движок пишет в ту же базу.


async def seed_conversation(
    sessionmaker,
    *,
    channel: str = CHANNEL,
    external_id: str = EXTERNAL_ID,
    mode: ConversationMode = ConversationMode.BOT_ACTIVE,
) -> uuid.UUID:
    """Клиент и активный диалог до первого сообщения: нужен id, чтобы
    занять замок или выставить режим оператора руками."""
    async with sessionmaker() as session:
        client = Client(channel=channel, external_id=external_id, created_at=utcnow())
        session.add(client)
        await session.flush()
        now = utcnow()
        conversation = Conversation(
            client_id=client.id,
            mode=mode,
            funnel_stage=FunnelStage.NEW,
            lead_data={},
            created_at=now,
            last_activity_at=now,
        )
        session.add(conversation)
        await session.commit()
        return conversation.id


async def load_conversation(sessionmaker, conversation_id: uuid.UUID) -> Conversation:
    async with sessionmaker() as session:
        return await session.get_one(Conversation, conversation_id)


async def load_messages(sessionmaker, conversation_id: uuid.UUID) -> list[Message]:
    """История диалога по времени создания."""
    async with sessionmaker() as session:
        result = await session.execute(
            sa.select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at, Message.id)
        )
        return list(result.scalars().all())


async def find_client(sessionmaker, *, channel: str = CHANNEL, external_id: str = EXTERNAL_ID) -> Client:
    async with sessionmaker() as session:
        result = await session.execute(
            sa.select(Client).where(Client.channel == channel, Client.external_id == external_id)
        )
        return result.scalar_one()


def roles(messages: list[Message]) -> list[str]:
    return [m.role.value for m in messages]


@dataclass
class EngineEnv:
    """Всё, из чего собирается движок в тесте. settings читаются лениво:
    тест может поменять окружение (гейт согласия) до сборки движка."""

    sessionmaker: object
    redis: object
    embedder: object

    @property
    def settings(self) -> Settings:
        return get_settings()

    def engine(self, **kwargs) -> Engine:
        return make_engine(self.settings, self.sessionmaker, self.redis, embedder=self.embedder, **kwargs)


@pytest.fixture
async def engine_env(migrated_db, fake_redis, fake_embedder) -> EngineEnv:
    """База мигрирована, Redis и эмбеддер подменены. В конце закрывает
    движок SQLAlchemy в том же цикле, где он создавался."""
    env = EngineEnv(sessionmaker=get_sessionmaker(), redis=fake_redis, embedder=fake_embedder)
    try:
        yield env
    finally:
        await close_resources()
