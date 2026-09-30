"""Маршруты, которыми раздел «ИИ-продавец» платформы настраивает продавца.

Вызывает их платформа служебным ключом (Б5) с правами владельца.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request

from src.ai.guardrails import scan_document
from src.ai.seller_prompt import SellerProfile, SellerPromptText, dirty_fields, render, render_owner_text
from src.agent_scope import AgentScope
from src.config import normalize_bot_role
from src.dashboard.auth_router import request_agent, require_owner
from src.dashboard.panel_common import log_action, sessions
from src.db.base import utcnow
from src.db.models import Agent, Organization
from src.knowledge.facts import ObjectFacts, replace_facts
from src.knowledge.ingestor import SuspiciousDocument

router = APIRouter()


def _require_seller(request: Request) -> None:
    """🔴 Только экземпляр продавца. Платформа по ошибке указала адрес помощника —
    его промпт не должен молча смениться промптом продавца."""
    if normalize_bot_role(request.app.state.settings.bot_role) != "seller":
        raise HTTPException(status_code=409, detail="Этот экземпляр бота — не продавец")


@router.put("/seller/profile", dependencies=[Depends(require_owner)])
async def apply_profile(
    request: Request, profile: SellerProfile, scope: AgentScope | None = Depends(request_agent)
) -> dict:
    _require_seller(request)
    dirty = dirty_fields(profile)
    if dirty:
        # Название поля — владельцу, чтобы он знал, что исправить; содержимое не повторяем.
        raise HTTPException(
            status_code=422,
            detail={"message": "В полях найдены инструкции для модели", "fields": dirty},
        )
    text = render(profile)
    await _store_prompt(scope, text, action="seller_profile")
    return {"status": "ok", "length": len(text)}


async def _store_prompt(scope: AgentScope | None, text: str, *, action: str) -> None:
    """Промпт продавца живёт в строке АГЕНТА (SA2.5), а не файлом на томе: у каждого агента свой. Файл PROMPT_PATH остался
    помощнику. У перенесённого продавца (id агента равен организации) прежняя строка организации обновляется тем же
    значением: старый образ читает промпт из неё, пока идёт выкладка (зеркало — до сжатия схемы)."""
    if scope is None:
        raise HTTPException(status_code=400, detail="У продавца нужен агент")
    async with sessions()() as session:
        agent = await session.get(Agent, scope.agent_id)
        if agent is None or agent.organization_id != scope.organization_id:
            # Сверка платформы заводит гостиницу и агента раньше профиля; нет строки — порядок нарушен, и молча
            # создавать её без ключа нельзя.
            raise HTTPException(status_code=404, detail="Агент у продавца не заведён")
        now = utcnow()
        if agent.id == agent.organization_id:
            org = await session.get(Organization, agent.organization_id)
            if org is not None:
                org.system_prompt = text
                org.updated_at = now
        agent.system_prompt = text
        agent.updated_at = now
        # В журнал — факт и размер, без текста профиля.
        log_action(
            session,
            action=action,
            payload={"organization": str(scope.organization_id), "agent": str(scope.agent_id), "length": len(text)},
        )
        await session.commit()


@router.put("/seller/prompt", dependencies=[Depends(require_owner)])
async def apply_prompt_text(
    request: Request, prompt: SellerPromptText, scope: AgentScope | None = Depends(request_agent)
) -> dict:
    """Инструкция продавцу одним текстом (ADR-097): ядро бот ставит сам и сверху."""
    _require_seller(request)
    if not scan_document(prompt.text).clean:
        raise HTTPException(
            status_code=422,
            detail={"message": "В тексте найдены инструкции для модели", "fields": ["text"]},
        )
    text = render_owner_text(prompt)
    await _store_prompt(scope, text, action="seller_prompt")
    return {"status": "ok", "length": len(text)}


@router.put("/seller/facts", dependencies=[Depends(require_owner)])
async def apply_facts(
    request: Request, facts: ObjectFacts, scope: AgentScope | None = Depends(request_agent)
) -> dict:
    """Адрес, заезд, категории и цены из платформы. Заменяют прежние атомарно —
    в пределах АГЕНТА запроса (SA2.5): цены одного агента не трут другого, даже в одной организации."""
    from src.knowledge.embedder import get_embedder

    _require_seller(request)
    settings = request.app.state.settings
    async with sessions()() as session:
        try:
            status = await replace_facts(
                session,
                get_embedder(),
                facts,
                scope=scope,
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
            log_action(
                session,
                action="seller_facts",
                payload={
                    "organization": str(scope.organization_id) if scope else None,
                    "agent": str(scope.agent_id) if scope else None,
                    "categories": len(facts.categories),
                },
            )
            await session.commit()
    return {"status": status}
