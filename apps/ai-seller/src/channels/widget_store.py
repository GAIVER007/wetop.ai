"""Виджет: клиент, диалог и чтение истории для опроса.

Вынесено из widget.py, потому что модуль канала режется на третьей сотне
строк (struktura.txt), а работа с базой — единственная часть, которую
маршруты используют целиком и не правят.

🔴 Внешний id клиента — ключ посетителя, всегда строка.
"""

from __future__ import annotations

import uuid

import sqlalchemy as sa

from src.channels.widget_identity import Visitor
from src.db.base import ConversationMode, MessageRole, utcnow
from src.db.models import Agent, Client, Conversation, Message

CHANNEL = "widget"
# Сколько реплик отдаём за один опрос: браузер догонит следующим запросом.
MAX_POLL_MESSAGES = 50


def new_flag_key(external_id: str) -> str:
    """Отметка «есть новое» для долгого опроса."""
    return f"widget:new:{external_id}"


async def _active_conversation(session, client_id) -> Conversation | None:
    stmt = (
        sa.select(Conversation)
        .where(Conversation.client_id == client_id, Conversation.is_active.is_(True))
        .order_by(Conversation.last_activity_at.desc())
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


def _same_agent(stmt, agent: Agent | None):
    """Отбор по АГЕНТУ двери (SA2.5; до неё — по организации, Э4). None — строки без организации (помощник и старые
    диалоги): NULL не равен NULL, поэтому явное IS NULL, а не ==."""
    if agent is None:
        return stmt.where(Client.organization_id.is_(None))
    return stmt.where(Client.agent_id == agent.id)


async def ensure_conversation(session, visitor: Visitor, agent: Agent | None = None) -> Conversation:
    """Тот же поиск, что делает движок в _accept: клиент по (канал, внешний
    id) в пределах агента и его активный диалог. Дальше движок найдёт их же."""
    stmt = _same_agent(
        sa.select(Client).where(Client.channel == CHANNEL, Client.external_id == visitor.key),
        agent,
    )
    client = (await session.execute(stmt)).scalar_one_or_none()
    if client is None:
        client = Client(channel=CHANNEL, external_id=visitor.key, name=visitor.display_name,
                        organization_id=agent.organization_id if agent else None,
                        agent_id=agent.id if agent else None, created_at=utcnow())
        session.add(client)
        await session.flush()
    conv = await _active_conversation(session, client.id)
    if conv is None:
        now = utcnow()
        conv = Conversation(client_id=client.id,
                            organization_id=agent.organization_id if agent else None,
                            agent_id=agent.id if agent else None,
                            lead_data={}, created_at=now, last_activity_at=now)
        session.add(conv)
        await session.flush()
    if visitor.signed:
        # Кто пишет — видно оператору в карточке и инструментам. Почта идёт
        # как есть: за ней оператор карточку и открывает.
        lead = dict(conv.lead_data or {})
        lead["platform_user"] = {"user_id": visitor.user_id, "email": visitor.email,
                                 "org_id": visitor.org_id, "role": visitor.role}
        conv.lead_data = lead
    await session.commit()
    return conv


async def conversation_for_key(session, key: str, agent: Agent | None = None) -> Conversation | None:
    """Активный диалог посетителя — в пределах агента двери. Нет клиента
    (или он чужой гостиницы либо чужого агента) — нет и диалога."""
    stmt = _same_agent(
        sa.select(Client.id).where(Client.channel == CHANNEL, Client.external_id == str(key)),
        agent,
    )
    client_id = (await session.execute(stmt)).scalar_one_or_none()
    if client_id is None:
        return None
    return await _active_conversation(session, client_id)


async def _marker(session, after: str):
    """Время последнего показанного сообщения. Метки нет или она чужая — None:
    лучше повтор в браузере, чем вечно пустой опрос."""
    if not after:
        return None
    try:
        message_id = uuid.UUID(str(after))
    except (ValueError, AttributeError, TypeError):
        return None
    stmt = sa.select(Message.created_at).where(Message.id == message_id)
    return (await session.execute(stmt)).scalar_one_or_none()


async def load_messages(
    sessionmaker, key: str, after: str, agent: Agent | None = None
) -> tuple[list[dict], str]:
    """Новые сообщения и режим диалога.

    🔴 Только сообщения ЭТОГО диалога: ключ приводит ровно к одному клиенту
    своего агента — ключом другого агента, даже той же гостиницы, историю не открыть.
    """
    async with sessionmaker() as session:
        conv = await conversation_for_key(session, key, agent)
        if conv is None:
            return [], ConversationMode.BOT_ACTIVE.value
        stmt = sa.select(Message).where(Message.conversation_id == conv.id)
        marker = await _marker(session, after)
        if marker is not None:
            # Отбор в SQL, а не после выборки: иначе опрос тянет всю историю
            # ради одной реплики.
            stmt = stmt.where(Message.created_at > marker)
        rows = list(
            (await session.execute(stmt.order_by(Message.created_at).limit(MAX_POLL_MESSAGES)))
            .scalars()
        )
        messages = [
            {"id": str(m.id), "role": m.role.value, "text": m.content,
             "at": m.created_at.isoformat(), "from_operator": m.role == MessageRole.OPERATOR}
            for m in rows
        ]
        return messages, conv.mode.value
