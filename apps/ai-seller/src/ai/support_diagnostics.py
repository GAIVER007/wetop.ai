"""Инструменты диагностики техподдержки (S5): каналы продаж, бронь по номеру, сводка «с чего начать».

Вынесены из support_tools.py ради предела ~300 строк на файл.

🔴 Аргументов «кто» и «какая организация» у инструментов нет: человек и организация берутся из подписи посетителя,
которую проверил канал; лишний аргумент отвергает реестр. Единственный аргумент — номер брони, который назвал сам
человек; он проверяется по форме до обращения к платформе.

🔴 Модели уходит текст, собранный по белому списку полей. Имя и телефон гостя, заметки, суммы, ключи и адреса
Channex, внутренние id — им здесь взяться неоткуда, что бы сервер ни добавил в ответ.

🔴 Сводка собирается из частей, и каждая часть может быть «не знаю» отдельно: сбой одной проверки не прячет остальные
и не превращается в «всё работает».
"""

from __future__ import annotations

import logging
import re
from datetime import timedelta
from typing import Any, Callable

from src.ai.support_diagnostics_text import _clean, _dict, integration_text, reservation_text
from src.ai.tools import ToolRegistry, ToolSpec
from src.db.base import utcnow
from src.integrations.failure_log import log_provider_failure

logger = logging.getLogger(__name__)

_NO_PARAMS: dict[str, Any] = {"type": "object", "properties": {}, "required": []}
_NUMBER = re.compile(r"^[A-Za-z0-9_-]{1,40}$")
_BAD_NUMBER = "номер брони — буквы, цифры, дефис или подчёркивание, до 40 знаков; уточните номер у человека"
_NOT_MEMBER = "не нашёл вас среди сотрудников этой организации: проверить не могу"
_NOT_FOUND = "не нашёл бронь с таким номером у вашей организации"

