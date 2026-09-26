"""Дневной предел токенов гостиницы на ключе платформы (plans/seller-cost-controls-2026-09-26.md, п. 1).

Расход гостиницы — сумма messages.tokens_used её диалогов с начала местных
суток. Выше LLM_DAILY_TOKENS_PER_ORG продавец модель не зовёт: гостю —
нейтральная фраза, диалог помечен для сотрудника, владельцу — один алерт
в сутки (ключ алерта несёт местную дату, окно молчания — сутки).

Где действует: только ход гостиницы (есть организация) на ключе платформы.
Ключ партнёра (С2) — его расход; помощник (без организации) предела не имеет.
Предел мягкий: проверка стоит до вызова модели, поэтому последний ход суток
может перешагнуть его на свой расход — считать токены до ответа нечем.

🔴 Сутки — по времени Казахстана: с 01.03.2024 вся страна в UTC+5, без
перехода на летнее время. Сдвиг задан числом, а не ZoneInfo: в slim-образе
базы часовых поясов может не оказаться, и продавец упал бы на первом ходе.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa

from src.db.base import utcnow
from src.db.models import Conversation, Message

LOCAL_TZ = timezone(timedelta(hours=5), "UTC+5")
# Вид алерта: окно молчания для него — сутки (src/alerts/dedup.py).
ALERT_EVENT = "llm_budget"


def local_day_start(now: datetime) -> datetime:
    """Полночь текущих местных суток — в UTC, как метки в базе."""
    local = now.astimezone(LOCAL_TZ)
    return local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)


def local_month_bounds(year: int, month: int) -> tuple[datetime, datetime]:
    """Месяц по местному времени -> [начало, начало следующего) в UTC.
    Тот же пояс, что у суток предела: отчёт о расходе и предел не расходятся."""
    start = datetime(year, month, 1, tzinfo=LOCAL_TZ)
    end = datetime(year + month // 12, month % 12 + 1, 1, tzinfo=LOCAL_TZ)
    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)


async def tokens_since(session, organization_id: uuid.UUID, since: datetime) -> int:
    """Токены ответов модели в диалогах гостиницы с момента since.

    Фильтр по организации — у диалога (Э4): сообщения своей организации
    не несут. Строки без расхода (реплики гостя, фразы без модели) в сумму
    не входят сами: tokens_used у них пуст.
    """
    stmt = (
        sa.select(sa.func.coalesce(sa.func.sum(Message.tokens_used), 0))
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(Conversation.organization_id == organization_id, Message.created_at >= since)
    )
    return int((await session.execute(stmt)).scalar_one())


@dataclass(frozen=True)
class DailyBudget:
    """Расход гостиницы за местные сутки против предела."""

    limit: int
    spent: int
    day: str  # местная дата — часть ключа алерта: новые сутки, новый алерт

    @property
    def exceeded(self) -> bool:
        return self.limit > 0 and self.spent >= self.limit


async def daily_budget(
    session, organization_id: uuid.UUID, limit: int, *, now: datetime | None = None
) -> DailyBudget:
    now = now or utcnow()
    spent = await tokens_since(session, organization_id, local_day_start(now)) if limit > 0 else 0
    return DailyBudget(limit=limit, spent=spent, day=f"{now.astimezone(LOCAL_TZ):%Y-%m-%d}")


def alert_body(hotel_name: str | None, organization_id: uuid.UUID, budget: DailyBudget) -> str:
    """Тело алерта владельцу: гостиница и цифры, ни слова из переписки."""
    hotel = f"«{hotel_name}» ({organization_id})" if hotel_name else str(organization_id)
    return (
        f"Дневной предел модели исчерпан: гостиница {hotel}, {budget.spent} из {budget.limit} "
        f"токенов на ключе платформы за {budget.day} (UTC+5). До полуночи продавец модель не зовёт: "
        "гостям отвечает «администратор свяжется», диалоги помечены для сотрудника. "
        "Поднять предел — LLM_DAILY_TOKENS_PER_ORG в .env продавца, или гостиница подключает свой ключ."
    )
