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

UNKNOWN_NUMBER_LINE = "Извините, этот номер пока не настроен. Позвоните, пожалуйста, позже."


def make_function_tools(tools: VoiceTools) -> list:
    @function_tool(name="get_services")
    async def get_services() -> str:
        """Услуги объекта: названия, длительность и цены из каталога. Вызывай, когда клиент спрашивает про услуги или цены."""
        return await tools.get_services()

    @function_tool(name="request_callback")
    async def request_callback(name: str, phone: str, note: str = "") -> str:
        """Сохранить просьбу перезвонить: имя клиента, его телефон и коротко чего он хочет. Вызывай, когда клиент хочет записаться."""
        return await tools.request_callback(name, phone, note)

    @function_tool(name="transfer_to_human")
    async def transfer_to_human() -> str:
        """Соединить клиента с администратором. Вызывай, если клиент просит живого человека или вопрос вне твоих данных."""
        return await tools.transfer_to_human()

    return [get_services, request_callback, transfer_to_human]


class VoiceAgent(Agent):
    def __init__(self, *, profile: VoiceProfile, tools: VoiceTools, journal: CallJournal, route: Route, call_id: str) -> None:
        super().__init__(instructions=build_instructions(profile, ""), tools=make_function_tools(tools))
        self._profile = profile
        self._journal = journal
        self._route = route
        self._call_id = call_id

    async def on_enter(self) -> None:
        self._journal.record(self._call_id, CallState.ANSWERED, route=self._route)
        await self.session.say(opening_line(self._profile))

    async def on_exit(self) -> None:
        self._journal.record(self._call_id, CallState.ENDED, route=self._route)
        try:
            await self.session.say(closing_line())
        except Exception:  # noqa: BLE001 - сессия уже закрывается
            logger.info("прощание не произнесено: сессия закрыта")


class RejectAgent(Agent):
    """Звонок на номер без настройки: вежливо прощаемся и кладём трубку."""

    def __init__(self) -> None:
        super().__init__(instructions="Сообщи, что номер не настроен, и заверши звонок.")

    async def on_enter(self) -> None:
        await self.session.say(UNKNOWN_NUMBER_LINE)
        await self.session.hangup("unknown_number")

    async def on_exit(self) -> None:
        return None
