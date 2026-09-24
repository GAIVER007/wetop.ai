"""Шаг 7: разбор ответа WETOP — на httpx.MockTransport, без сети.

🔴 Два правила проверяются здесь построчно:
отказ определяется по ТЕЛУ, а не по коду — но отказом считается только
непустая ошибка: {"error": false} и {"errors": []} это успех, и принять их
за отказ значит всегда отвечать «не знаю»;
единицы суммы не угадываются — поле с неизвестной размерностью даёт None,
а не цену, заниженную в сто раз.
"""

from __future__ import annotations

from datetime import date, timedelta

import httpx
import pytest

from src.config import get_settings
from src.integrations.providers import ProviderUnavailable
from src.integrations.wetop import WetopProviders

ARRIVAL = date.today() + timedelta(days=10)
DEPARTURE = ARRIVAL + timedelta(days=3)
CATEGORY = "Студия"
# Вымышленный контакт: боевых в тестах не бывает.
LEAD = {
    "name": "Асель Тест",
    "phone": "+7 701 000 00 00",
    "email": "asel@example.com",
    "extra": {"arrival": ARRIVAL.isoformat(), "departure": DEPARTURE.isoformat(), "category": CATEGORY, "guests": 2},
}


def _providers(handler) -> WetopProviders:
    """Провайдер поверх поддельного транспорта: адрес и ключ — из настроек."""
    settings = get_settings().model_copy(
        update={
            "integration_mode": "wetop",
            "integration_base_url": "https://wetop.example.com",
            "integration_api_key": "test-key",
        }
    )
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return WetopProviders(settings, client)


def _answer(status: int, body: object):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status, json=body)

    return handler


def _category(**fields) -> dict:
    return {"name": CATEGORY, "code": "studio", **fields}


# ─── Отказы ───


@pytest.mark.parametrize(
    ("status", "body"),
    [
        (403, {"message": "запрос не с домена сайта"}),
        (404, {"message": "сайт не найден"}),
        (429, {"message": "too many requests"}),
        (400, {"message": "тариф неактивен"}),
        (200, {"error": "сайт не найден"}),
        (200, {"errors": ["бронирование выключено"]}),
    ],
)
async def test_refusal_is_read_from_the_body(status: int, body: object) -> None:
    """Отказ виден и под кодом 200: сервер жив, ответа нет."""
    with pytest.raises(ProviderUnavailable):
        await _providers(_answer(status, body)).check(ARRIVAL, DEPARTURE, 2, None)


async def test_timeout_is_a_refusal_without_the_address_in_the_message() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("таймаут", request=request)

    with pytest.raises(ProviderUnavailable) as excinfo:
        await _providers(handler).check(ARRIVAL, DEPARTURE, 2, None)
    assert str(excinfo.value) == "timeout"


async def test_non_json_body_is_a_refusal() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="<html>страница обслуживания</html>")

    with pytest.raises(ProviderUnavailable):
        await _providers(handler).check(ARRIVAL, DEPARTURE, 2, None)


@pytest.mark.parametrize("empty", [{"error": False}, {"error": ""}, {"errors": []}, {"error": None}])
async def test_empty_error_field_is_not_a_refusal(empty: dict) -> None:
    """🔴 Самая частая форма успеха — поле ошибки на месте и пустое.
    Считать её отказом значит отвечать «не знаю» всегда."""
    body = {**empty, "categories": [_category(free=5)]}
    assert (await _providers(_answer(200, body)).check(ARRIVAL, DEPARTURE, 2, None)).kind == "yes"


# ─── Наличие ───


@pytest.mark.parametrize(("free", "kind"), [(5, "yes"), (2, "few"), (1, "few"), (0, "no")])
async def test_availability_returns_only_a_sign(free: int, kind: str) -> None:
    body = {"categories": [_category(free=free)]}
    result = await _providers(_answer(200, body)).check(ARRIVAL, DEPARTURE, 2, None)
    assert result.kind == kind
    assert str(free) not in (result.note or ""), "число мест не уходит даже в заметке"


