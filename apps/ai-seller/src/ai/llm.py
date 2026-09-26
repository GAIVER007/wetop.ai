"""Клиент к OpenAI-совместимому роутеру и каскад из трёх моделей.

Порядок внутри generate() фиксированный:
    замаскировать ПД (один раз) → основная → запасная → аварийная.

Маскировка стоит до цикла, а не внутри попытки: иначе запасная ступень
получит неотмаскированный текст ровно тогда, когда основная легла.
Обратная подстановка — не здесь: её делает движок после проверки выхода,
поэтому наружу уходят текст с метками и таблица меток.

Повторы SDK выключены (max_retries=0): повтор делаем сами, меняя модель.
Отказ определяется по телу ответа, а не по коду: роутер отдаёт отказ
и ошибку с кодом 200. Исключение наружу не выходит никогда.
Адрес и ключ — только из Settings.
"""

from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any

import httpx
import openai
from openai import AsyncOpenAI

from src.ai.context import MessageMasker
from src.ai.schemas import ModelReply, parse_model_json, parse_model_reply
from src.ai.tools import ToolRegistry
from src.config import Settings, get_settings
from src.dependencies import get_http_client

logger = logging.getLogger(__name__)

# Исходы одной попытки. Строки, а не Enum: они идут прямо в журнал.
OK, TIMEOUT, CONNECTION, HTTP_ERROR = "ok", "timeout", "connection", "http_error"
REFUSAL, EMPTY, INVALID, TOOL_ERROR = "refusal", "empty", "invalid", "tool_error"
# Внутренний исход разбора тела: модель просит инструмент, раунд продолжается.
_TOOL_CALLS = "tool_calls"

NOT_CONFIGURED = "llm_not_configured"
ALL_FAILED = "all_models_failed"


@dataclass
class AttemptLog:
    """Одна ступень каскада: что вызвали, чем кончилось, сколько ждали."""

    model: str
    outcome: str
    seconds: float
    note: str = ""


@dataclass
class LlmResult:
    """Итог каскада. text — с метками ПД; mapping — таблица для движка."""

    ok: bool
    text: str = ""
    parsed: ModelReply | None = None
    model: str | None = None
    attempts: list[AttemptLog] = field(default_factory=list)
    mapping: dict[str, str] = field(default_factory=dict)
    # Токены всех ступеней, включая отказавшие: огрызок, отказ модели и лишний
    # раунд инструментов тоже оплачены (ревизия 26.09). None — роутер не сообщил.
    tokens_used: int | None = None
    error: str | None = None


def vendor_of(model: str) -> str:
    """Вендор по имени модели: «openai/gpt-4.1» -> openai, «claude-x» -> claude."""
    name = model.strip()
    if "/" in name:
        return name.split("/", 1)[0].lower()
    return re.split(r"[-:]", name, maxsplit=1)[0].lower()


def check_distinct_vendors(models: list[str]) -> list[str]:
    """Предупреждения о ступенях одного вендора: сбой поставщика не должен
    класть весь каскад. Предупреждение, а не падение: выбор за заказчиком."""
    warnings: list[str] = []
    for i, first in enumerate(models):
        for second in models[i + 1 :]:
            vendor = vendor_of(first)
            if vendor and vendor == vendor_of(second):
                warnings.append(f"модели {first} и {second} — один вендор {vendor}")
    return warnings


def _body_is_error(content: str) -> bool:
    """Роутер иногда кладёт ошибку в content с кодом 200: {"error": {...}}."""
    try:
        data = json.loads(content)
    except ValueError:
        return False
    return isinstance(data, dict) and "error" in data


