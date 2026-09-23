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
    """Транспорты по каналам: 'telegram', если задан токен; иначе пусто.
    Токен берётся только из Settings — в код и журнал он не попадает."""
    transports: dict[str, Transport] = {}
    if settings.channel_telegram_bot_token:
        # Импорт внутри: модуль канала тянет FastAPI-роутер и движок,
        # а monitor'у они не нужны при старте.
        from src.channels.telegram import TelegramClient

        transports["telegram"] = TelegramClient(
            settings.channel_telegram_bot_token,
            http_client,
            api_base=settings.channel_telegram_api_base,
        )
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