async def test_unknown_body_shape_is_unknown_not_empty() -> None:
    """Связь есть, поля не узнали: «не знаю», а не «мест нет»."""
    body = {"categories": [{"name": CATEGORY, "rooms_left_today": 3}]}
    assert (await _providers(_answer(200, body)).check(ARRIVAL, DEPARTURE, 2, None)).kind == "unknown"


async def test_dates_outside_the_window_do_not_go_out() -> None:
    """Заведомо отказной запрос наружу не отправляется."""
    called: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        called.append(str(request.url.path))
        return httpx.Response(200, json={"categories": [_category(free=5)]})

    yesterday = date.today() - timedelta(days=1)
    result = await _providers(handler).check(yesterday, yesterday + timedelta(days=2), 2, None)
    assert result.kind == "unknown"
    assert not called


# ─── Расчёт ───


async def test_quote_takes_the_sum_in_declared_minor_units() -> None:
    """Сумму считает внешняя система: поле с объявленными малыми единицами
    берётся как есть."""
    body = {"categories": [_category(total_minor=4500000, currency="KZT")]}
    quote = await _providers(_answer(200, body)).quote(ARRIVAL, DEPARTURE, 2, CATEGORY)
    assert quote is not None
    assert quote.total_minor == 4500000
    assert quote.currency == "KZT"
    assert quote.nights == 3


async def test_sum_with_undeclared_units_is_not_a_price() -> None:
    """🔴 {"total": 45000} — это 45 000 или 450? Контракт не сказал (Q-166).
    Назвать «450» значит занизить цену в сто раз, и отвечает за это заказчик."""
    body = {"categories": [_category(total=45000, currency="KZT")]}
    assert await _providers(_answer(200, body)).quote(ARRIVAL, DEPARTURE, 2, CATEGORY) is None


@pytest.mark.parametrize("field", ["amount", "sum"])
async def test_other_undeclared_sum_fields_are_not_prices(field: str) -> None:
    body = {"categories": [_category(currency="KZT", **{field: 45000})]}
    assert await _providers(_answer(200, body)).quote(ARRIVAL, DEPARTURE, 2, CATEGORY) is None


async def test_sum_without_currency_is_not_a_price() -> None:
    """450 тенге и 450 рублей — разные разговоры: сумма без единицы
    такое же необеспеченное обещание, как выдуманное число."""
    body = {"categories": [_category(total_minor=4500000)]}
    assert await _providers(_answer(200, body)).quote(ARRIVAL, DEPARTURE, 2, CATEGORY) is None


async def test_currency_may_come_from_the_body_root() -> None:
    body = {"currency": "KZT", "categories": [_category(total_minor=4500000)]}
    quote = await _providers(_answer(200, body)).quote(ARRIVAL, DEPARTURE, 2, CATEGORY)
    assert quote is not None and quote.currency == "KZT"


async def test_quote_without_the_asked_category_is_none() -> None:
    body = {"categories": [{"name": "Люкс", "code": "lux", "total_minor": 100, "currency": "KZT"}]}
    assert await _providers(_answer(200, body)).quote(ARRIVAL, DEPARTURE, 2, CATEGORY) is None


# ─── Бронь ───


async def test_booking_returns_the_external_id_as_a_string() -> None:
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        import json as _json

        seen.update(_json.loads(request.content.decode("utf-8")))
        return httpx.Response(200, json={"id": 120345})

    ref = await _providers(handler).create_lead("k" * 32, dict(LEAD))
    assert ref.external_id == "120345" and isinstance(ref.external_id, str)
    assert ref.created is True
    assert seen["phone"] == "77010000000", "телефон уходит только цифрами"


async def test_booking_without_an_id_is_a_refusal() -> None:
    """🔴 Подтверждения нет — «записал» сказать нельзя."""
    with pytest.raises(ProviderUnavailable):
        await _providers(_answer(200, {"status": "ok"})).create_lead("k" * 32, dict(LEAD))


async def test_booking_without_enough_data_does_not_go_out() -> None:
    called: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        called.append(str(request.url.path))
        return httpx.Response(200, json={"id": 1})

    lead = {**LEAD, "phone": "123"}
    with pytest.raises(ProviderUnavailable):
        await _providers(handler).create_lead("k" * 32, lead)
    assert not called
