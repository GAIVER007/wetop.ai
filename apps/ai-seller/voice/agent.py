"""Агент VideoSDK: единственное место, где подключается SDK вместе с worker.py.

Вся логика ответов живёт в tools.py и profile.py и тестируется без SDK.
Здесь только хуки входа и выхода и превращение методов VoiceTools в инструменты модели.
"""

from __future__ import annotations

import logging

from videosdk.agents import Agent, function_tool

from voice.journal import CallJournal, CallState
from voice.numbers import Route
from voice.profile import VoiceProfile, build_instructions, closing_line, opening_line
from voice.tools import VoiceTools

logger = logging.getLogger(__name__)

UNKNOWN_NUMBER_LINE = "Извините, сейчас мы не можем принять звонок. Позвоните, пожалуйста, позже."


def make_function_tools(tools: VoiceTools, vertical: str = "BEAUTY", can_book: bool = False) -> list:
    """Набор инструментов по направлению: справочник только там, где у платформы есть читающий адрес для продавца."""
    built: list = []

    if vertical == "BEAUTY":

        @function_tool(name="get_services")
        async def get_services() -> str:
            """Услуги объекта: названия, длительность и цены из каталога. Вызывай, когда клиент спрашивает про услуги или цены."""
            return await tools.get_services()

        built.append(get_services)

    if vertical == "FOOD_SERVICE":

        @function_tool(name="get_service_hours")
        async def get_service_hours() -> str:
            """Часы обслуживания ресторана по дням недели. Вызывай, когда клиент спрашивает, когда открыто или во сколько завтрак, обед, ужин."""
            return await tools.get_service_hours()

        built.append(get_service_hours)

    if vertical == "HOSPITALITY" and can_book:

        @function_tool(name="check_availability")
        async def check_availability(arrival: str, departure: str, adults: int) -> str:
            """Свободные категории номеров и цена проживания. Даты заезда и выезда в формате ГГГГ-ММ-ДД, число гостей. Вызывай, когда клиент спрашивает про наличие, цены или хочет забронировать."""
            return await tools.check_availability(arrival, departure, adults)

        @function_tool(name="quote_stay")
        async def quote_stay(category: str, arrival: str, departure: str, adults: int) -> str:
            """Условия брони для категории из последнего результата check_availability, с теми же датами и числом гостей. Это не бронь: перескажи условия клиенту и спроси согласие."""
            return await tools.quote_stay(category, arrival, departure, adults)

        @function_tool(name="confirm_booking")
        async def confirm_booking(first_name: str, last_name: str, phone: str, customer_agreed: bool) -> str:
            """Подтвердить бронь по последним условиям. Вызывай только после того, как клиент явно сказал «да» на пересказанные условия; customer_agreed ставь true только в этом случае."""
            return await tools.confirm_booking(first_name, last_name, phone, customer_agreed)

        built.extend([check_availability, quote_stay, confirm_booking])

    if vertical == "BEAUTY" and can_book:

        @function_tool(name="get_masters")
        async def get_masters() -> str:
            """Услуги салона с ценами и мастера, которые каждую услугу оказывают. Вызывай первым, когда клиент хочет записаться или спрашивает, кто что делает."""
            return await tools.get_masters()

        @function_tool(name="find_slots")
        async def find_slots(service: str, date: str, master: str = "") -> str:
            """Свободное время на дату (ГГГГ-ММ-ДД) для услуги из get_masters. Мастера указывай, только если клиент назвал его; иначе оставь пустым (любой свободный)."""
            return await tools.find_slots(service, date, master)

        @function_tool(name="quote_visit")
        async def quote_visit(service: str, time: str, master: str = "") -> str:
            """Условия записи на время из последней выдачи find_slots. Это не запись: перескажи условия клиенту и спроси согласие."""
            return await tools.quote_visit(service, time, master)

        @function_tool(name="confirm_visit")
        async def confirm_visit(name: str, phone: str, comment: str, customer_agreed: bool) -> str:
            """Записать клиента по последним условиям. Вызывай только после явного «да» клиента на пересказанные условия; customer_agreed ставь true только в этом случае. comment: пожелание к визиту, если есть."""
            return await tools.confirm_visit(name, phone, comment, customer_agreed)

        built.extend([get_masters, find_slots, quote_visit, confirm_visit])

    @function_tool(name="request_callback")
    async def request_callback(name: str, phone: str, note: str = "") -> str:
        """Сохранить просьбу перезвонить: имя клиента, его телефон и коротко чего он хочет. Вызывай, когда клиент хочет записаться или забронировать."""
        return await tools.request_callback(name, phone, note)

    @function_tool(name="transfer_to_human")
    async def transfer_to_human() -> str:
        """Соединить клиента с администратором. Вызывай, если клиент просит живого человека или вопрос вне твоих данных."""
        return await tools.transfer_to_human()

    built.extend([request_callback, transfer_to_human])
    return built


class VoiceAgent(Agent):
    def __init__(
        self, *, profile: VoiceProfile, tools: VoiceTools, journal: CallJournal, route: Route, call_id: str, events=None
    ) -> None:
        super().__init__(instructions=build_instructions(profile, ""), tools=make_function_tools(tools, profile.vertical, profile.can_book))
        self._profile = profile
        self._journal = journal
        self._route = route
        self._call_id = call_id
        self._events = events

    async def _emit_state(self, state: CallState) -> None:
        if self._events is None:
            return
        try:
            self._events.state(self._call_id, self._route, state)
        except Exception:  # noqa: BLE001 - отчётность не ломает звонок
            logger.warning("событие %s не поставлено в очередь", state.value)

    async def on_enter(self) -> None:
        self._journal.record(self._call_id, CallState.ANSWERED, route=self._route)
        await self._emit_state(CallState.ANSWERED)
        await self.session.say(opening_line(self._profile))

    async def on_exit(self) -> None:
        self._journal.record(self._call_id, CallState.ENDED, route=self._route)
        await self._emit_state(CallState.ENDED)
        try:
            await self.session.say(closing_line())
        except Exception:  # noqa: BLE001 - сессия уже закрывается
            logger.info("прощание не произнесено: сессия закрыта")


class RejectAgent(Agent):
    """Звонок без настройки или без профиля объекта: вежливо прощаемся и кладём трубку."""

    def __init__(self) -> None:
        super().__init__(instructions="Сообщи, что номер не настроен, и заверши звонок.")

    async def on_enter(self) -> None:
        await self.session.say(UNKNOWN_NUMBER_LINE)
        await self.session.hangup("unknown_number")

    async def on_exit(self) -> None:
        return None
