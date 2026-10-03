"""[КЛИЕНТ] Инструменты модели поверх провайдеров внешней системы.

Ядро (ToolRegistry) не трогаем: здесь только сборка реестра под конкретного
заказчика. В другом проекте этот файл выбрасывается целиком.

🔴 Точное число свободных мест не возвращается никогда. «Осталось три» —
обещание: место ушло, пока клиент думал, и виноват бот. Признак «есть/мало/
нет» обещанием не становится.

🔴 Сумму берём из ответа внешней системы. Бот не складывает и не умножает:
итог, названный ботом, становится обещанием (AGENTS.md, «чего боту нельзя»).

Не знаем — так и говорим. Недоступная система, неверная дата и отсутствующий
провайдер дают один и тот же признак, а не исключение: исключение отсюда
уронило бы ход, а клиенту нужен ответ.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import date

from src.ai.tools import ToolRegistry, ToolSpec
from src.integrations.failure_log import log_provider_failure
from src.integrations.providers import Providers

logger = logging.getLogger(__name__)

# Единственный ответ на все виды «не знаю»: модель по нему говорит клиенту,
# что уточнит администратор, и не называет чисел.
UNKNOWN = "не знаю: уточнит администратор"

_KIND_TEXT: dict[str, str] = {
    "yes": "есть",
    "few": "мест мало",
    "no": "мест нет",
}

# Хвост описания, общий для обоих инструментов: правила для модели, а не для кода.
_RULES = (
    " Если инструмент ответил «не знаю», скажи клиенту, что уточнит"
    " администратор, и НЕ называй никаких чисел и дат как подтверждённые."
    " Не назвал клиент категорию номера — спроси, а не подставляй свою."
)

_DATE_PARAMS = {
    "arrival": {"type": "string", "description": "Дата заезда, YYYY-MM-DD"},
    "departure": {"type": "string", "description": "Дата выезда, YYYY-MM-DD"},
    "guests": {"type": "integer", "description": "Сколько гостей"},
}


def _parse(arrival: str, departure: str, guests: int) -> tuple[date, date, int] | None:
    """Разбор аргументов модели. Невалидные — не исключение, а None:
    модель регулярно придумывает '31 февраля' и 'завтра'."""
    try:
        start = date.fromisoformat(str(arrival).strip())
        end = date.fromisoformat(str(departure).strip())
        count = int(guests)
    except (TypeError, ValueError):
        logger.warning("инструмент: даты или число гостей не разобраны")
        return None
    if end <= start or count < 1:
        logger.warning("инструмент: выезд не позже заезда или гостей меньше одного")
        return None
    return start, end, count


def _availability(providers_getter: Callable[[], Providers]):
    """Провайдер наличия или None: сбой фабрики не должен ронять ход."""
    try:
        providers = providers_getter()
    except Exception as exc:
        log_provider_failure(logger, "инструмент: провайдеры", exc)
        return None
    return getattr(providers, "availability", None)


def build_registry(providers_getter: Callable[[], Providers], *, booking=None) -> ToolRegistry:
    """Реестр из двух инструментов; с `booking` (ADR-143) ещё два — бронь из чата. Движок получает его снаружи."""

    async def check_availability(
        arrival: str, departure: str, guests: int, category: str | None = None
    ) -> str:
        parsed = _parse(arrival, departure, guests)
        provider = _availability(providers_getter)
        if parsed is None or provider is None:
            return UNKNOWN
        start, end, count = parsed
        try:
            result = await provider.check(start, end, count, category)
        except Exception as exc:
            # Причина — в журнал; модели только признак, без текста ошибки.
            log_provider_failure(logger, "check_availability", exc)
            return UNKNOWN
        kind = getattr(result, "kind", None)
        # 🔴 Из ответа берём только признак: числа мест в нём нет и быть не должно.
        return _KIND_TEXT.get(kind or "", UNKNOWN)

    async def get_price(
        arrival: str, departure: str, guests: int, category: str
    ) -> str:
        parsed = _parse(arrival, departure, guests)
        provider = _availability(providers_getter)
        if parsed is None or provider is None or not str(category or "").strip():
            return UNKNOWN
        start, end, count = parsed
        try:
            quote = await provider.quote(start, end, count, str(category).strip())
        except Exception as exc:
            log_provider_failure(logger, "get_price", exc)
            return UNKNOWN
        if quote is None or getattr(quote, "total_minor", None) is None:
            return UNKNOWN
        money = str(getattr(quote, "currency", "") or "").strip()
        if not money:
            # 🔴 Сумма без валюты — такое же необеспеченное обещание, как
            # выдуманное число: «итого 450» клиент прочитает в своей валюте.
            logger.warning("get_price: валюта не известна, цену не называем")
            return UNKNOWN
        return (
            f"итого {_money(quote.total_minor)} {money}"
            f" за {_nights(quote.nights)}, категория {quote.category_name}"
        )

    registry = ToolRegistry()
    registry.register(
        ToolSpec(
            name="check_availability",
            description=(
                "Есть ли свободные номера на даты. Возвращает признак:"
                " «есть», «мест мало», «мест нет» или «не знаю»."
                " Точное количество свободных мест не возвращается и называть"
                " его клиенту нельзя." + _RULES
            ),
            parameters={
                "type": "object",
                "properties": {
                    **_DATE_PARAMS,
                    "category": {
                        "type": ["string", "null"],
                        "description": "Категория номера, если клиент её назвал",
                    },
                },
                "required": ["arrival", "departure", "guests"],
            },
            handler=check_availability,
        )
    )
    registry.register(
        ToolSpec(
            name="get_price",
            description=(
                "Стоимость проживания на даты по категории номера."
                " Сумму считает внешняя система: сам ничего не складывай"
                " и не умножай, называй только то, что вернул инструмент." + _RULES
            ),
            parameters={
                "type": "object",
                "properties": {
                    **_DATE_PARAMS,
                    "category": {"type": "string", "description": "Категория номера"},
                },
                "required": ["arrival", "departure", "guests", "category"],
            },
            handler=get_price,
        )
    )
    if booking is not None:
        from src.ai.seller_booking import register_booking_tools

        register_booking_tools(registry, providers_getter, booking)
    return registry


def _money(total_minor: int) -> str:
    """Малые единицы -> привычная запись. Это форматирование, а не расчёт:
    сумму посчитала внешняя система, мы её только показываем."""
    whole, rest = divmod(int(total_minor), 100)
    return str(whole) if rest == 0 else f"{whole}.{rest:02d}"


def _nights(nights: int) -> str:
    """«1 ночь», «2 ночи», «5 ночей». Модель вправе пересказать вывод
    инструмента дословно, и «за 1 ночей» дойдёт до клиента как есть."""
    count = int(nights)
    tail, hundred = count % 10, count % 100
    if tail == 1 and hundred != 11:
        word = "ночь"
    elif tail in (2, 3, 4) and hundred not in (12, 13, 14):
        word = "ночи"
    else:
        word = "ночей"
    return f"{count} {word}"
