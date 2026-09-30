"""Слова для диагностики техподдержки (S5): ответы платформы → текст для модели по белому списку полей.

Вынесено из support_diagnostics.py ради предела ~300 строк на файл. Здесь нет ни сети, ни посетителя: чистые функции,
которые из словаря платформы берут только перечисленные поля. Имя и телефон гостя, заметки, суммы, ключи и адреса
Channex сюда не попадают, что бы сервер ни добавил в ответ.
"""

from __future__ import annotations

import re
from datetime import datetime

NOT_CONNECTED = "каналы продаж к организации не подключены"

_STATES = {
    "READY": "работает",
    "NO_KEY": "ключ Channex не задан",
    "NO_MAPPING": "объект не сопоставлен с Channex",
    "ATTENTION": "требует внимания",
}
_PROBLEMS = {
    "KEY_MISSING": "ключ Channex не задан",
    "PROPERTY_NOT_MAPPED": "объект не сопоставлен",
    "CATEGORIES_UNMAPPED": "не все категории сопоставлены",
    "RATE_PLANS_UNMAPPED": "ни один тариф не сопоставлен",
    "WEBHOOK_SUSPECT": "webhook под подозрением",
    "WEBHOOK_UNREACHABLE": "адрес webhook недоступен",
    "OUTBOX_FAILED": "есть сбои отправки изменений в канал",
    "OUTBOX_STUCK": "очередь изменений застряла",
    "NO_EVENTS_24H": "событий из канала не было больше суток",
}
_RES_STATUS = {
    "TENTATIVE": "предварительная",
    "CONFIRMED": "подтверждена",
    "CHECKED_IN": "гость заселён",
    "CHECKED_OUT": "гость выехал",
    "CANCELLED": "отменена",
    "NO_SHOW": "незаезд",
}
_ITEM_STATUS = {
    "TENTATIVE": "предварительно",
    "CONFIRMED": "подтверждено",
    "CHECKED_IN": "заселено",
    "CHECKED_OUT": "выехало",
    "CANCELLED": "отменено",
    "NO_SHOW": "незаезд",
}
_HOUSEKEEPING = {"DIRTY": "уборка: грязно", "CLEAN": "уборка: чисто, не проверена", "INSPECTED": "уборка проверена"}
_RES_PROBLEMS = {
    "CANCELLED": "бронь отменена",
    "NO_SHOW": "отмечен незаезд",
    "UNASSIGNED_ITEMS": "есть проживание без ячейки",
    "ARRIVAL_PASSED_NOT_CHECKED_IN": "дата заезда прошла, а гость не заселён",
    "DEPARTURE_PASSED_NOT_CHECKED_OUT": "дата выезда прошла, а гость не выселен",
    "UNIT_NOT_INSPECTED_BEFORE_ARRIVAL": "ячейка к заезду не проверена уборкой",
}
_SOURCES = {
    "DESK": "стойка",
    "PHONE": "телефон",
    "WHATSAPP": "WhatsApp",
    "WALK_IN": "гость с улицы",
    "INSTAGRAM": "Instagram",
    "OTA": "канал продаж",
    "WEBSITE": "сайт",
    "WEB": "сайт",
}


def _dict(value: object) -> dict:
    return value if isinstance(value, dict) else {}


def _int(value: object) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def _clean(value: object, limit: int = 60) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text[:limit] + "…" if len(text) > limit else text


def _date(value: object) -> str:
    try:
        return datetime.strptime(str(value or "")[:10], "%Y-%m-%d").strftime("%d.%m.%Y")
    except ValueError:
        return "дата неизвестна"


def _plural(n: int, one: str, few: str, many: str) -> str:
    tail = n % 100
    if 11 <= tail <= 19:
        return f"{n} {many}"
    tail %= 10
    return f"{n} {one}" if tail == 1 else f"{n} {few}" if 2 <= tail <= 4 else f"{n} {many}"


def _ago(minutes: object) -> str:
    n = _int(minutes)
    if n is None:
        return "не было"
    if n < 60:
        return f"{n} мин назад"
    if n < 48 * 60:
        return f"{n // 60} ч назад"
    return f"{n // (24 * 60)} дн. назад"


