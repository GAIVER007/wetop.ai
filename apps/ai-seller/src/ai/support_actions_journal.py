"""Журнал действий WETOP Support и ожидающие подтверждения (S6).

Журнал — таблица бота `support_actions`: каждое предложение, подтверждение, выполнение, отказ и передача человеку.
Ожидающее предложение CONFIRM живёт в Redis под ключом диалога с TTL: одно на диалог, новое вытесняет старое.

🔴 `result` — короткая строка без ПД: сводку для человека вызывающий пропускает через маску до записи.
"""

from __future__ import annotations

import json
import time
import uuid
from typing import Any

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.base import ConversationMode, utcnow
from src.db.models import ACTION_STATUSES, Conversation, SupportAction

PENDING_TTL_SECONDS = 15 * 60
RESULT_LIMIT = 300


class JournalError(ValueError):
    """Неверный статус или аргумент; текст — человеку."""


def pending_key(conversation_id: str) -> str:
    return f"support:pending:{conversation_id}"


async def record(
    session: AsyncSession,
    *,
    conversation_id: str | None,
    user_ref: str,
    action: str,
    action_class: str,
    status: str,
    args: dict | None = None,
    result: str | None = None,
) -> SupportAction:
    if status not in ACTION_STATUSES:
        raise JournalError(f"статус {status!r} не из словаря")
    row = SupportAction(
        conversation_id=conversation_id, user_ref=user_ref[:32], action=action[:40], action_class=action_class,
        args=args, status=status, result=(result or None) and result[:RESULT_LIMIT], created_at=utcnow(),
    )
    session.add(row)
    await session.flush()
    return row


async def set_status(
    session: AsyncSession, action_id: uuid.UUID, status: str, *, result: str | None = None, executed: bool = False
) -> SupportAction | None:
    if status not in ACTION_STATUSES:
        raise JournalError(f"статус {status!r} не из словаря")
    row = await session.get(SupportAction, action_id)
    if row is None:
        return None
    row.status = status
    if result is not None:
        row.result = result[:RESULT_LIMIT]
    if executed:
        row.executed_at = utcnow()
    await session.flush()
    return row


async def list_for_conversation(session: AsyncSession, conversation_id: str) -> list[dict]:
    """Журнал диалога для оператора в кабинете (клиенту не отдаётся)."""
    rows = (
        await session.execute(
            sa.select(SupportAction)
            .where(SupportAction.conversation_id == conversation_id)
            .order_by(SupportAction.created_at)
        )
    ).scalars().all()
    return [
        {
            "id": str(r.id),
            "action": r.action,
            "class": r.action_class,
            "status": r.status,
            "result": r.result,
            "createdAt": r.created_at.isoformat(),
            "executedAt": r.executed_at.isoformat() if r.executed_at else None,
        }
        for r in rows
    ]


async def escalate(session: AsyncSession, conversation_id: str | None) -> bool:
    """Диалог → «нужен человек». Пометка, не передача: бот продолжает отвечать (как `needs_human` модели)."""
    if not conversation_id:
        return False
    try:
        conv = await session.get(Conversation, uuid.UUID(conversation_id))
    except ValueError:
        return False
    if conv is None:
        return False
    if conv.mode == ConversationMode.BOT_ACTIVE:
        conv.mode = ConversationMode.NEEDS_HUMAN
        await session.flush()
    return True


# ─── Ожидающее предложение ───


async def put_pending(redis: Any, conversation_id: str, *, action_id: uuid.UUID, action: str) -> None:
    payload = {"action_id": str(action_id), "action": action, "proposed_at": int(time.time())}
    await redis.set(pending_key(conversation_id), json.dumps(payload), ex=PENDING_TTL_SECONDS)


async def get_pending(redis: Any, conversation_id: str) -> dict | None:
    raw = await redis.get(pending_key(conversation_id))
    if not raw:
        return None
    try:
        payload = json.loads(raw)
    except (TypeError, ValueError):
        return None
    return payload if isinstance(payload, dict) and payload.get("action_id") else None


async def clear_pending(redis: Any, conversation_id: str) -> None:
    await redis.delete(pending_key(conversation_id))


def is_stale(payload: dict, now: float | None = None) -> bool:
    proposed = payload.get("proposed_at")
    if not isinstance(proposed, (int, float)):
        return True
    return (now if now is not None else time.time()) - proposed > PENDING_TTL_SECONDS
