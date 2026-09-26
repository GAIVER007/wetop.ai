"""Протокол отправителя: единственная дверь из движка во внешний канал.

Настоящие отправители (мессенджер, виджет) — шаг 6. Движок знает только
этот протокол: смена канала не трогает ядро, а тесты подставляют
отправитель-заглушку и проверяют, что при отказе доставки ответ бота
не попадает в историю.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class SendResult:
    """Итог одной отправки.

    ok=False — движок не пишет ответ в историю: иначе бот считает,
    что ответил, и молчит навсегда. error — для журнала, не для клиента.
    """

    ok: bool
    error: str | None = None
    external_message_id: str | None = None


class Sender(Protocol):
    """Отправить текст клиенту в канале. Исключения наружу не поднимать —
    отказ возвращается как SendResult(ok=False, error=...)."""

    async def send(self, *, channel: str, external_id: str, text: str) -> SendResult: ...
