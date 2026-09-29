"""Управляемая база знаний WETOP Support (S3, plans/ai-agents-s3-knowledge-2026-09-29.md).

🔴 Отвечает клиенту только ACTIVE. Публикует только тот, у кого есть approved_by: платформа подставляет id главного
администратора из его сессии, у бота команды «опубликовать» для модели нет. Правка активной записи уводит её в DRAFT.
🔴 PLATFORM_ADMIN_ONLY в разговоре с клиентом (audience="client") до модели не доходит вовсе.
Агент сам ничего не пишет и не «учится»: закрытый диалог даёт максимум черновик, который дописывает человек.
"""

from __future__ import annotations

import math
import uuid
from dataclasses import dataclass
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.base import utcnow
from src.db.models import (
    KB_CATEGORIES,
    KB_STATUSES,
    KB_VISIBILITIES,
    SupportKnowledge,
    SupportKnowledgeChunk,
    SupportKnowledgeUsage,
    SupportKnowledgeVersion,
)
from src.knowledge.chunker import split_text
from src.knowledge.retriever import _cosine, _cosine_distance, _dialect_name

if TYPE_CHECKING:
    from src.knowledge.embedder import Embedder

TITLE_MAX = 200
SOURCE_MAX = 200
CONTENT_MAX = 20_000
# Кому что видно. Клиенту — публичное и внутреннее; закрытое — только администратору платформы (песочница S9).
AUDIENCES = {
    "client": ("PUBLIC_SUPPORT", "INTERNAL_SUPPORT"),
    "platform_admin": ("PUBLIC_SUPPORT", "INTERNAL_SUPPORT", "PLATFORM_ADMIN_ONLY"),
}
DRAFT_TEMPLATE = "Симптом:\n\nПричина:\n\nЧто делать:\n"


class KbError(Exception):
    """Ошибка правил базы знаний; текст — человеку в кабинете."""


@dataclass
class KbHit:
    knowledge_id: uuid.UUID
    version: int
    title: str
    category: str
    visibility: str
    source: str
    content: str
    score: float
    confidence: str  # HIGH | MEDIUM | LOW


def _clean(value: object, name: str, limit: int, *, required: bool = True) -> str:
    text = str(value or "").strip()
    if required and not text:
        raise KbError(f"{name}: поле обязательно")
    if len(text) > limit:
        raise KbError(f"{name}: не длиннее {limit} знаков")
    return text


def _choice(value: object, name: str, allowed: tuple[str, ...]) -> str:
    text = str(value or "").strip().upper()
    if text not in allowed:
        raise KbError(f"{name}: допустимо {', '.join(allowed)}")
    return text


async def _snapshot(session: AsyncSession, entry: SupportKnowledge, by: str | None) -> None:
    session.add(
        SupportKnowledgeVersion(
            knowledge_id=entry.id, version=entry.version, title=entry.title, category=entry.category,
            visibility=entry.visibility, content=entry.content, saved_by=by, saved_at=utcnow(),
        )
    )


async def _drop_chunks(session: AsyncSession, knowledge_id: uuid.UUID) -> None:
    await session.execute(sa.delete(SupportKnowledgeChunk).where(SupportKnowledgeChunk.knowledge_id == knowledge_id))


async def _get(session: AsyncSession, knowledge_id: uuid.UUID) -> SupportKnowledge:
    entry = await session.get(SupportKnowledge, knowledge_id)
    if entry is None:
        raise KbError("Запись не найдена")
    return entry


async def create_entry(
    session: AsyncSession, *, title: str, category: str, visibility: str, content: str,
    source: str = "manual", by: str | None,
) -> SupportKnowledge:
    now = utcnow()
    entry = SupportKnowledge(
        title=_clean(title, "title", TITLE_MAX),
        category=_choice(category, "category", KB_CATEGORIES),
        visibility=_choice(visibility, "visibility", KB_VISIBILITIES),
        status="DRAFT", version=1,
        source=_clean(source or "manual", "source", SOURCE_MAX),
        content=_clean(content, "content", CONTENT_MAX),
        created_at=now, updated_at=now,
    )
    session.add(entry)
    await session.flush()
    await _snapshot(session, entry, by)
    return entry


