"""Мессенджер как ДУБЛЬ почтового алерта, а не замена ей.

Отдельный бот алертов: токен ALERT_TELEGRAM_BOT_TOKEN — 🔴 это не бот
канала клиентов, у того свой токен и свой чат. Перепутать их означает
отправить владельцу переписку клиента или клиенту — внутренний алерт.

🔴 Список запасных адресов перебирается ПО ПОРЯДКУ, и порядок важен:
в инциденте рабочий адрес стоял последним, мёртвый первым, и перебор
упирался в таймаут раньше, чем доходил до живого. Отсюда короткий таймаут
на адрес — мёртвый не должен съедать окно до живого.

🔴 Токен едет в адресе каждого запроса: полный адрес в журнал не пишется
никогда, из исключений httpx берётся только тип.
"""

from __future__ import annotations

import html
import logging

import httpx

from src.channels.sender import SendResult
from src.config import Settings

logger = logging.getLogger(__name__)

METHOD = "sendMessage"
# Предел Telegram на текст одного сообщения: длиннее — отказ целиком.
MAX_MESSAGE_CHARS = 4096
# Таймаут на ОДИН адрес: перебор должен успеть дойти до живого.
PER_BASE_TIMEOUT_SECONDS = 10.0


def to_html(text: str) -> str:
    """Экранирование для parse_mode=HTML.

    🔴 HTML, а не Markdown: ссылки часто содержат подчёркивания, в Markdown
    '_' открывает курсив, парсер не находит закрытия и отвергает сообщение.
    Потеря тихая — отказ виден только в журнале. Экранируем & < > у всех
    динамических значений; перевод строк HTML переносит как есть, приводим
    только к '\\n'.
    """
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    return html.escape(normalized, quote=False)


def _fit(html_text: str) -> str:
    """Обрезка до предела канала по границе сущности.

    Резать посреди '&amp;' нельзя: получится битая сущность и отказ разбора —
    та же тихая потеря, от которой уводит HTML.
    """
    if len(html_text) <= MAX_MESSAGE_CHARS:
        return html_text
    cut = html_text[:MAX_MESSAGE_CHARS]
    tail = cut.rsplit("&", 1)
    if len(tail) == 2 and ";" not in tail[1]:
        cut = tail[0]
    return cut


class MessengerTransport:
    """Transport для outbox: дубль алерта в чат владельца.

    Исключений наружу нет: отказ возвращается кодом, строка остаётся
    pending и добивается повторами до конца окна.
    """

    def __init__(self, settings: Settings, http_client: httpx.AsyncClient) -> None:
        self._settings = settings
        self._http = http_client
        # 🔴 httpx пишет полный URL запроса на INFO, а в нём токен бота.
        logging.getLogger("httpx").setLevel(logging.WARNING)

    def _url(self, api_base: str, token: str) -> str:
        return f"{api_base.rstrip('/')}/bot{token}/{METHOD}"

    async def _post(self, api_base: str, token: str, payload: dict) -> tuple[bool, str | None, str | None]:
        """Один запрос к одному адресу: (ok, id сообщения, код отказа).

        🔴 Отказ определяется по телу: {"ok": false} приходит с кодом 200 —
        сервер жив, сообщения нет. Код 200, засчитанный в успех, — это отчёт,
        который врёт в вашу пользу.
        """
        try:
            response = await self._http.post(
                self._url(api_base, token), json=payload, timeout=PER_BASE_TIMEOUT_SECONDS
            )
        except httpx.TimeoutException:
            logger.warning("alert %s: отказ timeout", METHOD)
            return False, None, "timeout"
        except Exception as exc:  # noqa: BLE001 — текст исключения httpx несёт URL с токеном
            logger.warning("alert %s: отказ connection (%s)", METHOD, type(exc).__name__)
            return False, None, "connection"

        body: object = None
        try:
            body = response.json()
        except ValueError:
            body = None
        if response.status_code == 429:
            logger.warning("alert %s: отказ rate_limited", METHOD)
            return False, None, "rate_limited"
        if response.status_code != 200:
            code = f"http_{response.status_code}"
            logger.warning("alert %s: отказ %s", METHOD, code)
            return False, None, code
        if not isinstance(body, dict) or body.get("ok") is not True:
            logger.warning("alert %s: отказ api_error", METHOD)
            return False, None, "api_error"
        result = body.get("result")
        message_id = None
        if isinstance(result, dict) and result.get("message_id") is not None:
            message_id = str(result["message_id"])
        return True, message_id, None

    async def deliver(self, recipient: str, text: str) -> SendResult:
        """Перебор адресов по порядку: первый успех завершает перебор."""
        token = self._settings.alert_telegram_bot_token
        if not token:
            # Бот алертов не настроен: строка останется pending и уедет
            # в повтор, когда токен появится.
            logger.warning("alert %s: бот алертов не настроен", METHOD)
            return SendResult(ok=False, error="alert_bot_not_configured")

        payload = {
            "chat_id": str(recipient),
            "text": _fit(to_html(text)),
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }
        last_error = "no_api_base"
        for api_base in self._settings.alert_telegram_api_base_list:
            ok, message_id, error = await self._post(api_base, token, payload)
            if ok:
                return SendResult(ok=True, external_message_id=message_id)
            last_error = error or "unknown"
        logger.warning("alert %s: все адреса отказали, последний код %s", METHOD, last_error)
        return SendResult(ok=False, error=last_error)


def build_messenger_transport(settings: Settings, http_client: httpx.AsyncClient) -> MessengerTransport:
    """Сборка транспорта для реестра транспортов outbox."""
    return MessengerTransport(settings, http_client)
