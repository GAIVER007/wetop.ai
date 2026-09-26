"""Приём документа в базу знаний: предел размера → дедуп по хешу → разбор →
нарезка → эмбеддинги → запись.

Порядок важен: размер проверяется ДО чтения (один тяжёлый файл кладёт
процесс, и снаружи это выглядит как «бот замолчал»), а «уже загружено»
проверяется ДО любой записи (идемпотентность по натуральному ключу — хешу).
Разборщики форматов — ниже, в этом же файле: тяжёлые библиотеки
(pypdf, python-docx, openpyxl) импортируются внутри функций, чтобы модуль
грузился быстро и без них там, где разбор не нужен.
"""

from __future__ import annotations

import hashlib
import io
import logging
import uuid
from dataclasses import dataclass
from pathlib import PurePosixPath

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.guardrails import scan_document
from src.db.base import utcnow
from src.db.models import Document, KnowledgeChunk
from src.knowledge.chunker import split_text
from src.knowledge.embedder import Embedder

logger = logging.getLogger(__name__)


# ─── Форматы и разборщики ───


ACCEPTED_FORMATS: tuple[str, ...] = (".md", ".txt", ".pdf", ".docx", ".xlsx")


class UnsupportedFormat(ValueError):
    """Формат не из списка: отказываем внятно, с перечнем того, что принимаем."""

    def __init__(self, extension: str) -> None:
        accepted = ", ".join(ACCEPTED_FORMATS)
        super().__init__(f"Формат «{extension or 'без расширения'}» не принимается. Принимаем: {accepted}.")


class FileTooLarge(ValueError):
    """Файл больше предела. Текст без внутренних имён — он уходит пользователю панели."""


class SuspiciousDocument(ValueError):
    """В документе найдены инструкции для модели (слой 9).

    Инструкция, спрятанная в прайсе, работает как присланная в чат, поэтому
    документ проходит те же проверки входа. Содержимое в текст ошибки
    не цитируется: он уходит в панель и в журнал.
    """


def check_size(declared_bytes: int, max_bytes: int) -> None:
    """Проверка ДО чтения файла: по Content-Length или размеру загрузки."""
    if declared_bytes > max_bytes:
        limit_mb = max_bytes / (1024 * 1024)
        actual_mb = declared_bytes / (1024 * 1024)
        raise FileTooLarge(
            f"Файл слишком большой: {actual_mb:.1f} МБ, предел {limit_mb:.0f} МБ."
        )


def extract_text(filename: str, data: bytes) -> str:
    """Текст файла по расширению (регистр не важен)."""
    extension = PurePosixPath(filename).suffix.lower()
    if extension in (".md", ".txt"):
        return _decode_text(data)
    if extension == ".pdf":
        return _extract_pdf(data)
    if extension == ".docx":
        return _extract_docx(data)
    if extension == ".xlsx":
        return _extract_xlsx(data)
    raise UnsupportedFormat(extension)


def _decode_text(data: bytes) -> str:
    """utf-8 (с BOM), иначе cp1251: кодировку определяем, не предполагаем.

    Файлы от заказчика из Windows приходят в cp1251, и «решётки» вместо
    русских букв в чанках заметят только когда бот начнёт отвечать не то.
    """
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        # errors="replace": в cp1251 не определён байт 0x98; один символ
        # не стоит целого файла заказчика.
        return data.decode("cp1251", errors="replace")


