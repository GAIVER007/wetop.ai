"""Интерфейсы внешних систем. ЯДРО.

🔴 Этот файл переносится в следующий проект целиком и не правится. Всё, что
отличает одного заказчика от другого — адрес, ключ, имена полей в ответе,
правила разбора отказа — живёт в реализации (stub.py, wetop.py). Поэтому
здесь нет ни одного импорта из src и ни одной строки, которая куда-то ходит:
ядро, знающее про httpx или про Settings, при переносе тянет за собой проект.

Ответы описаны признаками, а не сырым телом чужого API: движок не должен
знать, как именно называется поле «свободно» у конкретной системы.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Literal, Protocol, runtime_checkable

# Признак наличия. 'unknown' — честный ответ «не знаю», а не ошибка.
AvailabilityKind = Literal["yes", "few", "no", "unknown"]


class ProviderUnavailable(Exception):
    """Внешняя система не ответила или ответила отказом.

    🔴 Поднимается ТОЛЬКО внутри реализаций. Наружу — к инструментам модели
    и к движку — не выходит: там «не знаю» это признак, а не исключение,
    иначе недоступный справочник роняет весь диалог.
    """


@dataclass(frozen=True)
class Availability:
    """Наличие: признак, а не число.

    🔴 Точного количества свободных мест тут нет намеренно. Бот, сказавший
    «осталось три», дал обещание: пока клиент думает, остаток меняется,
    а спрос с бота остаётся. Клиенту хватает «есть / мало / нет».
    """

    kind: AvailabilityKind
    note: str | None = None


@dataclass(frozen=True)
class Quote:
    """Расчёт стоимости, как его вернула внешняя система.

    🔴 Сумму считает система, а не бот: сложение и умножение на стороне бота
    превращают его ответ в обещание цены, за которую никто не отвечает.
    Деньги в минорных единицах (тиын, копейки) — дробное число денег врёт.
    total_minor None — сумма не пришла; это «не знаю», а не ноль.
    """

    total_minor: int | None
    currency: str
    nights: int
    category_name: str
    per_night_minor: list[int] | None = None
    note: str | None = None


@dataclass(frozen=True)
class OrderStatus:
    """Статус заказа. Идентификатор строкой: чужой ключ приводится к строке
    на границе, а не там, где его решили сравнить."""

    order_id: str
    status: str
    eta: str | None = None


@dataclass(frozen=True)
class Customer:
    """Клиент из чужой базы. Имя и телефон могут отсутствовать."""

    external_id: str
    name: str | None
    phone: str | None


@dataclass(frozen=True)
class LeadRef:
    """Ссылка на заявку во внешней системе.

    created False — «уже было»: запись идемпотентна, повтор не плодит дубль
    и не повод слать второй алерт оператору.
    """

    external_id: str
    created: bool


@runtime_checkable
class OrderStatusProvider(Protocol):
    """Статус заказа. None — не найдено: признак, а не исключение."""

    async def get_status(self, order_id: str) -> OrderStatus | None: ...


@runtime_checkable
class CustomerDBProvider(Protocol):
    """База клиентов. None — не найдено."""

    async def find_by_phone(self, phone: str) -> Customer | None: ...


@runtime_checkable
class AvailabilityProvider(Protocol):
    """Наличие и расчёт. quote -> None означает «не знаю», а не «бесплатно»."""

    async def check(
        self, arrival: date, departure: date, guests: int, category: str | None
    ) -> Availability: ...

    async def quote(
        self, arrival: date, departure: date, guests: int, category: str
    ) -> Quote | None: ...


@runtime_checkable
class LeadSink(Protocol):
    """Приёмник заявок.

    natural_key — ключ идемпотентности, по нему повтор должен вернуть
    LeadRef(created=False), а не завести вторую заявку.
    """

    async def create_lead(self, natural_key: str, payload: dict) -> LeadRef: ...


# ─── Помощник платформы (роль support) ───
#
# Это тоже интерфейсы ядра, но нужны они только роли «помощник платформы»:
# бот отвечает пользователям самой платформы, а не покупателям. Отдельная
# секция, чтобы при переносе было видно, что можно не подключать.


@dataclass(frozen=True)
class Incident:
    """Одно происшествие из журнала платформы, как его можно показать человеку.

    🔴 summary — короткое человеческое описание. Ни трассировки, ни имён
    таблиц, ни кусков чужих данных: это уйдёт в ответ бота, а ответ бота
    видит посторонний. Приводит текст к такому виду реализация провайдера,
    а не бот: только она знает, что в её журнале лишнее.
    """

    at: datetime
    kind: str
    summary: str
    section: str | None = None
    ref: str | None = None


@dataclass(frozen=True)
class HealthReport:
    """Состояние платформы. degraded — имена разделов, а не адреса узлов.

    ok=True с пустым degraded — «всё работает». Незнание состояния этим
    объектом не описывается: у него нет значения «не знаю», поэтому
    отсутствующий провайдер отвечает признаком, а не выдуманным ok.
    """

    ok: bool
    degraded: list[str]
    checked_at: datetime


@runtime_checkable
class IncidentProvider(Protocol):
    """Журнал происшествий платформы.

    🔴 recent_for_user ищет по идентификатору пользователя и организации:
    человек видит только свои ошибки. Пусто — признак, а не исключение.
    """

    async def recent_for_user(
        self,
        *,
        user_id: str | None,
        org_id: str | None,
        since: datetime,
        limit: int,
    ) -> list[Incident]: ...

    async def search(
        self, *, text: str, since: datetime, limit: int
    ) -> list[Incident]: ...


@runtime_checkable
class PlatformHealthProvider(Protocol):
    """Общее состояние платформы: «всё работает» или список больных разделов."""

    async def status(self) -> HealthReport: ...


class SubscriptionProvider(Protocol):
    """Карточка организации платформы для техподдержки (С5, Q-187):
    название, статус и срок расширения. Денег и гостей здесь нет.
    None — организации с таким id не существует."""

    async def organization_card(self, organization_id: str) -> dict | None: ...


class RequesterContextProvider(Protocol):
    """Контекст обратившегося (S4): роль, организация, состояние аккаунта, права.
    Пара (user_id, org_id) — из подписи посетителя; платформа сверяет её с членством.
    None — такого сотрудника в организации нет."""

    async def requester_context(self, *, user_id: str, org_id: str) -> dict | None: ...


class DiagnosticsProvider(Protocol):
    """Диагностика для техподдержки (S5): состояние каналов продаж и бронь по номеру.
    Пара (user_id, org_id) — из подписи посетителя; платформа сверяет её с членством.
    None — обратившегося в организации нет (каналы) или брони с таким номером нет."""

    async def integration_health(self, *, user_id: str, org_id: str) -> dict | None: ...

    async def reservation_status(self, *, user_id: str, org_id: str, number: str) -> dict | None: ...


class ActionsProvider(Protocol):
    """Действия платформы для техподдержки (S6): только те, что в матрице. Ключ действий отдельный от ключа
    чтения. Возврат — словарь результата; отказ — ProviderUnavailable."""

    async def channel_pull(self, *, user_id: str, org_id: str, idempotency_key: str) -> dict: ...

    async def channel_sync(self, *, user_id: str, org_id: str, idempotency_key: str, days: int) -> dict: ...


@dataclass
class Providers:
    """Набор провайдеров для этого запуска. None — такой системы нет:
    вызывающий обязан проверить, а не ловить AttributeError.
    mode оставлен для журнала и панели: видно, на чём реально работаем."""

    orders: OrderStatusProvider | None
    customers: CustomerDBProvider | None
    availability: AvailabilityProvider | None
    leads: LeadSink | None
    mode: str
    # Роль «помощник платформы». Умолчание None, чтобы существующие сборки
    # (и следующий проект, где помощника нет) не пришлось править.
    incidents: IncidentProvider | None = None
    health: PlatformHealthProvider | None = None
    # С5: подписка организации — только у помощника, ключом ASSISTANT_READ_KEY.
    subscriptions: SubscriptionProvider | None = None
    # S4: кто обратился — тем же узким ключом помощника.
    requesters: RequesterContextProvider | None = None
    # S5: диагностика — каналы и бронь по номеру, тем же узким ключом.
    diagnostics: DiagnosticsProvider | None = None
    # S6: действия — отдельным ключом ASSISTANT_ACT_KEY; без него None и бот только читает.
    actions: ActionsProvider | None = None
