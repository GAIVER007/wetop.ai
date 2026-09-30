"""Экраны владельца: промпт, база знаний, настройки, сводка за сутки.

Всё, что здесь меняется, — данные и настройки заказчика, а не ядро:
промпт лежит файлом на томе, модель правится по белому списку в Redis.

🔴 В ответе GET /settings нет ни одного секрета: отдаётся белый список
правки на лету и перечень разрешённых моделей, больше ничего.
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import timedelta
from pathlib import Path

import sqlalchemy as sa
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, ConfigDict
from starlette.concurrency import run_in_threadpool

from src.agent_scope import AgentScope
from src.config import Settings
from src.dashboard.auth_router import request_agent, require_owner
from src.dashboard.panel_common import (
    allowed_models,
    is_secret_name,
    iso,
    log_action,
    redis,
    sessions,
)
from src.db.base import utcnow
from src.db.models import Client, Conversation, Document, Message
from src.knowledge.ingestor import (
    DocumentTooComplex,
    FileTooLarge,
    SuspiciousDocument,
    UnsupportedFormat,
    check_size,
    ingest_document,
)
from src.knowledge.prompt import reset_prompt_cache
from src.runtime_settings import effective, set_override

logger = logging.getLogger(__name__)

router = APIRouter()

# Окно сводки. Сутки, потому что владелец смотрит панель утром.
SUMMARY_HOURS = 24


class PromptIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    text: str


class ModelIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    model: str


@router.get("/prompt")
async def read_prompt(request: Request) -> dict:
    """Текст промпта. Путь к файлу наружу не отдаём: это карта тома."""
    try:
        text = Path(request.app.state.settings.prompt_path).read_text(encoding="utf-8")
    except OSError:
        text = ""
    return {"text": text}


def _write_atomic(path: Path, text: str) -> None:
    """🔴 Сначала во временный файл рядом, потом подмена os.replace.

    Прямая запись сначала обрезает файл: обрыв процесса или переполнение
    тома посреди неё оставят половину системного промпта, и бот уйдёт
    отвечать по половине инструкции. Подмена на одном томе атомарна.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f"{path.name}.tmp-{os.getpid()}")
    try:
        tmp.write_text(text, encoding="utf-8")
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)


@router.put("/prompt", dependencies=[Depends(require_owner)])
async def write_prompt(request: Request, body: PromptIn) -> dict:
    """Запись промпта. 🔴 Кэш сбрасывается только после успешной подмены:
    иначе движок перечитает обрезанный файл. Ввод-вывод — в потоке, чтобы
    не держать цикл событий, в котором идёт горячий путь."""
    path = Path(request.app.state.settings.prompt_path)
    try:
        previous = path.read_text(encoding="utf-8")
    except OSError:
        previous = ""
    await run_in_threadpool(_write_atomic, path, body.text)
    reset_prompt_cache()
    async with sessions()() as session:
        # 🔴 В журнал действий длины, а не тексты: промпт большой, и таблица
        # действий превратилась бы в хранилище его версий.
        log_action(
            session,
            action="prompt_edit",
            payload={"previous_length": len(previous), "new_length": len(body.text)},
        )
        await session.commit()
    return {"status": "ok", "length": len(body.text)}


@router.post("/knowledge", dependencies=[Depends(require_owner)])
async def upload_knowledge(
    request: Request,
    file: UploadFile = File(...),
    scope: AgentScope | None = Depends(request_agent),
) -> dict:
    """Загрузка документа базы знаний. Ответы понятные: формат, размер, инъекция.
    У продавца документ ложится АГЕНТУ запроса (SA2.5; до неё — организации, Э4)."""
    from src.knowledge.embedder import get_embedder

    settings: Settings = request.app.state.settings
    max_bytes = settings.kb_max_file_mb * 1024 * 1024
    try:
        # Предел — по заявленному размеру, ДО чтения: разборщик pdf/docx
        # съедает память на большом файле раньше любой проверки.
        if file.size is not None:
            check_size(file.size, max_bytes)
        data = await file.read()
        async with sessions()() as session:
            result = await ingest_document(
                session,
                get_embedder(),
                source=file.filename or "документ",
                data=data,
                max_bytes=max_bytes,
                chunk_chars=settings.kb_chunk_chars,
                overlap=settings.kb_chunk_overlap,
                min_chars=settings.kb_chunk_min_chars,
                organization_id=scope.organization_id if scope else None,
                agent_id=scope.agent_id if scope else None,
            )
    except UnsupportedFormat as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from None
    except FileTooLarge:
        raise HTTPException(status_code=413, detail="файл больше допустимого размера") from None
    except DocumentTooComplex as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    except SuspiciousDocument:
        # Слой 9: инструкция в прайсе работает так же, как присланная в чат.
        raise HTTPException(status_code=422, detail="в документе найдены инструкции для модели") from None
    return {
        "status": "ok",
        "source": result.document.source,
        "created": result.created,
        "chunks": result.chunks_added,
    }


