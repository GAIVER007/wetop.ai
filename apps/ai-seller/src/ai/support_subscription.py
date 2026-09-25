"""Инструмент техподдержки «организация и подписка» (С5, Q-187; ADR-086).

Вынесен из support_tools.py ради предела ~300 строк на файл. Подпись
выигрывает у названного ID: вошедший видит только свою организацию, чужой
UUID в аргументе чужую подписку не открывает. Обращению без подписи нужен
ID организации (UUID, точное совпадение). Денег и данных гостей в ответе
нет; возврат оплаты и продление — заявка владельцу, не действие бота.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Callable

from src.ai.tools import ToolRegistry, ToolSpec

logger = logging.getLogger(__name__)



def _providers(getter: Callable[[], Any]) -> Any:
    try:
        return getter()
    except Exception:
        logger.exception("my_subscription: провайдеры не получены")
        return None


def register_subscription_tool(
    registry: ToolRegistry,
    *,
    providers_getter: Callable[[], Any],
    visitor_getter: Callable[[], Any],
    rules: str = "",
    unknown: str = "не знаю",
) -> None:
    # Слова правил и «не знаю» приходят из support_tools: у всех инструментов
    # помощника они одни, а импорт отсюда дал бы круг.
    _RULES, UNKNOWN = rules, unknown
    _UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
    NAME_ID = "Назовите, пожалуйста, ID организации (его видно в разделе подписки платформы) — найду точным совпадением."

    def _date_words(value: object) -> str:
        text = str(value or "")[:10]
        try:
            return datetime.strptime(text, "%Y-%m-%d").strftime("%d.%m.%Y")
        except ValueError:
            return text

    def _card_text(card: dict) -> str:
        lines = [f"Организация: {card.get('name')}"]
        ai = card.get("aiSeller") if isinstance(card.get("aiSeller"), dict) else {}
        access = str(ai.get("access") or "off")
        until = ai.get("activeUntil")
        if access == "active":
            lines.append(
                "Расширение «ИИ-продавец» действует"
                + (f" до {_date_words(until)}" if until else " (бессрочно)")
                + "."
            )
        elif access == "expired":
            lines.append(
                "Срок расширения «ИИ-продавец» истёк"
                + (f" {_date_words(until)}" if until else "")
                + ": раздел только для чтения. Продление — заявкой владельцу платформы."
            )
        else:
            lines.append("Расширение «ИИ-продавец» не подключено.")
        created = str(card.get("createdAt") or "")[:10]
        if created:
            lines.append(f"В платформе с {_date_words(created)}.")
        return " ".join(lines)

    async def my_subscription(organization_id: str | None = None) -> str:
        # 🔴 Подпись выигрывает у названного ID: вошедший видит свою
        # организацию, чужой UUID в аргументе не открывает чужую подписку.
        visitor = None
        try:
            visitor = visitor_getter()
        except Exception:
            logger.exception("my_subscription: посетитель не получен")
        org: str | None = None
        if visitor is not None and getattr(visitor, "signed", False):
            org = getattr(visitor, "org_id", None)
        if not org:
            named = str(organization_id or "").strip().lower()
            if not named or not _UUID_RE.match(named):
                return NAME_ID
            org = named

        providers = _providers(providers_getter)
        source = getattr(providers, "subscriptions", None) if providers else None
        if source is None:
            return UNKNOWN
        try:
            card = await source.organization_card(org)
        except Exception:
            logger.exception("my_subscription: карточка организации не получена")
            return UNKNOWN
        if card is None:
            return "Организация с таким ID не найдена — проверьте, пожалуйста, точное значение."
        return _card_text(card)

    registry.register(
        ToolSpec(
            name="my_subscription",
            description=(
                "Организация и подписка клиента: название, действует ли"
                " расширение «ИИ-продавец» и до какой даты, с какого дня"
                " клиент в платформе. Для вошедшего берётся ЕГО организация"
                " по подписи; обращению без подписи нужен ID организации"
                " (UUID, точное совпадение). Денег и данных гостей не"
                " возвращает. Возврат оплаты и продление сам не делает —"
                " только заявка владельцу платформы." + _RULES
            ),
            parameters={
                "type": "object",
                "properties": {
                    "organization_id": {
                        "type": "string",
                        "description": "ID организации (UUID) — только если человек назвал его сам",
                    }
                },
                "required": [],
            },
            handler=my_subscription,
        )
    )
