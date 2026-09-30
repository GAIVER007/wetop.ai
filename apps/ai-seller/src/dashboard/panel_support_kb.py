"""База знаний WETOP Support в панели бота (S3, plans/ai-agents-s3-knowledge-2026-09-29.md).

🔴 Все маршруты — только со служебным ключом платформы и только у помощника (BOT_ROLE=support): человек с логином в
панели бота, даже владелец, получает 403. Права главного администратора проверяет платформа и подставляет `by` и
`approved_by` из его сессии; бот их не выдумывает. Публикация без `approved_by` невозможна, а у модели команды
«создать» и «опубликовать» нет вовсе.
"""

from __future__ import annotations

import logging
import uuid

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from src.config import normalize_bot_role
from src.dashboard.auth_router import SERVICE_ACTOR_EMAIL, SERVICE_HEADER, current_user
from src.dashboard.panel_common import iso, log_action, sessions
from src.db.models import (
    Conversation,
    Message,
    SupportKnowledge,
    SupportKnowledgeVersion,
)
from src.knowledge import support_kb as kb

logger = logging.getLogger(__name__)

EXCERPT = 160


async def require_support_platform(request: Request, user=Depends(current_user)):
    """Только служебный ключ платформы у экземпляра-помощника."""
    settings = request.app.state.settings if hasattr(request.app.state, "settings") else None
    role = normalize_bot_role(getattr(settings, "bot_role", None)) if settings else None
    if role != "support" or request.headers.get(SERVICE_HEADER) is None or user.email != SERVICE_ACTOR_EMAIL:
        raise HTTPException(status_code=403, detail="База знаний открывается только из платформы WETOP")
    return user


router = APIRouter(dependencies=[Depends(require_support_platform)])


class EntryIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str
    category: str
    visibility: str
    content: str
    source: str | None = None
    by: str | None = Field(default=None, max_length=200)


class EntryPatch(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str | None = None
    category: str | None = None
    visibility: str | None = None
    content: str | None = None
    source: str | None = None
    by: str | None = Field(default=None, max_length=200)


class PublishIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    approved_by: str = Field(max_length=200)


class StatusIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    status: str
    by: str | None = Field(default=None, max_length=200)


class DraftIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    by: str | None = Field(default=None, max_length=200)


def _item(entry: SupportKnowledge) -> dict:
    return {
        "id": str(entry.id), "title": entry.title, "category": entry.category, "visibility": entry.visibility,
        "status": entry.status, "version": entry.version, "source": entry.source,
        "approved_by": entry.approved_by, "approved_at": iso(entry.approved_at),
        "created_at": iso(entry.created_at), "updated_at": iso(entry.updated_at),
    }


def _uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=400, detail="Неверный идентификатор") from None


async def _run(action):
    """Правила базы знаний -> 400 с текстом для кабинета; модель поиска недоступна -> 503."""
    try:
        return await action()
    except kb.KbError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None


def _embedder():
    from src.knowledge.embedder import get_embedder

    try:
        return get_embedder()
    except Exception:
        logger.exception("база знаний: модель поиска недоступна")
        raise HTTPException(status_code=503, detail="Модель поиска недоступна") from None


@router.get("/support-knowledge")
async def list_entries(
    status: str | None = None, category: str | None = None, visibility: str | None = None,
    q: str | None = None, limit: int = 100,
) -> dict:
    stmt = sa.select(SupportKnowledge).order_by(SupportKnowledge.updated_at.desc()).limit(max(1, min(limit, 200)))
    if status:
        stmt = stmt.where(SupportKnowledge.status == status.upper())
    if category:
        stmt = stmt.where(SupportKnowledge.category == category.upper())
    if visibility:
        stmt = stmt.where(SupportKnowledge.visibility == visibility.upper())
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(sa.or_(SupportKnowledge.title.ilike(like), SupportKnowledge.content.ilike(like)))
    async with sessions()() as session:
        rows = (await session.execute(stmt)).scalars().all()
        counts = dict(
            (await session.execute(sa.select(SupportKnowledge.status, sa.func.count()).group_by(SupportKnowledge.status))).all()
        )
    return {
        "items": [{**_item(row), "excerpt": row.content[:EXCERPT]} for row in rows],
        "counts": {name: int(counts.get(name, 0)) for name in ("DRAFT", "ACTIVE", "OUTDATED", "ARCHIVED")},
    }


