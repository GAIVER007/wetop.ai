"""Правка части настроек на лету через Redis, по белому списку.

Зачем вообще: сменить модель или срок ответа ночью, не перекатывая образ.
Почему по белому списку: настройка, которую можно поменять из панели, —
это дыра ровно настолько, насколько широк список. Поэтому список приходит
из окружения (RUNTIME_SETTINGS_ALLOWED), а не собирается из полей Settings.

🔴 Системный промпт сюда НЕ входит. Его источник правды — файл на томе
(PROMPT_PATH, см. struktura.txt). Два источника правды у промпта означают,
что однажды поедет тот, который вы не смотрите, и понять это можно будет
только по ответам бота.

Правка живёт без TTL: настройка, которая молча откатывается через час, —
это инцидент, который ищут заново каждую ночь. Снимается только явно.
"""

from __future__ import annotations

import logging
from typing import Any

from src.config import Settings

logger = logging.getLogger(__name__)

KEY_PREFIX = "runtime:setting:"
# Что считаем «да» в строковом значении: панель и curl шлют по-разному.
_TRUE_WORDS = frozenset({"1", "true", "yes", "on"})


def _key(name: str) -> str:
    return f"{KEY_PREFIX}{name}"


def _decode(raw: Any) -> str:
    """Redis отдаёт bytes; строка нужна одинаковой и из fakeredis, и из боевого."""
    if isinstance(raw, bytes):
        return raw.decode("utf-8")
    return str(raw)


def _ensure_allowed(settings: Settings, name: str) -> None:
    """Имя вне белого списка — ValueError с перечислением разрешённых.

    Перечисление в тексте не украшение: оператор панели должен увидеть,
    что именно ему можно, а не гадать по отказу.
    """
    allowed = settings.runtime_settings_allowed_list
    if name not in allowed:
        raise ValueError(
            f"настройка «{name}» не правится на лету; разрешены: {', '.join(allowed) or '—'}"
        )


def _cast(settings: Settings, name: str, raw: str) -> Any:
    """Приведение к типу одноимённого поля Settings.

    Без приведения sla_seconds вернулся бы строкой и сравнение с числом
    дало бы TypeError глубоко в стороже — там, где искать его дороже всего.
    """
    current = getattr(settings, name, None)
    if isinstance(current, bool):
        return raw.strip().lower() in _TRUE_WORDS
    if isinstance(current, int):
        try:
            return int(raw)
        except ValueError:
            logger.warning("правка %s не число, берём значение из настроек", name)
            return current
    if isinstance(current, float):
        try:
            return float(raw)
        except ValueError:
            logger.warning("правка %s не число, берём значение из настроек", name)
            return current
    return raw


async def get_override(redis, name: str) -> str | None:
    """Сырая правка как строка, или None. Белый список здесь не проверяется:
    читать безопасно, а ключ мог остаться от прежней версии списка."""
    raw = await redis.get(_key(name))
    return None if raw is None else _decode(raw)


async def set_override(redis, settings: Settings, name: str, value: str) -> None:
    """Ставит правку. Имя не из белого списка -> ValueError."""
    _ensure_allowed(settings, name)
    await redis.set(_key(name), str(value))
    # Значение в журнал не пишем: в белом списке сегодня безобидные имена,
    # но список — настройка, и завтра в нём окажется что-то чувствительное.
    logger.info("настройка %s изменена на лету", name)


async def clear_override(redis, name: str) -> None:
    """Снимает правку: значение снова берётся из окружения."""
    await redis.delete(_key(name))
    logger.info("правка настройки %s снята", name)


async def all_overrides(redis, settings: Settings) -> dict[str, str]:
    """Все действующие правки из белого списка — для экрана настроек.

    Обходим список имён, а не ищем ключи по маске: KEYS/SCAN по боевому
    Redis ради четырёх имён — цена, которую платить незачем.
    """
    result: dict[str, str] = {}
    for name in settings.runtime_settings_allowed_list:
        raw = await get_override(redis, name)
        if raw is not None:
            result[name] = raw
    return result


async def effective(redis, settings: Settings, name: str) -> Any:
    """Действующее значение: правка из Redis, иначе значение из настроек.

    Redis недоступен — возвращаем настройку, а не падаем: отсутствие правки
    хуже всего проявляется как отказ всего хода из-за недоступного кэша.
    """
    try:
        raw = await get_override(redis, name)
    except Exception:
        logger.exception("правка %s недоступна, берём значение из настроек", name)
        raw = None
    if raw is None:
        return getattr(settings, name)
    return _cast(settings, name, raw)
