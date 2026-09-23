"""Суточная проверка канала алертов: тестовое сообщение в оба канала.

🔴 Молчание канала неотличимо от «всё спокойно». Не пришло тестовое
сообщение — доставка сломалась, и вы узнаёте об этом сами, а не в день,
когда понадобится настоящий алерт.
"""

from __future__ import annotations

import logging
from datetime import datetime

from src import dependencies
from src.alerts.raise_alert import raise_alert
from src.config import get_settings
from src.db.base import utcnow

logger = logging.getLogger(__name__)

KEY_PREFIX = "alert:heartbeat:"
# 48 часов: отметка переживает сутки с запасом на сдвиг часа и перезапуск,
# но не остаётся в Redis навсегда.
KEY_TTL_SECONDS = 48 * 3600


async def run_once(*, now: datetime | None = None) -> None:
    """Раз в сутки в назначенный час выпускает тестовый алерт.

    Отметка дня ставится через SET NX: задача крутится раз в минуту, и без
    неё за час ушло бы шестьдесят «проверок».
    🔴 force=True: проверку канала глушить дедупом нельзя, иначе проверка
    перестанет проверять ровно тогда, когда канал сломается.
    Исключений наружу нет: фоновая задача не роняет процесс.
    """
    try:
        settings = get_settings()
        if not settings.alert_heartbeat_enabled:
            return
        now = now or utcnow()
        if now.hour != settings.alert_heartbeat_hour:
            return

        redis = dependencies.get_redis()
        day = f"{now:%Y-%m-%d}"
        if not await redis.set(KEY_PREFIX + day, "1", nx=True, ex=KEY_TTL_SECONDS):
            return

        await raise_alert(
            dependencies.get_sessionmaker(),
            redis,
            settings,
            event_type="heartbeat",
            body=f"Проверка канала алертов, {now:%Y-%m-%d %H:%M} UTC — это тестовое сообщение",
            dedup_key=f"heartbeat:{day}",
            force=True,
        )
    except Exception:
        logger.exception("проверка канала алертов не выпущена")
