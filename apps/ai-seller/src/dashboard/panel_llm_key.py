"""Ключ модели партнёра — маршруты панели (С2 «под ключ», Q-186).

Платформа ставит, снимает и проверяет ключ; читает обратно только
«установлен + последние 4 знака». Хранение — `src/security/llm_keys.py`
(шифрованным, секрет `LLM_KEYS_SECRET`). Проверка — живой запрос списка
моделей у роутера с этим ключом: действительность видна по ответу,
сам ключ в ответах и журнале не появляется никогда.
"""

from __future__ import annotations

import logging
import uuid
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from src.dashboard.auth_router import require_platform
from src.dashboard.panel_common import log_action, sessions
from src.db.base import utcnow
from src.db.models import Organization, OrganizationLlmKey
from src.security.llm_keys import KeysNotConfigured, encrypt_key

logger = logging.getLogger(__name__)

router = APIRouter()

CHECK_TIMEOUT = 15.0


class LlmKeyIn(BaseModel):
    """Пустой ключ — снять сохранённый."""

    model_config = ConfigDict(extra="forbid")

    key: Annotated[str, Field(max_length=200)] = ""


def _require_seller(request: Request) -> None:
    from src.config import normalize_bot_role

    if normalize_bot_role(request.app.state.settings.bot_role) != "seller":
        raise HTTPException(status_code=409, detail="Этот экземпляр бота — не продавец")


@router.get("/seller/organizations/{org_id}/llm-key", dependencies=[Depends(require_platform)])
async def llm_key_status(request: Request, org_id: uuid.UUID) -> dict:
    _require_seller(request)
    async with sessions()() as session:
        row = await session.get(OrganizationLlmKey, org_id)
        return {"set": row is not None, "last4": row.last4 if row else None}


@router.put("/seller/organizations/{org_id}/llm-key", dependencies=[Depends(require_platform)])
async def put_llm_key(request: Request, org_id: uuid.UUID, body: LlmKeyIn) -> dict:
    _require_seller(request)
    settings = request.app.state.settings
    plain = body.key.strip()
    async with sessions()() as session:
        if plain == "":
            row = await session.get(OrganizationLlmKey, org_id)
            if row is not None:
                await session.delete(row)
                log_action(session, action="llm_key_cleared", payload={"organization": str(org_id)})
                await session.commit()
            return {"status": "ok", "set": False, "last4": None}
        if len(plain) < 8:
            raise HTTPException(status_code=422, detail="Ключ короче 8 знаков — это не ключ")
        if await session.get(Organization, org_id) is None:
            raise HTTPException(status_code=404, detail="Организация у продавца не заведена")
        try:
            blob = encrypt_key(plain, settings)
        except KeysNotConfigured:
            raise HTTPException(
                status_code=409,
                detail="Хранилище ключей не настроено: задайте LLM_KEYS_SECRET у продавца",
            ) from None
        last4 = plain[-4:]
        row = await session.get(OrganizationLlmKey, org_id)
        if row is None:
            session.add(
                OrganizationLlmKey(
                    organization_id=org_id, key_encrypted=blob, last4=last4, updated_at=utcnow()
                )
            )
        else:
            row.key_encrypted, row.last4, row.updated_at = blob, last4, utcnow()
        # В журнал — факт и последние 4 знака: по ним владелец узнаёт свой ключ.
        log_action(
            session, action="llm_key_set", payload={"organization": str(org_id), "last4": last4}
        )
        await session.commit()
    return {"status": "ok", "set": True, "last4": last4}


@router.post("/seller/organizations/{org_id}/llm-key/check", dependencies=[Depends(require_platform)])
async def check_llm_key(request: Request, org_id: uuid.UUID, body: LlmKeyIn) -> dict:
    """Пробный вызов роутера с ключом из тела (до сохранения). Наружу — только вердикт."""
    from src.dependencies import get_http_client

    _require_seller(request)
    settings = request.app.state.settings
    base = (settings.llm_base_url or "").rstrip("/")
    if not base:
        raise HTTPException(status_code=409, detail="Модель у продавца не настроена (LLM_BASE_URL)")
    plain = body.key.strip()
    if plain == "":
        raise HTTPException(status_code=422, detail="Нечего проверять: ключ пуст")
    # Пробный вызов роутера с произвольным ключом — оракул годности чужих ключей (аудит 30.09.2026):
    # часовой предел по организации, без счётчика (Redis) — 503 и вызова нет.
    from src.channels.widget_guards import RateLimitUnavailable, rate_exceeded

    try:
        exceeded = await rate_exceeded(settings, "llm-key", str(org_id), fail_closed=True)
    except RateLimitUnavailable:
        raise HTTPException(status_code=503, detail="Счётчик запросов недоступен — попробуйте позже") from None
    if exceeded:
        raise HTTPException(status_code=429, detail="Слишком много проверок ключа за час — попробуйте позже")
    try:
        response = await get_http_client().get(
            f"{base}/models",
            headers={"Authorization": f"Bearer {plain}"},
            timeout=CHECK_TIMEOUT,
        )
    except httpx.HTTPError as exc:
        logger.warning("проверка ключа партнёра: роутер недоступен (%s)", type(exc).__name__)
        return {"valid": False, "reason": "Роутер моделей недоступен, попробуйте позже"}
    if response.status_code in (401, 403):
        return {"valid": False, "reason": "Роутер не принял ключ"}
    if response.status_code >= 400:
        logger.warning("проверка ключа партнёра: ответ %s", response.status_code)
        return {"valid": False, "reason": "Роутер ответил отказом, попробуйте позже"}
    return {"valid": True, "reason": None}
