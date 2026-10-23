"""Инструменты голосового агента: чистая логика без SDK.

Каждый метод возвращает строку для модели и не бросает исключений: сбой
инструмента превращается в нейтральную фразу, клиент не слышит ошибок.
"""

from __future__ import annotations

import logging
import re
from collections.abc import Awaitable, Callable
from datetime import date

from voice.booking_client import BookingRefused, BookingUnavailable
from voice.journal import CallJournal, CallState, append_private
from voice.numbers import Route
from voice.phone import normalize_e164
from voice.profile import VoiceProfile
from voice.wetop_client import CatalogUnavailable

logger = logging.getLogger(__name__)

NOTE_MAX = 500
CALLBACKS_PER_CALL = 3
ASK_ADMIN = "Этих данных у меня нет, администратор уточнит и свяжется с клиентом."
TransferFn = Callable[[str, str], Awaitable[bool]]
ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MAX_ADULTS = 10
BAD_DATES = "Даты или число гостей не поняты: уточните дату заезда, дату выезда и число гостей."
NOT_AVAILABLE = "Этот вариант сейчас недоступен. Предложите другие даты или категорию, либо оставьте просьбу для администратора."
NEED_QUOTE = "Сначала нужно предложение с условиями: проверьте наличие и назовите условия клиенту."
BOOKING_OFF = "Бронь по телефону сейчас недоступна, администратор свяжется с клиентом."


def _money(minor: object, currency: object) -> str | None:
    try:
        value = int(str(minor))
    except ValueError:
        return None
    if value < 0:
        return None
    major, rest = divmod(value, 100)
    shown = f"{major}" if rest == 0 else f"{major},{rest:02d}"
    return f"{shown} {currency if isinstance(currency, str) else ''}".strip()


def format_services(items: list[dict]) -> str:
    rows = []
    for item in items:
        name = item.get("name") if isinstance(item, dict) else None
        if not isinstance(name, str) or not name.strip():
            continue
        price = _money(item.get("priceMinor"), item.get("currency"))
        minutes = item.get("durationMinutes")
        parts = [name.strip()]
        if isinstance(minutes, int) and minutes > 0:
            parts.append(f"{minutes} минут")
        if price:
            parts.append(price)
        rows.append(", ".join(parts))
    return "; ".join(rows)


DAYS = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"]


def format_service_hours(items: list[dict]) -> str:
    """Периоды обслуживания: дни с одинаковым временем объединяются, переход через полночь помечается."""
    groups: dict[tuple, list[int]] = {}
    for item in items:
        if not isinstance(item, dict):
            continue
        name, day = item.get("name"), item.get("weekday")
        start, end = item.get("timeFrom"), item.get("timeTo")
        if not (isinstance(name, str) and name.strip() and isinstance(day, int) and 0 <= day <= 6):
            continue
        if not (isinstance(start, str) and isinstance(end, str)):
            continue
        key = (name.strip(), start, end, bool(item.get("endsNextDay")))
        groups.setdefault(key, []).append(day)
    rows = []
    for (name, start, end, next_day), days in groups.items():
        names = ", ".join(DAYS[d] for d in sorted(set(days), key=lambda d: (d + 6) % 7))
        tail = " (заканчивается в ночь следующего дня)" if next_day else ""
        rows.append(f"{name}: {names}, с {start} до {end}{tail}")
    return "; ".join(rows)


