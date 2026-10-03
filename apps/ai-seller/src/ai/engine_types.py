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

# operator — диалог у оператора, модель не звали (С-59); budget — суточный бюджет модели исчерпан (С-10 от 25.09)
Status = Literal[
    "replied", "queued", "duplicate", "blocked", "consent", "send_failed", "error", "operator", "budget"
]


@dataclass(frozen=True)
class IncomingMessage:
    channel: str
    external_id: str
    text: str
    received_at: datetime
    client_name: str | None = None
    ip: str | None = None
    # Гостиница (Э4): ставит дверь канала — виджет из ключа в теге,
    # песочница из тела. None — экземпляр-помощник или строки до Э4.
    organization_id: str | None = None
    # Агент (SA2.5): ставит дверь канала — из ключа в теге, из адреса вебхука, из тела песочницы. Продавец — ВСЕГДА
    # вместе с организацией; помощник — ни того ни другого. Организация без агента (и наоборот) — ошибка двери:
    # движок такой ход не обрабатывает, а не угадывает агента по организации.
    agent_id: str | None = None

    def agent_uuid(self) -> uuid.UUID | None:
        return uuid.UUID(self.agent_id) if self.agent_id else None

    def org_uuid(self) -> uuid.UUID | None:
        """Организация как UUID на границе с базой. В JSON и по каналам она
        ездит строкой: from_json не должен зависеть от типа поля."""
        return uuid.UUID(self.organization_id) if self.organization_id else None

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
    agent: Any = None  # строка `agents` этого хода (SA2.5); у помощника — None
    history: list[Message] = field(default_factory=list)  # реплики ДО этого хода
    lead: dict = field(default_factory=dict)
    verdict: Any = None
    messages: list[dict] = field(default_factory=list)
    result: Any = None  # LlmResult, если модель вызывалась
    llm_api_key: str | None = None  # ключ модели партнёра на ход (С2); None — ключ платформы
    reply: str | None = None  # выставлен до модели — значит ранняя ветка
    lock: Any = None  # TurnLock, если замок наш: после хода разбираем очередь
    sent: bool = False
    # Алерты хода (вид, тело, ключ дедупа): выпускаются после коммита хода — своя сессия алерта
    # не ждёт незакоммиченную запись хода
    alerts: list[tuple[str, str, str]] = field(default_factory=list)

    def step(self, name: str) -> None:
        self.outcome.trace.append(name)
