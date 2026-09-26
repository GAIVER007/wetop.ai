"""Шаг 7: инструменты модели поверх провайдеров.

Два правила проверяются в каждом тесте этого файла:
🔴 инструмент при любой беде возвращает ПРИЗНАК, а не исключение — ход
   не должен падать из-за чужого сервера;
🔴 точного числа свободных мест в ответе нет никогда — «осталось три»
   становится обещанием, которого бот не давал.
"""

from __future__ import annotations

import dataclasses
import json
import re

import pytest

from src.ai.hotel_tools import build_registry
from src.integrations.providers import Availability, Quote
from tests.integration_fakes import FakeProviders, tool_call

UNKNOWN = "не знаю: уточнит администратор"
ARGS = {"arrival": "2026-10-01", "departure": "2026-10-04", "guests": 2, "category": "Студия"}
QUOTE = Quote(total_minor=45000, currency="KZT", nights=3, category_name="Студия")


async def call(registry, name: str, **arguments) -> str:
    """Вызов через диспетчер реестра — тем же путём, каким его делает модель."""
    messages = await registry.dispatch([tool_call("c1", name, json.dumps(arguments, ensure_ascii=False))])
    return messages[0]["content"]


def registry_for(providers) -> object:
    return build_registry(lambda: providers)


# ─── Реестр ───


def test_registry_exposes_two_tools() -> None:
    registry = registry_for(FakeProviders().as_providers())
    names = [spec["function"]["name"] for spec in registry.specs_for_openai()]
    assert names == ["check_availability", "get_price"]


def test_tool_descriptions_teach_the_model_what_to_say() -> None:
    """Описание — единственное, что модель прочитает перед вызовом: правило
    «не знаю → уточнит администратор» должно стоять в нём, а не только в коде."""
    specs = {s["function"]["name"]: s["function"] for s in registry_for(FakeProviders().as_providers()).specs_for_openai()}
    for name, spec in specs.items():
        assert "администратор" in spec["description"].lower(), name
        assert spec["parameters"]["type"] == "object"
    assert "номер" in " ".join(s["description"] for s in specs.values()).lower()


# ─── check_availability ───


@pytest.mark.parametrize(
    ("kind", "expected"),
    [("yes", "есть"), ("few", "мест мало"), ("no", "мест нет"), ("unknown", UNKNOWN)],
)
async def test_check_availability_translates_kind(kind: str, expected: str) -> None:
    providers = FakeProviders(availability_kind=kind)
    assert await call(registry_for(providers.as_providers()), "check_availability", **ARGS) == expected
    assert providers.count("check") == 1


async def test_check_availability_passes_dates_as_dates() -> None:
    """Строка YYYY-MM-DD разбирается здесь: провайдер получает date,
    а не чужой формат, который каждый поймёт по-своему."""
    from datetime import date

    providers = FakeProviders()
    await call(registry_for(providers.as_providers()), "check_availability", **ARGS)
    arrival, departure, guests, category = providers.args_of("check")[0]
    assert arrival == date(2026, 10, 1) and departure == date(2026, 10, 4)
    assert guests == 2 and category == "Студия"


async def test_check_availability_without_provider() -> None:
    """Провайдера нет (режим не настроен) — признак, не исключение."""
    providers = FakeProviders()
    result = await call(registry_for(providers.without_availability()), "check_availability", **ARGS)
    assert result == UNKNOWN


async def test_check_availability_when_system_is_down() -> None:
    """🔴 Внешняя система недоступна: та же фраза, исключение наружу не выходит."""
    providers = FakeProviders(raise_on={"check"})
    assert await call(registry_for(providers.as_providers()), "check_availability", **ARGS) == UNKNOWN
    assert providers.count("check") == 1


@pytest.mark.parametrize("arrival", ["31.02.2026", "завтра", "", "2026-13-01"])
async def test_check_availability_with_bad_date(arrival: str) -> None:
    """Модель выдумала формат даты — это не повод ронять ход."""
    providers = FakeProviders()
    result = await call(registry_for(providers.as_providers()), "check_availability", **{**ARGS, "arrival": arrival})
    assert result == UNKNOWN
    assert providers.count("check") == 0, "в систему с мусорной датой не ходим"


async def test_check_availability_category_may_be_missing() -> None:
    providers = FakeProviders(availability_kind="few")
    args = {k: v for k, v in ARGS.items() if k != "category"}
    assert await call(registry_for(providers.as_providers()), "check_availability", **args, category=None) == "мест мало"


# ─── get_price ───


async def test_get_price_reads_the_sum_from_the_system() -> None:
    """🔴 Сумму бот не складывает: она целиком из ответа внешней системы."""
    providers = FakeProviders(quote_value=QUOTE)
    result = await call(registry_for(providers.as_providers()), "get_price", **ARGS)
    assert result.lower().startswith("итого")
    assert "KZT" in result
    assert "Студия" in result
    assert "3" in result and "ноч" in result
    assert "45000" in result or "450" in result


async def test_get_price_without_quote_is_unknown() -> None:
    providers = FakeProviders(quote_value=None)
    assert await call(registry_for(providers.as_providers()), "get_price", **ARGS) == UNKNOWN


async def test_get_price_when_system_is_down() -> None:
    providers = FakeProviders(raise_on={"quote"})
    assert await call(registry_for(providers.as_providers()), "get_price", **ARGS) == UNKNOWN


async def test_get_price_without_provider() -> None:
    providers = FakeProviders()
    assert await call(registry_for(providers.without_availability()), "get_price", **ARGS) == UNKNOWN


# ─── Общее правило про числа ───


def test_availability_type_cannot_carry_a_count() -> None:
    """🔴 Поля со свободными местами нет в самом типе: даже захотев,
    инструмент не сможет назвать число."""
    names = {f.name for f in dataclasses.fields(Availability)}
    for forbidden in ("count", "free", "left", "rooms", "available", "qty"):
        assert forbidden not in names


@pytest.mark.parametrize("kind", ["yes", "few", "no", "unknown"])
async def test_availability_answers_never_contain_digits(kind: str) -> None:
    providers = FakeProviders(availability_kind=kind, availability_note="свободно 3 студии")
    result = await call(registry_for(providers.as_providers()), "check_availability", **ARGS)
    assert not re.search(r"\d", result), f"инструмент назвал число: {result}"


async def test_get_price_without_currency_is_unknown() -> None:
    """🔴 Сумма без единицы — такое же обещание, как выдуманное число:
    «итого 450» без валюты клиент прочитает как свою валюту."""
    providers = FakeProviders(quote_value=Quote(total_minor=45000, currency="", nights=3, category_name="Студия"))
    assert await call(registry_for(providers.as_providers()), "get_price", **ARGS) == UNKNOWN


@pytest.mark.parametrize(
    ("nights", "tail"), [(1, "1 ночь"), (2, "2 ночи"), (3, "3 ночи"), (5, "5 ночей"), (11, "11 ночей"), (21, "21 ночь")]
)
async def test_get_price_agrees_the_word_with_the_number(nights: int, tail: str) -> None:
    """Модель вправе пересказать вывод инструмента дословно (так и устроены
    тесты хода), поэтому «за 1 ночей» дойдёт до клиента как есть."""
    quote = Quote(total_minor=45000, currency="KZT", nights=nights, category_name="Студия")
    providers = FakeProviders(quote_value=quote)
    result = await call(registry_for(providers.as_providers()), "get_price", **ARGS)
    assert tail in result, result
