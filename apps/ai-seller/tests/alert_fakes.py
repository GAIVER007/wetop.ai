"""Заглушки шага 8а: SMTP, Bot API алертов, посев диалогов и чтение outbox.

Ни сети, ни сервисов: aiosmtplib подменяется на объект в памяти,
мессенджер — на httpx.MockTransport, база — sqlite из conftest.
"""

from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

import httpx
import pytest
import sqlalchemy as sa

from src.config import Settings, get_settings
from src.db.base import (
    ConversationMode,
    DeliveryStatus,
    FunnelStage,
    MessageRole,
    OutboxKind,
    utcnow,
)
from src.db.models import Client, Conversation, Message, OutboxItem

# Вымышленные значения: боевых адресов и токенов в тестах быть не может.
TEST_TOKEN = "111:ALERTBOT"
TEST_CHAT_ID = "-1001234567890"
TEST_EMAIL = "owner@example.test"

_PATH_RE = re.compile(r"^/bot(?P<token>[^/]+)/(?P<method>\w+)$")

# Базовые значения блока алертов. Тест меняет только то, что проверяет.
ALERT_ENV: dict[str, str] = {
    "SMTP_HOST": "",
    "SMTP_PORT": "465",
    "SMTP_USER": "",
    "SMTP_PASSWORD": "",
    "ALERT_EMAIL_FROM": "bot@example.test",
    "ALERT_EMAIL_TO": TEST_EMAIL,
    "ALERT_TELEGRAM_BOT_TOKEN": TEST_TOKEN,
    "ALERT_TELEGRAM_CHAT_ID": TEST_CHAT_ID,
    "ALERT_TELEGRAM_API_BASES": "",
    "ALERT_RATE_LIMIT_PER_HOUR": "10",
    "ALERT_DEDUP_SLA_MINUTES": "10",
    "ALERT_DEDUP_HOT_LEAD_HOURS": "24",
    "ALERT_RETRY_WINDOW_HOURS": "24",
    "ALERT_HEARTBEAT_ENABLED": "true",
    "ALERT_HEARTBEAT_HOUR": "9",
    "SLA_SECONDS": "300",
}


def alert_settings(monkeypatch: pytest.MonkeyPatch, **overrides: str) -> Settings:
    """Настройки с заполненным блоком алертов.

    Пустая строка в overrides значит «настройка не задана»: env_ignore_empty
    в Settings сведёт её к умолчанию поля, как это делает боевой .env.
    """
    values = dict(ALERT_ENV)
    values.update(overrides)
    for name, value in values.items():
        monkeypatch.setenv(name, value)
    get_settings.cache_clear()
    return get_settings()


# ─── Почта ───


def _header(message: Any, name: str) -> str:
    """Заголовок письма, каким бы объектом ни было сообщение."""
    getter = getattr(message, "get", None)
    if callable(getter):
        value = getter(name)
        if value is not None:
            return str(value)
    return ""


def _body(message: Any) -> str:
    """Текст письма: у EmailMessage — get_content(), иначе всё целиком."""
    get_content = getattr(message, "get_content", None)
    if callable(get_content):
        try:
            return str(get_content())
        except Exception:
            pass
    return str(message)


@dataclass
class SmtpCall:
    """Один вызов aiosmtplib.send: куда и что."""

    hostname: str | None
    port: int | None
    message: Any
    kwargs: dict[str, Any]

    @property
    def subject(self) -> str:
        return _header(self.message, "Subject")

    @property
    def to(self) -> str:
        return _header(self.message, "To")

    @property
    def sender(self) -> str:
        return _header(self.message, "From")

    @property
    def body(self) -> str:
        return _body(self.message)


@dataclass
class FakeSmtp:
    """Подмена aiosmtplib.send. raises — исключение вместо отправки."""

    calls: list[SmtpCall] = field(default_factory=list)
    raises: Exception | None = None

    async def send(self, message: Any = None, *args: Any, **kwargs: Any) -> Any:
        self.calls.append(
            SmtpCall(
                hostname=kwargs.get("hostname"),
                port=kwargs.get("port"),
                message=message,
                kwargs=dict(kwargs),
            )
        )
        if self.raises is not None:
            raise self.raises
        return {}, "250 OK"

    def install(self, monkeypatch: pytest.MonkeyPatch) -> "FakeSmtp":
        """Подменяет send на самом модуле aiosmtplib: транспорт импортирует
        его внутри метода, поэтому подмена на модуле его и достаёт."""
        import aiosmtplib

        monkeypatch.setattr(aiosmtplib, "send", self.send)
        return self


