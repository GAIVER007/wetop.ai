"""[КЛИЕНТ] Бронь из чата ИИ-продавца (DATA_MODEL §24 платформы, ADR-143; контракт владельца 30.09.2026).

Два инструмента поверх двери платформы POST /bot/booking-intents:
1. book_quote — предложение: сумму, срок 30 минут и место считает ПЛАТФОРМА, бот только пересказывает.
2. book_confirm — бронь. 🔴 Согласие проверяет сервер бота, а не модель: инструмент оформляет бронь, только если
   в ЭТОМ ходе гость написал явное «да» (точное совпадение с фразой из списка) и в диалоге есть живое предложение.
   «а сколько?», «наверное», «да, но…» бронью не становятся. Повтор того же сообщения не создаёт вторую бронь:
   ключ согласия — отпечаток сообщения, платформа держит UNIQUE и ключ повтора брони.

Телефон в WhatsApp не спрашиваем: он приходит из канала (решение владельца 30.09). В чате сайта телефон даёт гость.
Telegram — тестовый канал: брони там нет. Ни организации, ни объекта инструмент не принимает от модели: агента и диалог
ставит движок, платформа выводит остальное из строки агента.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from typing import Any

from src.ai.tools import ToolRegistry, ToolSpec
from src.integrations.failure_log import log_provider_failure
from src.integrations.providers import ProviderUnavailable

logger = logging.getLogger(__name__)

PENDING_TTL_SECONDS = 30 * 60
BOOKING_CHANNELS = {"whatsapp", "widget"}
UNKNOWN = "не знаю: уточнит администратор"

# Явное «да» гостя на четырёх языках. Детерминированно: точное совпадение после снятия знаков и регистра.
BOOKING_CONSENT: frozenset[str] = frozenset({
    "да", "да да", "да бронируйте", "бронируйте", "бронирую", "да бронирую", "подтверждаю", "да подтверждаю",
    "оформляйте", "да оформляйте", "согласен", "согласна", "да согласен", "да согласна",
    "иә", "ия", "иа", "иә растаймын", "растаймын", "келісемін",
    "yes", "yes please", "confirm", "i confirm", "book it", "yes book it",
    "是", "是的", "好", "好的", "确认", "我确认", "预订",
})
_PUNCT = re.compile(r"[^\w\s]+", re.UNICODE)


def explicit_booking_consent(text: object) -> bool:
    if not isinstance(text, str):
        return False
    normalized = re.sub(r"\s+", " ", _PUNCT.sub(" ", text.lower().replace("ё", "е"))).strip()
    return normalized in BOOKING_CONSENT


def pending_key(conversation_id: str) -> str:
    return f"seller:booking:{conversation_id}"


def consent_key(incoming: Any) -> str:
    """Отпечаток сообщения с согласием: один и тот же для повтора того же сообщения, разный для разных."""
    raw = "|".join(
        str(getattr(incoming, name, "") or "")
        for name in ("agent_id", "channel", "external_id", "received_at", "text")
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class BookingRuntime:
    redis_getter: Callable[[], Any]
    incoming_getter: Callable[[], Any]
    conversation_getter: Callable[[], str | None]
    agent_getter: Callable[[], str | None]


def _money(total_minor: int | str) -> str:
    whole, rest = divmod(int(total_minor), 100)
    text = f"{whole:,}".replace(",", " ")
    return text if rest == 0 else f"{text}.{rest:02d}"


def _nights(n: int) -> str:
    tail, hundred = n % 10, n % 100
    word = "ночь" if tail == 1 and hundred != 11 else "ночи" if tail in (2, 3, 4) and hundred not in (12, 13, 14) else "ночей"
    return f"{n} {word}"


def _provider(providers_getter: Callable[[], Any]) -> Any:
    try:
        providers = providers_getter()
    except Exception as exc:  # noqa: BLE001
        log_provider_failure(logger, "бронь из чата: провайдеры", exc)
        return None
    provider = getattr(providers, "availability", None)
    return provider if hasattr(provider, "create_booking_intent") else None


def register_booking_tools(
    registry: ToolRegistry, providers_getter: Callable[[], Any], runtime: BookingRuntime
) -> None:
    async def book_quote(arrival: str, departure: str, guests: int, category: str) -> str:
        incoming = runtime.incoming_getter()
        channel = getattr(incoming, "channel", None)
        if channel not in BOOKING_CHANNELS:
            return "бронь в этом канале не оформляется: предложи гостю оставить заявку администратору"
        agent, conversation = runtime.agent_getter(), runtime.conversation_getter()
        provider = _provider(providers_getter)
        if not agent or not conversation or provider is None or not str(category or "").strip():
            return UNKNOWN
        try:
            start, end, count = date.fromisoformat(str(arrival)), date.fromisoformat(str(departure)), int(guests)
        except (TypeError, ValueError):
            return UNKNOWN
        try:
            offer = await provider.create_booking_intent(
                agent=agent, conversation=conversation, channel=channel, category=str(category).strip(),
                arrival=start, departure=end, adults=count,
            )
        except ProviderUnavailable as exc:
            log_provider_failure(logger, "book_quote", exc)
            if "conflict" in str(exc):
                return "на эти даты эта категория недоступна: предложи другие даты или категорию"
            return UNKNOWN
        redis = runtime.redis_getter()
        await redis.set(
            pending_key(conversation),
            json.dumps({"intent": offer["intent"], "proposed_at": int(time.time())}),
            ex=PENDING_TTL_SECONDS,
        )
        return (
            f"предложение: {offer['categoryName']}, заезд {offer['arrivalDate']} с {offer['checkInTime']},"
            f" выезд {offer['departureDate']} до {offer['checkOutTime']}, {_nights(int(offer['nights']))},"
            f" гостей {offer['adults']}, итого {_money(offer['totalMinor'])} {offer['currency']},"
            " оплата при заселении. Назови гостю эти условия и спроси, бронировать ли."
            " Бронь оформляется только после «да» гостя; предложение действует 30 минут."
        )

    async def book_confirm(first_name: str, last_name: str, phone: str | None = None) -> str:
        incoming = runtime.incoming_getter()
        channel = getattr(incoming, "channel", None)
        conversation, agent = runtime.conversation_getter(), runtime.agent_getter()
        if channel not in BOOKING_CHANNELS or not conversation or not agent:
            return "бронь в этом канале не оформляется: предложи гостю оставить заявку администратору"
        redis = runtime.redis_getter()
        raw = await redis.get(pending_key(conversation))
        try:
            pending = json.loads(raw) if raw else None
        except (TypeError, ValueError):
            pending = None
        if not isinstance(pending, dict) or not pending.get("intent"):
            return "нет действующего предложения: сначала вызови book_quote и назови гостю условия"
        if not explicit_booking_consent(getattr(incoming, "text", None)):
            return (
                "гость ещё не сказал явное «да»: спроси подтверждение условий и не говори, что бронь оформлена"
            )
        if not str(first_name or "").strip() or not str(last_name or "").strip():
            return "нужны имя и фамилия гостя: спроси их, бронь пока не оформлена"
        if channel == "whatsapp":
            digits = re.sub(r"\D", "", str(getattr(incoming, "external_id", "")))
            guest_phone = f"+{digits}"
        else:
            guest_phone = str(phone or "").strip()
        if len(re.sub(r"\D", "", guest_phone)) < 10:
            return "нужен телефон гостя: спроси его, бронь пока не оформлена"
        provider = _provider(providers_getter)
        if provider is None:
            return UNKNOWN
        try:
            booking = await provider.confirm_booking_intent(
                agent=agent, intent=str(pending["intent"]), message=consent_key(incoming),
                guest={"firstName": str(first_name).strip(), "lastName": str(last_name).strip(), "phone": guest_phone},
            )
        except ProviderUnavailable as exc:
            log_provider_failure(logger, "book_confirm", exc)
            if "conflict" in str(exc):
                await redis.delete(pending_key(conversation))
                return (
                    "предложение больше не действует (истекло, изменилась цена или заняли место):"
                    " вызови book_quote заново и снова спроси гостя"
                )
            return UNKNOWN
        await redis.delete(pending_key(conversation))
        return (
            f"бронь оформлена: номер {booking['confirmationNumber']}, {booking['categoryName']},"
            f" {booking['arrivalDate']} → {booking['departureDate']}, итого {_money(booking['totalMinor'])}"
            f" {booking['currency']}, оплата при заселении. Назови гостю номер брони."
        )

    registry.register(
        ToolSpec(
            name="book_quote",
            description=(
                "Предложить бронь: система считает цену и проверяет место на даты, предложение действует 30 минут."
                " Вызывай, когда гость хочет забронировать и назвал даты, число гостей и категорию."
                " Если инструмент ответил «не знаю», скажи, что уточнит администратор."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "arrival": {"type": "string", "description": "Дата заезда, YYYY-MM-DD"},
                    "departure": {"type": "string", "description": "Дата выезда, YYYY-MM-DD"},
                    "guests": {"type": "integer", "description": "Сколько гостей"},
                    "category": {"type": "string", "description": "Категория номера, как её назвал гость"},
                },
                "required": ["arrival", "departure", "guests", "category"],
            },
            handler=book_quote,
        )
    )
    registry.register(
        ToolSpec(
            name="book_confirm",
            description=(
                "Оформить бронь по действующему предложению. Вызывай только когда гость в ЭТОМ сообщении явно ответил"
                " «да» на условия; иначе бронь не оформится. Нужны имя и фамилия гостя; в чате сайта ещё телефон."
                " Не говори гостю, что бронь оформлена, пока инструмент не вернул номер брони;"
                " при «не знаю» скажи, что уточнит администратор."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "first_name": {"type": "string", "description": "Имя гостя"},
                    "last_name": {"type": "string", "description": "Фамилия гостя"},
                    "phone": {"type": ["string", "null"], "description": "Телефон гостя, только в чате сайта"},
                },
                "required": ["first_name", "last_name"],
            },
            handler=book_confirm,
        )
    )