@router.get("/knowledge")
async def list_knowledge(scope: AgentScope | None = Depends(request_agent)) -> dict:
    """Что загружено: источник, число кусков, время. Содержимого здесь нет."""
    stmt = sa.select(Document).order_by(Document.created_at.desc()).limit(200)
    if scope is not None:
        stmt = stmt.where(Document.agent_id == scope.agent_id)
    async with sessions()() as session:
        docs = (await session.execute(stmt)).scalars().all()
    return {
        "items": [
            {"source": d.source, "chunks": d.chunk_count, "created_at": iso(d.created_at)}
            for d in docs
        ]
    }


@router.get("/settings")
async def read_settings(request: Request) -> dict:
    """Видимые настройки: модели и белый список правки на лету."""
    settings: Settings = request.app.state.settings
    conn = redis()
    # 🔴 Секретные имена отсеиваются, даже если они попали в белый список.
    values = {
        name: await effective(conn, settings, name)
        for name in settings.runtime_settings_allowed_list
        if not is_secret_name(name)
    }
    return {
        "models": allowed_models(settings),
        "model": await effective(conn, settings, "llm_model"),
        "values": values,
    }


@router.put("/settings/model", dependencies=[Depends(require_owner)])
async def change_model(request: Request, body: ModelIn) -> dict:
    """Смена основной модели — только из списка, свободного поля нет."""
    settings: Settings = request.app.state.settings
    models = allowed_models(settings)
    if not models:
        # Пусто — экрана выбора не существует, а не «значит, можно любую».
        raise HTTPException(status_code=404, detail="выбор модели не настроен")
    if body.model not in models:
        raise HTTPException(status_code=400, detail="модель не из списка разрешённых")

    conn = redis()
    previous = await effective(conn, settings, "llm_model")
    await set_override(conn, settings, "llm_model", body.model)
    async with sessions()() as session:
        # 🔴 Прежнее значение обязательно: без него ночью некуда возвращаться.
        log_action(session, action="model_change", payload={"previous": previous, "new": body.model})
        await session.commit()
    return {"status": "ok", "model": body.model, "previous": previous}


@router.get("/summary")
async def summary(request: Request, scope: AgentScope | None = Depends(request_agent)) -> dict:
    """Сводка за сутки. Считает база: выбрать всё и посчитать в Python —
    тот отказ, который на боевых объёмах находят последним.
    У продавца числа считаются по АГЕНТУ запроса (SA2.5)."""
    from src.sla_alerts import find_stale

    settings: Settings = request.app.state.settings
    now = utcnow()
    since = now - timedelta(hours=SUMMARY_HOURS)
    async with sessions()() as session:
        dialogs_stmt = (
            sa.select(sa.func.count())
            .select_from(Conversation)
            .where(Conversation.last_activity_at >= since)
        )
        replies_stmt = (
            sa.select(sa.func.count())
            .select_from(Message)
            .where(Message.sent_by_us.is_(True), Message.created_at >= since)
        )
        # Лид — клиент с контактом: телефон дороже любой другой метки.
        leads_stmt = (
            sa.select(sa.func.count())
            .select_from(Client)
            .where(Client.created_at >= since, Client.phone.is_not(None))
        )
        if scope is not None:
            dialogs_stmt = dialogs_stmt.where(Conversation.agent_id == scope.agent_id)
            replies_stmt = replies_stmt.join(
                Conversation, Conversation.id == Message.conversation_id
            ).where(Conversation.agent_id == scope.agent_id)
            leads_stmt = leads_stmt.where(Client.agent_id == scope.agent_id)
        dialogs = await session.scalar(dialogs_stmt)
        replies = await session.scalar(replies_stmt)
        leads = await session.scalar(leads_stmt)
        stale = await find_stale(
            session, sla_seconds=settings.sla_seconds, now=now, lookback_hours=SUMMARY_HOURS,
            agent_id=scope.agent_id if scope else None,
        )
    return {
        "hours": SUMMARY_HOURS,
        "dialogs": int(dialogs or 0),
        "replies": int(replies or 0),
        "leads": int(leads or 0),
        "sla_breaches": len(stale),
    }
