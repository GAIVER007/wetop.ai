"""Контракты структурного вывода модели и разбор её ответа.

Модель просят ответить одним JSON-объектом (см. context.OUTPUT_INSTRUCTIONS),
но на практике приходят три формы: чистый объект, объект в markdown-обёртке
или внутри текста, и просто строка. Все три — валидный ответ клиенту:
строка становится reply, а не ошибкой. Исключений наружу разбор не даёт.
"""

from __future__ import annotations

import json
import re
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from src.db.base import FunnelStage

FUNNEL_STAGES: tuple[str, ...] = tuple(stage.value for stage in FunnelStage)

# Обёртка ```json … ``` (или без языка) по краям текста.
_FENCE_RE = re.compile(r"^\s*```[A-Za-z]*\s*\n?(.*?)\n?\s*```\s*$", re.DOTALL)
# Первая обёртка внутри текста, когда вокруг есть пояснения модели.
_FENCE_INNER_RE = re.compile(r"```[A-Za-z]*\s*\n?(.*?)```", re.DOTALL)


class LeadFields(BaseModel):
    """Что модель сумела узнать о клиенте. Все поля необязательны:
    заявка без имени и телефона всё равно не создаётся — это решает код."""

    model_config = ConfigDict(extra="ignore")

    name: str | None = None
    phone: str | None = None
    email: str | None = None
    interest: str | None = None
    budget: str | None = None
    timeframe: str | None = None
    notes: str | None = None
    # Свободная сумка под нишу заказчика (даты, гости, категория):
    # ключи задаёт промпт, ядро о них не знает и не должно.
    extra: dict[str, Any] = Field(default_factory=dict)

    @field_validator("name", "phone", "email", "interest", "budget", "timeframe", "notes", mode="before")
    @classmethod
    def _to_str(cls, value: Any) -> str | None:
        """Число в budget — типичный ответ модели: приводим к строке,
        а не роняем весь объект из-за побочного поля."""
        if value is None or isinstance(value, str):
            return value
        return str(value)

    @field_validator("extra", mode="before")
    @classmethod
    def _extra_or_empty(cls, value: Any) -> dict[str, Any]:
        return value if isinstance(value, dict) else {}


class ModelReply(BaseModel):
    """Ответ модели за один ход. Только reply уходит клиенту;
    остальное — сигналы движку и панели (needs_human не переключает режим сам)."""

    model_config = ConfigDict(extra="ignore")

    reply: str
    needs_human: bool = False
    human_reason: str | None = None
    funnel_stage: str | None = None
    lead: LeadFields | None = None

    @field_validator("funnel_stage", mode="before")
    @classmethod
    def _known_stage_or_none(cls, value: Any) -> str | None:
        """Чужое значение стадии — None, а не ошибка: выдуманная стадия
        не должна ронять весь ответ, её просто не записываем."""
        if isinstance(value, FunnelStage):
            return value.value
        if isinstance(value, str) and value.strip().lower() in FUNNEL_STAGES:
            return value.strip().lower()
        return None


MODEL_REPLY_JSON_SCHEMA: dict = ModelReply.model_json_schema()


def _loads_object(text: str) -> dict | None:
    try:
        data = json.loads(text)
    except (ValueError, TypeError):
        return None
    return data if isinstance(data, dict) else None


def _balanced_object_end(text: str, start: int) -> int | None:
    """Индекс за закрывающей скобкой объекта, начатого в text[start] == '{'.

    Скобки внутри строк JSON не считаются: reply вида «цена {примерно}»
    не должен ломать поиск границ.
    """
    depth = 0
    in_string = False
    escaped = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i + 1
    return None


def strip_markdown_fence(text: str) -> str:
    """Снимает ```json … ``` по краям; внутри текст не трогает."""
    match = _FENCE_RE.match(text)
    return (match.group(1) if match else text).strip()


def parse_model_json(text: str) -> dict | None:
    """Три формы: (1) весь текст — объект; (2) объект в markdown-обёртке
    или первый сбалансированный {...} внутри текста; (3) иначе None."""
    if not text or not text.strip():
        return None
    stripped = text.strip()
    data = _loads_object(stripped)
    if data is not None:
        return data
    for candidate in (strip_markdown_fence(stripped), *_FENCE_INNER_RE.findall(stripped)):
        data = _loads_object(candidate.strip())
        if data is not None:
            return data
    # Объект внутри текста: перебираем открывающие скобки, пока не найдём
    # сбалансированный фрагмент, который разбирается как объект.
    pos = stripped.find("{")
    while pos != -1:
        end = _balanced_object_end(stripped, pos)
        if end is not None:
            data = _loads_object(stripped[pos:end])
            if data is not None:
                return data
        pos = stripped.find("{", pos + 1)
    return None


def parse_model_reply(text: str) -> ModelReply:
    """Объект -> ModelReply; невалидный объект или строка -> ModelReply(reply=текст).
    Пустой текст -> reply=''. Исключений не бросает."""
    if not text or not text.strip():
        return ModelReply(reply="")
    data = parse_model_json(text)
    if data is not None:
        try:
            return ModelReply.model_validate(data)
        except ValidationError:
            # Побочное поле сломано, но reply есть: клиенту уходит текст,
            # а не сырой JSON. Остальные поля — умолчания.
            reply = data.get("reply")
            if isinstance(reply, str) and reply.strip():
                return ModelReply(reply=reply)
    return ModelReply(reply=strip_markdown_fence(text))
