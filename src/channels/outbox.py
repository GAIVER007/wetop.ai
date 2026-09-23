"""Outbox: исходящие с отслеживанием доставки и повторная доставка.

Строка в outbox пишется ДО попытки отправки: если процесс упадёт между
записью и попыткой, monitor добьёт её повтором. Если бы писали после —
отказ канала терялся бы вместе с ответом бота.

Ответ бота попадает в историю только после доставки: при немедленном
успехе — движком (по SendResult ok), при доставке повтором — здесь,
в redeliver_pending. Иначе бот считает, что ответил, и молчит навсегда.
"""

from __future__ import annotations

import hashlib
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Protocol

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.channels.sender import Sender, SendResult
from src.db.base import DeliveryStatus, MessageRole, OutboxKind, utcnow
from src.db.models import Client, Conversation, Message, OutboxItem

logger = logging.getLogger(__name__)

REPLY_PREFIX = "reply:"
# Сколько секунд строка считается «в работе» после захвата. Попытка длится
# не дольше таймаута HTTP-клиента; пока она идёт, второй процесс строку
# не берёт, иначе клиент получит один ответ дважды.
IN_FLIGHT_SECONDS = 60


class Transport(Protocol):
    """Доставка одного текста одному адресату в конкретном канале.
    Исключений наружу не поднимает — отказ приходит как SendResult(ok=False)."""

    async def deliver(self, recipient: str, text: str) -> SendResult: ...


def _text_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def _short_error(error: str | None) -> str:
    """Короткий нейтральный код в last_error: без адресов, токенов и чужого текста."""
    return (error or "unknown")[:80]


