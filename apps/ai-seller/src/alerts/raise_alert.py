"""Выпуск алерта владельцу — ЕДИНСТВЕННАЯ точка выпуска во всём проекте.

Кто хочет позвать владельца, зовёт raise_alert(). Прямая запись строки
в outbox мимо этой функции обходит оба рубежа дедупа, и тогда один
инцидент снова превращается в сотни сообщений за ночь.

🔴 Один алерт кладётся ДВУМЯ строками outbox: почта и мессенджер отдельно.
Почта — основной канал, мессенджер — дубль, а не замена: провал одной
строки не отменяет другую. На боевом проекте адрес мессенджера был
заблокирован, и единственный канал означал молчание ровно тогда, когда
алерт нужнее всего.

🔴 Тело алерта не содержит персональных данных: ни телефона, ни имени,
ни текста переписки — только вид события, канал, время и идентификатор
диалога. Канал алертов чужой, контакт оператор смотрит в панели
(testy.md, раздел «Проверка канала алертов»).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.alerts.dedup import SEEN_PREFIX, flood_check, silenced, window_for
from src.config import Settings
from src.db.base import DeliveryStatus, OutboxKind, utcnow
from src.db.models import OutboxItem

logger = logging.getLogger(__name__)

# Транспорты строк: имена совпадают с ключами build_transports в jobs.
EMAIL_TRANSPORT = "email"
MESSENGER_TRANSPORT = "alert_messenger"
# Пустой получатель: строка всё равно пишется, событие не теряется
# из-за незаполненной настройки.
NO_RECIPIENT = "-"

# Виды событий. Список явный: по нему считается предел «однотипных в час»,
# и новый вид, придуманный на месте, тихо обошёл бы этот предел.
EVENT_TYPES: dict[str, str] = {
    "sla": "срок ответа клиенту истёк",
    "hot_lead": "горячий лид: заявка создана",
    "lead_failed": "заявка не записана во внешнюю систему",
    "lead_no_provider": "приёмник заявок не настроен",
    "lead_idem": "проверка «заявка уже создана» недоступна",
    "llm_down": "модель не ответила",
    "llm_budget": "дневной предел модели гостиницы исчерпан",
    "channel_down": "канал не принимает или не отдаёт сообщения",
    "outbox_failed": "строка исходящих не доставлена за окно повторов",
    "login_attack": "подбор пароля в панели",
    "heartbeat": "суточная проверка канала алертов",
    "flood": "поток однотипных алертов подавлен",
}


@dataclass(frozen=True)
class AlertResult:
    """Исход выпуска: сколько строк легло в outbox и почему их может не быть."""

    sent_rows: int = 0
    silenced: bool = False
    suppressed: bool = False


def _flood_body(event_type: str, limit: int) -> str:
    """⚠️ Одно сообщение о подавлении обязательно: молчаливое подавление
    неотличимо от «всё спокойно», а это ровно тот случай, когда всё плохо."""
    return f"Поток однотипных алертов «{event_type}» подавлен: больше {limit} за час"


def _rows(settings: Settings, *, body: str, dedup_key: str) -> list[OutboxItem]:
    """Строки одного алерта: на каждый адрес почты своя плюс одна в мессенджер.

    🔴 Ключи дедупа строк различаются суффиксом: с одинаковым ключом дедуп
    самой outbox схлопнул бы вторую строку, и дубль канала исчез бы —
    ровно та страховка, ради которой каналов два.
    """
    now = utcnow()
    expires_at = now + timedelta(hours=settings.alert_retry_window_hours)

    def item(transport: str, recipient: str, suffix: str) -> OutboxItem:
        return OutboxItem(
            kind=OutboxKind.ALERT,
            transport=transport,
            recipient=recipient or NO_RECIPIENT,
            body=body,
            dedup_key=f"{dedup_key}:{suffix}",
            status=DeliveryStatus.PENDING,
            attempts=0,
            expires_at=expires_at,
            created_at=now,
        )

    # Пустой список адресов — одна строка с '-': событие не теряется,
    # а незаполненная настройка видна в очереди.
    recipients = settings.alert_email_to_list or [NO_RECIPIENT]
    rows = [item(EMAIL_TRANSPORT, addr, "email") for addr in recipients]
    rows.append(item(MESSENGER_TRANSPORT, settings.alert_telegram_chat_id, "messenger"))

    # Личный адрес владельца — отдельной строкой: группа дежурных ночью спит,
    # владелец нет. Своя строка, потому что недоставка в группу не должна
    # отменять доставку лично (та же причина, что у пары «почта и мессенджер»).
    personal = (settings.alert_telegram_chat_id_personal or "").strip()
    if personal and personal != settings.alert_telegram_chat_id:
        rows.append(item(MESSENGER_TRANSPORT, personal, "messenger_personal"))
    return rows


async def _unmark(redis, dedup_key: str, marked: bool) -> None:
    """Снять отметку молчания: алерт так и не был записан.

    Лишний повтор дешевле пропавшего алерта — молчание худший исход.
    Сбой самого Redis здесь не важен: хуже, чем уже случилось, не будет.
    """
    if not marked:
        return
    try:
        await redis.delete(SEEN_PREFIX + dedup_key)
    except Exception:
        logger.exception("отметку молчания %s снять не удалось", dedup_key)


async def raise_alert(
    sessionmaker: async_sessionmaker[AsyncSession],
    redis,
    settings: Settings,
    *,
    event_type: str,
    body: str,
    dedup_key: str,
    force: bool = False,
) -> AlertResult:
    """Выпустить алерт: два рубежа дедупа, затем две строки outbox.

    force=True пропускает окно молчания: суточную проверку канала глушить
    дедупом нельзя, иначе проверка перестанет проверять.

    🔴 body без персональных данных — вид события, диалог, канал, время.
    🔴 Своя сессия БД: вызов приходит из хода или из фоновой задачи, чужая
    сессия закроется вместе с ними и запись потеряется без ошибки в журнале.
    Исключений наружу нет: несделанный алерт не должен подменять собой
    исход операции, ради которой его выпускали.
    """
    marked = False
    try:
        if not force:
            if await silenced(redis, SEEN_PREFIX + dedup_key, window_for(event_type, settings)):
                logger.info("алерт %s в окне молчания, не выпускаем", dedup_key)
                return AlertResult(sent_rows=0, silenced=True)
            marked = True

        limit = settings.alert_rate_limit_per_hour
        verdict = await flood_check(redis, event_type, limit=limit)
        if not verdict.allowed:
            if not verdict.first_suppressed:
                # Тишина: сообщение о подавлении уже ушло на предыдущем алерте.
                # Отметку снимаем: инцидент так и не прозвучал, и после конца
                # часа он должен получить свой шанс.
                await _unmark(redis, dedup_key, marked)
                return AlertResult(sent_rows=0, suppressed=True)
            logger.warning("поток алертов вида %s подавлен: %d за час", event_type, verdict.count)
            body = _flood_body(event_type, limit)

        rows = _rows(settings, body=body, dedup_key=dedup_key)
        async with sessionmaker() as session:
            session.add_all(rows)
            await session.commit()
        logger.info("алерт %s выпущен, строк %d", dedup_key, len(rows))
        return AlertResult(sent_rows=len(rows))
    except Exception:
        logger.exception("алерт %s не выпущен", dedup_key)
        # 🔴 Отметка молчания принадлежит выпущенному алерту, а не попытке:
        # иначе секундный сбой базы глушит инцидент на всё окно — для
        # горячего лида на сутки, — и алерт пропадает молча.
        await _unmark(redis, dedup_key, marked)
        return AlertResult(sent_rows=0)
