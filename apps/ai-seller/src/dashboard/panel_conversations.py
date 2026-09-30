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
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict

from src import dependencies
from src.config import Settings
from src.dashboard.auth_router import request_org
from src.dashboard.panel_common import iso, log_action, mask_name, sessions
from src.db.base import ConversationMode, MessageRole, utcnow
from src.db.models import Client, Conversation, Message

logger = logging.getLogger(__name__)

router = APIRouter()


class ReplyIn(BaseModel):
    """Лишние поля отбрасываем, а не роняем запрос."""

    model_config = ConfigDict(extra="ignore")

    text: str


def build_reply_sender(
    settings: Settings, channel: str | None = None, organization: uuid.UUID | None = None
):
    """Отправитель канала для реплики оператора.

    🔴 Реплика уходит тем же путём, что ответ бота в ЭТОМ канале. Виджет вытягивает
    сообщения сам: доставка там — запись в историю, очереди нет намеренно. WhatsApp
    так не работает: гость получит текст, только если он ушёл в Graph API токеном
    гостиницы диалога (BUG-WA-1, Q-SA-7). Раньше любой канал шёл через виджетного
    отправителя, и оператор видел «отправлено» там, где гость ничего не получил.
    Импорт внутри: модуль канала не нужен тем, кто подменяет отправителя в тестах.
    """
    from src.channels.whatsapp import CHANNEL as WHATSAPP_CHANNEL

    if channel == WHATSAPP_CHANNEL:
        from src.channels.whatsapp import WhatsAppSender

        return WhatsAppSender(dependencies.get_sessionmaker(), settings, organization)

    from src.channels.widget import WidgetSender

    return WidgetSender(redis=dependencies.get_redis())


QUEUES = ("new", "waiting")
# Строка списка — не переписка: хвост последнего сообщения, чтобы понять, о чём речь
LAST_MESSAGE_MAX = 160
NEW_WINDOW = timedelta(hours=24)


def _utc(value: datetime | str | None) -> datetime | None:
    """Итог агрегата времени: Postgres отдаёт его с поясом, sqlite тестов — без пояса или строкой.
    Время в базе ставит приложение и всегда в UTC."""
    if value is None:
        return None
    if isinstance(value, str):
        value = datetime.fromisoformat(value)
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _preview(text: str) -> str:
    flat = " ".join(text.split())
    return flat if len(flat) <= LAST_MESSAGE_MAX else flat[: LAST_MESSAGE_MAX - 1].rstrip() + "…"


@router.get("/conversations")
async def list_conversations(
    mode: str | None = None,
    queue: str | None = None,
    nonempty: bool = False,
    closed: bool | None = None,
    limit: int = 50,
    org: uuid.UUID | None = Depends(request_org),
) -> dict:
    """Список диалогов. 🔴 Телефона в ответе нет, имя маскировано.
    У продавца — только диалоги организации из X-Organization (Э4).

    Очередь техподдержки (S1): `nonempty` — без диалогов без сообщений, `queue=new` — начатые за сутки,
    `queue=waiting` — последнее слово за пользователем, `closed` — закрытые (`is_active = false`) или открытые;
    без параметров ответ прежний — все диалоги."""
    try:
        wanted = ConversationMode(mode) if mode else None
    except ValueError:
        raise HTTPException(status_code=400, detail="неизвестный режим диалога") from None
    if queue and queue not in QUEUES:
        raise HTTPException(status_code=400, detail="неизвестная очередь")

    counts = (
        sa.select(Message.conversation_id.label("cid"), sa.func.count().label("n"))
        .group_by(Message.conversation_id)
        .subquery()
    )
    # Последний ответ (бота, человека или системы) — от него считается ожидание
    answered = (
        sa.select(Message.conversation_id.label("cid"), sa.func.max(Message.created_at).label("at"))
        .where(Message.role != MessageRole.USER)
        .group_by(Message.conversation_id)
        .subquery()
    )
    waiting = (
        sa.select(Message.conversation_id.label("cid"), sa.func.min(Message.created_at).label("since"))
        .outerjoin(answered, answered.c.cid == Message.conversation_id)
        .where(
            Message.role == MessageRole.USER,
            sa.or_(answered.c.at.is_(None), Message.created_at > answered.c.at),
        )
        .group_by(Message.conversation_id)
        .subquery()
    )
    stmt = (
        sa.select(Conversation, Client, sa.func.coalesce(counts.c.n, 0), waiting.c.since)
        .join(Client, Client.id == Conversation.client_id)
        .outerjoin(counts, counts.c.cid == Conversation.id)
        .outerjoin(waiting, waiting.c.cid == Conversation.id)
        .order_by(Conversation.last_activity_at.desc())
        # Отбор и предел — в SQL: фильтрация после выборки на живой базе
        # означает, что панель тянет всю таблицу ради двадцати строк.
        .limit(max(1, min(limit, 200)))
    )
    if wanted is not None:
        stmt = stmt.where(Conversation.mode == wanted)
    if org is not None:
        stmt = stmt.where(Conversation.organization_id == org)
    if nonempty:
        stmt = stmt.where(counts.c.n > 0)
    if closed is not None:
        stmt = stmt.where(Conversation.is_active.is_(not closed))
    if queue == "waiting":
        stmt = stmt.where(waiting.c.since.is_not(None))
    elif queue == "new":
        stmt = stmt.where(Conversation.created_at >= utcnow() - NEW_WINDOW)

    async with sessions()() as session:
        rows = (await session.execute(stmt)).all()
        last = await _last_messages(session, [conv.id for conv, *_ in rows])
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
                "started_at": iso(conv.created_at),
                "last_message": last.get(conv.id),
                "waiting_since": iso(_utc(since)),
                "closed": not conv.is_active,
            }
            for conv, client, count, since in rows
        ]
    }


