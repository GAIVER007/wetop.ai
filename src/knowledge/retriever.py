"""Поиск по базе знаний: чистый вектор.

Развилка кита (SBOROCHNYY-PROMPT.md, «Развилка · поиск по базе знаний»):
у объекта нет каталога, поэтому гибрид pgvector + ts_rank_cd не собираем.
Точка слияния оставлена: fuse() — Reciprocal Rank Fusion, search() её пока
не вызывает. Когда появится каталог, второе ранжирование (полнотекст)
добавляется здесь, а не в движке диалога.
"""

from __future__ import annotations

import math
import uuid
from dataclasses import dataclass
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import KnowledgeChunk

if TYPE_CHECKING:  # только для аннотаций: retriever не зависит от загрузки модели
    from src.knowledge.embedder import Embedder


@dataclass
class RetrievedChunk:
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    content: str
    score: float  # косинусная близость в [-1, 1], выше — ближе
    meta: dict | None


def _dialect_name(session: AsyncSession) -> str:
    bind = session.bind if session.bind is not None else session.get_bind()
    return bind.dialect.name


def _cosine_distance(vec: list[float]) -> sa.ColumnElement[float]:
    """Косинусное расстояние pgvector (`<=>`) до вектора запроса.

    Оператором, а не .cosine_distance(): колонка объявлена через TypeDecorator,
    и метод компаратора pgvector на ней недоступен. return_type обязателен:
    без него результату приписывается тип левого операнда (VectorType), и
    pgvector пытается разобрать число float8 как строку «[…]» — падение на
    первом же ответе.
    """
    return KnowledgeChunk.embedding.op("<=>", return_type=sa.Float())(vec)


def _cosine(a: list[float], b: list[float]) -> float:
    """Косинус двух векторов. Нормировку не предполагаем: считаем честно."""
    dot = sum(x * y for x, y in zip(a, b, strict=False))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / (na * nb)


async def search(
    session: AsyncSession, embedder: Embedder, query: str, *, top_k: int
) -> list[RetrievedChunk]:
    """Ближайшие top_k чанков к запросу по косинусу, по убыванию оценки.

    Postgres — расстояние считает pgvector (оператор <=>, индекс hnsw из
    миграции). SQLite (только тесты) — косинус в Python по всем чанкам:
    индекса нет, но и данных в тестах мало.
    """
    if not query.strip() or top_k <= 0:
        return []
    vec = await embedder.embed_query(query)

    if _dialect_name(session) == "postgresql":
        distance = _cosine_distance(vec).label("distance")
        stmt = (
            sa.select(KnowledgeChunk, distance)
            .where(KnowledgeChunk.embedding.is_not(None))
            .order_by(distance)
            .limit(top_k)
        )
        rows = (await session.execute(stmt)).all()
        return [
            RetrievedChunk(
                chunk_id=chunk.id,
                document_id=chunk.document_id,
                content=chunk.content,
                score=1.0 - float(dist),
                meta=chunk.chunk_metadata,
            )
            for chunk, dist in rows
        ]

    stmt = sa.select(KnowledgeChunk).where(KnowledgeChunk.embedding.is_not(None))
    chunks = (await session.execute(stmt)).scalars().all()
    scored = [
        RetrievedChunk(
            chunk_id=chunk.id,
            document_id=chunk.document_id,
            content=chunk.content,
            score=_cosine(vec, list(chunk.embedding)),
            meta=chunk.chunk_metadata,
        )
        for chunk in chunks
        if chunk.embedding
    ]
    scored.sort(key=lambda r: r.score, reverse=True)
    return scored[:top_k]


def fuse(rankings: list[list[uuid.UUID]], *, k: int = 60) -> list[uuid.UUID]:
    """Reciprocal Rank Fusion: score(id) = Σ 1 / (k + позиция) по всем ранжированиям.

    Точка расширения для гибрида (вектор + полнотекст), см. развилку кита.
    k=60 — значение из исходной статьи RRF; сглаживает вклад верхних позиций,
    чтобы одно ранжирование не перекрывало другое.
    """
    scores: dict[uuid.UUID, float] = {}
    for ranking in rankings:
        for position, item in enumerate(ranking, start=1):
            scores[item] = scores.get(item, 0.0) + 1.0 / (k + position)
    return sorted(scores, key=lambda item: scores[item], reverse=True)
