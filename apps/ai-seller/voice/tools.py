"""Инструменты голосового агента: чистая логика без SDK.

Каждый метод возвращает строку для модели и не бросает исключений: сбой
инструмента превращается в нейтральную фразу, клиент не слышит ошибок.
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable

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
    ) -> None:
        self._call_id = call_id
        self._route = route
        self._journal = journal
        self._catalog = catalog
        self._profile = profile
        self._transfer = transfer
        self._transfer_done = False

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
        return "Перевожу на администратора, подождите, пожалуйста."
