"""S4: инструменты «кто спрашивает» для роли «помощник платформы» (plans/ai-agents-s4-requester-context-2026-09-29.md).

Три инструмента без параметров: `get_requester_context`, `get_account_status`, `get_permissions`. Человека и организацию
берёт только подпись посетителя (`Visitor`): то, что модель передала аргументом, игнорируется, поэтому подставить чужой
`organizationId` она не может. Роль и права считает платформа по членству в своей базе — бот пересказывает ответ.

🔴 Аноним и неподписанный признак — «не вошли», в платформу такой запрос не уходит.
🔴 Сбой платформы, неизвестная пара и битый ответ — один честный «не знаю», без исключений наружу.
🔴 Из ответа берём только разобранные поля: названия, статусы, слова роли и прав. Почта приходит уже маской.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

from src.ai.tools import ToolRegistry, ToolSpec
from src.integrations.failure_log import log_provider_failure

logger = logging.getLogger(__name__)

_NO_PARAMS: dict[str, Any] = {"type": "object", "properties": {}, "required": []}

_VERTICALS = {"HOSPITALITY": "Hospitality", "BEAUTY": "Beauty"}
_ORG_STATUS = {
    "ACTIVE": "активна",
    "TRIAL": "пробный период",
    "SUSPENDED": "приостановлена",
    "ARCHIVED": "в архиве",
}


def _text(value: object) -> str:
    return str(value or "").strip()


def _names(items: object, limit: int = 20) -> list[str]:
    out: list[str] = []
    for item in items if isinstance(items, list) else []:
        label = _text(item.get("label") if isinstance(item, dict) else None)
        if label:
            out.append(label)
    return out[:limit]


def _requester_text(ctx: dict) -> str:
    user = ctx.get("user") if isinstance(ctx.get("user"), dict) else {}
    role = ctx.get("role") if isinstance(ctx.get("role"), dict) else {}
    org = ctx.get("organization") if isinstance(ctx.get("organization"), dict) else {}
    who = _text(user.get("name")) or "имя не указано"
    email = _text(user.get("email"))
    lines = [
        f"Пишет: {who}" + (f" ({email})" if email else "") + f", роль: {_text(role.get('label')) or 'не определена'}.",
        f"Организация: {_text(org.get('name'))}.",
    ]
    for business in (ctx.get("businesses") if isinstance(ctx.get("businesses"), list) else [])[:10]:
        if not isinstance(business, dict):
            continue
        vertical = _VERTICALS.get(_text(business.get("vertical")), _text(business.get("vertical")))
        locations = [
            _text(loc.get("name"))
            for loc in (business.get("locations") if isinstance(business.get("locations"), list) else [])
            if isinstance(loc, dict) and _text(loc.get("name"))
        ]
        line = f"Бизнес: {_text(business.get('name'))} ({vertical})"
        if locations:
            line += "; филиалы: " + ", ".join(locations[:20])
        lines.append(line + ".")
    return "\n".join(lines)


def _status_text(ctx: dict) -> str:
    org = ctx.get("organization") if isinstance(ctx.get("organization"), dict) else {}
    sub = ctx.get("subscription") if isinstance(ctx.get("subscription"), dict) else {}
    seller = sub.get("aiSeller") if isinstance(sub.get("aiSeller"), dict) else {}
    status = _ORG_STATUS.get(_text(org.get("status")), "статус не определён")
    summary = _text(seller.get("summary")) or "Состояние расширения «ИИ-продавец» платформа не назвала."
    return f"Организация {_text(org.get('name'))}: {status}. {summary}"


def _permissions_text(ctx: dict) -> str:
    role = ctx.get("role") if isinstance(ctx.get("role"), dict) else {}
    perms = ctx.get("permissions") if isinstance(ctx.get("permissions"), dict) else {}
    allowed = _names(
        [{"label": p.get("label")} for p in perms.get("allowed", []) if isinstance(p, dict)]
    )
    denied = _names(
        [{"label": p.get("label")} for p in perms.get("denied", []) if isinstance(p, dict)]
    )
    human = [_text(x) for x in perms.get("humanOnly", []) if _text(x)]
    lines = [f"Роль: {_text(role.get('label'))}."]
    lines.append("Можно: " + (", ".join(allowed) if allowed else "ничего") + ".")
    lines.append("Нельзя: " + (", ".join(denied) if denied else "ограничений нет") + ".")
    if human:
        lines.append("Решает только человек, а не помощник: " + "; ".join(human) + ".")
    lines.append("Помощник не выдаёт права и не меняет роль: это делает владелец организации.")
    return "\n".join(lines)


def register_context_tools(
    registry: ToolRegistry,
    *,
    providers_getter: Callable[[], Any],
    visitor_getter: Callable[[], Any],
    rules: str,
    unknown: str,
    not_signed: str,
) -> None:
    async def _context(tool: str) -> tuple[dict | None, str | None]:
        """(контекст, None) или (None, ответ вместо контекста)"""
        visitor = None
        try:
            visitor = visitor_getter()
        except Exception:
            logger.exception("%s: посетитель не получен", tool)
        user_id = getattr(visitor, "user_id", None) if visitor is not None else None
        org_id = getattr(visitor, "org_id", None) if visitor is not None else None
        if visitor is None or not getattr(visitor, "signed", False) or not user_id or not org_id:
            return None, not_signed
        try:
            providers = providers_getter()
        except Exception as exc:
            log_provider_failure(logger, f"{tool}: провайдеры", exc)
            return None, unknown
        source = getattr(providers, "requesters", None) if providers else None
        if source is None:
            return None, unknown
        try:
            ctx = await source.requester_context(user_id=user_id, org_id=org_id)
        except Exception as exc:
            log_provider_failure(logger, tool, exc)
            return None, unknown
        if not isinstance(ctx, dict):
            return None, unknown
        return ctx, None

    def make(tool: str, render: Callable[[dict], str]):
        async def handler(**_ignored: Any) -> str:
            # 🔴 Аргументы модели отброшены: человек и организация — только из подписи посетителя.
            ctx, reply = await _context(tool)
            if ctx is None:
                return reply or unknown
            try:
                return render(ctx)
            except Exception:
                logger.exception("%s: ответ платформы не разобран", tool)
                return unknown

        return handler

    specs = [
        (
            "get_requester_context",
            "Кто сейчас пишет: имя, роль в организации, организация, бизнесы и филиалы."
            " Аргументов нет: человека определяет подпись входа. Возвращает текст или «не знаю»"
            " или сообщение, что человек не вошёл.",
            _requester_text,
        ),
        (
            "get_account_status",
            "Статус организации того, кто пишет, и подписка на расширение «ИИ-продавец» (действует,"
            " истекло, не подключено, срок). Аргументов нет. Продление и возврат оплаты помощник не делает.",
            _status_text,
        ),
        (
            "get_permissions",
            "Что можно и нельзя роли того, кто пишет, и какие решения принимает только человек."
            " Аргументов нет. Отвечай ровно по этому списку: права не выдумывай и не обещай.",
            _permissions_text,
        ),
    ]
    for name, description, render in specs:
        registry.register(
            ToolSpec(
                name=name,
                description=description + rules,
                parameters=dict(_NO_PARAMS),
                handler=make(name, render),
            )
        )
