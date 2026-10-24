"""Состояние ключа модели организации: работает, нет денег, неверный, предел запросов.

Остаток на счёте OpenAI по API не узнать (эндпоинта нет, 20.10.2026), поэтому владелец видит последнее
известное состояние: его пишет каждый ход модели и каждая проверка ключа. Хранится в Redis (тот же счётчик,
что у дневного предела): потеря при перезапуске Redis безвредна, следующий ход запишет заново.
Код ошибки поставщика приходит в заметке попытки каскада: «HTTP 429 insufficient_quota».
"""

from __future__ import annotations

import json
import logging
import re
import uuid

from src.db.base import utcnow

logger = logging.getLogger(__name__)

OK, NO_CREDITS, INVALID_KEY, RATE_LIMITED, ERROR = "ok", "no_credits", "invalid_key", "rate_limited", "error"
_TTL_SECONDS = 30 * 24 * 3600
_NOTE_RE = re.compile(r"^HTTP (\d{3})(?: (\S+))?")

# Подписи для владельца: что случилось и что делать. Ключ сам не показывается никогда.
REASONS = {
    OK: None,
    NO_CREDITS: "На счёте провайдера модели закончились деньги: пополните баланс в его кабинете",
    INVALID_KEY: "Провайдер не принял ключ: проверьте, что ключ действующий и скопирован целиком",
    RATE_LIMITED: "Провайдер временно ограничил число запросов: повторите позже",
    ERROR: "Провайдер ответил отказом: повторите позже",
}


def classify(status: int, code: str | None) -> str:
    """Код ответа поставщика и его `error.code` -> состояние ключа."""
    if status in (401, 403):
        return INVALID_KEY
    if status == 429:
        return NO_CREDITS if code in ("insufficient_quota", "credit_balance_exhausted") else RATE_LIMITED
    if status == 402:
        return NO_CREDITS
    return OK if status < 400 else ERROR


def from_attempts(attempts: list) -> str | None:
    """Состояние по ступеням неудачного хода: решает последний ответ поставщика с кодом.
    Таймауты и обрывы связи о ключе ничего не говорят -> None (состояние не меняем)."""
    for attempt in reversed(attempts or []):
        match = _NOTE_RE.match(getattr(attempt, "note", "") or "")
        if match:
            return classify(int(match.group(1)), match.group(2))
    return None


def _key(org: uuid.UUID | str) -> str:
    return f"llm:keystate:{org}"


async def record(redis, org: uuid.UUID | str | None, state: str | None) -> None:
    """Записать состояние. Сбой Redis хода не роняет: состояние это подсказка, а не учёт."""
    if org is None or state is None:
        return
    try:
        await redis.set(_key(org), json.dumps({"state": state, "at": utcnow().isoformat()}), ex=_TTL_SECONDS)
    except Exception:
        logger.warning("состояние ключа модели не записано", exc_info=True)


async def clear(redis, org: uuid.UUID | str) -> None:
    """Ключ сменили или сняли: прежнее состояние больше не про него."""
    try:
        await redis.delete(_key(org))
    except Exception:
        logger.warning("состояние ключа модели не сброшено", exc_info=True)


async def read(redis, org: uuid.UUID | str) -> dict:
    """{state, reason, checked_at}; ничего не известно -> state None."""
    try:
        raw = await redis.get(_key(org))
        data = json.loads(raw) if raw else {}
    except Exception:
        logger.warning("состояние ключа модели не прочитано", exc_info=True)
        data = {}
    state = data.get("state")
    return {"state": state, "reason": REASONS.get(state) if state else None, "checked_at": data.get("at")}
