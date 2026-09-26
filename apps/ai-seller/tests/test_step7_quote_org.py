"""Шаг 7: котировка у платформы — организация хода и форма ответа виджета (Q-166, ADR-085).

Продавец спрашивает наличие и цену у WETOP через дверь `/bot/availability`
(узкий ключ котировки): организация — из хода (ставит движок), поле гостей
у платформы зовётся `adults`, сумма приходит строкой минорных в `totalMinor`.
Закрытая ограничением или не вмещающая гостей категория не считается местом
и не получает цены: «есть» и «итого» по ней стали бы обещанием, которое
стойка не выполнит. Брони этой дверью нет (Q-166б, ADR-086).
"""

from __future__ import annotations

from datetime import date, timedelta

import httpx
import pytest

from src import dependencies
from src.config import get_settings
from src.integrations.wetop import PATH_AVAILABILITY, WetopProviders

ARRIVAL = date.today() + timedelta(days=10)
DEPARTURE = ARRIVAL + timedelta(days=2)
ORG = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa"

# Ответ ровно той формы, что отдаёт платформа (`Quote` среза 9): суммы строками
# минорных, признаки fits/closed, валюта в корне.
PLATFORM_BODY = {
    "site": "Тестовый сайт",
    "arrivalDate": ARRIVAL.isoformat(),
    "departureDate": DEPARTURE.isoformat(),
    "nights": 2,
    "adults": 2,
    "currency": "KZT",
    "checkInTime": "14:00",
    "checkOutTime": "12:00",
    "ratePlan": "Базовый тариф",
    "categories": [
        {
            "code": "exely-900002",
            "name": "Двойная",
            "capacity": 2,
            "fits": True,
            "available": 3,
            "closed": False,
            "totalMinor": "3000000",
            "perNight": [{"date": ARRIVAL.isoformat(), "priceMinor": "1500000"}],
        },
        {
            "code": "exely-900001",
            "name": "Одиночная",
            "capacity": 1,
            "fits": False,
            "available": 5,
            "closed": False,
            "totalMinor": "2200000",
            "perNight": [],
        },
        {
            "code": "exely-900003",
            "name": "Закрытая",
            "capacity": 2,
            "fits": True,
            "available": 4,
            "closed": True,
            "totalMinor": "2600000",
            "perNight": [],
        },
    ],
}


def _providers(handler) -> WetopProviders:
    settings = get_settings().model_copy(
        update={
            "integration_mode": "wetop",
            "integration_base_url": "https://wetop.example.com",
            "integration_api_key": "test-quote-key",
        }
    )
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return WetopProviders(settings, client)


def _capture(body: object = PLATFORM_BODY):
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=body)

    return seen, handler


@pytest.fixture
def org_turn():
    """Ход идёт в организации: так её ставит движок в accept."""
    token = dependencies.organization_id_var.set(ORG)
    yield
    dependencies.organization_id_var.reset(token)


async def test_the_request_carries_the_organization_and_platform_field_names(org_turn) -> None:
    seen, handler = _capture()
    await _providers(handler).check(ARRIVAL, DEPARTURE, 2, None)
    assert len(seen) == 1
    request = seen[0]
    assert request.url.path == PATH_AVAILABILITY == "/bot/availability"
    assert request.url.params["organization"] == ORG
    # контракт виджета: поле гостей зовётся adults
    assert request.url.params["adults"] == "2"
    assert "guests" not in request.url.params


async def test_without_an_organization_the_param_is_absent() -> None:
    """Помощник и ходы без организации: параметра нет, платформа ответит 400 —
    инструмент честно скажет «не знаю», а не спросит про чужую гостиницу."""
    seen, handler = _capture()
    await _providers(handler).check(ARRIVAL, DEPARTURE, 2, None)
    assert "organization" not in seen[0].url.params


async def test_total_minor_comes_from_the_platform_string_field(org_turn) -> None:
    _seen, handler = _capture()
    quote = await _providers(handler).quote(ARRIVAL, DEPARTURE, 2, "Двойная")
    assert quote is not None
    assert quote.total_minor == 3_000_000
    assert quote.currency == "KZT"
    assert quote.category_name == "Двойная"


async def test_a_closed_category_is_not_a_place_and_not_a_price(org_turn) -> None:
    _seen, handler = _capture()
    providers = _providers(handler)
    assert await providers.quote(ARRIVAL, DEPARTURE, 2, "Закрытая") is None
    # признак наличия по конкретной категории: закрытая — «мест нет», не «есть»
    result = await providers.check(ARRIVAL, DEPARTURE, 2, "Закрытая")
    assert result.kind == "unknown" or result.kind == "no"


async def test_a_category_that_does_not_fit_the_guests_is_not_offered(org_turn) -> None:
    _seen, handler = _capture()
    providers = _providers(handler)
    assert await providers.quote(ARRIVAL, DEPARTURE, 2, "Одиночная") is None
    result = await providers.check(ARRIVAL, DEPARTURE, 2, "Одиночная")
    assert result.kind in ("unknown", "no")


async def test_the_overall_sign_counts_only_sellable_categories(org_turn) -> None:
    """Без категории признак считается по продаваемым: закрытая и не
    вмещающая не превращают «есть 3 места» в «есть 12»."""
    _seen, handler = _capture()
    result = await _providers(handler).check(ARRIVAL, DEPARTURE, 2, None)
    assert result.kind == "yes"  # только «Двойная», у неё 3
