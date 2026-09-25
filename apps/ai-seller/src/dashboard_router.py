"""API панели: песочница, диалоги, промпт, знания, настройки, сводка.

Два роутера, и это не украшение:
* router — песочница /internal/sandbox по внутреннему ключу, живёт в корне
  (ОСТАНОВКА 2 сборочного плана, путь менять нельзя);
* panel_router — API панели, монтируется под путём из настроек и целиком
  закрыт зависимостью current_user.

Ошибки наружу не отдаются: движок их не поднимает, а всё, что упало
до него, уходит в журнал и нейтральный статус.
"""

from __future__ import annotations

import logging
import secrets
import uuid

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, ValidationError

from src.ai.engine import IncomingMessage, build_engine
from src.channels.sender import SendResult
from src.dashboard import (
    panel_conversations,
    panel_extract,
    panel_llm_key,
    panel_orgs,
    panel_whatsapp,
    panel_seller,
    panel_settings,
)
from src.dashboard.auth_router import current_user
from src.db.base import utcnow

logger = logging.getLogger(__name__)

router = APIRouter()

# 🔴 Зависимость объявлена на роутере, а не на каждом обработчике: забыть её
# на одном экране — открыть контакты заказчика всему интернету, и заметить
# это будет некому. Вложенные роутеры её наследуют.
panel_router = APIRouter(dependencies=[Depends(current_user)])
panel_router.include_router(panel_conversations.router)
panel_router.include_router(panel_settings.router)
panel_router.include_router(panel_seller.router)
panel_router.include_router(panel_extract.router)
panel_router.include_router(panel_llm_key.router)
panel_router.include_router(panel_whatsapp.router)
panel_router.include_router(panel_orgs.router)

SANDBOX_CHANNEL = "sandbox"


class SandboxIn(BaseModel):
    """Тело запроса песочницы. Лишние поля отбрасываем, а не роняем запрос."""

    model_config = ConfigDict(extra="ignore")

    external_id: str
    text: str
    client_name: str | None = None
    # Э4: у продавца ход песочницы идёт в организации — без неё непонятно,
    # чей промпт и чьи знания брать.
    organization_id: str | None = None


class CollectSender:
    """Отправитель песочницы: не шлёт никуда, складывает тексты в список,
    чтобы отдать их в ответе запроса."""

    def __init__(self) -> None:
        self.sent: list[str] = []

    async def send(self, *, channel: str, external_id: str, text: str) -> SendResult:
        self.sent.append(text)
        return SendResult(ok=True)


def _key_ok(request: Request) -> bool:
    """Внутренний ключ (как у /internal/health) или служебный ключ платформы:
    экран «Проверка» раздела «ИИ-продавец» говорит с ботом через песочницу.
    Пустой ключ в настройках этот вход не открывает."""
    settings = request.app.state.settings
    for expected, header in (
        (settings.internal_health_key, "x-internal-key"),
        (settings.seller_service_key, "x-service-key"),
    ):
        provided = request.headers.get(header, "")
        # Сравниваем байты: compare_digest(str, str) падает на не-ASCII.
        if expected and secrets.compare_digest(provided.encode("utf-8"), expected.encode("utf-8")):
            return True
    return False


@router.post("/internal/sandbox")
async def sandbox(request: Request) -> JSONResponse:
    """Один ход диалога в канале «sandbox». Тело читаем сами, а не через
    зависимость: проверка ключа должна идти раньше разбора тела, иначе
    чужой запрос получает подробности валидации вместо 403."""
    if not _key_ok(request):
        return JSONResponse(status_code=403, content={"status": "forbidden"})

    try:
        body = SandboxIn.model_validate(await request.json())
    except (ValueError, ValidationError):
        return JSONResponse(status_code=400, content={"status": "bad_request"})

    from src.config import normalize_bot_role

    organization_id: str | None = None
    if normalize_bot_role(request.app.state.settings.bot_role) == "seller":
        try:
            organization_id = str(uuid.UUID((body.organization_id or "").strip()))
        except ValueError:
            return JSONResponse(status_code=400, content={"status": "bad_request"})

    sender = CollectSender()
    try:
        engine = build_engine(request.app.state.settings, sender=sender)
        outcome = await engine.process_message(
            IncomingMessage(
                channel=SANDBOX_CHANNEL,
                external_id=body.external_id,
                text=body.text,
                received_at=utcnow(),
                client_name=body.client_name,
                organization_id=organization_id,
            )
        )
    except Exception:
        # Движок исключений не поднимает; сюда попадает только сбой сборки
        # (нет роутера, нет базы). Клиенту панели — статус, подробности — в журнал.
        logger.exception("Песочница: движок не собрался")
        return JSONResponse(status_code=500, content={"status": "error"})

    reply = outcome.reply if outcome.reply is not None else (sender.sent[-1] if sender.sent else None)
    return JSONResponse(
        status_code=200,
        content={
            "status": outcome.status,
            "reply": reply,
            "needs_human": outcome.needs_human,
            "edits": list(outcome.edits),
            "reasons": list(outcome.reasons),
            "conversation_id": str(outcome.conversation_id) if outcome.conversation_id else None,
        },
    )