# ─── Мессенджер ───


@dataclass
class MessengerApi:
    """Bot API алертов в памяти поверх httpx.MockTransport.

    fail_hosts — хосты, которые отвечают отказом (или поднимают исключение,
    если значение — Exception). Порядок опроса виден в hosts: на нём
    держится проверка «перебор идёт по списку, а не как придётся».
    """

    token: str = TEST_TOKEN
    fail_hosts: dict[str, Any] = field(default_factory=dict)
    hosts: list[str] = field(default_factory=list)
    calls: list[tuple[str, dict]] = field(default_factory=list)

    def client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(transport=httpx.MockTransport(self._handle))

    def _handle(self, request: httpx.Request) -> httpx.Response:
        host = request.url.host
        self.hosts.append(host)
        match = _PATH_RE.match(request.url.path)
        if match is None:
            return httpx.Response(404, json={"ok": False, "description": "Not Found"})
        if match.group("token") != self.token:
            return httpx.Response(401, json={"ok": False, "description": "Unauthorized"})
        try:
            payload = json.loads(request.content or b"{}")
        except ValueError:
            payload = {}
        self.calls.append((match.group("method"), payload if isinstance(payload, dict) else {}))

        behaviour = self.fail_hosts.get(host)
        if isinstance(behaviour, Exception):
            raise behaviour
        if behaviour is not None:
            return httpx.Response(int(behaviour), json={"ok": False, "description": "nope"})
        return httpx.Response(200, json={"ok": True, "result": {"message_id": len(self.calls)}})


# ─── База ───


async def alert_rows(sessionmaker) -> list[OutboxItem]:
    """Строки outbox с kind=ALERT, по порядку записи."""
    async with sessionmaker() as session:
        stmt = (
            sa.select(OutboxItem)
            .where(OutboxItem.kind == OutboxKind.ALERT)
            .order_by(OutboxItem.id)
        )
        return list((await session.execute(stmt)).scalars().all())


async def seed_turn(
    sessionmaker,
    *,
    external_id: str,
    waited_seconds: int = 600,
    now: datetime | None = None,
    text: str = "Здравствуйте, посчитайте стоимость",
    answered: bool = False,
    mode: ConversationMode = ConversationMode.BOT_ACTIVE,
    is_active: bool = True,
    channel: str = "telegram",
) -> uuid.UUID:
    """Диалог с сообщением клиента waited_seconds назад.

    answered=True добавляет ответ ассистента ПОЗЖЕ клиентского: на этой паре
    проверяется, что сторож смотрит на последнее сообщение, а не на любое.
    """
    now = now or utcnow()
    asked_at = now - timedelta(seconds=waited_seconds)
    async with sessionmaker() as session:
        client = Client(channel=channel, external_id=external_id, created_at=asked_at)
        session.add(client)
        await session.flush()
        conversation = Conversation(
            client_id=client.id,
            mode=mode,
            funnel_stage=FunnelStage.NEW,
            lead_data={},
            is_active=is_active,
            created_at=asked_at,
            last_activity_at=asked_at,
        )
        session.add(conversation)
        await session.flush()
        session.add(
            Message(
                conversation_id=conversation.id,
                role=MessageRole.USER,
                content=text,
                sent_by_us=False,
                created_at=asked_at,
            )
        )
        if answered:
            session.add(
                Message(
                    conversation_id=conversation.id,
                    role=MessageRole.ASSISTANT,
                    content="Сейчас посмотрю.",
                    sent_by_us=True,
                    created_at=asked_at + timedelta(seconds=5),
                )
            )
        await session.commit()
        return conversation.id


async def add_pending_alert(
    sessionmaker,
    *,
    transport: str,
    recipient: str,
    body: str = "Проверка канала алертов",
    dedup_key: str = "test:1",
) -> int:
    """Строка алерта в состоянии pending — для проверки повторной доставки."""
    now = utcnow()
    async with sessionmaker() as session:
        item = OutboxItem(
            kind=OutboxKind.ALERT,
            transport=transport,
            recipient=recipient,
            body=body,
            dedup_key=dedup_key,
            status=DeliveryStatus.PENDING,
            attempts=0,
            created_at=now,
            expires_at=now + timedelta(hours=24),
        )
        session.add(item)
        await session.commit()
        return item.id
