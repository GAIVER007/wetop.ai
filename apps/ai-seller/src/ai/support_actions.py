"""Инструменты действий WETOP Support (S6): матрица, предложение, подтверждение, отмена, передача человеку.

🔴 Аргументов «кто» и «какая организация» нет: область — из подписи посетителя. Единственные аргументы — имя
действия из матрицы и, у передачи человеку, вид и короткая сводка.

🔴 SAFE выполняется сразу; CONFIRM — только после confirm_action тем же диалогом и не позже 15 минут; HUMAN_ONLY не
выполняется никогда. Каждое движение — строка в журнале бота; ключ идемпотентности для платформы — id этой строки.

🔴 Модели уходит текст по белому списку: числа результата и слова матрицы. Адреса, ключи и всё, что платформа
добавит в ответ сверх контракта, взять неоткуда.
"""

from __future__ import annotations

import hashlib
import logging
import re
import uuid
from typing import Any, Callable

from src.ai.support_actions_journal import (
    PENDING_TTL_SECONDS,
    clear_pending,
    escalate,
    explicit_consent,
    get_pending,
    is_stale,
    list_for_conversation,  # noqa: F401 — реэкспорт для панели
    pending_key,
    put_pending,
    record,
    set_status,
)
from src.ai.support_actions_matrix import (
    CHANNEL_SYNC_DAYS,
    HUMAN_KINDS,
    MATRIX,
    ActionClass,
    capabilities_text,
    result_text,
)
from src.ai.tools import ToolRegistry, ToolSpec
from src.integrations.failure_log import log_provider_failure
from src.security.pii import mask_for_log

__all__ = ["PENDING_TTL_SECONDS", "pending_key", "register_action_tools", "user_ref"]

logger = logging.getLogger(__name__)

_NO_PARAMS: dict[str, Any] = {"type": "object", "properties": {}, "required": []}
_NOTHING_PENDING = "нечего подтверждать: ожидающего предложения в этом диалоге нет"
_NO_CONSENT = (
    "явного подтверждения в сообщении человека нет: действие не выполнено, предложение ждёт. Спроси прямо, "
    "делать ли это, и не подтверждай сам — подтверждает человек словом «да»"
)
_OTHER_PERSON = "предложение делал другой человек: подтвердить его может только он"
_STALE = "предложение устарело (прошло больше 15 минут): предложи действие заново"
_NO_CONVERSATION = "не могу запомнить предложение вне диалога: уточнит человек"
_SUMMARY_LIMIT = 300


def user_ref(user_id: str) -> str:
    """Псевдоним человека для журнала — тот же, что у платформы в S4: id не раскрывает."""
    return "u_" + hashlib.sha256(f"requester:{user_id}".encode()).hexdigest()[:12]