def integration_text(body: dict) -> tuple[str, str]:
    """Ответ платформы → (подробный текст, короткое слово для сводки). Только белый список полей."""
    channex = body.get("channex")
    if channex is None:
        return NOT_CONNECTED, NOT_CONNECTED
    view = _dict(channex)
    state = _STATES.get(str(view.get("state")), "состояние неизвестно")
    categories = _dict(view.get("categories"))
    outbox = _dict(view.get("outbox"))
    webhook = _dict(view.get("webhook"))
    parts = [f"Каналы продаж (Channex): {state}"]
    mapped, total = _int(categories.get("mapped")), _int(categories.get("total"))
    if mapped is not None and total is not None:
        parts.append(f"категорий сопоставлено {mapped} из {total}")
    plans = _int(view.get("ratePlansMapped"))
    if plans is not None:
        parts.append(f"тарифов сопоставлено: {plans}")
    parts.append(f"последнее событие из канала: {_ago(view.get('lastEventAgeMinutes'))}")
    pending, failed = _int(outbox.get("pending")), _int(outbox.get("failed"))
    if pending is not None and failed is not None:
        line = f"очередь изменений в канал: ждут {pending}, сбоев {failed}"
        oldest = _int(outbox.get("oldestPendingMinutes"))
        if oldest is not None:
            line += f", самая старая ждёт {oldest} мин"
        parts.append(line)
    hooks = []
    if webhook.get("suspect") is True:
        hooks.append("под подозрением")
    if webhook.get("reachable") is False:
        hooks.append("адрес webhook недоступен")
    parts.append("webhook: " + ("; ".join(hooks) if hooks else "в порядке"))
    problems = [_PROBLEMS.get(str(code), "") for code in (view.get("problems") or [])]
    problems = [one for one in problems if one]
    parts.append("проблемы: " + ("; ".join(problems) if problems else "нет"))
    return ". ".join(parts) + ".", state


def reservation_text(body: dict) -> str:
    """Карточка диагностики брони → текст. Гостя, заметок и сумм в белом списке нет."""
    number = _clean(body.get("number"), 40)
    status = _RES_STATUS.get(str(body.get("status")), "статус неизвестен")
    nights = _int(body.get("nights"))
    parts = [f"Бронь {number}: {status}"]
    stay = f"заезд {_date(body.get('arrivalDate'))}, выезд {_date(body.get('departureDate'))}"
    if nights is not None:
        stay += f", {_plural(nights, 'ночь', 'ночи', 'ночей')}"
    parts.append(stay)
    source = _SOURCES.get(str(body.get("source")), str(body.get("source") or "источник неизвестен").lower())
    channel = _clean(body.get("channel"))
    parts.append(f"источник: {source}" + (f" ({channel})" if channel else ""))
    guests = _dict(body.get("guests"))
    adults, children = _int(guests.get("adults")), _int(guests.get("children"))
    if adults is not None:
        who = _plural(adults, "взрослый", "взрослых", "взрослых")
        if children:
            who += ", " + _plural(children, "ребёнок", "ребёнка", "детей")
        parts.append(f"гостей: {who}")
    items = []
    for raw in body.get("items") or []:
        item = _dict(raw)
        line = f"{_clean(item.get('category'))} — {_ITEM_STATUS.get(str(item.get('status')), 'статус неизвестен')}"
        if item.get("unitAssigned") is True and item.get("unitCode"):
            line += f", ячейка {_clean(item.get('unitCode'), 20)}"
            housekeeping = _HOUSEKEEPING.get(str(item.get("housekeeping")))
            if housekeeping:
                line += f" ({housekeeping})"
        else:
            line += ", ячейка не назначена"
        items.append(line)
    if items:
        parts.append("проживания: " + "; ".join(items))
    problems = [_RES_PROBLEMS.get(str(code), "") for code in (body.get("problems") or [])]
    problems = [one for one in problems if one]
    parts.append("проблемы: " + ("; ".join(problems) if problems else "нет"))
    return ". ".join(parts) + "."