async def update_entry(
    session: AsyncSession, embedder: "Embedder | None", knowledge_id: uuid.UUID, *, by: str | None,
    title: str | None = None, category: str | None = None, visibility: str | None = None,
    content: str | None = None, source: str | None = None,
) -> SupportKnowledge:
    """Правка: версия растёт; активная запись возвращается в DRAFT и перестаёт отвечать до нового утверждения."""
    entry = await _get(session, knowledge_id)
    changed = False
    if title is not None:
        entry.title, changed = _clean(title, "title", TITLE_MAX), True
    if category is not None:
        entry.category, changed = _choice(category, "category", KB_CATEGORIES), True
    if visibility is not None:
        entry.visibility, changed = _choice(visibility, "visibility", KB_VISIBILITIES), True
    if content is not None:
        entry.content, changed = _clean(content, "content", CONTENT_MAX), True
    if source is not None:
        entry.source, changed = _clean(source, "source", SOURCE_MAX), True
    if not changed:
        return entry
    entry.version += 1
    entry.updated_at = utcnow()
    if entry.status == "ACTIVE":
        entry.status = "DRAFT"
        entry.approved_by = None
        entry.approved_at = None
        await _drop_chunks(session, entry.id)
    await session.flush()
    await _snapshot(session, entry, by)
    return entry


async def publish(
    session: AsyncSession, embedder: "Embedder", knowledge_id: uuid.UUID, *, approved_by: str | None
) -> SupportKnowledge:
    """DRAFT → ACTIVE. Без approved_by нельзя; чанки строятся заново (повторная публикация дублей не даёт)."""
    approver = str(approved_by or "").strip()
    if not approver:
        raise KbError("Публикует только главный администратор платформы")
    entry = await _get(session, knowledge_id)
    if entry.status != "DRAFT":
        raise KbError("Опубликовать можно только черновик")
    pieces = split_text(entry.content, chunk_chars=900, overlap=150, min_chars=40)
    if not pieces:
        raise KbError("content: пустой текст опубликовать нельзя")
    vectors = await embedder.embed_passages([piece.text for piece in pieces])
    await _drop_chunks(session, entry.id)
    now = utcnow()
    for piece, vector in zip(pieces, vectors):
        session.add(
            SupportKnowledgeChunk(
                knowledge_id=entry.id, version=entry.version, chunk_index=piece.index,
                content=piece.text, embedding=vector, created_at=now,
            )
        )
    entry.status = "ACTIVE"
    entry.approved_by = approver[:200]
    entry.approved_at = now
    entry.updated_at = now
    await session.flush()
    return entry


async def set_status(session: AsyncSession, knowledge_id: uuid.UUID, status: str, *, by: str | None) -> SupportKnowledge:
    """DRAFT / OUTDATED / ARCHIVED. ACTIVE ставится только публикацией. Не-ACTIVE индекса не имеет."""
    target = _choice(status, "status", KB_STATUSES)
    if target == "ACTIVE":
        raise KbError("Активной запись делает только публикация")
    entry = await _get(session, knowledge_id)
    if entry.status == target:
        return entry
    entry.status = target
    entry.approved_by = None if target == "DRAFT" else entry.approved_by
    entry.approved_at = None if target == "DRAFT" else entry.approved_at
    entry.updated_at = utcnow()
    await _drop_chunks(session, entry.id)
    await session.flush()
    return entry


def confidence_of(score: float, *, high: float, medium: float) -> str:
    if score >= high:
        return "HIGH"
    if score >= medium:
        return "MEDIUM"
    return "LOW"