def register_action_tools(
    registry: ToolRegistry,
    *,
    providers_getter: Callable[[], Any],
    visitor_getter: Callable[[], Any],
    conversation_getter: Callable[[], str | None],
    actions_getter: Callable[[], Any],
    incoming_getter: Callable[[], str | None] = lambda: None,
    rules: str = "",
    unknown: str = "не знаю",
    not_signed: str = "не вошли",
) -> None:
    def _scope() -> tuple[str, str] | None:
        try:
            visitor = visitor_getter()
        except Exception:
            logger.exception("действия: посетитель не получен")
            return None
        if visitor is None or not getattr(visitor, "signed", False):
            return None
        user_id, org_id = getattr(visitor, "user_id", None), getattr(visitor, "org_id", None)
        return (str(user_id), str(org_id)) if user_id and org_id else None

    def _runtime() -> Any | None:
        try:
            return actions_getter()
        except Exception:
            logger.exception("действия: runtime не получен")
            return None

    def _conversation() -> str | None:
        try:
            value = conversation_getter()
        except Exception:
            return None
        return str(value) if value else None

    def _source() -> Any | None:
        try:
            providers = providers_getter()
        except Exception as exc:
            log_provider_failure(logger, "действия: провайдеры", exc)
            return None
        return getattr(providers, "actions", None) if providers else None

    async def _execute(session, runtime, scope, spec, row) -> str:
        """Выполнить SAFE или подтверждённое CONFIRM: провайдер → статус в журнале → слова."""
        source = _source()
        if source is None:
            await set_status(session, row.id, "FAILED", result="ключ действий не задан")
            return unknown
        kwargs = {"user_id": scope[0], "org_id": scope[1], "idempotency_key": str(row.id)}
        if spec.name == "channel_sync":
            kwargs["days"] = CHANNEL_SYNC_DAYS
        try:
            body = await getattr(source, spec.name)(**kwargs)
        except Exception as exc:
            log_provider_failure(logger, f"действие {spec.name}", exc)
            await set_status(session, row.id, "FAILED", result="платформа отказала")
            return unknown
        words = result_text(spec.name, body if isinstance(body, dict) else {})
        await set_status(session, row.id, "DONE", result=words, executed=True)
        return f"Готово: {spec.title} — {words}."

    async def list_capabilities() -> str:
        return capabilities_text()

    async def propose_action(action: str) -> str:
        scope = _scope()
        if scope is None:
            return not_signed
        spec = MATRIX.get(str(action or "").strip())
        if spec is None:
            return "нет такого действия; есть: " + ", ".join(MATRIX)
        runtime = _runtime()
        if runtime is None:
            return unknown
        conversation = _conversation()
        ref = user_ref(scope[0])
        async with runtime.session_factory() as session:
            if spec.action_class is ActionClass.HUMAN_ONLY:
                await record(
                    session, conversation_id=conversation, user_ref=ref, action=spec.name,
                    action_class=spec.action_class.value, status="REFUSED", result="только человек",
                )
                await session.commit()
                return (
                    f"Это делает только человек ({spec.title}): не обещай и не выполняй. Вызови request_human с видом "
                    f"«{spec.name}» и короткой сводкой без телефонов и почты."
                )
            if spec.action_class is ActionClass.SAFE:
                row = await record(
                    session, conversation_id=conversation, user_ref=ref, action=spec.name,
                    action_class=spec.action_class.value, status="CONFIRMED",
                )
                await session.commit()
                text = await _execute(session, runtime, scope, spec, row)
                await session.commit()
                return text
            # CONFIRM: запомнить и спросить человека
            if conversation is None:
                return _NO_CONVERSATION
            previous = await get_pending(runtime.redis, conversation)
            if previous:
                try:
                    await set_status(session, uuid.UUID(previous["action_id"]), "CANCELLED", result="вытеснено новым")
                except (ValueError, KeyError):
                    pass
            row = await record(
                session, conversation_id=conversation, user_ref=ref, action=spec.name,
                action_class=spec.action_class.value, status="PROPOSED",
            )
            await session.commit()
            await put_pending(runtime.redis, conversation, action_id=row.id, action=spec.name, user_ref=ref)
            return (
                f"Нужно подтверждение человека: {spec.description}. Спроси, делать ли это. Ответит «да» — вызови "
                f"confirm_action, «нет» — cancel_action. Предложение действует {PENDING_TTL_SECONDS // 60} минут."
            )

    async def _take_pending(runtime, conversation):
        pending = await get_pending(runtime.redis, conversation)
        if pending is None:
            return None, None
        await clear_pending(runtime.redis, conversation)
        try:
            action_id = uuid.UUID(str(pending.get("action_id")))
        except ValueError:
            return None, None
        return pending, action_id

    async def confirm_action() -> str:
        scope = _scope()
        if scope is None:
            return not_signed
        runtime, conversation = _runtime(), _conversation()
        if runtime is None:
            return unknown
        if conversation is None:
            return _NOTHING_PENDING
        # Q-S6-2: согласие доказывает сервер — тот же человек, тот же диалог, явное «да» в его сообщении этого хода.
        # Вызов confirm_action моделью доказательством не считается: без «да» предложение остаётся ждать.
        waiting = await get_pending(runtime.redis, conversation)
        if waiting is None:
            return _NOTHING_PENDING
        if waiting.get("user_ref") != user_ref(scope[0]):
            return _OTHER_PERSON
        try:
            said = incoming_getter()
        except Exception:
            said = None
        if not explicit_consent(said):
            return _NO_CONSENT
        pending, action_id = await _take_pending(runtime, conversation)
        if pending is None:
            return _NOTHING_PENDING
        spec = MATRIX.get(str(pending.get("action")))
        async with runtime.session_factory() as session:
            if is_stale(pending) or spec is None or spec.action_class is not ActionClass.CONFIRM:
                await set_status(session, action_id, "EXPIRED", result="не подтверждено вовремя")
                await session.commit()
                return _STALE
            row = await set_status(session, action_id, "CONFIRMED")
            await session.commit()
            if row is None:
                return _NOTHING_PENDING
            text = await _execute(session, runtime, scope, spec, row)
            await session.commit()
            return text

    async def cancel_action() -> str:
        scope = _scope()
        if scope is None:
            return not_signed
        runtime, conversation = _runtime(), _conversation()
        if runtime is None or conversation is None:
            return _NOTHING_PENDING
        pending, action_id = await _take_pending(runtime, conversation)
        if pending is None:
            return _NOTHING_PENDING
        async with runtime.session_factory() as session:
            await set_status(session, action_id, "CANCELLED", result="отменено человеком")
            await session.commit()
        return "Отменено: действие не выполнено."

    async def request_human(kind: str, summary: str) -> str:
        scope = _scope()
        if scope is None:
            return not_signed
        kind = str(kind or "").strip()
        if kind not in HUMAN_KINDS:
            return "не знаю такого вида запроса; есть: " + ", ".join(HUMAN_KINDS)
        runtime = _runtime()
        if runtime is None:
            return unknown
        conversation = _conversation()
        clean = re.sub(r"\s+", " ", str(summary or "")).strip()[:_SUMMARY_LIMIT]
        safe = mask_for_log(clean) if clean else "без сводки"
        async with runtime.session_factory() as session:
            await record(
                session, conversation_id=conversation, user_ref=user_ref(scope[0]), action=kind,
                action_class=ActionClass.HUMAN_ONLY.value, status="ESCALATED", result=safe,
            )
            marked = await escalate(session, conversation)
            await session.commit()
        spec = MATRIX[kind]
        tail = " Диалог отмечен «нужен человек»." if marked else ""
        return f"Передал человеку: {spec.title}. Скажи, что вопрос передан специалисту и он ответит здесь.{tail}"

    registry.register(ToolSpec(
        name="list_capabilities",
        description="Что бот может сделать сам, что после подтверждения человека, а что делает только специалист." + rules,
        parameters=dict(_NO_PARAMS), handler=list_capabilities,
    ))
    registry.register(ToolSpec(
        name="propose_action",
        description=(
            "Предложить действие из матрицы возможностей (list_capabilities). Безопасное выполняется сразу; требующее "
            "подтверждения — только после «да» человека через confirm_action; то, что делает только человек, не "
            "выполняется — используй request_human. Организация берётся из подписи." + rules
        ),
        parameters={
            "type": "object",
            "properties": {"action": {"type": "string", "description": "Имя действия из матрицы, например channel_pull"}},
            "required": ["action"],
        },
        handler=propose_action,
    ))
    registry.register(ToolSpec(
        name="confirm_action",
        description=(
            "Выполнить ожидающее предложение. Сервер сам проверяет, что человек в этом сообщении написал явное «да»: "
            "без него действие не выполнится. Зови только после ответа человека." + rules
        ),
        parameters=dict(_NO_PARAMS), handler=confirm_action,
    ))
    registry.register(ToolSpec(
        name="cancel_action",
        description="Отменить ожидающее предложение, если человек ответил «нет» или передумал." + rules,
        parameters=dict(_NO_PARAMS), handler=cancel_action,
    ))
    registry.register(ToolSpec(
        name="request_human",
        description=(
            "Передать вопрос специалисту: деньги, подписка, права, удаление, массовые правки броней и всё, что бот не "
            "делает. Сводка — коротко, без телефонов, почты и документов." + rules
        ),
        parameters={
            "type": "object",
            "properties": {
                "kind": {"type": "string", "description": "Вид: " + ", ".join(HUMAN_KINDS)},
                "summary": {"type": "string", "description": "Короткая сводка, что нужно человеку"},
            },
            "required": ["kind", "summary"],
        },
        handler=request_human,
    ))
