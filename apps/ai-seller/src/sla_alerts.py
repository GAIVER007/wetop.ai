"""Сторож сроков ответа: «клиент написал и ждёт дольше срока» → алерт.

🔴 Сторож, а не health-check: он только зовёт человека. Проверка, которая
под нагрузкой перезапускает процесс, добивает сервис вместо того, чтобы
его спасти.

🔴 Весь отбор идёт в SQL, одним запросом с пределом. Выбрать все диалоги
и отсеять в Python — тот самый отказ, который руками не находится: самые
старые записи занимают выборку навсегда, и часть клиентов перестаёт
получать внимание, а причину ищут где угодно, только не в порядке запроса.

🔴 В теле алерта нет ни текста переписки, ни контакта: вид события, сколько
ждут, диалог и канал. Контакт оператор смотрит в панели.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.alerts.raise_alert import raise_alert
from src.config import Settings
from src.db.base import ConversationMode, MessageRole, utcnow
from src.db.models import Client, Conversation, Message

logger = logging.getLogger(__name__)

EVENT_TYPE = "sla"

# 🔴 Нижняя граница отбора. Диалог, оставшийся без ответа насовсем (хвост
# после отказа модели: клиент больше не пишет, бот сам не ответит), иначе
# занимал бы место в выборке до конца жизни. Как только таких станет больше
# предела, свежие нарушения срока не попадут в выборку никогда, и сторож
# замолчит о живых клиентах, оставаясь зелёным на тесте с одним диалогом.
# Умолчание на случай прямого вызова без настройки.
DEFAULT_LOOKBACK_HOURS = 24


@dataclass
class StaleTurn:
    """Диалог, где клиент ждёт ответа дольше срока."""

    conversation_id: uuid.UUID
    waiting_seconds: int
    channel: str
    # Настоящее время вопроса. Ключ дедупа строится из него, а не из
    # разности «сейчас минус сколько ждут»: разность усечена до секунды,
    # и вопрос в конце 59-й секунды давал на соседних проходах две разные
    # минуты, то есть два ключа на один инцидент и второй алерт в окне.
    asked_at: datetime


def _as_utc(value: datetime) -> datetime:
    """Метка из базы без зоны считается UTC: SQLite отдаёт naive, Postgres — aware.
    Без этого вычитание двух дат падает прямо в фоновой задаче."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


async def find_stale(
    session: AsyncSession,
    *,
    sla_seconds: int,
    now: datetime,
    limit: int = 100,
    lookback_hours: int | None = None,
    organization_id: uuid.UUID | None = None,
) -> list[StaleTurn]:
    """Диалоги, где последнее сообщение клиента старше срока и не отвечено.

    Один запрос: два сгруппированных подзапроса (последний вопрос клиента и
    последний ответ бота) + условия и LIMIT в SQL. Диалог в режиме
    owner_takeover пропускается — человек вошёл, сторож молчит, иначе
    оператору капают алерты о разговоре, который он ведёт руками.

    🔴 Окно отбора ограничено и сверху, и снизу, а сортировка идёт от самых
    свежих: вечно висящий диалог не должен занимать предел выборки, иначе
    новые клиенты перестанут попадать в неё совсем.
    """
    deadline = now - timedelta(seconds=sla_seconds)
    hours = lookback_hours if lookback_hours is not None else DEFAULT_LOOKBACK_HOURS
    lookback = now - timedelta(hours=max(hours, 1))

    last_user = (
        sa.select(
            Message.conversation_id.label("conversation_id"),
            sa.func.max(Message.created_at).label("asked_at"),
        )
        .where(Message.role == MessageRole.USER)
        .group_by(Message.conversation_id)
        .subquery()
    )
    last_answer = (
        sa.select(
            Message.conversation_id.label("conversation_id"),
            sa.func.max(Message.created_at).label("answered_at"),
        )
        .where(Message.role == MessageRole.ASSISTANT)
        .group_by(Message.conversation_id)
        .subquery()
    )

    stmt = (
        sa.select(Conversation.id, last_user.c.asked_at, Client.channel)
        .join(Client, Client.id == Conversation.client_id)
        .join(last_user, last_user.c.conversation_id == Conversation.id)
        .outerjoin(last_answer, last_answer.c.conversation_id == Conversation.id)
        .where(
            Conversation.is_active.is_(True),
            Conversation.mode != ConversationMode.OWNER_TAKEOVER,
            last_user.c.asked_at <= deadline,
            last_user.c.asked_at >= lookback,
            sa.or_(
                last_answer.c.answered_at.is_(None),
                last_answer.c.answered_at < last_user.c.asked_at,
            ),
        )
        # Самые свежие вперёд: по старым алерт уже уходил, а новое нарушение
        # срока должно попадать в выборку всегда.
        .order_by(last_user.c.asked_at.desc())
        .limit(limit)
    )
    if organization_id is not None:
        # Сводка панели продавца (Э4): нарушения — только своей организации.
        # Сторож алертов зовёт без организации и видит всё, как раньше.
        stmt = stmt.where(Conversation.organization_id == organization_id)

    rows = (await session.execute(stmt)).all()
    return [
        StaleTurn(
            conversation_id=conv_id,
            waiting_seconds=int((now - _as_utc(asked_at)).total_seconds()),
            channel=channel,
            asked_at=_as_utc(asked_at),
        )
        for conv_id, asked_at, channel in rows
    ]


def _dedup_key(turn: StaleTurn) -> str:
    """Ключ на конкретное ожидание: диалог + минута вопроса.

    Минута вопроса, а не времени прохода: иначе каждый проход давал бы новый
    ключ, окно молчания не срабатывало бы, и один молчащий диалог слал бы
    алерт раз в минуту до утра.
    🔴 Минута берётся из настоящего asked_at: восстановленная из разности
    метка гуляет на доли секунды и на границе минуты даёт два ключа.
    """
    return f"{EVENT_TYPE}:{turn.conversation_id}:{turn.asked_at:%Y-%m-%dT%H:%M}"


async def scan_and_alert(
    sessionmaker: async_sessionmaker[AsyncSession],
    redis,
    settings: Settings,
    *,
    now: datetime | None = None,
) -> int:
    """Один проход сторожа. Возвращает число выпущенных алертов.

    🔴 Своя сессия БД: это фоновая задача, чужая сессия закрылась бы вместе
    с запросом и проход молча ничего не нашёл бы.
    Повторный проход в том же окне молчания второго алерта не создаёт —
    его гасит дедуп внутри raise_alert.
    Исключений наружу нет: сторож не роняет процесс monitor.
    """
    now = now or utcnow()
    raised = 0
    try:
        async with sessionmaker() as session:
            stale = await find_stale(
                session,
                sla_seconds=settings.sla_seconds,
                now=now,
                lookback_hours=settings.sla_lookback_hours,
            )

        for turn in stale:
            minutes = max(turn.waiting_seconds // 60, 1)
            result = await raise_alert(
                sessionmaker,
                redis,
                settings,
                event_type=EVENT_TYPE,
                # 🔴 Без текста сообщения и без контактов.
                body=(
                    f"Клиент ждёт ответа {minutes} мин, "
                    f"диалог {turn.conversation_id}, канал {turn.channel}"
                ),
                dedup_key=_dedup_key(turn),
            )
            if result.sent_rows:
                raised += 1
        if raised:
            logger.warning("сторож: диалогов без ответа %d, алертов %d", len(stale), raised)
    except Exception:
        logger.exception("сторож: проход прерван")
    return raised
