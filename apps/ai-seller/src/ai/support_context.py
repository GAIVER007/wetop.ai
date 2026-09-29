"""Инструменты техподдержки «кто обратился» (S4): контекст, состояние аккаунта, права.

Вынесены из support_tools.py ради предела ~300 строк на файл.

🔴 У инструментов НЕТ аргументов «кто» и «какая организация». Человек и организация берутся из подписи
посетителя, которую проверил канал; модель их не называет и подставить не может (лишний аргумент отвергает
реестр). Платформа сверяет пару с членством ещё раз.

🔴 Модели уходит текст, собранный по белому списку полей. Почты, телефона, имени, внутренних id, псевдонима
человека, ключей и всего, что сервер добавит в ответ сверх контракта, здесь взять неоткуда. Названия организации,
бизнеса и филиала пишут люди: они сплющиваются в одну строку и режутся по длине — это данные, не инструкции.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Callable

from src.ai.tools import ToolRegistry, ToolSpec

logger = logging.getLogger(__name__)

_ROLES = {"owner": "владелец", "manager": "управляющий", "staff": "администратор"}
_VERTICALS = {"HOSPITALITY": "гостиничный бизнес", "BEAUTY": "салонный бизнес"}
# Названия прав — как в таблице ролей платформы (packages/domain, accounts/permissions.ts)
_PERMISSIONS = {
    "self": "своя учётная запись",
    "desk": "работа с гостями",
    "dialogs": "диалоги ИИ-продавца",
    "reports": "статистика и оплаты",
    "refunds": "возврат оплаты и сторно",
    "property": "номерной фонд",
    "rates": "тарифы и цены",
    "channels": "каналы продаж",
    "settings": "настройки гостиницы",
    "journal": "журнал действий",
    "seller": "настройки ИИ-продавца",
    "staff": "сотрудники и приглашения",
    "owner": "управляющие, роли и платные расширения",
}
_ACCOUNT = {
    "ACTIVE": "активен: данные можно менять",
    "TRIAL": "пробный период: данные можно менять до конца срока",
    "READ_ONLY": "режим «только чтение»: данные видны, менять их нельзя",
    "SUSPENDED": "организация приостановлена: менять данные нельзя",
}
_REASONS = {
    "TRIAL_ENDED": "пробный период закончился",
    "READ_ONLY_BY_PLATFORM": "режим «только чтение» включила платформа",
    "SUSPENDED": "организация приостановлена платформой",
}
_NO_PARAMS: dict[str, Any] = {"type": "object", "properties": {}, "required": []}
_NOT_MEMBER = "не нашёл вас среди сотрудников этой организации: проверить контекст не могу"


def _clean(value: object, limit: int = 80) -> str:
    """Название от человека -> одна короткая строка без переводов строк."""
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text[:limit] + "…" if len(text) > limit else text


def _date(value: object) -> str:
    text = str(value or "")[:10]
    try:
        return datetime.strptime(text, "%Y-%m-%d").strftime("%d.%m.%Y")
    except ValueError:
        return ""


def _dict(value: object) -> dict:
    return value if isinstance(value, dict) else {}


def register_context_tools(
    registry: ToolRegistry,
    *,
    providers_getter: Callable[[], Any],
    visitor_getter: Callable[[], Any],
    rules: str = "",
    unknown: str = "не знаю",
    not_signed: str = "не вошли",
) -> None:
    async def _load() -> tuple[dict | None, str | None]:
        """(контекст, None) или (None, слово-отказ). Область — только из подписи посетителя."""
        try:
            visitor = visitor_getter()
        except Exception:
            logger.exception("контекст обратившегося: посетитель не получен")
            visitor = None
        user_id = getattr(visitor, "user_id", None) if visitor is not None else None
        org_id = getattr(visitor, "org_id", None) if visitor is not None else None
        if visitor is None or not getattr(visitor, "signed", False) or not user_id or not org_id:
            return None, not_signed
        try:
            providers = providers_getter()
        except Exception:
            logger.exception("контекст обратившегося: провайдеры не получены")
            return None, unknown
        source = getattr(providers, "requesters", None) if providers else None
        if source is None:
            return None, unknown
        try:
            ctx = await source.requester_context(user_id=user_id, org_id=org_id)
        except Exception:
            logger.exception("контекст обратившегося: платформа не ответила")
            return None, unknown
        if ctx is None:
            return None, _NOT_MEMBER
        return (ctx, None) if isinstance(ctx, dict) else (None, unknown)

    async def get_requester_context() -> str:
        ctx, refusal = await _load()
        if ctx is None:
            return refusal or unknown
        who = _dict(ctx.get("requester"))
        role = _ROLES.get(str(who.get("role")), "сотрудник")
        parts = [f"Обратился: {role}"]
        if who.get("kind") == "PLATFORM_ADMIN":
            parts[0] += " (он же главный администратор платформы)"
        parts.append(f"Организация: {_clean(_dict(ctx.get('organization')).get('displayName'))}")
        businesses = ctx.get("businesses") if isinstance(ctx.get("businesses"), list) else []
        if businesses:
            described = []
            for one in businesses:
                b = _dict(one)
                places = [_clean(_dict(x).get("displayName"), 60) for x in (b.get("locations") or [])]
                kind = _VERTICALS.get(str(b.get("vertical")), "бизнес")
                described.append(
                    f"{_clean(b.get('displayName'))} ({kind}"
                    + (f"; филиалы: {', '.join(p for p in places if p)}" if places else "")
                    + ")"
                )
            parts.append("Бизнесы: " + "; ".join(described))
        else:
            parts.append("Бизнесов в организации пока нет")
        parts.append("Область: вся организация")
        return ". ".join(parts) + "."

    async def get_account_status() -> str:
        ctx, refusal = await _load()
        if ctx is None:
            return refusal or unknown
        acc = _dict(ctx.get("account"))
        status = str(acc.get("status") or "")
        if status not in _ACCOUNT:
            return unknown
        text = f"Аккаунт организации: {status} — {_ACCOUNT[status]}."
        reason = _REASONS.get(str(acc.get("reasonCode")))
        if reason:
            text += f" Причина: {reason}."
        end = _date(acc.get("trialEndsAt"))
        if end:
            text += f" Срок пробного периода — до {end}."
        if acc.get("canMutate") is False and "нельзя" not in text:
            text += " Менять данные нельзя."
        return text

    async def get_permissions(permission: str | None = None) -> str:
        ctx, refusal = await _load()
        if ctx is None:
            return refusal or unknown
        role = _ROLES.get(str(_dict(ctx.get("requester")).get("role")), "сотрудник")
        perms = _dict(ctx.get("permissions"))
        tail = " Права я не меняю: роли и права меняет владелец организации."
        wanted = str(permission or "").strip().lower()
        if wanted:
            if wanted not in _PERMISSIONS:
                return "не знаю такого права; известные: " + ", ".join(_PERMISSIONS)
            has = perms.get(wanted) is True
            return (
                f"Право «{_PERMISSIONS[wanted]}» ({wanted}) у роли «{role}»: "
                + ("есть." if has else "нет.")
                + ("" if has else tail)
            )
        yes = [_PERMISSIONS[k] for k in _PERMISSIONS if perms.get(k) is True]
        no = [_PERMISSIONS[k] for k in _PERMISSIONS if perms.get(k) is not True]
        return f"Роль «{role}». Есть: {', '.join(yes) or 'ничего'}. Нет: {', '.join(no) or 'ничего'}.{tail}"

    registry.register(
        ToolSpec(
            name="get_requester_context",
            description=(
                "Кто к тебе обратился: роль, организация, бизнесы и филиалы, область (вся организация)."
                " Ничего называть не нужно: человек и организация берутся из его входа в платформу."
                " Почты, телефона и имени тут нет — не проси их и не выдумывай." + rules
            ),
            parameters=dict(_NO_PARAMS),
            handler=get_requester_context,
        )
    )
    registry.register(
        ToolSpec(
            name="get_account_status",
            description=(
                "Состояние аккаунта организации обратившегося: ACTIVE, TRIAL, READ_ONLY или SUSPENDED,"
                " можно ли менять данные, причина и срок пробного периода. Проверяй это, когда человек"
                " жалуется, что не может что-то создать или изменить." + rules
            ),
            parameters=dict(_NO_PARAMS),
            handler=get_account_status,
        )
    )
    registry.register(
        ToolSpec(
            name="get_permissions",
            description=(
                "Есть ли у роли обратившегося конкретное право. Названия прав:"
                " " + ", ".join(_PERMISSIONS) + ". Без аргумента — короткая сводка «есть / нет»."
                " Права ты не меняешь и не выдаёшь: если права нет, скажи, что его может дать владелец." + rules
            ),
            parameters={
                "type": "object",
                "properties": {
                    "permission": {
                        "type": ["string", "null"],
                        "enum": [*_PERMISSIONS, None],
                        "description": "Название права; пусто — сводка",
                    }
                },
                "required": [],
            },
            handler=get_permissions,
        )
    )