def register_diagnostics_tools(
    registry: ToolRegistry,
    *,
    providers_getter: Callable[[], Any],
    visitor_getter: Callable[[], Any],
    settings_getter: Callable[[], Any],
    rules: str = "",
    unknown: str = "не знаю",
    not_signed: str = "не вошли",
) -> None:
    def _scope() -> tuple[str, str] | None:
        """(user_id, org_id) из подписи посетителя или None — анонима к платформе не пускаем."""
        try:
            visitor = visitor_getter()
        except Exception:
            logger.exception("диагностика: посетитель не получен")
            return None
        if visitor is None or not getattr(visitor, "signed", False):
            return None
        user_id, org_id = getattr(visitor, "user_id", None), getattr(visitor, "org_id", None)
        return (str(user_id), str(org_id)) if user_id and org_id else None

    def _source(name: str) -> Any | None:
        try:
            providers = providers_getter()
        except Exception as exc:
            log_provider_failure(logger, "диагностика: провайдеры", exc)
            return None
        return getattr(providers, name, None) if providers else None

    async def _integration(scope: tuple[str, str]) -> tuple[str, str]:
        source = _source("diagnostics")
        if source is None:
            return unknown, unknown
        try:
            body = await source.integration_health(user_id=scope[0], org_id=scope[1])
        except Exception as exc:
            log_provider_failure(logger, "get_integration_health", exc)
            return unknown, unknown
        if body is None:
            return _NOT_MEMBER, _NOT_MEMBER
        return integration_text(_dict(body))

    async def get_integration_health() -> str:
        scope = _scope()
        if scope is None:
            return not_signed
        return (await _integration(scope))[0]

    async def get_reservation_status(number: str) -> str:
        scope = _scope()
        if scope is None:
            return not_signed
        clean = str(number or "").strip()
        if not _NUMBER.match(clean):
            return _BAD_NUMBER
        source = _source("diagnostics")
        if source is None:
            return unknown
        try:
            body = await source.reservation_status(user_id=scope[0], org_id=scope[1], number=clean)
        except Exception as exc:
            log_provider_failure(logger, "get_reservation_status", exc)
            return unknown
        if body is None:
            return _NOT_FOUND
        return reservation_text(_dict(body))

    async def _account(scope: tuple[str, str]) -> str:
        source = _source("requesters")
        if source is None:
            return unknown
        try:
            ctx = await source.requester_context(user_id=scope[0], org_id=scope[1])
        except Exception as exc:
            log_provider_failure(logger, "get_workspace_health: аккаунт", exc)
            return unknown
        account = _dict(_dict(ctx).get("account"))
        status = _clean(account.get("status"), 20)
        if not status:
            return unknown
        can = account.get("canMutate")
        return status + (" (данные можно менять)" if can is True else " (менять данные нельзя)" if can is False else "")

    async def _platform() -> str:
        source = _source("health")
        if source is None:
            return unknown
        try:
            report = await source.status()
        except Exception as exc:
            log_provider_failure(logger, "get_workspace_health: платформа", exc)
            return unknown
        degraded = [str(one).strip() for one in (getattr(report, "degraded", None) or []) if str(one).strip()]
        if degraded:
            return "есть сбои: " + ", ".join(degraded)
        return "всё работает" if getattr(report, "ok", False) else "есть сбои: раздел не назван"

    async def _errors(scope: tuple[str, str]) -> str:
        try:
            settings = settings_getter()
        except Exception:
            settings = None
        hours = int(getattr(settings, "support_incident_window_hours", 24) or 24)
        limit = int(getattr(settings, "support_max_incidents", 5) or 5)
        source = _source("incidents")
        if source is None:
            return unknown
        try:
            items = await source.recent_for_user(
                user_id=scope[0], org_id=scope[1], since=utcnow() - timedelta(hours=hours), limit=limit
            )
        except Exception as exc:
            log_provider_failure(logger, "get_workspace_health: ошибки", exc)
            return unknown
        items = list(items or [])
        if not items:
            return f"за последние {hours} ч ошибок у вас не записано"
        last = items[0]
        at = getattr(last, "at", None)
        when = at.strftime("%d.%m %H:%M") + " UTC" if at is not None else "время неизвестно"
        section = _clean(getattr(last, "section", ""), 30)
        summary = _clean(getattr(last, "summary", ""), 80) or "без описания"
        return f"за {hours} ч: {len(items)} (последняя: {when}, {section + ': ' if section else ''}{summary})"

    async def get_workspace_health() -> str:
        scope = _scope()
        if scope is None:
            return not_signed
        parts = [
            f"Аккаунт: {await _account(scope)}",
            f"Платформа: {await _platform()}",
            f"Каналы: {(await _integration(scope))[1]}",
            f"Ошибок {await _errors(scope)}",
        ]
        return ". ".join(parts) + "."

    registry.register(
        ToolSpec(
            name="get_integration_health",
            description=(
                "Состояние каналов продаж (Channex) у организации обратившегося: сопоставление категорий и тарифов,"
                " последнее событие из канала, очередь изменений, webhook и список проблем словами. Без аргументов:"
                " организация берётся из подписи. «Не подключены» — это не поломка." + rules
            ),
            parameters=dict(_NO_PARAMS),
            handler=get_integration_health,
        )
    )
    registry.register(
        ToolSpec(
            name="get_reservation_status",
            description=(
                "Состояние брони по номеру, который назвал человек: статус, даты, проживания и ячейки, проблемы"
                " словами. Ищет только среди броней его организации. Имени и телефона гостя не возвращает." + rules
            ),
            parameters={
                "type": "object",
                "properties": {"number": {"type": "string", "description": "Номер брони, как его назвал человек"}},
                "required": ["number"],
            },
            handler=get_reservation_status,
        )
    )
    registry.register(
        ToolSpec(
            name="get_workspace_health",
            description=(
                "Сводка «с чего начать» по обратившемуся: состояние аккаунта, платформы, каналов продаж и число его"
                " ошибок за окно из настроек. Зови первым при жалобе «ничего не работает». Каждая часть может быть"
                " «не знаю» отдельно — так и передай." + rules
            ),
            parameters=dict(_NO_PARAMS),
            handler=get_workspace_health,
        )
    )
