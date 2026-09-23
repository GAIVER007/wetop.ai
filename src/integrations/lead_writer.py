"""Идемпотентная запись заявки во внешнюю систему — это и есть lead_hook движка.

🔴 Проверка «уже сделано» стоит ДО вызова провайдера, а ключ ставится только
ПОСЛЕ успеха. Наоборот — значит либо дубли заявок у менеджера, либо
потерянный лид: обе цены платит заказчик, а не разработчик.

Не смог записать — поднимаем LeadNotWritten. Движок тогда не ставит
lead_created_at, и следующий ход повторит попытку. Тихий возврат означал бы
«записал», хотя заявки нет: бот не обещает действий, которых не делает.

🔴 Алерт не содержит телефона, имени и текста переписки: только
идентификатор диалога и тип события. Канал алертов — чужая труба,
персональные данные в неё не уходят, контакт оператор смотрит в панели.
"""

from __future__ import annotations

import hashlib
import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src import dependencies
from src.alerts.raise_alert import raise_alert
from src.integrations.failure_log import log_provider_failure
from src.config import Settings
from src.integrations.providers import Providers

logger = logging.getLogger(__name__)

# Префикс ключа «заявка по этому диалогу и номеру уже создана».
DONE_PREFIX = "lead:done:"
# 30 суток: дольше живого диалога, но не вечно — Redis не архив.
DONE_TTL_SECONDS = 30 * 24 * 60 * 60

# Поля, которые уходят наружу. Список явный: «весь lead» утащил бы служебные
# asks, contact_refused и lead_created_at в чужую систему.
PAYLOAD_KEYS: tuple[str, ...] = (
    "name", "phone", "email", "interest", "budget", "timeframe", "notes", "extra",
)

# Вид события выводится из префикса ключа дедупа: ключи ставит этот же
# модуль, а вид нужен предельщику «однотипных алертов в час».
_EVENT_BY_PREFIX: tuple[tuple[str, str], ...] = (
    ("hotlead:", "hot_lead"),
    ("leadfail:", "lead_failed"),
    ("leadidem:", "lead_idem"),
)


class LeadNotWritten(RuntimeError):
    """Заявка не создана. Движок ловит любое исключение хука и повторит ход."""


def natural_key(conversation_id: uuid.UUID, lead: dict) -> str:
    """Натуральный ключ: один диалог + один телефон = одна заявка.

    От телефона берутся только цифры: '+7 701 000 00 00' и '+77010000000'
    — одна запись, а разный ключ дал бы вторую заявку. Национальные формы
    (8 вместо +7) здесь НЕ сводятся: гадать за клиента дороже, чем
    показать менеджеру два контакта.
    Хеш, а не сам номер: ключ виден в Redis и в журнале.
    """
    digits = "".join(ch for ch in str(lead.get("phone") or "") if ch.isdigit())
    raw = f"conv:{conversation_id}|phone:{digits}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def _event_type(dedup_key: str) -> str:
    """Вид события по префиксу ключа: по нему считается предел однотипных
    алертов в час. Неизвестный префикс — 'lead_failed': это ключи заявок,
    и незнакомый случай безопаснее считать отказом записи."""
    for prefix, event_type in _EVENT_BY_PREFIX:
        if dedup_key.startswith(prefix):
            return event_type
    return "lead_failed"


async def write_alert(
    sessionmaker: async_sessionmaker[AsyncSession],
    settings: Settings,
    *,
    body: str,
    dedup_key: str,
) -> None:
    """Алерт оператору по событию заявки. Имя и сигнатура прежние.

    🔴 Выпуск идёт через единственную точку — alerts.raise_alert: там оба
    рубежа дедупа и ДВЕ строки outbox, почта и мессенджер. Прямая запись
    одной строки, как было раньше, обходила и дедуп, и дубль канала.
    Исключение наружу не поднимаем: несделанный алерт не должен подменять
    собой исход самой записи заявки.
    """
    try:
        await raise_alert(
            sessionmaker,
            dependencies.get_redis(),
            settings,
            event_type=_event_type(dedup_key),
            body=body,
            dedup_key=dedup_key,
        )
    except Exception:
        logger.exception("алерт %s не выпущен", dedup_key)


