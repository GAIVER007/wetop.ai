"""Приём гостиницы от платформы (Э4, ADR-083).

PUT /seller/organizations/{id} — платформа служебным ключом заводит и правит
гостиницу: название, действует ли расширение, домены сайта, публичный ключ
виджета. Шлётся при смене расширения и каждой сверкой, поэтому идемпотентно:
та же строка перезаписывается, а не плодится.

Промпта здесь нет намеренно: его собирает PUT /seller/profile из полей
профиля поверх ядра правил (Б6) — свободного текста промпта у владельца
объекта нет и через эту дверь.
"""

from __future__ import annotations

import re
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from src.db.base import utcnow
from src.db.models import ORG_KEY_RE_TEXT, Organization
from src.dashboard.auth_router import require_platform
from src.dashboard.panel_common import log_action, sessions
from src.dashboard.panel_seller import _require_seller

router = APIRouter()

_ORG_KEY_RE = re.compile(ORG_KEY_RE_TEXT)


class OrganizationIn(BaseModel):
    """Лишние поля отбрасываем, а не роняем запрос."""

    model_config = ConfigDict(extra="ignore")

    name: Annotated[str, Field(min_length=1, max_length=200)]
    public_key: Annotated[str, Field(pattern=ORG_KEY_RE_TEXT)]
    active: bool = True
    # Домены сайтов гостиницы; каждый — хост или источник, как в настройке.
    hosts: Annotated[list[Annotated[str, Field(min_length=1, max_length=253)]], Field(max_length=20)] = []


@router.put("/seller/organizations/{org_id}", dependencies=[Depends(require_platform)])
async def upsert_organization(request: Request, org_id: uuid.UUID, body: OrganizationIn) -> dict:
    _require_seller(request)
    now = utcnow()
    async with sessions()() as session:
        row = await session.get(Organization, org_id)
        if row is None:
            row = Organization(id=org_id, created_at=now)
            session.add(row)
        row.name = body.name
        row.public_key = body.public_key
        row.active = body.active
        row.hosts = [h.strip() for h in body.hosts if h.strip()]
        row.updated_at = now
        # В журнал — факт и признаки, без названий и доменов: журнал общий.
        log_action(
            session,
            action="seller_org",
            payload={"organization": str(org_id), "active": body.active, "hosts": len(row.hosts)},
        )
        try:
            await session.commit()
        except Exception:
            await session.rollback()
            # Единственная ожидаемая причина — ключ занят другой гостиницей.
            raise HTTPException(
                status_code=409, detail="Публичный ключ уже у другой организации"
            ) from None
    return {"status": "ok"}