@router.post("/support-knowledge")
async def create_entry(body: EntryIn) -> dict:
    async with sessions()() as session:
        entry = await _run(
            lambda: kb.create_entry(
                session, title=body.title, category=body.category, visibility=body.visibility,
                content=body.content, source=body.source or "manual", by=body.by,
            )
        )
        log_action(session, action="support_kb.create", payload={"id": str(entry.id), "by": body.by})
        await session.commit()
        return _item(entry)


@router.get("/support-knowledge/{knowledge_id}")
async def read_entry(knowledge_id: str) -> dict:
    kid = _uuid(knowledge_id)
    async with sessions()() as session:
        entry = await session.get(SupportKnowledge, kid)
        if entry is None:
            raise HTTPException(status_code=404, detail="Запись не найдена")
        versions = (
            await session.execute(
                sa.select(SupportKnowledgeVersion)
                .where(SupportKnowledgeVersion.knowledge_id == kid)
                .order_by(SupportKnowledgeVersion.version.desc())
            )
        ).scalars().all()
        return {
            **_item(entry), "content": entry.content,
            "versions": [
                {"version": v.version, "title": v.title, "category": v.category, "visibility": v.visibility,
                 "content": v.content, "saved_by": v.saved_by, "saved_at": iso(v.saved_at)}
                for v in versions
            ],
        }


@router.put("/support-knowledge/{knowledge_id}")
async def update_entry(knowledge_id: str, body: EntryPatch) -> dict:
    kid = _uuid(knowledge_id)
    async with sessions()() as session:
        entry = await _run(
            lambda: kb.update_entry(
                session, None, kid, by=body.by, title=body.title, category=body.category,
                visibility=body.visibility, content=body.content, source=body.source,
            )
        )
        log_action(session, action="support_kb.update", payload={"id": str(kid), "by": body.by, "version": entry.version})
        await session.commit()
        return _item(entry)


@router.post("/support-knowledge/{knowledge_id}/publish")
async def publish_entry(knowledge_id: str, body: PublishIn) -> dict:
    kid = _uuid(knowledge_id)
    embedder = _embedder()
    async with sessions()() as session:
        entry = await _run(lambda: kb.publish(session, embedder, kid, approved_by=body.approved_by))
        log_action(session, action="support_kb.publish", payload={"id": str(kid), "approved_by": body.approved_by, "version": entry.version})
        await session.commit()
        return _item(entry)


@router.post("/support-knowledge/{knowledge_id}/status")
async def set_entry_status(knowledge_id: str, body: StatusIn) -> dict:
    kid = _uuid(knowledge_id)
    async with sessions()() as session:
        entry = await _run(lambda: kb.set_status(session, kid, body.status, by=body.by))
        log_action(session, action="support_kb.status", payload={"id": str(kid), "status": entry.status, "by": body.by})
        await session.commit()
        return _item(entry)


@router.get("/conversations/{conv_id}/knowledge")
async def conversation_knowledge(conv_id: str) -> dict:
    """На каких знаниях строился ответ: для оператора; клиент этого не видит."""
    async with sessions()() as session:
        return {"items": await kb.conversation_sources(session, str(_uuid(conv_id)))}


@router.get("/conversations/{conv_id}/actions")
async def conversation_actions(conv_id: str) -> dict:
    """Журнал действий бота в диалоге (S6): для оператора; клиент этого не видит."""
    from src.ai.support_actions_journal import list_for_conversation

    async with sessions()() as session:
        return {"items": await list_for_conversation(session, str(_uuid(conv_id)))}


@router.post("/conversations/{conv_id}/knowledge-draft")
async def draft_from_conversation(conv_id: str, body: DraftIn) -> dict:
    """Из закрытого обращения — только пустой черновик; ничего из переписки не копируется."""
    cid = _uuid(conv_id)
    async with sessions()() as session:
        conversation = await session.get(Conversation, cid)
        if conversation is None:
            raise HTTPException(status_code=404, detail="Диалог не найден")
        if conversation.is_active:
            raise HTTPException(status_code=409, detail="Знание создаётся из закрытого обращения")
        entry = await _run(lambda: kb.draft_from_conversation(session, conversation_id=str(cid), by=body.by))
        log_action(session, action="support_kb.draft", payload={"id": str(entry.id), "by": body.by}, conversation_id=cid)
        await session.commit()
        return _item(entry)
