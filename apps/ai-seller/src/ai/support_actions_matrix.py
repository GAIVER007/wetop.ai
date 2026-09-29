"""Матрица возможностей WETOP Support (S6): что бот делает сам, что после «да», что только человек.

Источник правды для инструментов, кабинета и отчёта (plans/ai-agents-s6-actions-2026-09-29.md §2); тест сверяет с
таблицей плана. Ни одно действие не принимает организацию или человека от модели — область из подписи посетителя.

🔴 Деньги, права, отключение организации, удаление данных, массовые правки броней — только человек. Бот их не
выполняет и не обещает: ставит диалогу «нужен человек» и пишет в журнал.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass


class ActionClass(str, enum.Enum):
    SAFE = "SAFE"
    CONFIRM = "CONFIRM"
    HUMAN_ONLY = "HUMAN_ONLY"


@dataclass(frozen=True)
class ActionSpec:
    name: str
    action_class: ActionClass
    #: короткое название для журнала и оператора
    title: str
    #: что произойдёт — словами, которые бот повторит человеку
    description: str
    #: право обратившегося в платформе, без него платформа отвечает отказом; None у HUMAN_ONLY
    permission: str | None = None
    #: адрес действия у платформы; None у HUMAN_ONLY
    route: str | None = None


CHANNEL_SYNC_DAYS = 90

_SPECS = (
    ActionSpec(
        "channel_pull", ActionClass.SAFE, "лента Channex подтянута",
        "подтянуть из ленты Channex неподтверждённые ревизии броней и обработать их; повтор безопасен",
        permission="channels", route="/assistant/actions/channel-pull",
    ),
    ActionSpec(
        "channel_sync", ActionClass.CONFIRM, "полная выгрузка в Channex",
        f"полная выгрузка остатков и ограничений в Channex на {CHANNEL_SYNC_DAYS} дней вперёд: каналы продаж получат "
        "текущие остатки заново",
        permission="channels", route="/assistant/actions/channel-sync",
    ),
    ActionSpec("refund", ActionClass.HUMAN_ONLY, "возврат оплаты", "возврат оплаты, сторно, спор по платежу"),
    ActionSpec("subscription", ActionClass.HUMAN_ONLY, "подписка", "тариф, продление, подключение и отключение расширений"),
    ActionSpec(
        "organization_disable", ActionClass.HUMAN_ONLY, "отключение организации",
        "приостановка, отключение или удаление организации",
    ),
    ActionSpec(
        "owner_rights", ActionClass.HUMAN_ONLY, "права и роли",
        "права владельца, смена ролей, приглашения и удаление сотрудников от имени другого человека",
    ),
    ActionSpec("data_delete", ActionClass.HUMAN_ONLY, "удаление данных", "удаление гостей, документов, броней, истории"),
    ActionSpec(
        "reservations_bulk", ActionClass.HUMAN_ONLY, "массовые правки броней",
        "массовые переселения, отмены, смена дат и цен по многим броням",
    ),
    ActionSpec("other_human", ActionClass.HUMAN_ONLY, "другое", "всё, чего нет в матрице и что меняет данные"),
)

MATRIX: dict[str, ActionSpec] = {spec.name: spec for spec in _SPECS}
HUMAN_KINDS: tuple[str, ...] = tuple(s.name for s in _SPECS if s.action_class is ActionClass.HUMAN_ONLY)

CLASS_WORDS = {
    ActionClass.SAFE: "делаю сам",
    ActionClass.CONFIRM: "делаю после подтверждения человека",
    ActionClass.HUMAN_ONLY: "только человек",
}


def capabilities_text() -> str:
    """Матрица словами для модели: имя действия, класс, что произойдёт."""
    lines = []
    for spec in _SPECS:
        lines.append(f"{spec.name} — {CLASS_WORDS[spec.action_class]}: {spec.description}")
    return "Что я могу. " + "; ".join(lines) + "."


def _int(value: object) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def result_text(action: str, body: dict) -> str:
    """Результат платформы → слова. Только числа из белого списка."""
    if action == "channel_pull":
        received, processed, failed = _int(body.get("received")), _int(body.get("processed")), _int(body.get("failed"))
        parts = []
        if received is not None:
            parts.append(f"ревизий получено {received}")
        if processed is not None:
            parts.append(f"обработано {processed}")
        if failed is not None:
            parts.append(f"со сбоем {failed}")
        return ", ".join(parts) if parts else "без подробностей"
    if action == "channel_sync":
        queued, days = _int(body.get("queued")), _int(body.get("days"))
        text = f"в очередь поставлено {queued} строк" if queued is not None else "поставлено в очередь"
        return text + (f" на {days} дней" if days is not None else "")
    return "без подробностей"