async def _find_active_conversation_id(
    session: AsyncSession, channel: str, external_id: str
) -> uuid.UUID | None:
    """Тот же поиск, что делает движок в _accept: клиент по (канал, id), активный диалог."""
    stmt = sa.select(Client.id).where(Client.channel == channel, Client.external_id == external_id)
    client_id = (await session.execute(stmt)).scalar_one_or_none()
    if client_id is None:
        return None
    stmt = (
        sa.select(Conversation.id)
        .where(Conversation.client_id == client_id, Conversation.is_active.is_(True))
        .order_by(Conversation.last_activity_at.desc())
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


def _conversation_id_from_dedup(dedup_key: str | None) -> uuid.UUID | None:
    """'reply:<uuid>:<hash>' -> uuid; 'reply:-:<hash>' и всё остальное -> None."""
    if not dedup_key or not dedup_key.startswith(REPLY_PREFIX):
        return None
    parts = dedup_key.split(":")
    if len(parts) != 3:
        return None
    try:
        return uuid.UUID(parts[1])
    except ValueError:
        return None


async def _claim(session: AsyncSession, item: OutboxItem, now: datetime) -> bool:
    """Захват строки ДО доставки: attempts+1 и last_attempt_at одним UPDATE.

    🔴 Доставляет тот, чей UPDATE изменил строку (rowcount == 1). Без захвата
    немедленная попытка отправителя и проход monitor доставят один ответ
    дважды, и в историю он попадёт двумя записями. last_error гасится:
    «захвачена, исход не записан» — это и есть признак идущей попытки.
    """
    seen = item.attempts
    stmt = (
        sa.update(OutboxItem)
        .where(
            OutboxItem.id == item.id,
            OutboxItem.status == DeliveryStatus.PENDING,
            OutboxItem.attempts == seen,
        )
        .values(attempts=seen + 1, last_attempt_at=now, last_error=None)
        .execution_options(synchronize_session=False)
    )
    taken = ((await session.execute(stmt)).rowcount or 0) == 1
    await session.commit()
    if taken:
        await session.refresh(item)  # UPDATE прошёл мимо ORM: перечитываем
    return taken


async def _attempt(transport: Transport, recipient: str, text: str) -> SendResult:
    """Попытка доставки: исключение транспорта — тоже отказ, а не падение outbox."""
    try:
        return await transport.deliver(recipient, text)
    except Exception:
        logger.exception("Транспорт бросил исключение при доставке")
        return SendResult(ok=False, error="transport_exception")


class OutboxSender(Sender):
    """Отправитель для движка: пишет строку outbox, пробует доставить сразу."""

    def __init__(
        self,
        sessionmaker: async_sessionmaker[AsyncSession],
        transports: dict[str, Transport],
        *,
        retry_window_hours: int,
    ) -> None:
        self._sessionmaker = sessionmaker
        self._transports = transports
        self._retry_window = timedelta(hours=retry_window_hours)

    async def send(self, *, channel: str, external_id: str, text: str) -> SendResult:
        transport = self._transports.get(channel)
        if transport is None:
            # Без транспорта строка бессмысленна: повтор её тоже не доставит.
            logger.warning("Нет транспорта для канала %s", channel)
            return SendResult(ok=False, error="no_transport")

        recipient = str(external_id)
        # 🔴 Своя сессия: сессия движка живёт один ход, а строка должна
        # остаться в базе независимо от того, чем ход закончится.
        async with self._sessionmaker() as session:
            conv_id = await _find_active_conversation_id(session, channel, recipient)
            dedup_key = f"{REPLY_PREFIX}{conv_id or '-'}:{_text_hash(text)}"
            now = utcnow()
            item = OutboxItem(
                kind=OutboxKind.REPLY,
                transport=channel,
                recipient=recipient,
                body=text,
                dedup_key=dedup_key,
                status=DeliveryStatus.PENDING,
                attempts=0,
                expires_at=now + self._retry_window,
                created_at=now,
            )
            session.add(item)
            await session.commit()  # строка есть ДО попытки

            # Захват до доставки: пока попытка идёт, monitor эту строку не берёт.
            await _claim(session, item, utcnow())
            result = await _attempt(transport, recipient, text)
            if result.ok:
                item.status = DeliveryStatus.SENT
                item.sent_at = utcnow()
                item.last_error = None
            else:
                # status остаётся pending: monitor добьёт повтором.
                item.last_error = _short_error(result.error)
                logger.warning("Доставка в %s не удалась: %s", channel, item.last_error)
            await session.commit()

        if result.ok:
            return SendResult(ok=True, external_message_id=result.external_message_id)
        return SendResult(ok=False, error=result.error)


@dataclass
class RedeliverReport:
    """Итог одного прохода повторной доставки — числа для журнала."""

    delivered: int = 0
    failed: int = 0
    expired: int = 0
    skipped: int = 0


async def _record_reply_in_history(session: AsyncSession, item: OutboxItem) -> None:
    """Ответ, доставленный повтором, пишет в историю сам повтор: движок уже отработал."""
    conv_id = _conversation_id_from_dedup(item.dedup_key)
    if item.kind != OutboxKind.REPLY or conv_id is None:
        return
    conv = await session.get(Conversation, conv_id)
    if conv is None:
        return
    now = utcnow()
    session.add(
        Message(
            conversation_id=conv.id,
            role=MessageRole.ASSISTANT,
            content=item.body,
            sent_by_us=True,
            created_at=now,
        )
    )
    conv.last_activity_at = now


async def redeliver_pending(
    sessionmaker: async_sessionmaker[AsyncSession],
    transports: dict[str, Transport],
    *,
    now: datetime | None = None,
    batch: int = 50,
    in_flight_seconds: int = IN_FLIGHT_SECONDS,
) -> RedeliverReport:
    """Один проход: истёкшие -> failed, живые pending -> попытка доставки.

    🔴 Фильтр только в SQL. Если выбрать pending без условия по expires_at и
    отсеять в Python, истёкшие с самым старым created_at займут выборку
    навсегда и живые до транспорта не дойдут.
    🔴 Строки с идущей попыткой (захвачены недавно, исход не записан) в
    выборку не берутся, а перед доставкой строка захватывается: иначе
    немедленная попытка отправителя и этот проход доставят один ответ дважды.
    Одна строка — одна транзакция: падение на пятой не откатывает четыре.
    Исключений наружу нет: это фоновая задача, её падение молчаливо.
    """
    report = RedeliverReport()
    now = now or utcnow()
    try:
        async with sessionmaker() as session:
            expire_stmt = (
                sa.update(OutboxItem)
                .where(OutboxItem.status == DeliveryStatus.PENDING, OutboxItem.expires_at <= now)
                .values(status=DeliveryStatus.FAILED, last_error="expired")
                .execution_options(synchronize_session=False)
            )
            report.expired = (await session.execute(expire_stmt)).rowcount or 0
            await session.commit()

            # «Попытка идёт прямо сейчас»: захвачена недавно, исход не записан.
            # Упал процесс на попытке — через окно строка снова живая.
            in_flight_since = now - timedelta(seconds=in_flight_seconds)
            not_in_flight = sa.or_(
                OutboxItem.last_attempt_at.is_(None),
                OutboxItem.last_attempt_at <= in_flight_since,
                OutboxItem.last_error.is_not(None),
            )
            select_stmt = (
                sa.select(OutboxItem)
                .where(
                    OutboxItem.status == DeliveryStatus.PENDING,
                    OutboxItem.expires_at > now,
                    not_in_flight,
                )
                .order_by(OutboxItem.created_at)
                .limit(batch)
            )
            items = list((await session.execute(select_stmt)).scalars().all())

            for item in items:
                try:
                    await _redeliver_one(session, item, transports, report)
                except Exception:
                    # Одна сломанная строка не останавливает проход по остальным.
                    logger.exception("outbox %s: сбой повторной доставки", item.id)
                    await session.rollback()
    except Exception:
        logger.exception("Проход повторной доставки прерван")
    return report


async def _redeliver_one(
    session: AsyncSession,
    item: OutboxItem,
    transports: dict[str, Transport],
    report: RedeliverReport,
) -> None:
    transport = transports.get(item.transport)
    if transport is None:
        # Строка остаётся pending: транспорт может появиться после перезапуска.
        logger.warning("outbox %s: нет транспорта %s, пропуск", item.id, item.transport)
        report.skipped += 1
        return

    if not await _claim(session, item, utcnow()):
        # Строку уже взял другой процесс: доставит он, а не мы.
        logger.info("outbox %s: строка занята другим проходом, пропуск", item.id)
        report.skipped += 1
        return

    result = await _attempt(transport, item.recipient, item.body)
    if result.ok:
        item.status = DeliveryStatus.SENT
        item.sent_at = utcnow()
        item.last_error = None
        await _record_reply_in_history(session, item)
        report.delivered += 1
    else:
        item.last_error = _short_error(result.error)
        report.failed += 1
    await session.commit()
