"""Подмены внешних систем для тестов шага 7: провайдеры с настраиваемым
ответом и модель, которая честно зовёт инструмент.

Сети здесь нет ни в одном виде. FakeProviders считает вызовы, чтобы
проверять идемпотентность: «вызван один раз» — единственное доказательство
того, что проверка «уже сделано» стоит ДО действия, а не после.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date
from types import SimpleNamespace
from typing import Any

import pytest

from src.ai.llm import LlmResult
from src.ai.schemas import ModelReply
from src.integrations.providers import (
    Availability,
    Customer,
    LeadRef,
    OrderStatus,
    ProviderUnavailable,
    Providers,
    Quote,
)

# Вымышленный номер и почта: боевых контактов в тестах не бывает.
PHONE = "77010000000"
PHONE_TYPED = "+7 701 000 00 00"
EMAIL = "asel@example.com"
NAME = "Асель"


@dataclass
class FakeProviders:
    """Все четыре протокола в одном объекте.

    raise_on — имена методов, которые поднимают ProviderUnavailable:
    так проверяется, что недоступная система не выходит наружу исключением.
    """

    availability_kind: str = "yes"
    availability_note: str | None = None
    quote_value: Quote | None = None
    order: OrderStatus | None = None
    customer: Customer | None = None
    lead_ref: LeadRef | None = None
    raise_on: set[str] = field(default_factory=set)
    calls: list[tuple[str, tuple]] = field(default_factory=list)

    # ─── Учёт вызовов ───

    def _record(self, name: str, args: tuple) -> None:
        """Записать вызов и, если метод в raise_on, изобразить недоступность."""
        self.calls.append((name, args))
        if name in self.raise_on:
            raise ProviderUnavailable(f"{name}: внешняя система недоступна")

    @property
    def names(self) -> list[str]:
        return [name for name, _ in self.calls]

    def count(self, name: str) -> int:
        return self.names.count(name)

    def args_of(self, name: str) -> list[tuple]:
        return [args for called, args in self.calls if called == name]

    def fix(self) -> None:
        """Внешняя система «починилась»: следующий вызов пройдёт."""
        self.raise_on = set()

    # ─── AvailabilityProvider ───

    async def check(self, arrival: date, departure: date, guests: int, category: str | None) -> Availability:
        self._record("check", (arrival, departure, guests, category))
        return Availability(kind=self.availability_kind, note=self.availability_note)  # type: ignore[arg-type]

    async def quote(self, arrival: date, departure: date, guests: int, category: str) -> Quote | None:
        self._record("quote", (arrival, departure, guests, category))
        return self.quote_value

    # ─── OrderStatusProvider / CustomerDBProvider ───

    async def get_status(self, order_id: str) -> OrderStatus | None:
        self._record("get_status", (order_id,))
        return self.order

    async def find_by_phone(self, phone: str) -> Customer | None:
        self._record("find_by_phone", (phone,))
        return self.customer

    # ─── LeadSink ───

    async def create_lead(self, natural_key: str, payload: dict) -> LeadRef:
        self._record("create_lead", (natural_key, payload))
        return self.lead_ref or LeadRef(external_id=f"fake-{natural_key[:8]}", created=True)

    # ─── Сборка фасада ───

    def as_providers(self, *, mode: str = "fake") -> Providers:
        """Фасад со всеми слотами занятыми."""
        return Providers(orders=self, customers=self, availability=self, leads=self, mode=mode)

    def without_leads(self, *, mode: str = "fake") -> Providers:
        """Фасад без приёмника заявок: LeadWriter должен это заметить до записи."""
        return Providers(orders=self, customers=self, availability=self, leads=None, mode=mode)

    def without_availability(self, *, mode: str = "fake") -> Providers:
        """Фасад без справочника мест: инструмент обязан вернуть признак, не упасть."""
        return Providers(orders=self, customers=self, availability=None, leads=self, mode=mode)


def lead_data(**overrides: Any) -> dict:
    """Полный лид с вымышленным контактом; ключи как в LEAD_KEYS."""
    lead = {
        "name": NAME,
        "phone": PHONE,
        "email": EMAIL,
        "interest": "студия",
        "budget": "до 30000",
        "timeframe": "выходные",
        "notes": "с питомцем",
        "extra": {"guests": 2},
        "asks": 1,
        "contact_refused": False,
    }
    lead.update(overrides)
    return lead


def tool_call(call_id: str, name: str, arguments: str) -> SimpleNamespace:
    """Вызов инструмента в том виде, в каком его отдаёт SDK: .id и .function."""
    return SimpleNamespace(id=call_id, function=SimpleNamespace(name=name, arguments=arguments))


class ToolCallingLlm:
    """Модель, которая сначала зовёт инструмент, потом отвечает его словами.

    🔴 Ответ строится ИЗ вывода инструмента намеренно: так проверяется
    худший случай — модель пересказала инструмент дословно. Если инструмент
    отдаст текст ошибки, клиент его увидит, и тест это поймает.
    """

    def __init__(
        self,
        registry,
        calls: list[SimpleNamespace],
        *,
        prefix: str = "Уточню у администратора.",
        needs_human: bool = False,
    ) -> None:
        self._registry = registry
        self._calls = calls
        self._prefix = prefix
        self._needs_human = needs_human
        self.tool_results: list[str] = []
        self.generate_calls = 0

    async def generate(self, messages: list[dict], *, use_tools: bool = True, **_: object) -> LlmResult:
        self.generate_calls += 1
        # Диспетчер реестра исключений не поднимает — как у настоящего каскада.
        tool_messages = await self._registry.dispatch(self._calls)
        results = [m["content"] for m in tool_messages]
        self.tool_results.extend(results)
        text = " ".join([self._prefix, *results]).strip()
        parsed = ModelReply(reply=text, needs_human=self._needs_human)
        return LlmResult(ok=True, text=text, parsed=parsed, model="fake", attempts=[], mapping={}, tokens_used=10)


def new_conversation_id() -> uuid.UUID:
    """Идентификатор диалога для тестов LeadWriter: строка outbox на него не ссылается."""
    return uuid.uuid4()


# ─── Окружение для LeadWriter: база, Redis, провайдеры ───


@dataclass
class LeadEnv:
    """Всё, из чего собирается LeadWriter в тесте. Настройки читаются лениво:
    тест может поменять окружение (получатель алертов) до сборки."""

    sessionmaker: Any
    redis: Any
    providers: FakeProviders

    @property
    def settings(self):
        from src.config import get_settings

        return get_settings()

    def writer(self, facade: Providers | None = None):
        """LeadWriter поверх этого окружения. facade — чтобы подсунуть фасад
        без приёмника заявок."""
        from src.integrations.lead_writer import LeadWriter

        resolved = facade if facade is not None else self.providers.as_providers()
        return LeadWriter(
            sessionmaker=self.sessionmaker,
            redis=self.redis,
            providers_getter=lambda: resolved,
            settings=self.settings,
        )

    async def outbox(self) -> list:
        """Строки outbox по порядку появления."""
        import sqlalchemy as sa

        from src.db.models import OutboxItem

        async with self.sessionmaker() as session:
            result = await session.execute(sa.select(OutboxItem).order_by(OutboxItem.id))
            return list(result.scalars().all())

    async def alert_keys(self) -> list[str]:
        return [row.dedup_key or "" for row in await self.outbox()]


@pytest.fixture
async def lead_env(migrated_db, fake_redis):
    """База мигрирована, Redis подменён, провайдеры — фальшивые.
    Движок SQLAlchemy закрывается в том же цикле, где создавался."""
    from src.dependencies import close_resources, get_sessionmaker

    env = LeadEnv(sessionmaker=get_sessionmaker(), redis=fake_redis, providers=FakeProviders())
    try:
        yield env
    finally:
        await close_resources()


# ─── Перехват алерта на уровне хода ───


@dataclass
class AlertSpy:
    """Записанные вызовы write_alert: (dedup_key, body).

    🔴 Зачем перехват, а не чтение outbox: тесты идут на sqlite, а он
    блокирует ФАЙЛ целиком. Пока сессия хода держит незакоммиченную правку
    диалога (а она её держит, как только в сообщении нашёлся телефон),
    вторая сессия свою строку записать не может. В бою Postgres: правка
    диалога и вставка в outbox не конфликтуют. Сама строка outbox проверяется
    в тестах LeadWriter — там хода нет и конфликта тоже.
    """

    calls: list[tuple[str, str]] = field(default_factory=list)

    @property
    def keys(self) -> list[str]:
        return [key for key, _ in self.calls]

    @property
    def bodies(self) -> list[str]:
        return [body for _, body in self.calls]

    def keys_like(self, prefix: str) -> list[str]:
        return [key for key in self.keys if key.startswith(prefix)]


@pytest.fixture
def alert_spy(monkeypatch: "pytest.MonkeyPatch") -> AlertSpy:
    """Подменяет write_alert на запись в память на время теста."""
    import src.integrations.lead_writer as lead_writer

    spy = AlertSpy()

    async def fake_write_alert(sessionmaker, settings, *, body: str, dedup_key: str) -> None:
        spy.calls.append((dedup_key, body))

    monkeypatch.setattr(lead_writer, "write_alert", fake_write_alert)
    return spy