async def search(
    session: AsyncSession, embedder: "Embedder", query: str, *, audience: str = "client", top_k: int = 3,
    high: float = 0.85, medium: float = 0.78,
) -> list[KbHit]:
    """Ближайшие ACTIVE-записи, видимые аудитории. Одна запись — один результат (лучший её чанк)."""
    visible = AUDIENCES.get(audience)
    if visible is None or not query.strip() or top_k <= 0:
        return []
    vec = await embedder.embed_query(query)
    base = (
        sa.select(SupportKnowledgeChunk, SupportKnowledge)
        .join(SupportKnowledge, SupportKnowledge.id == SupportKnowledgeChunk.knowledge_id)
        .where(
            SupportKnowledge.status == "ACTIVE",
            SupportKnowledge.visibility.in_(visible),
            SupportKnowledgeChunk.version == SupportKnowledge.version,
            SupportKnowledgeChunk.embedding.is_not(None),
        )
    )
    scored: list[tuple[float, SupportKnowledgeChunk, SupportKnowledge]] = []
    if _dialect_name(session) == "postgresql":
        distance = _cosine_distance(vec).label("distance")
        rows = (await session.execute(base.add_columns(distance).order_by(distance).limit(top_k * 4))).all()
        scored = [(1.0 - float(dist), chunk, entry) for chunk, entry, dist in rows]
    else:
        rows = (await session.execute(base)).all()
        scored = [(_cosine(vec, list(chunk.embedding)), chunk, entry) for chunk, entry in rows]
        scored.sort(key=lambda item: item[0], reverse=True)
    hits: list[KbHit] = []
    seen: set[uuid.UUID] = set()
    for score, chunk, entry in scored:
        if entry.id in seen or math.isnan(score):
            continue
        seen.add(entry.id)
        hits.append(
            KbHit(
                knowledge_id=entry.id, version=entry.version, title=entry.title, category=entry.category,
                visibility=entry.visibility, source=entry.source, content=entry.content, score=score,
                confidence=confidence_of(score, high=high, medium=medium),
            )
        )
        if len(hits) >= top_k:
            break
    return hits


async def record_usage(session: AsyncSession, *, conversation_id: str | None, hits: list[KbHit]) -> None:
    now = utcnow()
    for hit in hits:
        session.add(
            SupportKnowledgeUsage(
                conversation_id=conversation_id, knowledge_id=hit.knowledge_id, version=hit.version,
                visibility=hit.visibility, score=hit.score, used_at=now,
            )
        )
    await session.flush()


async def conversation_sources(session: AsyncSession, conversation_id: str) -> list[dict]:
    """Знания, на которых строился ответ в диалоге: для оператора в кабинете (клиенту не отдаётся)."""
    rows = (
        await session.execute(
            sa.select(SupportKnowledgeUsage, SupportKnowledge.title)
            .join(SupportKnowledge, SupportKnowledge.id == SupportKnowledgeUsage.knowledge_id)
            .where(SupportKnowledgeUsage.conversation_id == conversation_id)
            .order_by(SupportKnowledgeUsage.used_at)
        )
    ).all()
    seen: set[tuple[uuid.UUID, int]] = set()
    out: list[dict] = []
    for usage, title in rows:
        key = (usage.knowledge_id, usage.version)
        if key in seen:
            continue
        seen.add(key)
        out.append(
            {
                "knowledge_id": str(usage.knowledge_id), "title": title, "version": usage.version,
                "visibility": usage.visibility, "score": round(usage.score, 3),
                "used_at": usage.used_at.isoformat(),
            }
        )
    return out


async def draft_from_conversation(
    session: AsyncSession, *, conversation_id: str, by: str | None
) -> SupportKnowledge:
    """Из закрытого обращения — только черновик по шаблону. Ни вопрос, ни ответы из обращения не копируются: в них
    чужие данные; администратор открывает обращение по ссылке в `source` и пишет знание сам."""
    title = f"Знание из обращения от {utcnow().strftime('%d.%m.%Y')}"
    return await create_entry(
        session, title=title, category="TROUBLESHOOTING", visibility="INTERNAL_SUPPORT",
        content=DRAFT_TEMPLATE, source=f"conversation:{conversation_id}", by=by,
    )
