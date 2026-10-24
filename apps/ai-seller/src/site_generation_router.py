"""Вход генерации сайта (MKT6), ИИ-правки (MKT9), разговора (MKT9.2), скана накладной бара (ADR-157) и
предложения ИИ-таргетолога (ADR-MKT-LAUNCH): POST /internal/site-generation, /internal/site-edit,
/internal/site-assistant, /internal/bar-receipt-scan, /internal/ad-proposal и /internal/content-draft (черновик поста
«Контента») только по служебному ключу платформы.

Живёт в корне экземпляра, как песочница. Сессия панели, публичный ключ виджета и ключ живости этот вход не
открывают. Проверка ключа идёт раньше разбора тела: чужой запрос не получает подробностей проверки.
Ответ на любой исход модели структурный 200: расход оплаченных неудачных вызовов не должен теряться за кодом 5xx.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from src.ai.ad_proposal import AdProposalIn, propose_ad
from src.ai.content_draft import ContentDraftIn, propose_content
from src.ai.bar_receipt_scan import BarReceiptScanIn, scan_bar_receipt
from src.ai.llm import get_cascade_client
from src.ai.site_assistant import SiteAssistantIn, answer_site
from src.ai.site_edit import SiteEditIn, edit_site
from src.ai.site_generation import SiteGenerationIn, generate_site
from src.dashboard_router import _key_ok

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/internal/site-generation")
async def site_generation(request: Request) -> JSONResponse:
    if not _key_ok(request):
        return JSONResponse(status_code=403, content={"status": "forbidden"})
    try:
        body = SiteGenerationIn.model_validate(await request.json())
    except (ValueError, ValidationError):
        return JSONResponse(status_code=422, content={"status": "bad_request"})
    try:
        result = await generate_site(request.app.state.settings, get_cascade_client(), body)
    except Exception:
        # Каскад исключений не поднимает; сюда попадает сбой сборки. Расход неизвестен: 500, платформа
        # считает его USAGE_UNAVAILABLE.
        logger.exception("генерация сайта: сбой")
        return JSONResponse(status_code=500, content={"status": "error"})
    return JSONResponse(status_code=200, content=result)


@router.post("/internal/site-edit")
async def site_edit(request: Request) -> JSONResponse:
    if not _key_ok(request):
        return JSONResponse(status_code=403, content={"status": "forbidden"})
    try:
        body = SiteEditIn.model_validate(await request.json())
    except (ValueError, ValidationError):
        return JSONResponse(status_code=422, content={"status": "bad_request"})
    try:
        result = await edit_site(request.app.state.settings, get_cascade_client(), body)
    except Exception:
        logger.exception("правка сайта: сбой")
        return JSONResponse(status_code=500, content={"status": "error"})
    return JSONResponse(status_code=200, content=result)


@router.post("/internal/bar-receipt-scan")
async def bar_receipt_scan(request: Request) -> JSONResponse:
    if not _key_ok(request):
        return JSONResponse(status_code=403, content={"status": "forbidden"})
    try:
        body = BarReceiptScanIn.model_validate(await request.json())
    except (ValueError, ValidationError):
        return JSONResponse(status_code=422, content={"status": "bad_request"})
    try:
        result = await scan_bar_receipt(request.app.state.settings, get_cascade_client(), body)
    except Exception:
        logger.exception("скан накладной: сбой")
        return JSONResponse(status_code=500, content={"status": "error"})
    return JSONResponse(status_code=200, content=result)


@router.post("/internal/ad-proposal")
async def ad_proposal(request: Request) -> JSONResponse:
    if not _key_ok(request):
        return JSONResponse(status_code=403, content={"status": "forbidden"})
    try:
        body = AdProposalIn.model_validate(await request.json())
    except (ValueError, ValidationError):
        return JSONResponse(status_code=422, content={"status": "bad_request"})
    try:
        result = await propose_ad(request.app.state.settings, get_cascade_client(), body)
    except Exception:
        logger.exception("предложение рекламы: сбой")
        return JSONResponse(status_code=500, content={"status": "error"})
    return JSONResponse(status_code=200, content=result)


@router.post("/internal/content-draft")
async def content_draft(request: Request) -> JSONResponse:
    if not _key_ok(request):
        return JSONResponse(status_code=403, content={"status": "forbidden"})
    try:
        body = ContentDraftIn.model_validate(await request.json())
    except (ValueError, ValidationError):
        return JSONResponse(status_code=422, content={"status": "bad_request"})
    try:
        result = await propose_content(request.app.state.settings, get_cascade_client(), body)
    except Exception:
        logger.exception("черновик поста: сбой")
        return JSONResponse(status_code=500, content={"status": "error"})
    return JSONResponse(status_code=200, content=result)


@router.post("/internal/site-assistant")
async def site_assistant(request: Request) -> JSONResponse:
    if not _key_ok(request):
        return JSONResponse(status_code=403, content={"status": "forbidden"})
    try:
        body = SiteAssistantIn.model_validate(await request.json())
    except (ValueError, ValidationError):
        return JSONResponse(status_code=422, content={"status": "bad_request"})
    try:
        result = await answer_site(request.app.state.settings, get_cascade_client(), body)
    except Exception:
        logger.exception("разговор о сайте: сбой")
        return JSONResponse(status_code=500, content={"status": "error"})
    return JSONResponse(status_code=200, content=result)
