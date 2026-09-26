"""Подключение WhatsApp гостиницы — маршруты панели (С3 «под ключ», Q-185 (а)).

Платформа ставит и снимает подключение и читает статус; токен и секрет
приложения Meta наружу не возвращаются никогда — только `phone_number_id`
и проверочное слово вебхука (его партнёр вписывает в консоль Meta вместе
с адресом вебхука, который показывает платформа). Проверка — живой запрос
номера у Graph API с токеном из тела, до сохранения.
"""

from __future__ import annotations

import logging
import secrets
import uuid
from typing import Annotated

import httpx
import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.exc import IntegrityError

from src.dashboard.auth_router import require_platform
from src.dashboard.panel_common import log_action, sessions
from src.db.base import utcnow
from src.db.models import Organization, WhatsAppConnection
from src.security.llm_keys import KeysNotConfigured, encrypt_key

logger = logging.getLogger(__name__)

router = APIRouter()

CHECK_TIMEOUT = 15.0

# Номер WhatsApp — одной гостинице (уникальность `phone_number_id`, миграция 0004):
# вебхук находит гостиницу по двери, а ответ уходит с её номера.
NUMBER_TAKEN = "Этот номер уже подключён к другой гостинице"


class WhatsAppIn(BaseModel):
    """Пустой `phone_number_id` — снять подключение."""

    model_config = ConfigDict(extra="forbid")

    phone_number_id: Annotated[str, Field(max_length=64)] = ""
    token: Annotated[str, Field(max_length=512)] = ""
    app_secret: Annotated[str, Field(max_length=200)] = ""


def _require_seller(request: Request) -> None:
    from src.config import normalize_bot_role

    if normalize_bot_role(request.app.state.settings.bot_role) != "seller":
        raise HTTPException(status_code=409, detail="Этот экземпляр бота — не продавец")


def _view(row: WhatsAppConnection | None) -> dict:
    return {
        "set": row is not None,
        "phone_number_id": row.phone_number_id if row else None,
        "verify_token": row.verify_token if row else None,
    }


@router.get("/seller/organizations/{org_id}/whatsapp", dependencies=[Depends(require_platform)])
async def whatsapp_status(request: Request, org_id: uuid.UUID) -> dict:
    _require_seller(request)
    async with sessions()() as session:
        return _view(await session.get(WhatsAppConnection, org_id))


@router.put("/seller/organizations/{org_id}/whatsapp", dependencies=[Depends(require_platform)])
async def put_whatsapp(request: Request, org_id: uuid.UUID, body: WhatsAppIn) -> dict:
    _require_seller(request)
    settings = request.app.state.settings
    phone_id = body.phone_number_id.strip()
    async with sessions()() as session:
        if phone_id == "":
            row = await session.get(WhatsAppConnection, org_id)
            if row is not None:
                await session.delete(row)
                log_action(session, action="whatsapp_cleared", payload={"organization": str(org_id)})
                await session.commit()
            return {"set": False, "phone_number_id": None, "verify_token": None}
        if not phone_id.isdigit():
            raise HTTPException(status_code=422, detail="phone_number_id — цифры из консоли Meta")
        token, app_secret = body.token.strip(), body.app_secret.strip()
        if len(token) < 16 or len(app_secret) < 8:
            raise HTTPException(status_code=422, detail="Нужны постоянный токен и секрет приложения Meta")
        if await session.get(Organization, org_id) is None:
            raise HTTPException(status_code=404, detail="Организация у продавца не заведена")
        taken = await session.scalar(
            sa.select(WhatsAppConnection.organization_id).where(
                WhatsAppConnection.phone_number_id == phone_id,
                WhatsAppConnection.organization_id != org_id,
            )
        )
        if taken is not None:
            raise HTTPException(status_code=409, detail=NUMBER_TAKEN)
        try:
            token_blob = encrypt_key(token, settings)
            secret_blob = encrypt_key(app_secret, settings)
        except KeysNotConfigured:
            raise HTTPException(
                status_code=409,
                detail="Хранилище ключей не настроено: задайте LLM_KEYS_SECRET у продавца",
            ) from None
        row = await session.get(WhatsAppConnection, org_id)
        if row is None:
            row = WhatsAppConnection(
                organization_id=org_id,
                phone_number_id=phone_id,
                token_encrypted=token_blob,
                app_secret_encrypted=secret_blob,
                # Слово вебхука выдаёт бот: партнёр вписывает его в консоль Meta.
                verify_token=secrets.token_urlsafe(24),
                updated_at=utcnow(),
            )
            session.add(row)
        else:
            row.phone_number_id, row.token_encrypted = phone_id, token_blob
            row.app_secret_encrypted, row.updated_at = secret_blob, utcnow()
        # В журнал — номер и факт: токена и секрета там нет.
        log_action(
            session,
            action="whatsapp_set",
            payload={"organization": str(org_id), "phone_number_id": phone_id},
        )
        view = _view(row)
        try:
            await session.commit()
        except IntegrityError:
            # Гонка двух подключений одного номера: проверка выше прошла у обоих,
            # уникальность базы пропустила одно. Второму — 409, а не 500.
            await session.rollback()
            raise HTTPException(status_code=409, detail=NUMBER_TAKEN) from None
    return view


@router.post("/seller/organizations/{org_id}/whatsapp/check", dependencies=[Depends(require_platform)])
async def check_whatsapp(request: Request, org_id: uuid.UUID, body: WhatsAppIn) -> dict:
    """Проверка до сохранения: Graph отдаёт номер по токену. Наружу — вердикт и номер."""
    from src.dependencies import get_http_client

    _require_seller(request)
    settings = request.app.state.settings
    phone_id, token = body.phone_number_id.strip(), body.token.strip()
    if not phone_id.isdigit() or token == "":
        raise HTTPException(status_code=422, detail="Нужны phone_number_id и токен")
    base = settings.whatsapp_graph_base_url.rstrip("/")
    try:
        response = await get_http_client().get(
            f"{base}/{phone_id}",
            params={"fields": "display_phone_number"},
            headers={"Authorization": f"Bearer {token}"},
            timeout=CHECK_TIMEOUT,
        )
    except httpx.HTTPError as exc:
        logger.warning("проверка WhatsApp: Graph недоступен (%s)", type(exc).__name__)
        return {"valid": False, "phone": None, "reason": "Graph API недоступен, попробуйте позже"}
    if response.status_code >= 400:
        return {"valid": False, "phone": None, "reason": "Meta не приняла номер или токен"}
    try:
        phone = str(response.json().get("display_phone_number") or "")
    except Exception:  # noqa: BLE001 — форма ответа не наша
        phone = ""
    return {"valid": True, "phone": phone or None, "reason": None}
