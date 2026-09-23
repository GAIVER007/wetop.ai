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

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, ValidationError

from src.ai.engine import IncomingMessage, build_engine
from src.channels.sender import SendResult
from src.dashboard import panel_conversations, panel_settings
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

SANDBOX_CHANNEL = "sandbox"


class SandboxIn(BaseModel):
    """Тело запроса песочницы. Лишние поля отбрасываем, а не роняем запрос."""

    model_config = ConfigDict(extra="ignore")

    external_id: str
    text: str
    client_name: str | None = None


class CollectSender:
    """Отправитель песочницы: не шлёт никуда, складывает тексты в список,
    чтобы отдать их в ответе запроса."""

    def __init__(self) -> None:
        self.sent: list[str] = []

    async def send(self, *, channel: str, external_id: str, text: str) -> SendResult:
        self.sent.append(text)
        return SendResult(ok=True)


def _key_ok(request: Request) -> bool:
    """Тот же ключ и то же сравнение, что у /internal/health.
    Пустой ключ в настройках — вход закрыт."""
    expected = request.app.state.settings.internal_health_key
    provided = request.headers.get("x-internal-key", "")
    # Сравниваем байты: compare_digest(str, str) падает на не-ASCII.
    return bool(expected) and secrets.compare_digest(
        provided.encode("utf-8"), expected.encode("utf-8")
    )


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