def _inspect(response: Any) -> tuple[str, Any, str]:
    """Разбор тела ответа при HTTP 200 -> (исход, message, заметка).

    Код 200 сам по себе ничего не значит: проверяем choices, refusal,
    finish_reason, содержимое. Исход _TOOL_CALLS — не отказ, а раунд.
    """
    choices = getattr(response, "choices", None)
    if not choices:
        return INVALID, None, "нет choices"
    choice = choices[0]
    message = getattr(choice, "message", None)
    if message is None:
        return INVALID, None, "нет message"
    if getattr(message, "refusal", None) or getattr(choice, "finish_reason", None) == "content_filter":
        return REFUSAL, message, "отказ модели"
    if getattr(message, "tool_calls", None):
        return _TOOL_CALLS, message, ""
    content = getattr(message, "content", None)
    if not isinstance(content, str) or not content.strip():
        return EMPTY, message, "пустой ответ"
    if _body_is_error(content):
        return INVALID, message, "ошибка в теле"
    # Обрезанный по max_tokens JSON — огрызок, а не ответ: клиенту его
    # показывать нельзя. Если объект успел закрыться — годится.
    if getattr(choice, "finish_reason", None) == "length" and parse_model_json(content) is None:
        return INVALID, message, "обрезан по длине"
    return OK, message, ""


def _tokens_of(response: Any) -> int | None:
    usage = getattr(response, "usage", None)
    total = getattr(usage, "total_tokens", None)
    return total if isinstance(total, int) else None


def _assistant_message(message: Any) -> dict:
    """Сообщение ассистента с tool_calls в том виде, в каком его вернула
    модель: без него роутер не примет tool-ответы следующего раунда."""
    tool_calls = [
        tc.model_dump(exclude_none=True) if hasattr(tc, "model_dump") else tc
        for tc in message.tool_calls
    ]
    return {"role": "assistant", "content": message.content, "tool_calls": tool_calls}


