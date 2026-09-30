"""Канал WhatsApp Cloud API (С3 «под ключ», Q-185 (а); ADR-086).

Дверь вебхука живёт под АГЕНТОМ: `/channels/whatsapp/webhook/{agent}` (SA2.5; до неё — организация). У перенесённого
продавца идентификатор агента равен организации, поэтому прежний адрес в консоли Meta не меняется.
GET — подтверждение подписки Meta проверочным словом ЕЁ строки; POST —
сообщения, подпись `X-Hub-Signature-256` считается секретом ЕЁ приложения
по сырому телу. Чужой `phone_number_id` в теле — 200 и молча мимо: Meta
повторяет доставку на не-200, а чужое обрабатывать нельзя. Повтор той же
реплики гасит дедуп движка (слой 0). Бот только отвечает написавшим —
окно 24 часов Cloud API соблюдено самим устройством канала; телефон гостя
приходит каналом (`wa_id`), просить его не нужно.

Агент и организация хода — правило Э4/SA2.5: их ставит дверь, движок про Meta не знает. Организацию дверь берёт из строки
агента, а не из адреса.

🔴 Срок расширения вышел (`organizations.active=false`) или агент выключен — продавец молчит
(Q-183), как гаснет виджет: Meta получает 200 (иначе повторяет доставку),
а движок и модель не вызываются. Тело вебхука — с пределом
`WHATSAPP_MAX_BODY_BYTES` ДО чтения и подписи: дверь публичная.
"""

from __future__ import annotations

import hashlib
import hmac
import json
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
from src.db.models import Agent, Organization, WhatsAppConnection
from src.security.llm_keys import decrypt_key

logger = logging.getLogger(__name__)

router = APIRouter()

CHANNEL = "whatsapp"
SIGNATURE_HEADER = "X-Hub-Signature-256"
SEND_TIMEOUT = 20.0


class WhatsAppSender:
    """Ответ гостю через Graph API токеном подключения ЕГО агента.

    Агента хода сендер читает из contextvar (ставит движок) или получает явно (реплика оператора из панели): у одного
    гостя может быть переписка с двумя гостиницами и с двумя агентами одной гостиницы, и внешний id этого не различает.
    Токен берётся ТОЛЬКО из подключения этого агента. Отказ Graph — SendResult(ok=False): движок не запишет ответ в
    историю и бот не будет считать, что ответил.
    """

    def __init__(
        self, sessionmaker, settings: Settings, agent: uuid.UUID | str | None = None
    ) -> None:
        self._sessions = sessionmaker
        self._settings = settings
        # Реплика оператора идёт вне хода движка, contextvar там пуст: агента диалога называет панель.
        # Ход движка его не задаёт — читаем из contextvar.
        self._agent = str(agent) if agent else None

    async def send(self, *, channel: str, external_id: str, text: str) -> SendResult:
        agent = self._agent or dependencies.get_current_agent_id()
        if not agent:
            return SendResult(ok=False, error="no_agent")
        async with self._sessions() as session:
            row = await session.get(WhatsAppConnection, uuid.UUID(agent))
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


async def _connection(agent_id: uuid.UUID) -> WhatsAppConnection | None:
    async with dependencies.get_sessionmaker()() as session:
        return await session.get(WhatsAppConnection, agent_id)


@router.get("/channels/whatsapp/webhook/{agent_id}")
async def verify(agent_id: uuid.UUID, request: Request) -> PlainTextResponse:
    """Подтверждение подписки Meta: эхо challenge только со словом подключения этого агента."""
    row = await _connection(agent_id)
    token = request.query_params.get("hub.verify_token") or ""
    # Сравниваем байты: compare_digest(str, str) падает на не-ASCII, и чужая строка в запросе
    # давала бы 500 вместо 403 (аудит 30.09.2026).
    if row is None or not hmac.compare_digest(
        token.encode("utf-8"), (row.verify_token or "").encode("utf-8")
    ):
        raise HTTPException(status_code=403, detail="forbidden")
    return PlainTextResponse(request.query_params.get("hub.challenge") or "")


async def _read_limited(request: Request, max_bytes: int) -> bytes:
    """Заявленный Content-Length сверх предела — отказ сразу; тело без него
    (chunked) читается кусками и обрывается на первом лишнем байте.
    Прочитать целиком и померить потом — значит уже принять переростка
    в память, а подпись проверяется только ПОСЛЕ чтения."""
    declared = request.headers.get("content-length", "")
    if declared.isdigit() and int(declared) > max_bytes:
        raise HTTPException(status_code=413, detail="too_large")
    body = bytearray()
    async for chunk in request.stream():
        body += chunk
        if len(body) > max_bytes:
            raise HTTPException(status_code=413, detail="too_large")
    return bytes(body)


async def _door_open(agent_id: uuid.UUID) -> uuid.UUID | None:
    """Организация агента, если дверь его канала открыта: агент действует И расширение организации действует (Q-183).
    Организацию даёт строка агента, а не адрес запроса."""
    async with dependencies.get_sessionmaker()() as session:
        agent = await session.get(Agent, agent_id)
        if agent is None or not agent.active:
            return None
        org = await session.get(Organization, agent.organization_id)
    return agent.organization_id if org is not None and bool(org.active) else None


@router.post("/channels/whatsapp/webhook/{agent_id}")
async def receive(agent_id: uuid.UUID, request: Request) -> JSONResponse:
    settings: Settings = request.app.state.settings
    raw = await _read_limited(request, settings.whatsapp_max_body_bytes)
    row = await _connection(agent_id)
    if row is None:
        raise HTTPException(status_code=403, detail="forbidden")
    secret = decrypt_key(row.app_secret_encrypted, settings)
    expected = "sha256=" + hmac.new((secret or "").encode(), raw, hashlib.sha256).hexdigest()
    provided = request.headers.get(SIGNATURE_HEADER) or ""
    if not secret or not hmac.compare_digest(
        provided.encode("utf-8"), expected.encode("utf-8")
    ):
        raise HTTPException(status_code=403, detail="forbidden")
    organization_id = await _door_open(agent_id)
    if organization_id is None:
        # Срок расширения вышел или агент выключен (Q-183): 200 — Meta не повторяет, хода нет.
        logger.info("whatsapp: дверь агента %s закрыта (расширение или агент), сообщение без ответа", agent_id)
        return JSONResponse({"status": "ok", "accepted": 0})
    if row.organization_id != organization_id:
        # Подключение и агент указывают на разные организации — данные испорчены, дверь закрыта без подробностей
        logger.error("whatsapp: подключение агента %s принадлежит другой организации", agent_id)
        raise HTTPException(status_code=403, detail="forbidden")

    try:
        body = json.loads(raw)
    except Exception:  # noqa: BLE001 — не JSON: подпись сошлась, но тело не наше
        return JSONResponse({"status": "ok"})
    if not isinstance(body, dict):
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
                    organization_id=str(organization_id),
                    agent_id=str(agent_id),
                )
                if get_whatsapp_runner(request.app).submit(incoming) is None:
                    # Очередь полна: не-200 — Meta доставит ещё раз, реплика не теряется.
                    return JSONResponse(status_code=503, content={"status": "busy"})
                accepted += 1
    return JSONResponse({"status": "ok", "accepted": accepted})
