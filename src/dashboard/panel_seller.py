"""Маршруты, которыми раздел «ИИ-продавец» платформы настраивает продавца.

Вызывает их платформа служебным ключом (Б5) с правами владельца.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from starlette.concurrency import run_in_threadpool

from src.ai.seller_prompt import SellerProfile, dirty_fields, render
from src.config import normalize_bot_role
from src.dashboard.auth_router import require_owner
from src.dashboard.panel_common import log_action, sessions
from src.dashboard.panel_settings import _write_atomic
from src.knowledge.facts import ObjectFacts, replace_facts
from src.knowledge.ingestor import SuspiciousDocument
from src.knowledge.prompt import reset_prompt_cache

router = APIRouter()


def _require_seller(request: Request) -> None:
    """🔴 Только экземпляр продавца. Платформа по ошибке указала адрес помощника —
    его промпт не должен молча смениться промптом продавца."""
    if normalize_bot_role(request.app.state.settings.bot_role) != "seller":
        raise HTTPException(status_code=409, detail="Этот экземпляр бота — не продавец")


@router.put("/seller/profile", dependencies=[Depends(require_owner)])
async def apply_profile(request: Request, profile: SellerProfile) -> dict:
    _require_seller(request)
    dirty = dirty_fields(profile)
    if dirty:
        # Название поля — владельцу, чтобы он знал, что исправить; содержимое не повторяем.
        raise HTTPException(
            status_code=422,
            detail={"message": "В полях найдены инструкции для модели", "fields": dirty},
        )
    text = render(profile)
    # Запись атомарная, кэш сбрасывается только после подмены — как у PUT /prompt.
    await run_in_threadpool(_write_atomic, Path(request.app.state.settings.prompt_path), text)
    reset_prompt_cache()
    async with sessions()() as session:
        # В журнал — факт и размер, без текста профиля.
        log_action(session, action="seller_profile", payload={"length": len(text)})
        await session.commit()
    return {"status": "ok", "length": len(text)}


@router.put("/seller/facts", dependencies=[Depends(require_owner)])
async def apply_facts(request: Request, facts: ObjectFacts) -> dict:
    """Адрес, заезд, категории и цены из платформы. Заменяют прежние атомарно."""
    from src.knowledge.embedder import get_embedder

    _require_seller(request)
    settings = request.app.state.settings
    async with sessions()() as session:
        try:
            status = await replace_facts(
                session,
                get_embedder(),
                facts,
                max_bytes=settings.kb_max_file_mb * 1024 * 1024,
                chunk_chars=settings.kb_chunk_chars,
                overlap=settings.kb_chunk_overlap,
                min_chars=settings.kb_chunk_min_chars,
            )
        except SuspiciousDocument:
            # Инструкция для модели в поле платформы (адрес, имя категории):
            # отказ, прежние факты целы — замена откатилась.
            raise HTTPException(status_code=422, detail="в фактах найдены инструкции для модели") from None
        if status == "replaced":
            log_action(session, action="seller_facts", payload={"categories": len(facts.categories)})
            await session.commit()
    return {"status": status}
