"""Экран диалогов: список, карточка, перехват, возврат, реплика оператора.

🔴 Разделение «список — карточка» не косметика: в списке контакта нет,
в карточке он есть целиком. Оператор открывает карточку осознанно, а список
держит открытым весь день.

🔴 Диалог не уходит в owner_takeover сам по себе: перехват и возврат делает
человек кнопкой. Автоматический перехват означает, что бот замолчал,
оператор спит, а клиент ушёл.
"""

from __future__ import annotations

import logging
import uuid

import sqlalchemy as sa
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict

from src import dependencies
from src.config import Settings
from src.dashboard.panel_common import iso, log_action, mask_name, sessions
from src.db.base import ConversationMode, MessageRole, utcnow
from src.db.models import Client, Conversation, Message

logger = logging.getLogger(__name__)

router = APIRouter()


class ReplyIn(BaseModel):
    """Лишние поля отбрасываем, а не роняем запрос."""

    model_config = ConfigDict(extra="ignore")

    text: str


def build_reply_sender(settings: Settings):
    """Отправитель канала для реплики оператора.

    Тот же OutboxSender, что у движка: строка ложится в outbox до попытки,
    и мигание канала не съедает реплику. Импорты внутри — клиент мессенджера
    не нужен тем, кто подменяет отправителя в тестах.
    """
    from src.channels.outbox import OutboxSender
    from src.channels.telegram import CHANNEL, TelegramClient

    telegram = TelegramClient(
        settings.channel_telegram_bot_token,
        dependencies.get_http_client(),
        api_base=settings.channel_telegram_api_base,
    )
    return OutboxSender(
        sessions(), {CHANNEL: telegram}, retry_window_hours=settings.alert_retry_window_hours
    )


@router.get("/conversations")
async def list_conversations(mode: str | None = None, limit: int = 50) -> dict:
    """Список диалогов. 🔴 Телефона в ответе нет, имя маскировано."""
    try:
        wanted = ConversationMode(mode) if mode else None
    except ValueError:
        raise HTTPException(status_code=400, detail="неизвестный режим диалога") from None

    counts = (
        sa.select(Message.conversation_id.label("cid"), sa.func.count().label("n"))
        .group_by(Message.conversation_id)
        .subquery()
    )
    stmt = (
        sa.select(Conversation, Client, sa.func.coalesce(counts.c.n, 0))
        .join(Client, Client.id == Conversation.client_id)
        .outerjoin(counts, counts.c.cid == Conversation.id)
        .order_by(Conversation.last_activity_at.desc())
        # Отбор и предел — в SQL: фильтрация после выборки на живой базе
        # означает, что панель тянет всю таблицу ради двадцати строк.
        .limit(max(1, min(limit, 200)))
    )
    if wanted is not None:
        stmt = stmt.where(Conversation.mode == wanted)

    async with sessions()() as session:
        rows = (await session.execute(stmt)).all()
    return {
        "items": [
            {
                "id": str(conv.id),
                "channel": client.channel,
                "client_name": mask_name(client.name),
                "mode": conv.mode.value,
                "stage": conv.funnel_stage.value,
                "last_activity_at": iso(conv.last_activity_at),
                "messages": int(count),
                "has_contact": bool(client.phone or client.email),
            }
            for conv, client, count in rows
        ]
    }


@router.get("/conversations/{conv_id}")
async def conversation_card(conv_id: uuid.UUID) -> dict:
    """Карточка: контакт целиком — оператор за ним и пришёл."""
    async with sessions()() as session:
        conv = await session.get(Conversation, conv_id)
        if conv is None:
            raise HTTPException(status_code=404, detail="диалог не найден")
        client = await session.get(Client, conv.client_id)
        stmt = sa.select(Message).where(Message.conversation_id == conv_id).order_by(Message.created_at)
        messages = (await session.execute(stmt)).scalars().all()
    return {
        "id": str(conv.id),
        "mode": conv.mode.value,
        "stage": conv.funnel_stage.value,
        "lead_data": dict(conv.lead_data or {}),
        "contact": {
            "name": client.name,
            "phone": client.phone,
            "email": client.email,
            "channel": client.channel,
            "external_id": client.external_id,
        },
        "messages": [
            {"role": m.role.value, "text": m.content, "at": iso(m.created_at), "sent_by_us": m.sent_by_us}
            for m in messages
        ],
    }


async def _switch_mode(conv_id: uuid.UUID, target: ConversationMode, action: str) -> dict:
    """Смена режима руками оператора + запись прежнего значения в журнал."""
    async with sessions()() as session:
        conv = await session.get(Conversation, conv_id)
        if conv is None:
            raise HTTPException(status_code=404, detail="диалог не найден")
        previous = conv.mode.value
        conv.mode = target
        log_action(session, action=action, payload={"previous_mode": previous}, conversation_id=conv.id)
        await session.commit()
    return {"status": "ok", "mode": target.value, "previous_mode": previous}


@router.post("/conversations/{conv_id}/takeover")
async def takeover(conv_id: uuid.UUID) -> dict:
    """Перехват: дальше отвечает человек."""
    return await _switch_mode(conv_id, ConversationMode.OWNER_TAKEOVER, "takeover")


@router.post("/conversations/{conv_id}/release")
async def release(conv_id: uuid.UUID) -> dict:
    """Возврат боту — тоже кнопкой, а не по таймеру."""
    return await _switch_mode(conv_id, ConversationMode.BOT_ACTIVE, "release")


@router.post("/conversations/{conv_id}/reply")
async def reply(conv_id: uuid.UUID, body: ReplyIn, request: Request) -> dict:
    """Реплика оператора в канал клиента."""
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="пустое сообщение")

    async with sessions()() as session:
        conv = await session.get(Conversation, conv_id)
        if conv is None:
            raise HTTPException(status_code=404, detail="диалог не найден")
        client = await session.get(Client, conv.client_id)
        channel, external_id = client.channel, client.external_id

    sender = build_reply_sender(request.app.state.settings)
    result = await sender.send(channel=channel, external_id=external_id, text=text)
    if not result.ok:
        # 🔴 В историю не пишем: иначе оператор видит отправленным то, что
        # клиенту не ушло, и второй раз уже не напишет.
        logger.warning("Панель: реплика оператора не ушла (%s)", result.error)
        raise HTTPException(status_code=502, detail="сообщение не отправлено")

    async with sessions()() as session:
        now = utcnow()
        session.add(
            Message(
                conversation_id=conv_id,
                role=MessageRole.OPERATOR,
                content=text,
                sent_by_us=True,
                created_at=now,
            )
        )
        conv = await session.get(Conversation, conv_id)
        conv.last_activity_at = now
        await session.commit()
    return {"status": "ok"}
