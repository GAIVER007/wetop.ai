"""Фоновая задача сторожа: раз в 60 с ищет диалоги без ответа дольше срока.

🔴 Сторож зовёт человека и ничего не перезапускает: проверка живости,
которая гасит процесс под нагрузкой, добивает сервис.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

import sqlalchemy as sa

from src import dependencies
from src.alerts.raise_alert import raise_alert
from src.db.base import ConversationMode, DeliveryStatus, utcnow
from src.db.models import Conversation, OutboxItem
from src.config import get_settings
from src.sla_alerts import scan_and_alert

logger = logging.getLogger(__name__)


async def run_once() -> None:
    """Один проход. Исключений наружу нет: фоновая задача не роняет процесс.

    🔴 Ресурсы берутся на месте, а не при импорте: сессия своя (get_sessionmaker),
    Redis один на процесс. Обращение через модуль dependencies, а не через
    импортированное имя, — чтобы подмена в тестах доставала и эту задачу.
    """
    settings = get_settings()
    # Каждая проверка в своём try: сбой первой не должен съесть вторую.
    for check in (scan_and_alert, check_health):
        try:
            await check(dependencies.get_sessionmaker(), dependencies.get_redis(), settings)
        except Exception:
            logger.exception("сторож: проверка %s упала", getattr(check, "__name__", check))


async def check_health(sessionmaker, redis, settings, *, now: datetime | None = None) -> int:
    """Здоровье самого бота: затор в очереди и очередь ждущих человека.

    Обе болезни тихие — в журнале ни строки, бот отвечает, а сообщения
    не уходят и люди ждут. Считаем в SQL, чтобы не тянуть таблицы в память.
    Возвращает число выпущенных алертов; дедуп внутри raise_alert не даёт
    повторить тот же инцидент в окне молчания.
    """
    now = now or utcnow()
    raised = 0
    stuck_since = now - timedelta(minutes=settings.watch_outbox_stuck_minutes)
    async with sessionmaker() as session:
        stuck = await session.scalar(
            sa.select(sa.func.count())
            .select_from(OutboxItem)
            .where(OutboxItem.status == DeliveryStatus.PENDING, OutboxItem.created_at <= stuck_since)
        )
        waiting = await session.scalar(
            sa.select(sa.func.count())
            .select_from(Conversation)
            .where(Conversation.mode == ConversationMode.NEEDS_HUMAN, Conversation.is_active.is_(True))
        )

    checks = (
        (stuck or 0, settings.watch_outbox_stuck_limit, "outbox_stuck",
         f"Очередь отправки встала: {stuck} сообщений ждут дольше "
         f"{settings.watch_outbox_stuck_minutes} мин"),
        (waiting or 0, settings.watch_needs_human_limit, "needs_human",
         f"Ждут человека: {waiting} разговоров"),
    )
    for count, limit, kind, body in checks:
        if count <= limit:
            continue
        result = await raise_alert(
            sessionmaker, redis, settings,
            event_type="channel_down" if kind == "outbox_stuck" else "sla",
            body=body,  # 🔴 только числа: ни контактов, ни текста переписки
            dedup_key=f"{kind}:{now:%Y-%m-%dT%H}",
        )
        if result.sent_rows:
            raised += 1
    return raised
