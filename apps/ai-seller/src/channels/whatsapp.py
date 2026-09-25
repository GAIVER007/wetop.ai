"""Канал WhatsApp Cloud API (С3 «под ключ», Q-185 (а); ADR-086).

Дверь вебхука живёт под организацией: `/channels/whatsapp/webhook/{org}`.
GET — подтверждение подписки Meta проверочным словом ЕЁ строки; POST —
сообщения, подпись `X-Hub-Signature-256` считается секретом ЕЁ приложения
по сырому телу. Чужой `phone_number_id` в теле — 200 и молча мимо: Meta
повторяет доставку на не-200, а чужое обрабатывать нельзя. Повтор той же
реплики гасит дедуп движка (слой 0). Бот только отвечает написавшим —
окно 24 часов Cloud API соблюдено самим устройством канала; телефон гостя
приходит каналом (`wa_id`), просить его не нужно.

Организация хода — правило Э4: её ставит дверь, движок про Meta не знает.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import uuid

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, PlainTextResponse

from src import dependencies
from src.ai.engine_types import IncomingMessage
from src.channels.sender import SendResult
from src.channels.widget_runner import WidgetRunner, build_runner
from src.config import Settings
from src.db.base import utcnow
from src.db.models import WhatsAppConnection
from src.security.llm_keys import decrypt_key

logger = logging.getLogger(__name__)

router = APIRouter()

CHANNEL = "whatsapp"
SIGNATURE_HEADER = "X-Hub-Signature-256"
SEND_TIMEOUT = 20.0


class WhatsAppSender:
    """Ответ гостю через Graph API токеном ЕГО гостиницы.

    Организацию хода сендер читает из contextvar (ставит движок): у одного
    гостя может быть переписка с двумя гостиницами, и внешний id этого
    не различает. Отказ Graph — SendResult(ok=False): движок не запишет
    ответ в историю и бот не будет считать, что ответил.
    """

    def __init__(self, sessionmaker, settings: Settings) -> None:
        self._sessions = sessionmaker
        self._settings = settings

    async def send(self, *, channel: str, external_id: str, text: str) -> SendResult:
        org = dependencies.get_current_organization_id()
        if not org:
            return SendResult(ok=False, error="no_organization")
        async with self._sessions() as session:
            row = await session.get(WhatsAppConnection, uuid.UUID(org))
        if row is None:
            return SendResult(ok=False, error="not_connected")
        token = decrypt_key(row.token_encrypted, self._settings)
        if not token:
            # Секрет хранилища сменился: честный отказ, не молчаливая пропажа ответа.
            return SendResult(ok=False, error="token_unreadable")
        base = self._settings.whatsapp_graph_base_url.rstrip("/")
        try:
            response = await dependencies.get_http_client().post(
                f"{base}/{row.phone_number_id}/messages",
                json={
                    "messaging_product": "whatsapp",
                    "recipient_type": "individual",
                    "to": external_id,
                    "type": "text",
                    "text": {"body": text},
                },
                headers={"Authorization": f"Bearer {token}"},
                timeout=SEND_TIMEOUT,
            )
        except httpx.HTTPError as exc:
            logger.warning("whatsapp: отправка не удалась (%s)", type(exc).__name__)
            return SendResult(ok=False, error="connection")
        if response.status_code >= 400:
            # Тело в журнал не целиком: код достаточно называет причину (вне окна 24 часов — 470/131047).
            logger.warning("whatsapp: Graph ответил %s", response.status_code)
            return SendResult(ok=False, error=f"graph_{response.status_code}")
        try:
            wamid = response.json().get("messages", [{}])[0].get("id")
        except Exception:  # noqa: BLE001 — форма ответа не наша
            wamid = None
        return SendResult(ok=True, external_message_id=str(wamid) if wamid else None)


def get_whatsapp_runner(app) -> WidgetRunner:
    """Свой runner с сендером Graph; движок и защита — те же, что у виджета."""
    runner = getattr(app.state, "whatsapp_runner", None)
    if runner is None:
        settings = app.state.settings
        runner = build_runner(
            settings, sender=WhatsAppSender(dependencies.get_sessionmaker(), settings)
        )
        app.state.whatsapp_runner = runner
    return runner


async def _connection(org_id: uuid.UUID) -> WhatsAppConnection | None:
    async with dependencies.get_sessionmaker()() as session:
        return await session.get(WhatsAppConnection, org_id)


@router.get("/channels/whatsapp/webhook/{org_id}")
async def verify(org_id: uuid.UUID, request: Request) -> PlainTextResponse:
    """Подтверждение подписки Meta: эхо challenge только со словом этой гостиницы."""
    row = await _connection(org_id)
    token = request.query_params.get("hub.verify_token") or ""
    if row is None or not hmac.compare_digest(token, row.verify_token):
        raise HTTPException(status_code=403, detail="forbidden")
    return PlainTextResponse(request.query_params.get("hub.challenge") or "")


@router.post("/channels/whatsapp/webhook/{org_id}")
async def receive(org_id: uuid.UUID, request: Request) -> JSONResponse:
    row = await _connection(org_id)
    if row is None:
        raise HTTPException(status_code=403, detail="forbidden")
    raw = await request.body()
    secret = decrypt_key(row.app_secret_encrypted, request.app.state.settings)
    expected = "sha256=" + hmac.new((secret or "").encode(), raw, hashlib.sha256).hexdigest()
    provided = request.headers.get(SIGNATURE_HEADER) or ""
    if not secret or not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=403, detail="forbidden")

    try:
        body = await request.json()
    except Exception:  # noqa: BLE001 — не JSON: подпись сошлась, но тело не наше
        return JSONResponse({"status": "ok"})
    accepted = 0
    for entry in body.get("entry") or []:
        for change in entry.get("changes") or []:
            value = change.get("value") or {}
            metadata = value.get("metadata") or {}
            if str(metadata.get("phone_number_id") or "") != row.phone_number_id:
                # Чужой номер под подписью этой гостиницы: молча мимо, Meta не повторяет.
                continue
            names = {
                str(c.get("wa_id") or ""): str((c.get("profile") or {}).get("name") or "")
                for c in value.get("contacts") or []
            }
            for message in value.get("messages") or []:
                if message.get("type") != "text":
                    continue
                text = str((message.get("text") or {}).get("body") or "").strip()
                sender_id = str(message.get("from") or "").strip()
                if not text or not sender_id:
                    continue
                incoming = IncomingMessage(
                    channel=CHANNEL,
                    external_id=sender_id,
                    text=text,
                    received_at=utcnow(),
                    client_name=names.get(sender_id) or None,
                    organization_id=str(org_id),
                )
                if get_whatsapp_runner(request.app).submit(incoming) is None:
                    # Очередь полна: не-200 — Meta доставит ещё раз, реплика не теряется.
                    return JSONResponse(status_code=503, content={"status": "busy"})
                accepted += 1
    return JSONResponse({"status": "ok", "accepted": accepted})