class VoiceTools:
    def __init__(
        self,
        *,
        call_id: str,
        route: Route,
        journal: CallJournal,
        catalog,
        profile: VoiceProfile,
        transfer: TransferFn | None = None,
        events=None,
        booking=None,
    ) -> None:
        self._call_id = call_id
        self._route = route
        self._journal = journal
        self._catalog = catalog
        self._profile = profile
        self._transfer = transfer
        self._transfer_done = False
        self._events = events
        self._booking = booking
        # категории, которые платформа вернула как свободные в этом звонке: бронь только из этой выдачи
        self._offered: dict[str, tuple[str, str, str, int]] = {}
        # последняя котировка этого звонка: идентификатор остаётся здесь, модель его не видит и не подставляет
        self._pending: dict | None = None
        self._booked = 0

    def _emit(self, kind: str, *args: str) -> None:
        """Событие в очередь платформы. Сбой отчётности не должен ломать разговор."""
        if self._events is None:
            return
        try:
            if kind == "callback":
                self._events.callback(self._call_id, self._route, *args)
            else:
                self._events.transfer(self._call_id, self._route)
        except Exception:  # noqa: BLE001 - причину в лог без данных клиента
            logger.warning("событие %s не поставлено в очередь", kind)

    async def get_services(self) -> str:
        """Услуги объекта с длительностью и ценой из каталога."""
        try:
            items = await self._catalog.beauty_services(self._route.agent_id)
        except CatalogUnavailable:
            return ASK_ADMIN
        except Exception:  # noqa: BLE001
            logger.warning("get_services: непредвиденный сбой")
            return ASK_ADMIN
        text = format_services(items)
        return f"Услуги и цены каталога: {text}." if text else ASK_ADMIN

    async def get_service_hours(self) -> str:
        """Периоды обслуживания ресторана по дням недели (часы работы)."""
        try:
            items = await self._catalog.food_service_periods(self._route.agent_id)
        except CatalogUnavailable:
            return ASK_ADMIN
        except Exception:  # noqa: BLE001
            logger.warning("get_service_hours: непредвиденный сбой")
            return ASK_ADMIN
        text = format_service_hours(items)
        return f"Часы обслуживания: {text}." if text else ASK_ADMIN

    async def request_callback(self, name: str, phone: str, note: str = "") -> str:
        """Сохранить просьбу перезвонить клиенту."""
        number = normalize_e164(phone)
        if number is None:
            return "Номер телефона не расслышан, попросите клиента повторить его полностью."
        if self._journal.has(self._call_id, CallState.CALLBACK, number):
            return "Эта просьба уже записана."
        done = sum(1 for e in self._journal.events_for(self._call_id) if e.get("state") == CallState.CALLBACK.value)
        if done >= CALLBACKS_PER_CALL:
            return "Достаточно, администратор свяжется с клиентом."
        clean_name = (name or "").strip()[:100]
        clean_note = (note or "").strip()[:NOTE_MAX]
        try:
            append_private(
                self._journal.callbacks_path,
                {
                    "call_id": self._call_id,
                    "received_at": self._journal.now_iso(),
                    "organization_id": self._route.organization_id,
                    "agent_id": self._route.agent_id,
                    "phone": number,
                    "name": clean_name,
                    "note": clean_note,
                },
            )
        except Exception:  # noqa: BLE001 - номер в лог не пишем
            logger.warning("request_callback: просьба не сохранена")
            return "Не удалось сохранить просьбу, администратор уточнит номер и свяжется с клиентом."
        self._journal.record(
            self._call_id, CallState.CALLBACK, route=self._route, caller=number, key=number,
            client_name=clean_name, note=clean_note,
        )
        self._emit("callback", number, clean_name, clean_note)
        return "Просьба записана, администратор свяжется с клиентом."

    async def transfer_to_human(self) -> str:
        """Соединить с человеком по номеру из профиля."""
        number = self._profile.handoff_number
        if self._transfer_done:
            return "Перевод уже запрошен."
        if not number or self._transfer is None:
            return "Перевод сейчас недоступен, администратор перезвонит клиенту."
        self._transfer_done = True
        try:
            ok = await self._transfer(self._call_id, number)
        except Exception:  # noqa: BLE001 - деталь сбоя клиенту не нужна
            logger.warning("transfer_to_human: сбой перевода")
            ok = False
        if not ok:
            return "Перевод не удался, администратор перезвонит клиенту."
        self._journal.record(self._call_id, CallState.TRANSFER, route=self._route)
        self._emit("transfer")
        return "Перевожу на администратора, подождите, пожалуйста."

    def _valid_stay(self, arrival: str, departure: str, adults: int) -> bool:
        if not (ISO_DATE.match(arrival or "") and ISO_DATE.match(departure or "")):
            return False
        try:
            start, end = date.fromisoformat(arrival), date.fromisoformat(departure)
        except ValueError:
            return False
        return end > start and isinstance(adults, int) and 1 <= adults <= MAX_ADULTS

    async def check_availability(self, arrival: str, departure: str, adults: int) -> str:
        """Свободные категории номеров и цена проживания по расчёту платформы."""
        if self._booking is None or not self._profile.can_book:
            return BOOKING_OFF
        if not self._valid_stay(arrival, departure, adults):
            return BAD_DATES
        try:
            data = await self._booking.availability(self._route.agent_id, self._call_id, arrival, departure, adults)
        except BookingRefused:
            return NOT_AVAILABLE
        except BookingUnavailable:
            return BOOKING_OFF
        except Exception:  # noqa: BLE001
            logger.warning("check_availability: непредвиденный сбой")
            return BOOKING_OFF
        rows, offered = [], {}
        currency = data.get("currency")
        for item in data.get("categories") or []:
            if not isinstance(item, dict) or not isinstance(item.get("name"), str):
                continue
            price = _money(item.get("totalMinor"), currency) if item.get("free") == "yes" else None
            if item.get("free") == "yes" and price and isinstance(item.get("code"), str):
                rows.append(f"{item['name']}: есть места, {price} за весь период")
                offered[item["name"].strip().lower()] = (item["code"], arrival, departure, adults)
                offered[item["code"].strip().lower()] = (item["code"], arrival, departure, adults)
            else:
                rows.append(f"{item['name']}: мест нет")
        self._offered = offered
        self._pending = None
        if not rows:
            return NOT_AVAILABLE
        nights = data.get("nights")
        head = f"На {nights} ноч. с {arrival} по {departure}, гостей {adults}. " if isinstance(nights, int) else ""
        return head + "; ".join(rows) + "."

    async def quote_stay(self, category: str, arrival: str, departure: str, adults: int) -> str:
        """Предложение с условиями на 30 минут для категории из последней выдачи; бронью не является."""
        if self._booking is None or not self._profile.can_book:
            return BOOKING_OFF
        picked = self._offered.get((category or "").strip().lower())
        if picked is None:
            if self._offered:
                return NOT_AVAILABLE
            return NEED_QUOTE
        code, offered_arrival, offered_departure, offered_adults = picked
        # условия те же, что платформа показала при проверке наличия: другие даты или гостей требуют новой проверки
        if (arrival, departure, adults) != (offered_arrival, offered_departure, offered_adults):
            return NEED_QUOTE
        try:
            quote = await self._booking.quote(self._route.agent_id, self._call_id, code, arrival, departure, adults)
        except BookingRefused:
            return NOT_AVAILABLE
        except BookingUnavailable:
            return BOOKING_OFF
        except Exception:  # noqa: BLE001
            logger.warning("quote_stay: непредвиденный сбой")
            return BOOKING_OFF
        intent = quote.get("intent")
        price = _money(quote.get("totalMinor"), quote.get("currency"))
        if not isinstance(intent, str) or not price:
            return BOOKING_OFF
        self._pending = {"intent": intent}
        return (
            f"Условия: {quote.get('categoryName', category)}, с {quote.get('arrivalDate')} по {quote.get('departureDate')}, "
            f"гостей {quote.get('adults')}, {price} за весь период, заезд с {quote.get('checkInTime')}. "
            "Это ещё не бронь. Предложение действует 30 минут. Для подтверждения брони спросите имя, фамилию, телефон и получите от клиента явное согласие «да»."
        )

    async def confirm_booking(self, first_name: str, last_name: str, phone: str, customer_agreed: bool) -> str:
        """Подтвердить бронь по последнему предложению после явного согласия звонящего."""
        if self._booking is None or not self._profile.can_book:
            return BOOKING_OFF
        if self._pending is None:
            return NEED_QUOTE
        if customer_agreed is not True:
            return "Нужно явное согласие клиента на условия: переспросите и дождитесь слова «да»."
        if self._booked >= self._profile.booking_max_per_call:
            return "За один звонок забронировано максимум, остальное уточнит администратор."
        first, last = (first_name or "").strip()[:80], (last_name or "").strip()[:80]
        if not first or not last:
            return "Нужны имя и фамилия гостя, уточните их у клиента."
        number = normalize_e164(phone)
        if number is None:
            return "Номер телефона не расслышан, попросите клиента повторить его полностью."
        intent = self._pending["intent"]
        try:
            booked = await self._booking.confirm(
                self._route.agent_id, self._call_id, intent, {"firstName": first, "lastName": last, "phone": number}
            )
        except BookingRefused:
            self._pending = None
            return NOT_AVAILABLE
        except BookingUnavailable:
            return BOOKING_OFF
        except Exception:  # noqa: BLE001
            logger.warning("confirm_booking: непредвиденный сбой")
            return BOOKING_OFF
        self._pending = None
        self._offered = {}
        self._booked += 1
        number_text = booked.get("confirmationNumber")
        tail = (
            "Бронь ожидает подтверждения администратора, он свяжется с клиентом."
            if booked.get("pendingApproval")
            else "Бронь подтверждена."
        )
        return f"Бронь принята, номер {number_text}. {tail}"
