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
from src.ai.budget import LOCAL_TZ
from src.db.base import utcnow
from src.db.models import Organization, OrganizationLlmKey
from src.ai import key_state
from src.security.llm_keys import KeysNotConfigured, encrypt_key, org_llm_api_key

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


async def _forget_state(org_id: uuid.UUID) -> None:
    from src.dependencies import get_redis

    await key_state.clear(get_redis(), org_id)


@router.get("/seller/organizations/{org_id}/llm-key", dependencies=[Depends(require_platform)])
async def llm_key_status(request: Request, org_id: uuid.UUID) -> dict:
    _require_seller(request)
    async with sessions()() as session:
        row = await session.get(OrganizationLlmKey, org_id)
    from src.dependencies import get_redis

    # Состояние ключа: последнее, что видели ход модели или проверка (остаток счёта по API не узнать)
    state = await key_state.read(get_redis(), org_id)
    return {"set": row is not None, "last4": row.last4 if row else None, **state}


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
            await _forget_state(org_id)
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
    await _forget_state(org_id)
    return {"status": "ok", "set": True, "last4": last4}


@router.post("/seller/organizations/{org_id}/llm-key/check", dependencies=[Depends(require_platform)])
async def check_llm_key(request: Request, org_id: uuid.UUID, body: LlmKeyIn) -> dict:
    """Пробный вызов роутера с ключом из тела (до сохранения) или, при пустом теле, с сохранённым ключом.
    Наружу только вердикт и состояние ключа: список моделей показывает, что ключ действующий, а вызов
    модели в 1 токен показывает, есть ли на счёте деньги (список моделей отвечает 200 и на пустом счёте)."""
    from src.dependencies import get_http_client

    _require_seller(request)
    settings = request.app.state.settings
    base = (settings.llm_base_url or "").rstrip("/")
    if not base:
        raise HTTPException(status_code=409, detail="Модель у продавца не настроена (LLM_BASE_URL)")
    plain = body.key.strip()
    saved = plain == ""
    if saved:
        async with sessions()() as session:
            plain = await org_llm_api_key(session, org_id, settings) or ""
        if plain == "":
            raise HTTPException(status_code=422, detail="Нечего проверять: ключ не сохранён")
    # Пробный вызов роутера с произвольным ключом — оракул годности чужих ключей (аудит 30.09.2026):
    # часовой предел по организации, без счётчика (Redis) — 503 и вызова нет.
    from src.channels.widget_guards import RateLimitUnavailable, rate_exceeded

    try:
        exceeded = await rate_exceeded(settings, "llm-key", str(org_id), fail_closed=True)
    except RateLimitUnavailable:
        raise HTTPException(status_code=503, detail="Счётчик запросов недоступен — попробуйте позже") from None
    if exceeded:
        raise HTTPException(status_code=429, detail="Слишком много проверок ключа за час — попробуйте позже")
    headers = {"Authorization": f"Bearer {plain}"}
    models = settings.llm_models
    try:
        response = await get_http_client().get(f"{base}/models", headers=headers, timeout=CHECK_TIMEOUT)
        if response.status_code < 400 and models:
            response = await get_http_client().post(
                f"{base}/chat/completions",
                headers=headers,
                json={"model": models[0], "messages": [{"role": "user", "content": "ok"}], "max_tokens": 1},
                timeout=CHECK_TIMEOUT,
            )
    except httpx.HTTPError as exc:
        logger.warning("проверка ключа партнёра: роутер недоступен (%s)", type(exc).__name__)
        return {"valid": False, "state": None, "reason": "Роутер моделей недоступен, попробуйте позже"}
    code = None
    if response.status_code >= 400:
        try:
            error = response.json().get("error") or {}
            code = error.get("code") or error.get("type") if isinstance(error, dict) else None
        except ValueError:
            code = None
        logger.warning("проверка ключа партнёра: ответ %s %s", response.status_code, code or "")
    state = key_state.classify(response.status_code, code)
    if saved:
        # Состояние сохранённого ключа видит экран; чужой ключ до сохранения его не перетирает
        from src.dependencies import get_redis

        await key_state.record(get_redis(), org_id, state)
    return {"valid": state == key_state.OK, "state": state, "reason": key_state.REASONS[state]}


@router.get("/seller/organizations/{org_id}/llm-usage", dependencies=[Depends(require_platform)])
async def llm_usage(request: Request, org_id: uuid.UUID, month: str | None = None) -> dict:
    """Расход модели организации за местный месяц по нашему учёту ответов (не счёт поставщика).
    Стоимость считается по LLM_PRICES; цен нет, значит только токены."""
    from src.jobs.usage_report import collect, parse_month, parse_prices

    _require_seller(request)
    settings = request.app.state.settings
    try:
        period = parse_month(month) if month else (utcnow().astimezone(LOCAL_TZ).year, utcnow().astimezone(LOCAL_TZ).month)
    except ValueError:
        raise HTTPException(status_code=422, detail="Месяц в виде ГГГГ-ММ") from None
    prices, _ = parse_prices(settings.llm_prices)
    async with sessions()() as session:
        report = await collect(session, month=period, prices=prices)
    row = next((r for r in report.rows if r.organization_id == org_id), None)
    return {
        "month": f"{period[0]:04d}-{period[1]:02d}",
        "replies": row.replies if row else 0,
        "tokens": row.tokens if row else 0,
        "input": row.input if row else 0,
        "output": row.output if row else 0,
        # null: цен нет; partial: часть токенов оценить нечем
        "cost_usd": round(row.cost, 4) if row and row.cost is not None else (0.0 if report.priced and not row else None),
        "cost_partial": bool(row and row.cost_partial),
        "priced": report.priced,
    }
