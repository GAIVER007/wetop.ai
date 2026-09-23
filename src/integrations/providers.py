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
from datetime import date
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
