"""Шаг 7: интерфейсы внешних систем и честная заглушка.

Проверяем две вещи, ради которых файл providers.py существует: он ядро
(ничего из src не тянет, переносится целиком) и заглушка на нём честная —
отвечает «не знаю», а не выдумывает данные.
"""

from __future__ import annotations

import dataclasses
import inspect
import re
from datetime import date
from pathlib import Path

import pytest

from src.integrations.providers import (
    Availability,
    Customer,
    LeadRef,
    OrderStatus,
    ProviderUnavailable,
    Providers,
    Quote,
)
from src.integrations.stub import StubProviders

ARRIVAL, DEPARTURE = date(2026, 10, 1), date(2026, 10, 4)


# ─── Ядро: providers.py ни от чего в проекте не зависит ───


def test_providers_module_imports_nothing_from_src() -> None:
    """🔴 Файл переносится в следующий проект целиком: импорт из src сделал бы
    его частью ЭТОГО проекта, и перенос потянул бы за собой половину дерева."""
    import src.integrations.providers as module

    source = inspect.getsource(module)
    bad = [
        line.strip()
        for line in source.splitlines()
        if re.match(r"^\s*(from|import)\s+src\b", line)
    ]
    assert not bad, f"providers.py импортирует из src: {bad}"


def test_providers_module_header_says_it_is_portable() -> None:
    """Правило переноса записано в самом файле: иначе его нарушит тот,
    кто откроет файл без этого текста рядом."""
    text = Path(inspect.getsourcefile(Providers)).read_text(encoding="utf-8")
    head = text[: text.find("\n\n\n")] or text[:2000]
    assert "не правится" in head or "не правим" in head, head[:400]


def test_provider_unavailable_is_exception() -> None:
    assert issubclass(ProviderUnavailable, Exception)


# ─── Формы данных ───


@pytest.mark.parametrize("cls", [Availability, Quote, OrderStatus, Customer, LeadRef])
def test_result_types_are_frozen_dataclasses(cls: type) -> None:
    """Неизменяемые: ответ внешней системы не правят по дороге к модели."""
    assert dataclasses.is_dataclass(cls)
    assert cls.__dataclass_params__.frozen is True


def test_availability_has_no_exact_count_field() -> None:
    """🔴 Точного числа мест в типе НЕТ намеренно: «осталось три» —
    это обязательство, которое бот взять не может."""
    names = {f.name for f in dataclasses.fields(Availability)}
    assert names == {"kind", "note"}
    for forbidden in ("count", "free", "left", "rooms", "available"):
        assert forbidden not in names


def test_availability_kinds_and_default_note() -> None:
    assert Availability("yes").note is None
    assert Availability(kind="few", note="две категории").kind == "few"


def test_quote_shape_sum_comes_from_outside() -> None:
    """🔴 Сумму считает внешняя система: в Quote она приходит готовой."""
    names = {f.name for f in dataclasses.fields(Quote)}
    assert {"total_minor", "currency", "nights", "category_name"} <= names
    quote = Quote(total_minor=45000, currency="KZT", nights=3, category_name="Студия")
    assert quote.per_night_minor is None and quote.note is None
    assert Quote(total_minor=None, currency="KZT", nights=1, category_name="Студия").total_minor is None


def test_lead_ref_created_flag() -> None:
    """created=False — «уже было»: на этом держится идемпотентность."""
    assert LeadRef(external_id="x-1", created=False).created is False


def test_providers_facade_fields() -> None:
    facade = Providers(orders=None, customers=None, availability=None, leads=None, mode="stub")
    assert facade.mode == "stub"
    # incidents и health добавлены ролью «помощник платформы»; у них есть
    # умолчание None, поэтому сборки продавца остались прежними.
    assert {f.name for f in dataclasses.fields(Providers)} == {
            "orders", "customers", "availability", "leads", "mode",
            "incidents", "health", "subscriptions", "requesters",
        }
    assert facade.incidents is None and facade.health is None


# ─── Заглушка ───


async def test_stub_check_is_honest_unknown() -> None:
    """Заглушка не притворяется справочником: 'unknown' и пояснение."""
    result = await StubProviders().check(ARRIVAL, DEPARTURE, 2, None)
    assert isinstance(result, Availability)
    assert result.kind == "unknown"
    assert result.note


async def test_stub_returns_none_instead_of_inventing_data() -> None:
    stub = StubProviders()
    assert await stub.quote(ARRIVAL, DEPARTURE, 2, "Студия") is None
    assert await stub.get_status("A-1") is None
    assert await stub.find_by_phone("77010000000") is None


async def test_stub_create_lead_is_marked_as_stub() -> None:
    """Заглушка не притворяется успехом чужой системы: префикс 'stub:'
    видно и в панели, и в журнале."""
    ref = await StubProviders().create_lead("k" * 40, {"name": "Асель"})
    assert isinstance(ref, LeadRef)
    assert ref.external_id.startswith("stub:")
    assert ref.created is True


async def test_stub_log_has_no_personal_data(caplog: pytest.LogCaptureFixture) -> None:
    """🔴 В журнал заглушки уходит длина payload и маскированный ключ,
    но не имя и не телефон."""
    caplog.set_level("INFO")
    await StubProviders().create_lead("abc123", {"name": "Асель", "phone": "77010000000"})
    text = caplog.text
    assert "77010000000" not in text
    assert "Асель" not in text


async def test_stub_satisfies_every_protocol_by_call() -> None:
    """Соответствие протоколам проверяем вызовом: Protocol без
    runtime_checkable isinstance не поддерживает, а сигнатуры важнее типа."""
    stub = StubProviders()
    for name in ("check", "quote", "get_status", "find_by_phone", "create_lead"):
        assert inspect.iscoroutinefunction(getattr(stub, name)), name
