"""[КЛИЕНТ] Инструменты модели для роли «помощник платформы».

Ядро (ToolRegistry, providers.py) не трогаем: здесь только сборка реестра под
платформу WETOP. Образец устройства — src/ai/hotel_tools.py, правила те же.

🔴 Бот не выдумывает причину ошибки. Не нашли в справочнике и в журнале —
инструмент отвечает «не знаю», и модель обязана сказать это человеку.
Выдуманное объяснение хуже молчания: по нему пойдут что-то чинить.

🔴 Никаких исключений наружу: недоступный провайдер, отсутствующий файл
справочника и кривые аргументы дают один и тот же признак. Исключение отсюда
уронило бы ход, а человеку нужен ответ.

🔴 Человек видит только СВОИ происшествия: поиск идёт по подписанному
признаку пользователя. Аноним не получает из журнала платформы ничего.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import timedelta
from typing import Any

from src.ai.tools import ToolRegistry, ToolSpec
from src.ai.support_actions import register_action_tools
from src.ai.support_context import register_context_tools
from src.ai.support_diagnostics import register_diagnostics_tools
from src.ai.support_kb_tool import register_kb_tool
from src.ai.support_subscription import register_subscription_tool
from src.db.base import utcnow
from src.integrations.failure_log import log_provider_failure
from src.knowledge.catalog import CatalogMissing, ErrorEntry, find_by_code, find_by_text, load_catalog

logger = logging.getLogger(__name__)

# Единственный ответ на все виды «не знаю»: та же честная фраза, что
# у инструментов продавца, только зовём специалиста, а не администратора.
UNKNOWN = "не знаю: уточнит человек"
# Отдельный ответ анониму: это не «не знаю», а «нечего показывать».
NOT_SIGNED = "не могу посмотреть: вы не вошли в платформу"
ALL_OK = "всё работает"


def no_incidents(hours: int) -> str:
    """«Ошибок нет» с тем окном, которое ДЕЙСТВИТЕЛЬНО проверили.

    Окно берётся из настроек владельца: зашитые «сутки» при окне в три часа
    означали бы, что бот называет фактом то, чего не смотрел.
    """
    return f"за последние {hours} ч ошибок у вас не записано"

# Хвост описания, общий для всех трёх инструментов. Это правило для модели,
# а не для кода: без него модель на «не знаю» сочиняет правдоподобную причину.
_RULES = (
    " Если инструмент ответил «не знаю» — так и скажи человеку и предложи"
    " позвать специалиста. НЕ придумывай причину ошибки и не обещай, что"
    " что-то уже починено."
)

_NO_PARAMS: dict[str, Any] = {"type": "object", "properties": {}, "required": []}


def _settings(settings_getter: Callable[[], Any]) -> Any | None:
    """Настройки или None: сбой чтения настроек не должен ронять ход."""
    try:
        return settings_getter()
    except Exception:
        logger.exception("инструмент помощника: настройки не прочитаны")
        return None


def _providers(providers_getter: Callable[[], Any]) -> Any | None:
    """Набор провайдеров или None: сбой фабрики — это «не знаю», не падение."""
    try:
        return providers_getter()
    except Exception as exc:
        log_provider_failure(logger, "инструмент помощника: провайдеры", exc)
        return None


def _entry_text(entry: ErrorEntry) -> str:
    """Запись справочника -> строка для модели. Только разобранные поля:
    сырой текст записи мог бы протащить в ответ что угодно, включая
    инструкцию, спрятанную в документе."""
    parts = [f"ситуация: {entry.title}"]
    if entry.section:
        parts.append(f"раздел: {entry.section}")
    parts.append(f"причина: {entry.cause}")
    parts.append(f"что делать: {entry.action}")
    parts.append(f"состояние: {entry.status}")
    return "; ".join(parts)


def _incident_text(incident: Any) -> str:
    """Происшествие -> строка для модели.

    🔴 Берём только время, раздел и короткое описание. Ни ref во внутреннюю
    систему, ни kind как имя класса ошибки человеку не нужны, а трассировки
    в summary быть не должно уже на стороне провайдера.
    """
    at = getattr(incident, "at", None)
    # Зона названа прямо: метки в UTC, а человек платформы живёт в UTC+5/+6
    # и без пометки сверит свои действия со временем, сдвинутым на часы.
    when = at.strftime("%d.%m %H:%M") + " UTC" if at is not None else "время неизвестно"
    section = str(getattr(incident, "section", "") or "").strip()
    summary = str(getattr(incident, "summary", "") or "").strip() or "без описания"
    return f"{when}, {section}: {summary}" if section else f"{when}: {summary}"


def build_registry(
    providers_getter: Callable[[], Any],
    *,
    settings_getter: Callable[[], Any],
    visitor_getter: Callable[[], Any],
    knowledge_getter: Callable[[], Any] | None = None,
    conversation_getter: Callable[[], str | None] | None = None,
    actions_getter: Callable[[], Any] | None = None,
) -> ToolRegistry:
    """Реестр инструментов помощника (ошибки, подписка, кто обратился, состояние платформы).

    visitor_getter отдаёт текущего Visitor (канал кладёт его в contextvar).
    Так инструменты знают, кто спрашивает, а движок про платформу не знает.
    """

    async def find_error(message: str, code: str | None = None) -> str:
        settings = _settings(settings_getter)
        if settings is None:
            return UNKNOWN
        path = getattr(settings, "errors_catalog_path", "") or ""
        try:
            entries = load_catalog(path)
        except CatalogMissing:
            # Файла нет — это недонастройка, а не повод выдумывать причину.
            logger.warning("find_error: справочник ошибок не найден")
            return UNKNOWN
        except Exception:
            logger.exception("find_error: справочник ошибок не прочитан")
            return UNKNOWN

        found: ErrorEntry | None = None
        wanted = str(code or "").strip()
        if wanted:
            found = find_by_code(entries, wanted)
        if found is not None:
            return _entry_text(found)
        # 🔴 Кода не было или он не нашёлся — ищем по тексту: у платформы
        # кодов ошибок нет, человек приносит сообщение словами.
        text = str(message or "").strip()
        if not text:
            return UNKNOWN
        matches = find_by_text(entries, text, limit=3)
        if not matches:
            # Похожего нет — так и говорим. Ближайшая по смыслу запись здесь
            # была бы догадкой, а человек примет её за ответ.
            return UNKNOWN
        return " | ".join(_entry_text(entry) for entry in matches)

    async def my_recent_errors() -> str:
        visitor = None
        try:
            visitor = visitor_getter()
        except Exception:
            logger.exception("my_recent_errors: посетитель не получен")
        # 🔴 Аноним и неподписанный признак — одно и то же: журнал платформы
        # ему не показывается никогда, даже пустой. Пустой user_id при подписи —
        # тоже отказ: иначе запрос уйдёт с user_id=None и вернёт чужие записи.
        if visitor is None or not getattr(visitor, "signed", False):
            return NOT_SIGNED
        user_id = getattr(visitor, "user_id", None)
        if not user_id:
            return NOT_SIGNED

        settings = _settings(settings_getter)
        providers = _providers(providers_getter)
        source = getattr(providers, "incidents", None) if providers else None
        if settings is None or source is None:
            return UNKNOWN

        hours = int(getattr(settings, "support_incident_window_hours", 24) or 24)
        limit = int(getattr(settings, "support_max_incidents", 5) or 5)
        since = utcnow() - timedelta(hours=hours)
        try:
            incidents = await source.recent_for_user(
                user_id=user_id,
                org_id=getattr(visitor, "org_id", None),
                since=since,
                limit=limit,
            )
        except Exception as exc:
            # 🔴 Причина — в журнал, и штатная недоступность без трассировки.
            # Модели только признак: текст чужой ошибки человеку не уходит.
            log_provider_failure(logger, "my_recent_errors", exc)
            return UNKNOWN
        if not incidents:
            return no_incidents(hours)
        # Предел режем здесь тоже: провайдер мог его не соблюсти, а длинный
        # список ошибок в ответе бота читать невозможно.
        return "; ".join(_incident_text(one) for one in list(incidents)[:limit])

    async def platform_status() -> str:
        providers = _providers(providers_getter)
        source = getattr(providers, "health", None) if providers else None
        if source is None:
            # 🔴 Именно «не знаю», а не «всё работает»: молчаливое «всё
            # хорошо» неотличимо от незнания, и человек с поломанной
            # платформой уйдёт искать причину у себя.
            return UNKNOWN
        try:
            report = await source.status()
        except Exception as exc:
            log_provider_failure(logger, "platform_status", exc)
            return UNKNOWN
        if report is None:
            return UNKNOWN
        degraded = [str(one).strip() for one in (getattr(report, "degraded", None) or [])]
        degraded = [one for one in degraded if one]
        if degraded:
            return "есть сбои: " + ", ".join(degraded)
        if getattr(report, "ok", False):
            return ALL_OK
        # Не ok, а разделы не названы: сказать «всё работает» нельзя.
        return "есть сбои: раздел не назван"

    registry = ToolRegistry()
    registry.register(
        ToolSpec(
            name="find_error",
            description=(
                "Найти в справочнике платформы известную ошибку по тексту"
                " сообщения, которое увидел человек. Возвращает причину,"
                " что делать и состояние (ожидаемое поведение, известный"
                " дефект, чинится, исправлено) или «не знаю»."
                " У платформы кодов ошибок нет, ищи по тексту; code"
                " передавай, только если человек сам назвал код." + _RULES
            ),
            parameters={
                "type": "object",
                "properties": {
                    "message": {
                        "type": "string",
                        "description": "Текст сообщения об ошибке, как его видел человек",
                    },
                    "code": {
                        "type": ["string", "null"],
                        "description": "Код ошибки, если человек его назвал",
                    },
                },
                "required": ["message"],
            },
            handler=find_error,
        )
    )
    registry.register(
        ToolSpec(
            name="my_recent_errors",
            description=(
                "Последние ошибки ЭТОГО пользователя в платформе за окно"
                " из настроек владельца."
                " Возвращает время (UTC), раздел и короткое описание, либо «не"
                " знаю», либо сообщение, что человек не вошёл в платформу."
                " Чужие ошибки этот инструмент не показывает." + _RULES
            ),
            parameters=dict(_NO_PARAMS),
            handler=my_recent_errors,
        )
    )
    register_subscription_tool(
        registry,
        providers_getter=providers_getter,
        visitor_getter=visitor_getter,
        rules=_RULES,
        unknown=UNKNOWN,
    )
    register_kb_tool(
        registry, knowledge_getter=knowledge_getter or (lambda: None), settings_getter=settings_getter,
        conversation_getter=conversation_getter or (lambda: None), rules=_RULES, unknown=UNKNOWN)
    register_context_tools(registry, providers_getter=providers_getter, visitor_getter=visitor_getter,
                           rules=_RULES, unknown=UNKNOWN, not_signed=NOT_SIGNED)
    registry.register(
        ToolSpec(
            name="platform_status",
            description=(
                "Общее состояние платформы: «всё работает», список разделов со сбоями или «не знаю»."
                " «Не знаю» НЕ означает, что всё хорошо: так и скажи, что проверить не удалось." + _RULES
            ),
            parameters=dict(_NO_PARAMS),
            handler=platform_status,
        )
    )
    register_diagnostics_tools(
        registry, providers_getter=providers_getter, visitor_getter=visitor_getter,
        settings_getter=settings_getter, rules=_RULES, unknown=UNKNOWN, not_signed=NOT_SIGNED,
    )
    register_action_tools(
        registry, providers_getter=providers_getter, visitor_getter=visitor_getter,
        conversation_getter=conversation_getter or (lambda: None), actions_getter=actions_getter or (lambda: None),
        rules=_RULES, unknown=UNKNOWN, not_signed=NOT_SIGNED,
    )
    return registry
