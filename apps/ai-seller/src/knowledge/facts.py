"""Факты объекта от платформы в базу знаний (ТЗ интеграции, Б7).

Адрес, заезд, категории и цены — источник правды платформа, а не бот.
Бот получает их документом и 🔴 заменяет прежний, а не кладёт рядом:
иначе старая цена остаётся в поиске вместе с новой.
"""

from __future__ import annotations

import hashlib
import uuid
from typing import Annotated, Literal

import sqlalchemy as sa
from pydantic import BaseModel, ConfigDict, Field

from src.db.models import Document
from src.knowledge.ingestor import ingest_document

# Расширение обязательно: приём документа определяет формат по имени источника.
SOURCE = "platform:facts.md"
_TIME = r"^([01]\d|2[0-3]):[0-5]\d$"
_SYMBOL = {"KZT": "₸", "RUB": "₽", "USD": "$", "EUR": "€"}
_KIND = {"room": "номер", "bed": "койка"}


class Category(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Annotated[str, Field(min_length=1, max_length=120)]
    kind: Literal["room", "bed"]
    capacity: Annotated[int, Field(ge=1, le=50)]
    # Минорные единицы (тиын, копейки): деньги не float. None — цены нет.
    price_minor: Annotated[int, Field(ge=0)] | None = None


class ObjectFacts(BaseModel):
    """extra='forbid': поле «скидка всем 50%» не протащить мимо схемы."""

    model_config = ConfigDict(extra="forbid")
    object_name: Annotated[str, Field(min_length=1, max_length=120)]
    address: Annotated[str, Field(max_length=300)] = ""
    timezone: Annotated[str, Field(max_length=64)] = ""
    check_in: Annotated[str, Field(pattern=_TIME)]
    check_out: Annotated[str, Field(pattern=_TIME)]
    currency: Annotated[str, Field(pattern=r"^[A-Z]{3}$")]
    categories: Annotated[list[Category], Field(max_length=50)] = []


def money(minor: int | None, currency: str) -> str:
    """Отображение, а не расчёт: 1 100 050 минорных -> «11 000,50 ₸».
    Целочисленное деление, без float: копейки не теряются округлением."""
    if minor is None:
        return "уточнит администратор"
    major, cents = divmod(minor, 100)
    text = f"{major:,}".replace(",", " ")
    if cents:
        text += f",{cents:02d}"
    return f"{text} {_SYMBOL.get(currency, currency)}"


def render(facts: ObjectFacts) -> str:
    """Markdown с таблицей: нарезка разворачивает её построчно с шапкой,
    и строка «Категория: …; Цена за ночь: …» находится коротким вопросом."""
    zone = f" (местное время, {facts.timezone})" if facts.timezone else ""
    lines = [
        f"# {facts.object_name}: адрес, заезд и цены",
        "",
    ]
    if facts.address:
        lines.append(f"Адрес: {facts.address}.")
    lines += [f"Заезд с {facts.check_in}, выезд до {facts.check_out}{zone}.", ""]
    if facts.categories:
        lines += [
            "## Категории и цены",
            "",
            "| Категория | Тип | Вместимость | Цена за ночь |",
            "|---|---|---|---|",
        ]
        lines += [
            f"| {c.name} | {_KIND[c.kind]} | {c.capacity} | {money(c.price_minor, facts.currency)} |"
            for c in facts.categories
        ]
    return "\n".join(lines).strip() + "\n"


async def replace_facts(
    session, embedder, facts: ObjectFacts, *, organization_id: uuid.UUID | None = None, **ingest_kwargs
) -> str:
    """Заменить факты одной транзакцией. Возвращает 'unchanged' или 'replaced'.

    organization_id (Э4): у каждой гостиницы свой platform:facts.md — замена
    фактов одной не трогает цены другой.

    🔴 Удаление старых и запись новых фиксируются вместе: ingest_document делает
    единственный commit в конце. Упала запись (инъекция в поле, отказ модели
    эмбеддингов) — откат уносит и удаление, прежние факты остаются целыми,
    а платформа получает отказ и повторяет. Бот не остаётся без цен.
    """
    data = render(facts).encode("utf-8")
    digest = hashlib.sha256(data).hexdigest()
    stmt = sa.select(Document).where(Document.source == SOURCE)
    if organization_id is not None:
        stmt = stmt.where(Document.organization_id == organization_id)
    old = (await session.execute(stmt)).scalars().all()
    if any(doc.file_hash == digest for doc in old):
        return "unchanged"
    try:
        for doc in old:
            await session.delete(doc)  # каскад ORM уносит куски документа
        await ingest_document(session, embedder, source=SOURCE, data=data,
                              organization_id=organization_id, **ingest_kwargs)
    except Exception:
        await session.rollback()
        raise
    return "replaced"