def _extract_pdf(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    pages = [(page.extract_text() or "").strip() for page in reader.pages]
    return "\n\n".join(p for p in pages if p)


def _extract_docx(data: bytes) -> str:
    """Абзацы и таблицы в порядке документа; таблица — markdown-таблицей."""
    from docx import Document as DocxDocument
    from docx.table import Table

    document = DocxDocument(io.BytesIO(data))
    parts: list[str] = []
    for block in document.iter_inner_content():
        if isinstance(block, Table):
            rows = [[cell.text for cell in row.cells] for row in block.rows]
            table = _markdown_table(rows)
            if table:
                parts.append(table)
        else:
            text = block.text.strip()
            if text:
                parts.append(text)
    return "\n\n".join(parts)


def _extract_xlsx(data: bytes) -> str:
    """Каждый лист — markdown-таблица под заголовком с именем листа.

    Имя листа идёт заголовком, чтобы chunker приклеил его к строкам
    как контекст («Цены — Тариф: …»). Первая непустая строка — шапка.
    """
    from openpyxl import load_workbook

    workbook = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    parts: list[str] = []
    try:
        for sheet in workbook.worksheets:
            rows = [
                ["" if v is None else str(v) for v in row]
                for row in sheet.iter_rows(values_only=True)
            ]
            table = _markdown_table(rows)
            if table:
                parts.append(f"## {sheet.title}\n\n{table}")
    finally:
        workbook.close()
    return "\n\n".join(parts)


def _markdown_table(rows: list[list[str]]) -> str:
    """Список строк → markdown-таблица. Шапка — первая непустая строка.

    Пустые строки пропускаются, пустые ячейки — пустая строка.
    Ширина строки выравнивается по шапке: лишние ячейки отбрасываются,
    недостающие добиваются пустыми, иначе разбор таблицы поедет.
    """
    non_empty = [row for row in rows if any(cell.strip() for cell in row)]
    if not non_empty:
        return ""
    header = [_cell(c) for c in non_empty[0]]
    width = len(header)
    lines = ["| " + " | ".join(header) + " |", "|" + "---|" * width]
    for row in non_empty[1:]:
        cells = [_cell(c) for c in row[:width]] + [""] * (width - len(row))
        lines.append("| " + " | ".join(cells) + " |")
    return "\n".join(lines)


def _cell(value: str) -> str:
    """Ячейка в одну строку без «|»: перенос и вертикальная черта ломают таблицу."""
    return value.replace("\r", " ").replace("\n", " ").replace("|", "\\|").strip()


# ─── Приём документа ───


@dataclass
class IngestResult:
    document: Document
    created: bool  # False — документ с таким хешем уже был, ничего не писали
    chunks_added: int


async def ingest_document(
    session: AsyncSession,
    embedder: Embedder,
    *,
    source: str,
    data: bytes,
    max_bytes: int,
    chunk_chars: int,
    overlap: int,
    min_chars: int,
    organization_id: uuid.UUID | None = None,
) -> IngestResult:
    """Загружает один файл. Повторная загрузка того же содержимого — no-op.

    organization_id (Э4): документ гостиницы. Дедуп по хешу — в её пределах:
    один и тот же прайс у двух гостиниц — две записи. None — как раньше.

    Граница транзакции: один документ = одна транзакция, commit делает эта
    функция. В сессию до вызова ничего не кладут: незавершённая чужая работа
    (например, запись в журнал действий оператора) зафиксируется здесь
    раньше времени или частично.
    """
    # (1) Предел — до разбора: разборщик pdf/docx на большом файле ест память.
    check_size(len(data), max_bytes)

    # (2) Натуральный ключ — хеш содержимого, а не имя: файл переименовали,
    # содержимое то же — грузить второй раз незачем.
    file_hash = hashlib.sha256(data).hexdigest()

    # (3) Проверка «уже сделано» ДО действия.
    dedup = sa.select(Document).where(Document.file_hash == file_hash)
    if organization_id is not None:
        dedup = dedup.where(Document.organization_id == organization_id)
    existing = (await session.execute(dedup)).scalar_one_or_none()
    if existing is not None:
        logger.info("Документ %s уже в базе (hash=%s…), пропускаем", source, file_hash[:12])
        return IngestResult(document=existing, created=False, chunks_added=0)

    # (4) Разбор → нарезка → эмбеддинги одним вызовом (кэш и модель любят пачки).
    text = extract_text(source, data)
    # Слой 9: те же проверки, что на входе от клиента. До любой записи.
    verdict = scan_document(text)
    if not verdict.clean:
        raise SuspiciousDocument(
            f"в документе найдены инструкции для модели ({len(verdict.hits)})"
        )
    chunks = split_text(text, chunk_chars=chunk_chars, overlap=overlap, min_chars=min_chars)
    vectors = await embedder.embed_passages([c.text for c in chunks]) if chunks else []

    document = Document(
        source=source,
        organization_id=organization_id,
        file_hash=file_hash,
        chunk_count=len(chunks),
        created_at=utcnow(),
    )
    session.add(document)
    await session.flush()  # нужен document.id для чанков

    for chunk, vector in zip(chunks, vectors, strict=True):
        session.add(
            KnowledgeChunk(
                document_id=document.id,
                chunk_index=chunk.index,
                content=chunk.text,
                embedding=vector,
                chunk_metadata=chunk.meta,
                created_at=utcnow(),
            )
        )
    await session.commit()

    if not chunks:
        # Пустой документ всё равно записываем: иначе его будут грузить
        # снова и снова, а причина (скан без текстового слоя) не всплывёт.
        logger.warning("Документ %s разобран без текста: чанков 0, запись сохранена", source)
    else:
        logger.info("Документ %s загружен: чанков %d", source, len(chunks))
    return IngestResult(document=document, created=True, chunks_added=len(chunks))
