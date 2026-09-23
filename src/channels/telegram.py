"""Канал Telegram: клиент Bot API, разбор обновлений, вебхук.

Канал ничего не знает о движке: он превращает обновление Telegram во
входящее сообщение и отдаёт движку, а ответ уходит через отправитель
(outbox). Приём — вебхуком, не опросом: один процесс, дублирования нет.

🔴 Токен едет в адресе каждого запроса. Полный адрес в журнал не пишется
никогда — только имя метода; из исключений httpx берётся только тип,
потому что их текст содержит URL.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass

import httpx
import sqlalchemy as sa
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from src.ai.engine_types import IncomingMessage
from src.channels.consent_gate import consent_required, consent_screen, grant_consent
from src.channels.sender import SendResult
from src.config import Settings
from src.db.base import utcnow
from src.db.models import Client
from src.security.signatures import verify_secret_token

logger = logging.getLogger(__name__)

CHANNEL = "telegram"
WEBHOOK_PATH = "/webhooks/telegram"
SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token"
CONSENT_CALLBACK = "consent:accept"
# Предел Telegram на текст одного сообщения.
MAX_MESSAGE_CHARS = 4096
# Предел на тело обновления: живое обновление — десятки килобайт.
MAX_UPDATE_BYTES = 256 * 1024
START_GREETING = "Здравствуйте"
CONSENT_BUTTON_HINT = "Нажмите кнопку, чтобы подтвердить согласие"
CONSENT_THANKS = "Спасибо! Напишите, чем помочь."
_URL_RE = re.compile(r"https?://\S+")


def consent_keyboard(button_text: str) -> dict:
    """Inline-клавиатура с одной кнопкой согласия."""
    return {"inline_keyboard": [[{"text": button_text, "callback_data": CONSENT_CALLBACK}]]}


def split_text(text: str, limit: int = MAX_MESSAGE_CHARS) -> list[str]:
    """Режет длинный текст на части <= limit: по абзацу, строке, пробелу, иначе жёстко.
    Telegram отвергает сообщение длиннее предела целиком, а не обрезает его."""
    parts: list[str] = []
    rest = text
    while len(rest) > limit:
        cut = -1
        for sep in ("\n\n", "\n", " "):
            cut = rest.rfind(sep, 1, limit + 1)
            if cut > 0:
                break
        if cut <= 0:
            cut = limit
        parts.append(rest[:cut].rstrip())
        rest = rest[cut:].lstrip()
    parts.append(rest)
    return [p for p in parts if p] or [text]


def _short_description(body: object) -> str:
    """Первые 80 символов description без адресов: там может быть чужой текст."""
    description = body.get("description", "") if isinstance(body, dict) else ""
    return _URL_RE.sub("[url]", str(description))[:80]


class TelegramClient:
    """Bot API поверх общего httpx-клиента. Реализует Transport для outbox.
    Исключений наружу нет: отказ возвращается кодом, а не текстом."""

    def __init__(self, token: str, http_client: httpx.AsyncClient, *, api_base: str) -> None:
        self._token = token
        self._http = http_client
        self._api_base = api_base.rstrip("/")
        # httpx пишет полный URL запроса на INFO, а в нём токен (как в llm.py).
        logging.getLogger("httpx").setLevel(logging.WARNING)

    def _url(self, method: str) -> str:
        return f"{self._api_base}/bot{self._token}/{method}"

    async def _call(self, method: str, payload: dict) -> tuple[bool, object, str | None]:
        """Один запрос: (ok, result, код отказа). Отказ — по телу, не по коду:
        {"ok": false} при HTTP 200 — тоже отказ."""
        try:
            response = await self._http.post(self._url(method), json=payload)
        except httpx.TimeoutException:
            logger.warning("telegram %s: отказ timeout", method)
            return False, None, "timeout"
        except httpx.HTTPError as exc:
            logger.warning("telegram %s: отказ connection (%s)", method, type(exc).__name__)
            return False, None, "connection"
        except Exception as exc:  # noqa: BLE001 — текст исключения может нести URL
            logger.warning("telegram %s: отказ connection (%s)", method, type(exc).__name__)
            return False, None, "connection"

        body: object = None
        try:
            body = response.json()
        except ValueError:
            body = None
        if response.status_code == 429:
            retry_after = body.get("parameters", {}).get("retry_after") if isinstance(body, dict) else None
            logger.warning("telegram %s: отказ rate_limited, retry_after=%s", method, retry_after)
            return False, None, "rate_limited"
        if response.status_code != 200:
            code = f"http_{response.status_code}"
            logger.warning("telegram %s: отказ %s", method, code)
            return False, None, code
        if not isinstance(body, dict) or body.get("ok") is not True:
            logger.warning("telegram %s: отказ api_error (%s)", method, _short_description(body))
            return False, None, "api_error"
        return True, body.get("result"), None

    async def send_message(self, chat_id: str, text: str, *, reply_markup: dict | None = None) -> SendResult:
        """Плоский текст без parse_mode: разметку уже снял humanizer.
        Длинный текст уходит частями; клавиатура — под последней."""
        parts = split_text(text)
        last_id: str | None = None
        for index, part in enumerate(parts):
            payload: dict = {"chat_id": str(chat_id), "text": part, "disable_web_page_preview": True}
            if reply_markup is not None and index == len(parts) - 1:
                payload["reply_markup"] = reply_markup
            ok, result, error = await self._call("sendMessage", payload)
            if not ok:
                return SendResult(ok=False, error=error)
            if isinstance(result, dict) and result.get("message_id") is not None:
                last_id = str(result["message_id"])
        return SendResult(ok=True, external_message_id=last_id)

    async def deliver(self, recipient: str, text: str) -> SendResult:
        """Transport для outbox."""
        return await self.send_message(recipient, text)

    async def answer_callback_query(self, callback_query_id: str, text: str | None = None) -> bool:
        """Гасит «часики» на кнопке; без ответа Telegram крутит их до минуты."""
        payload: dict = {"callback_query_id": str(callback_query_id)}
        if text:
            payload["text"] = text
        ok, _, _ = await self._call("answerCallbackQuery", payload)
        return ok

    async def set_webhook(self, url: str, secret_token: str) -> bool:
        """drop_pending_updates=False: накопленное за простой не выбрасываем."""
        ok, _, _ = await self._call("setWebhook", {
            "url": url,
            "secret_token": secret_token,
            "allowed_updates": ["message", "callback_query"],
            "drop_pending_updates": False,
        })
        return ok

    async def delete_webhook(self) -> bool:
        ok, _, _ = await self._call("deleteWebhook", {"drop_pending_updates": False})
        return ok

    async def webhook_info(self) -> dict:
        ok, result, _ = await self._call("getWebhookInfo", {})
        return result if ok and isinstance(result, dict) else {}


# ─── Разбор обновления ───


@dataclass(frozen=True)
class CallbackEvent:
    """Нажатие inline-кнопки. Идентификаторы — строкой сразу при разборе."""

    callback_id: str
    chat_id: str
    data: str
    client_name: str | None


def _client_name(user: object) -> str | None:
    if not isinstance(user, dict):
        return None
    name = " ".join(str(p) for p in (user.get("first_name"), user.get("last_name")) if p)
    return name or None


def parse_update(update: dict) -> IncomingMessage | CallbackEvent | None:
    """message с текстом -> IncomingMessage; callback_query -> CallbackEvent;
    всё остальное (фото, голос, стикер, правки) -> None."""
    if not isinstance(update, dict):
        return None
    callback = update.get("callback_query")
    if isinstance(callback, dict):
        chat = (callback.get("message") or {}).get("chat") or {}
        chat_id = chat.get("id", (callback.get("from") or {}).get("id"))
        if callback.get("id") is None or chat_id is None:
            return None
        return CallbackEvent(
            callback_id=str(callback["id"]), chat_id=str(chat_id),
            data=str(callback.get("data") or ""), client_name=_client_name(callback.get("from")),
        )
    message = update.get("message")
    if not isinstance(message, dict):
        return None
    text = message.get("text")
    chat_id = (message.get("chat") or {}).get("id")
    if not isinstance(text, str) or not text.strip() or chat_id is None:
        return None
    # «/start» — нажатие кнопки «Начать», а не реплика: движку уходит приветствие.
    if text.strip().split()[0].split("@")[0] == "/start":
        text = START_GREETING
    return IncomingMessage(
        channel=CHANNEL, external_id=str(chat_id), text=text, received_at=utcnow(),
        client_name=_client_name(message.get("from")), ip=None,
    )


# ─── Обработчик ───


class WebhookRunner:
    """Обрабатывает обновления в фоновых задачах: Telegram ждёт ответ на вебхук
    недолго, а ход с каскадом моделей может идти минуту."""

    def __init__(self, engine, telegram: TelegramClient, sessionmaker, settings: Settings) -> None:
        self._engine, self._telegram, self._sessionmaker, self._settings = engine, telegram, sessionmaker, settings
        self._tasks: set[asyncio.Task] = set()

    def submit(self, update: dict) -> asyncio.Task:
        """Ссылка на задачу хранится до завершения: иначе цикл её соберёт на полпути."""
        task = asyncio.create_task(self.handle(update))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        return task

    async def drain(self) -> None:
        """Дождаться всех задач: для тестов и остановки."""
        while self._tasks:
            await asyncio.gather(*list(self._tasks), return_exceptions=True)

    async def handle(self, update: dict) -> None:
        """Исключения ловятся здесь: ошибка одного обновления не роняет обработчик."""
        try:
            event = parse_update(update)
            if isinstance(event, IncomingMessage):
                await self._handle_message(event)
            elif isinstance(event, CallbackEvent):
                await self._handle_callback(event)
        except Exception:
            logger.exception("telegram: обработка обновления упала")

    async def _handle_message(self, incoming: IncomingMessage) -> None:
        outcome = await self._engine.process_message(incoming)
        # 🔴 Смотрим на состояние согласия, а не только на статус хода: если
        # экран согласия не доставился, движок отдаст 'send_failed', и без
        # этой проверки клиент останется с экраном без кнопки.
        needs_button = outcome.status == "consent" or (
            outcome.status == "send_failed" and await self._consent_pending(incoming.external_id)
        )
        if needs_button:
            # Экран согласия уходит текстом от движка; канал добавляет кнопку.
            screen = consent_screen(self._settings)
            result = await self._telegram.send_message(
                incoming.external_id, CONSENT_BUTTON_HINT, reply_markup=consent_keyboard(screen.button_text),
            )
            if not result.ok:
                # Кнопка уйдёт заново на следующем сообщении клиента:
                # согласия всё ещё нет, и движок снова покажет экран.
                logger.warning("telegram: кнопка согласия не ушла (%s)", result.error)

    async def _consent_pending(self, chat_id: str) -> bool:
        """Согласия всё ещё нет. Своя сессия: обработчик живёт дольше запроса."""
        if not self._settings.consent_gate_enabled:
            return False
        async with self._sessionmaker() as session:
            stmt = sa.select(Client.id).where(Client.channel == CHANNEL, Client.external_id == str(chat_id))
            client_id = (await session.execute(stmt)).scalar_one_or_none()
            if client_id is None:
                return True  # клиента ещё нет — согласия тем более
            return await consent_required(session, self._settings, client_id)

    async def _handle_callback(self, event: CallbackEvent) -> None:
        if event.data != CONSENT_CALLBACK:
            await self._telegram.answer_callback_query(event.callback_id)
            return
        screen = consent_screen(self._settings)
        # Своя сессия: обработчик живёт дольше запроса, в котором пришло обновление.
        async with self._sessionmaker() as session:
            client = await _get_or_create_client(session, event.chat_id, event.client_name)
            await grant_consent(
                session, self._settings, client.id, method="telegram_button", shown_text=screen.text,
            )
        await self._telegram.answer_callback_query(event.callback_id, "Спасибо")
        await self._telegram.send_message(event.chat_id, CONSENT_THANKS)


async def _get_or_create_client(session, chat_id: str, name: str | None) -> Client:
    stmt = sa.select(Client).where(Client.channel == CHANNEL, Client.external_id == str(chat_id))
    client = (await session.execute(stmt)).scalar_one_or_none()
    if client is None:
        client = Client(channel=CHANNEL, external_id=str(chat_id), name=name, created_at=utcnow())
        session.add(client)
        await session.flush()
    return client


def build_runner(settings: Settings) -> WebhookRunner:
    """Сборка из синглтонов процесса. Импорты внутри: движок и outbox не нужны
    тем, кто подменяет runner в тестах."""
    from src.ai.engine import build_engine
    from src.channels.outbox import OutboxSender
    from src.dependencies import get_http_client, get_sessionmaker

    telegram = TelegramClient(
        settings.channel_telegram_bot_token, get_http_client(), api_base=settings.channel_telegram_api_base,
    )
    sender = OutboxSender(
        get_sessionmaker(), {CHANNEL: telegram}, retry_window_hours=settings.alert_retry_window_hours,
    )
    engine = build_engine(settings, sender=sender, channel_markdown=False, channel_emoji=False)
    return WebhookRunner(engine, telegram, get_sessionmaker(), settings)


def get_runner(app) -> WebhookRunner:
    """Runner из app.state; нет — создаётся лениво один раз."""
    runner = getattr(app.state, "telegram_runner", None)
    if runner is None:
        runner = build_runner(app.state.settings)
        app.state.telegram_runner = runner
    return runner


# ─── Вебхук ───

router = APIRouter()


@router.post(WEBHOOK_PATH)
async def telegram_webhook(request: Request) -> JSONResponse:
    """Проверка секрета -> разбор JSON -> задача -> сразу 200.
    Пустой секрет в настройках — 403 всегда: «не настроен» не значит «пускаем всех»."""
    settings: Settings = request.app.state.settings
    if not verify_secret_token(settings.channel_telegram_webhook_secret, request.headers.get(SECRET_HEADER)):
        return JSONResponse(status_code=403, content={"status": "forbidden"})
    body = await request.body()
    if len(body) > MAX_UPDATE_BYTES:
        # Переросток отбивается до разбора: на nginx полагаться нельзя.
        logger.warning("telegram: обновление больше предела, %d байт", len(body))
        return JSONResponse(status_code=400, content={"status": "bad_request"})
    try:
        update = json.loads(body)
    except Exception:
        # Ловим шире ValueError: на глубоко вложенном теле json поднимает
        # RecursionError, а 500 заставит Telegram слать то же обновление снова.
        update = None
    if not isinstance(update, dict):
        return JSONResponse(status_code=400, content={"status": "bad_request"})
    get_runner(request.app).submit(update)
    return JSONResponse(status_code=200, content={"status": "ok"})
