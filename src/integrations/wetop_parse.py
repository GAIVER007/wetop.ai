"""[КЛИЕНТ] Разбор тела ответа WETOP: поля, отказы, суммы.

Вынесено из wetop.py, чтобы оба файла читались целиком: в длинном модуле
пропущенная проверка и прячется, а здесь как раз проверки.

🔴 Имена полей ответа контрактом ещё не зафиксированы (Q-166), поэтому
разбор мягкий в одну сторону: незнакомое тело даёт None — «не знаю»,
а не ноль мест и не выдуманную сумму.

🔴 В другом проекте этот файл выбрасывается вместе с wetop.py.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

# Имена полей: берём первое подходящее, ни одного не нашли — «не знаю».
CATEGORY_KEYS = ("categories", "items", "results")
FREE_KEYS = ("free", "available", "free_units", "units_free")
PER_NIGHT_KEYS = ("per_night_minor", "night_prices", "prices")
NAME_KEYS = ("name", "title", "category_name")
CODE_KEYS = ("code", "category_code", "category")
CURRENCY_KEYS = ("currency", "currency_code")
MESSAGE_KEYS = ("message", "error", "detail", "description")
ERROR_KEYS = ("error", "errors")

# 🔴 Сумма берётся ТОЛЬКО из поля с объявленными малыми единицами.
TOTAL_MINOR_KEYS = ("total_minor",)
# А эти единицами не подписаны: 45000 — это 45 000 или 450? Пока Q-166
# не зафиксировал ответ, цену по ним не называем: ошибка в сто раз
# становится обещанием, за которое платит заказчик.
UNDECLARED_TOTAL_KEYS = ("total", "amount", "sum")

# Отказ различается по ТЕЛУ, а не по коду: за 400/403/404 у WETOP стоят разные
# ситуации, «сайт не найден» лечится не тем же, чем «тариф неактивен».
BODY_REASONS = (
    ("домен", "domain_rejected"),
    ("origin", "domain_rejected"),
    ("сайт не найден", "site_not_found"),
    ("бронирование выключено", "booking_off"),
    ("тариф", "rate_inactive"),
    ("лимит", "rate_limited"),
    ("too many", "rate_limited"),
)

# Пустая ошибка — это успех: {"error": false} и {"errors": []} самые частые
# формы нормального ответа, и принять их за отказ значит всегда молчать.
EMPTY_ERRORS: tuple[Any, ...] = (False, "", [], {}, 0)


def pick(data: dict, keys: tuple[str, ...]) -> Any:
    """Первое непустое из нескольких возможных имён поля."""
    for key in keys:
        value = data.get(key)
        if value is not None:
            return value
    return None


def as_int(value: Any) -> int | None:
    """Целое или None. Строка с числом принимается, мусор — нет."""
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.strip().lstrip("-").isdigit():
        return int(value.strip())
    return None


def body_reason(body: Any, status: int) -> str:
    """Короткий код отказа по тексту тела; в журнал уходит только код.

    🔴 Само тело не логируем: в ответе на бронь едут имя и телефон гостя.
    """
    text = ""
    if isinstance(body, dict):
        raw = pick(body, MESSAGE_KEYS)
        text = str(raw).lower() if raw is not None else ""
    for needle, reason in BODY_REASONS:
        if needle in text:
            return reason
    if status == 429:
        return "rate_limited"
    if status == 409:
        return "conflict"
    return f"api_error_{status}"


def has_error(body: dict) -> bool:
    """Есть ли в теле НЕПУСТАЯ ошибка.

    🔴 Проверяем значение, а не наличие ключа: поле ошибки в успешном ответе
    обычно присутствует и пусто, и «ключ есть — значит отказ» превратило бы
    каждый нормальный ответ в «не знаю».
    """
    value = pick(body, ERROR_KEYS)
    return value is not None and not any(value == empty for empty in EMPTY_ERRORS)


def categories(body: dict, category: str | None) -> list[dict]:
    """Категории из ответа, при нужде отфильтрованные по коду или имени."""
    raw = pick(body, CATEGORY_KEYS)
    items = [item for item in raw if isinstance(item, dict)] if isinstance(raw, list) else []
    if category is None:
        return items
    wanted = category.strip().lower()
    return [
        item
        for item in items
        if wanted
        in {
            str(pick(item, CODE_KEYS) or "").lower(),
            str(pick(item, NAME_KEYS) or "").lower(),
        }
    ]


def free_units(items: list[dict]) -> list[int]:
    """Остатки по категориям. Наружу уходит признак, не эти числа."""
    return [c for c in (as_int(pick(item, FREE_KEYS)) for item in items) if c is not None]


def total_minor(item: dict) -> int | None:
    """Сумма в малых единицах или None.

    🔴 Единицы не угадываются: поле total/amount/sum размерности не объявляет,
    и делить его на сто вслепую значит назвать цену в сто раз меньше.
    """
    value = as_int(pick(item, TOTAL_MINOR_KEYS))
    if value is not None:
        return value
    if pick(item, UNDECLARED_TOTAL_KEYS) is not None:
        logger.warning("wetop: сумма пришла полем без единиц измерения, цену не называем")
    return None


def currency(item: dict, body: dict) -> str | None:
    """Валюта из категории или из корня ответа. Нет валюты — нет цены:
    450 тенге и 450 рублей это разные разговоры."""
    raw = pick(item, CURRENCY_KEYS) or pick(body, CURRENCY_KEYS)
    text = str(raw).strip() if raw is not None else ""
    if not text:
        logger.warning("wetop: в ответе нет валюты, цену не называем")
        return None
    return text


def per_night_minor(item: dict) -> list[int] | None:
    """Поночные суммы, если они пришли списком чисел."""
    raw = pick(item, PER_NIGHT_KEYS)
    if not isinstance(raw, list):
        return None
    values = [as_int(v) for v in raw]
    return [v for v in values if v is not None] or None