class CascadeClient:
    """Каскад моделей поверх одного OpenAI-совместимого роутера."""

    def __init__(
        self,
        settings: Settings,
        *,
        http_client: httpx.AsyncClient | None = None,
        tools: ToolRegistry | None = None,
    ) -> None:
        self._settings = settings
        self._tools = tools if tools is not None else ToolRegistry()
        self._client: AsyncOpenAI | None = None
        # httpx пишет полный URL запроса на INFO; в нём бывает токен.
        logging.getLogger("httpx").setLevel(logging.WARNING)
        logging.getLogger("openai").setLevel(logging.WARNING)
        if settings.llm_base_url and settings.llm_api_key:
            self._client = AsyncOpenAI(
                api_key=settings.llm_api_key,
                base_url=settings.llm_base_url,
                # Повтор делаем сами, меняя модель между попытками.
                max_retries=0,
                timeout=settings.llm_timeout_seconds,
                http_client=http_client,
            )
        for warning in check_distinct_vendors(self.models):
            logger.warning("каскад моделей: %s", warning)

    @property
    def models(self) -> list[str]:
        return self._settings.llm_models

    async def generate(
        self, messages: list[dict], *, use_tools: bool = True, max_tool_rounds: int = 3
    ) -> LlmResult:
        """Один вызов слоя модели. Никогда не поднимает исключение."""
        # маскировка до каскада: запасная ступень не должна увидеть ПД
        masker = MessageMasker(
            allowlist_phones=self._settings.pii_allowlist_phones_list,
            allowlist_emails=self._settings.pii_allowlist_emails_list,
        )
        masked = masker.mask(messages)
        # Тот же маскировщик дописывает метки из результатов инструментов.
        mapping = masker.mapping
        if self._client is None or not self.models:
            logger.error("слой модели не настроен: нет адреса, ключа или списка моделей")
            return LlmResult(ok=False, mapping=mapping, error=NOT_CONFIGURED)

        attempts: list[AttemptLog] = []
        spent: int | None = None
        try:
            for model in self.models:
                started = time.perf_counter()
                outcome, text, tokens = await self._attempt(
                    model, masked, masker, use_tools=use_tools, max_tool_rounds=max_tool_rounds
                )
                seconds = round(time.perf_counter() - started, 3)
                if tokens is not None:
                    spent = (spent or 0) + tokens
                if outcome == OK:
                    attempts.append(AttemptLog(model, OK, seconds))
                    return LlmResult(
                        ok=True,
                        text=text,
                        parsed=parse_model_reply(text),
                        model=model,
                        attempts=attempts,
                        mapping=mapping,
                        tokens_used=spent,
                    )
                # При отказе слот text несёт короткую заметку, не текст ответа.
                attempts.append(AttemptLog(model, outcome, seconds, note=text))
                logger.warning("модель %s: %s, переключение на следующую ступень", model, outcome)
        except Exception:
            # Последний рубеж: сбой диспетчера или разбора не должен вылететь в движок.
            logger.exception("слой модели: непредвиденный сбой каскада")
        logger.error("все ступени каскада отказали")
        return LlmResult(ok=False, attempts=attempts, mapping=mapping, tokens_used=spent, error=ALL_FAILED)

    async def _attempt(
        self,
        model: str,
        messages: list[dict],
        masker: MessageMasker,
        *,
        use_tools: bool,
        max_tool_rounds: int,
    ) -> tuple[str, str, int | None]:
        """Одна ступень -> (исход, текст, токены).

        При исходе OK текст — ответ модели; при отказе — короткая нейтральная
        заметка для журнала (код HTTP, причина), без тела ответа и ПД.
        Раунды инструментов идут внутри той же ступени. Любое исключение —
        исход invalid: сбой одной ступени не должен класть остальные.
        """
        assert self._client is not None
        settings = self._settings
        tools = self._tools.specs_for_openai() if use_tools else []
        # Копия: раунды инструментов дописывают сообщения, а следующая
        # ступень должна начать с исходного замаскированного списка.
        convo = list(messages)
        tokens: int | None = None

        try:
            for round_no in range(max_tool_rounds + 1):
                try:
                    response = await self._client.chat.completions.create(
                        model=model,
                        messages=convo,
                        temperature=settings.llm_temperature,
                        max_tokens=settings.llm_max_tokens,
                        timeout=settings.llm_timeout_seconds,
                        **({"tools": tools} if tools else {}),
                    )
                except openai.APITimeoutError:
                    return TIMEOUT, "таймаут попытки", tokens
                except openai.APIConnectionError:
                    return CONNECTION, "нет соединения", tokens
                except openai.APIStatusError as exc:
                    return HTTP_ERROR, f"HTTP {exc.status_code}", tokens

                got = _tokens_of(response)
                if got is not None:
                    tokens = (tokens or 0) + got

                outcome, message, note = _inspect(response)
                if outcome == OK:
                    return OK, message.content, tokens
                if outcome != _TOOL_CALLS:
                    return outcome, note, tokens
                if round_no >= max_tool_rounds:
                    break
                # Раунд инструментов: ответ ассистента + результаты, и снова к модели.
                # Результаты маскируются той же таблицей: инструмент поверх CRM
                # отдаёт ПД клиента, а модель их видеть не должна.
                convo.append(_assistant_message(message))
                convo.extend(masker.mask(await self._tools.dispatch(message.tool_calls)))
        except Exception as exc:  # APIResponseValidationError, сбой разбора и всё прочее
            logger.exception("модель %s: ответ не разобран", model)
            return INVALID, f"исключение {type(exc).__name__}", tokens

        return TOOL_ERROR, f"раундов инструментов больше {max_tool_rounds}", tokens


class _Holder:
    """Держатель синглтона: один объект вместо голого глобала."""

    def __init__(self) -> None:
        self.client: CascadeClient | None = None


_holder = _Holder()


def get_cascade_client() -> CascadeClient:
    """Каскад на процесс, поверх общего HTTP-клиента из dependencies."""
    if _holder.client is None:
        _holder.client = CascadeClient(get_settings(), http_client=get_http_client())
    return _holder.client


def set_cascade_client(client: CascadeClient | None) -> None:
    """Подмена для тестов и песочницы."""
    _holder.client = client


def reset_cascade_client() -> None:
    _holder.client = None