class LeadWriter:
    """lead_hook движка: идемпотентная запись заявки + алерт оператору."""

    def __init__(
        self,
        *,
        sessionmaker: async_sessionmaker[AsyncSession],
        redis,
        providers_getter,
        settings: Settings,
    ) -> None:
        self._sessionmaker = sessionmaker
        self._redis = redis
        # Фабрика, а не готовый объект: режим может смениться перезапуском,
        # а тесты подставляют своих провайдеров.
        self._providers_getter = providers_getter
        self._settings = settings

    async def __call__(self, conversation_id: uuid.UUID, lead: dict) -> None:
        key = natural_key(conversation_id, lead)

        # 🔴 (1) Проверка ДО действия. Никаких записей и алертов, если заявка
        # по этому ключу уже создана: повторный ход не должен дать дубль.
        try:
            done = await self._already_done(key)
        except LeadNotWritten:
            # Проверить нечем — наружу не идём, но и молчать нельзя: запись
            # в журнале уедет вместе с контейнером, а лид ждать не станет.
            await write_alert(
                self._sessionmaker,
                self._settings,
                body=f"lead_idempotency: заявка в диалоге {conversation_id} не записана,"
                f" проверка «уже создана» недоступна",
                dedup_key=f"leadidem:{key}",
            )
            raise
        if done:
            logger.info("заявка уже создана, ключ %s", key)
            return

        providers: Providers = self._providers_getter()
        sink = getattr(providers, "leads", None)
        if sink is None:
            # Не молчим: без приёмника заявка не записана, и притворяться
            # успехом нельзя — иначе лид исчезнет навсегда.
            logger.warning("некуда записать заявку: провайдер заявок не настроен")
            await write_alert(
                self._sessionmaker,
                self._settings,
                body=f"lead_no_provider: заявка в диалоге {conversation_id} не записана,"
                f" приёмник заявок не настроен",
                dedup_key=f"leadfail:{key}",
            )
            raise LeadNotWritten("нет провайдера заявок")

        payload = self._payload(conversation_id, lead)
        try:
            ref = await sink.create_lead(key, payload)
        except Exception as exc:
            # Сюда попадает и ProviderUnavailable из реализации провайдера,
            # и любой другой сбой: клиенту в любом случае нельзя показать
            # текст ошибки, а ключ НЕ ставим, чтобы следующий ход повторил.
            log_provider_failure(logger, "заявка не создана", exc, ключ=key)
            await write_alert(
                self._sessionmaker,
                self._settings,
                body=f"lead_failed: заявка в диалоге {conversation_id} не создана,"
                f" внешняя система недоступна",
                dedup_key=f"leadfail:{key}",
            )
            raise LeadNotWritten("внешняя система недоступна") from exc

        # 🔴 Ключ ставится только после успеха. Упадёт Redis здесь — запись
        # наружу уже идемпотентна по тому же натуральному ключу.
        await self._mark_done(key, ref)
        logger.info(
            "заявка записана, ключ %s, создана=%s", key, getattr(ref, "created", None)
        )
        await write_alert(
            self._sessionmaker,
            self._settings,
            # 🔴 Без телефона, имени и текста переписки: только диалог.
            body=f"Новая заявка в диалоге {conversation_id}, контакт в панели",
            dedup_key=f"hotlead:{key}",
        )

    async def _already_done(self, key: str) -> bool:
        """Отметка «сделано» в Redis. Redis недоступен — считаем, что проверить
        нельзя, и не пишем: дубль заявки хуже отложенной на ход попытки."""
        try:
            return (await self._redis.get(DONE_PREFIX + key)) is not None
        except Exception as exc:
            logger.exception("не удалось проверить отметку заявки, ключ %s", key)
            raise LeadNotWritten("проверка идемпотентности недоступна") from exc

    async def _mark_done(self, key: str, ref) -> None:
        """Отметка о созданной заявке. Сбой Redis здесь не отменяет успех:
        заявка уже наружу записана, и хуже всего было бы записать её дважды."""
        try:
            await self._redis.set(
                DONE_PREFIX + key, str(getattr(ref, "external_id", "")), ex=DONE_TTL_SECONDS
            )
        except Exception:
            logger.exception("отметка заявки не сохранена, ключ %s", key)

    def _payload(self, conversation_id: uuid.UUID, lead: dict) -> dict:
        """Только поля заявки плюс идентификатор диалога строкой.

        Идентификатор строкой на границе с чужим API: UUID там всё равно
        станет строкой, а приводить на границе дешевле, чем искать потом,
        где сравнение разъехалось.
        """
        payload = {k: lead[k] for k in PAYLOAD_KEYS if lead.get(k) not in (None, "")}
        payload["conversation_id"] = str(conversation_id)
        return payload