async def _last_messages(session, conversation_ids: list[uuid.UUID]) -> dict[uuid.UUID, dict]:
    """Последнее сообщение каждого диалога страницы — одним запросом, не по запросу на строку."""
    if not conversation_ids:
        return {}
    ranked = (
        sa.select(
            Message.conversation_id,
            Message.role,
            Message.content,
            Message.created_at,
            sa.func.row_number()
            .over(partition_by=Message.conversation_id, order_by=Message.created_at.desc())
            .label("rn"),
        )
        .where(Message.conversation_id.in_(conversation_ids))
        .subquery()
    )
    result = await session.execute(sa.select(ranked).where(ranked.c.rn == 1))
    return {
        row.conversation_id: {
            "role": row.role.value if hasattr(row.role, "value") else str(row.role),
            "text": _preview(row.content or ""),
            "at": iso(row.created_at),
        }
        for row in result
    }


def _foreign(conv: Conversation | None, org: uuid.UUID | None) -> bool:
    """Чужой диалог для организации запроса — как несуществующий (Э4):
    404 не подтверждает чужому даже сам факт диалога."""
    return conv is not None and org is not None and conv.organization_id != org


@router.get("/conversations/{conv_id}")
async def conversation_card(conv_id: uuid.UUID, org: uuid.UUID | None = Depends(request_org)) -> dict:
    """Карточка: контакт целиком — оператор за ним и пришёл."""
    async with sessions()() as session:
        conv = await session.get(Conversation, conv_id)
        if conv is None or _foreign(conv, org):
            raise HTTPException(status_code=404, detail="диалог не найден")
        client = await session.get(Client, conv.client_id)
        stmt = sa.select(Message).where(Message.conversation_id == conv_id).order_by(Message.created_at)
        messages = (await session.execute(stmt)).scalars().all()
    return {
        "id": str(conv.id),
        "mode": conv.mode.value,
        "stage": conv.funnel_stage.value,
        "closed": not conv.is_active,
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


async def _switch_mode(
    conv_id: uuid.UUID, target: ConversationMode, action: str, org: uuid.UUID | None
) -> dict:
    """Смена режима руками оператора + запись прежнего значения в журнал."""
    async with sessions()() as session:
        conv = await session.get(Conversation, conv_id)
        if conv is None or _foreign(conv, org):
            raise HTTPException(status_code=404, detail="диалог не найден")
        previous = conv.mode.value
        conv.mode = target
        log_action(session, action=action, payload={"previous_mode": previous}, conversation_id=conv.id)
        await session.commit()
    return {"status": "ok", "mode": target.value, "previous_mode": previous}


@router.post("/conversations/{conv_id}/takeover")
async def takeover(conv_id: uuid.UUID, org: uuid.UUID | None = Depends(request_org)) -> dict:
    """Перехват: дальше отвечает человек."""
    return await _switch_mode(conv_id, ConversationMode.OWNER_TAKEOVER, "takeover", org)


@router.post("/conversations/{conv_id}/release")
async def release(conv_id: uuid.UUID, org: uuid.UUID | None = Depends(request_org)) -> dict:
    """Возврат боту — тоже кнопкой, а не по таймеру."""
    return await _switch_mode(conv_id, ConversationMode.BOT_ACTIVE, "release", org)


@router.post("/conversations/{conv_id}/close")
async def close(conv_id: uuid.UUID, org: uuid.UUID | None = Depends(request_org)) -> dict:
    """Закрыть обращение: диалог уходит в «Закрытые» с перепиской, следующее сообщение того же человека
    откроет новый диалог — движок и виджет ищут диалог клиента по `is_active`."""
    async with sessions()() as session:
        conv = await session.get(Conversation, conv_id)
        if conv is None or _foreign(conv, org):
            raise HTTPException(status_code=404, detail="диалог не найден")
        was_active = conv.is_active
        conv.is_active = False
        log_action(
            session,
            action="close",
            payload={"mode": conv.mode.value, "was_active": was_active},
            conversation_id=conv.id,
        )
        await session.commit()
    return {"status": "ok", "closed": True}


@router.post("/conversations/{conv_id}/reply")
async def reply(
    conv_id: uuid.UUID,
    body: ReplyIn,
    request: Request,
    org: uuid.UUID | None = Depends(request_org),
) -> dict:
    """Реплика оператора в канал клиента."""
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="пустое сообщение")

    async with sessions()() as session:
        conv = await session.get(Conversation, conv_id)
        if conv is None or _foreign(conv, org):
            raise HTTPException(status_code=404, detail="диалог не найден")
        client = await session.get(Client, conv.client_id)
        channel, external_id = client.channel, client.external_id
        conv_org = conv.organization_id or org

    sender = build_reply_sender(request.app.state.settings, channel=channel, organization=conv_org)
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
