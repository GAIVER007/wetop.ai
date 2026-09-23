"""Типы хода движка: входящее, исход, состояние между шагами.

Вынесены из engine.py, чтобы конвейер остался обозримым; наружу они
по-прежнему импортируются из src.ai.engine.
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

from src.db.models import Client, Conversation, Message

Status = Literal["replied", "queued", "duplicate", "blocked", "consent", "send_failed", "error"]


@dataclass(frozen=True)
class IncomingMessage:
    channel: str
    external_id: str
    text: str
    received_at: datetime
    client_name: str | None = None
    ip: str | None = None

    def to_json(self) -> str:
        return json.dumps({**self.__dict__, "received_at": self.received_at.isoformat()}, ensure_ascii=False)

    @classmethod
    def from_json(cls, raw: str | bytes) -> IncomingMessage:
        data = json.loads(raw)
        return cls(**{**data, "received_at": datetime.fromisoformat(data["received_at"])})


@dataclass
class TurnOutcome:
    status: Status
    reply: str | None
    conversation_id: uuid.UUID | None
    needs_human: bool
    edits: list[str]
    reasons: list[str]
    trace: list[str]


@dataclass
class Turn:
    """Состояние одного хода между шагами. Наружу не выходит."""

    incoming: IncomingMessage
    session: Any
    outcome: TurnOutcome
    client: Client | None = None
    conversation: Conversation | None = None
    history: list[Message] = field(default_factory=list)  # реплики ДО этого хода
    lead: dict = field(default_factory=dict)
    verdict: Any = None
    messages: list[dict] = field(default_factory=list)
    result: Any = None  # LlmResult, если модель вызывалась
    reply: str | None = None  # выставлен до модели — значит ранняя ветка
    lock: Any = None  # TurnLock, если замок наш: после хода разбираем очередь
    sent: bool = False

    def step(self, name: str) -> None:
        self.outcome.trace.append(name)
