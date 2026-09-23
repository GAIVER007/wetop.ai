"""Фоновая задача сторожа: раз в 60 с ищет диалоги без ответа дольше срока.

🔴 Сторож зовёт человека и ничего не перезапускает: проверка живости,
которая гасит процесс под нагрузкой, добивает сервис.
"""

from __future__ import annotations

import logging

from src import dependencies
from src.config import get_settings
from src.sla_alerts import scan_and_alert

logger = logging.getLogger(__name__)


async def run_once() -> None:
    """Один проход. Исключений наружу нет: фоновая задача не роняет процесс.

    🔴 Ресурсы берутся на месте, а не при импорте: сессия своя (get_sessionmaker),
    Redis один на процесс. Обращение через модуль dependencies, а не через
    импортированное имя, — чтобы подмена в тестах доставала и эту задачу.
    """
    try:
        await scan_and_alert(
            dependencies.get_sessionmaker(), dependencies.get_redis(), get_settings()
        )
    except Exception:
        logger.exception("сторож: проход упал")
