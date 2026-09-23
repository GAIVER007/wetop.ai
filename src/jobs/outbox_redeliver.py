"""Повторная доставка outbox: раз в 60 с добивает pending, пока не вышло окно.

Транспорты собираются из настроек при каждом проходе: токен может
появиться после перезапуска, а процесс monitor живёт долго.
"""

from __future__ import annotations

import logging

import httpx

from src.channels.outbox import Transport, redeliver_pending
from src.config import Settings, get_settings
from src.dependencies import get_http_client, get_sessionmaker

logger = logging.getLogger(__name__)


def build_transports(settings: Settings, http_client: httpx.AsyncClient) -> dict[str, Transport]:
    """Транспорты по ключу строки outbox: только алерты владельцу.

    🔴 Канала клиента здесь нет: виджет работает вытягиванием, браузер сам
    спрашивает новые сообщения, и доставлять ему через очередь нечего.
    'email' и 'alert_messenger' — оба всегда: 🔴 почта основной канал,
    мессенджер дубль, а не замена. Ненастроенный транспорт вернёт отказ
    с кодом, и строка останется pending до починки, а вот отсутствие ключа
    означало бы, что алерт не доставит никто.
    Токены берутся только из Settings — в код и журнал они не попадают.
    """
    transports: dict[str, Transport] = {}

    from src.alerts.email import build_email_transport
    from src.alerts.messenger import build_messenger_transport

    transports["email"] = build_email_transport(settings)
    # 🔴 Отдельный бот алертов со своим токеном, чатом и адресом Bot API
    # (ALERT_TELEGRAM_API_BASE): к каналу клиентов он отношения не имеет.
    transports["alert_messenger"] = build_messenger_transport(settings, http_client)
    return transports


async def run_once() -> None:
    """Один проход. Исключений наружу нет: фоновая задача не роняет процесс."""
    try:
        settings = get_settings()
        transports = build_transports(settings, get_http_client())
        # Окно «попытка идёт» равно шагу повторов: строку, по которой прямо
        # сейчас идёт отправка, проход не берёт — иначе ответ уйдёт дважды.
        report = await redeliver_pending(
            get_sessionmaker(), transports, in_flight_seconds=settings.alert_retry_interval_seconds
        )
        if report.delivered or report.failed or report.expired or report.skipped:
            logger.info(
                "outbox: доставлено %d, отказов %d, истекло %d, пропущено %d",
                report.delivered, report.failed, report.expired, report.skipped,
            )
    except Exception:
        logger.exception("outbox: проход повторной доставки упал")
