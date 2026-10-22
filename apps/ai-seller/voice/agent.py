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


def make_function_tools(tools: VoiceTools, vertical: str = "BEAUTY") -> list:
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
        super().__init__(instructions=build_instructions(profile, ""), tools=make_function_tools(tools, profile.vertical))
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
