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

Второй путь (Р3): аварийная ступень может идти своим адресом и ключом
поставщика напрямую (LLM_EMERGENCY_BASE_URL + LLM_EMERGENCY_API_KEY) —
иначе лёг шлюз, легли все три ступени. Только на ключе платформы.
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
    # Разбивка расхода удачной ступени (Р2): вход, из него кэш, выход.
    # None — поставщик эту часть не сообщил.
    tokens_input: int | None = None
    tokens_cached: int | None = None
    tokens_output: int | None = None


def _add(a: int | None, b: int | None) -> int | None:
    """Сумма, где «не сообщено» не превращается в ноль раньше времени."""
    return b if a is None else a if b is None else a + b


@dataclass
class Usage:
    """Расход одной ступени по раундам инструментов: сумма и разбивка."""

    total: int | None = None
    input: int | None = None
    cached: int | None = None
    output: int | None = None

    def add(self, other: Usage) -> None:
        self.total = _add(self.total, other.total)
        self.input = _add(self.input, other.input)
        self.cached = _add(self.cached, other.cached)
        self.output = _add(self.output, other.output)


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


def _int_or_none(value: Any) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def _usage_of(response: Any) -> Usage:
    """usage ответа -> Usage. Кэшированная часть входа — в
    prompt_tokens_details.cached_tokens (OpenAI и роутеры в его формате)."""
    usage = getattr(response, "usage", None)
    details = getattr(usage, "prompt_tokens_details", None)
    return Usage(
        total=_int_or_none(getattr(usage, "total_tokens", None)),
        input=_int_or_none(getattr(usage, "prompt_tokens", None)),
        cached=_int_or_none(getattr(details, "cached_tokens", None)),
        output=_int_or_none(getattr(usage, "completion_tokens", None)),
    )


# Вендоры, которым кэш префикса нужно разметить явно; OpenAI, Gemini
# и DeepSeek кэшируют префикс сами.
_CACHE_MARK_VENDORS = frozenset({"anthropic", "claude"})


def _with_cache_mark(messages: list[dict]) -> list[dict]:
    """Метка кэша Anthropic на первом системном сообщении — постоянной части
    промпта (правила и профиль гостиницы, src/ai/context.py).

    🔴 Ставится на уже замаскированный список: маскировщик видит только
    строковый content, и метка до маскировки пронесла бы ПД мимо него.
    Знания и история меняются от хода к ходу — метки на них нет.
    """
    if not messages or messages[0].get("role") != "system" or not isinstance(messages[0].get("content"), str):
        return messages
    first = dict(messages[0])
    first["content"] = [{"type": "text", "text": first["content"], "cache_control": {"type": "ephemeral"}}]
    return [first, *messages[1:]]


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
        self._emergency_client: AsyncOpenAI | None = None
        # httpx пишет полный URL запроса на INFO; в нём бывает токен.
        logging.getLogger("httpx").setLevel(logging.WARNING)
        logging.getLogger("openai").setLevel(logging.WARNING)
        # Клиент — как только задан адрес роутера: ключ бывает только у гостиницы (вкладка «Модель», С2).
        # Заглушка никуда не уходит: ход без ключа гостиницы и без ключа платформы отказывает в generate().
        if settings.llm_base_url:
            self._client = self._make_client(
                settings.llm_base_url, settings.llm_api_key or "no-platform-key", http_client
            )
        base = settings.llm_emergency_base_url.strip()
        key = settings.llm_emergency_api_key.strip()
        if base and key:
            self._emergency_client = self._make_client(base, key, http_client)
        elif base or key:
            # Полунастроенный путь молча выключенным не остаётся: владелец
            # думает, что страховка есть, а её нет.
            logger.warning(
                "второй путь аварийной модели не включён: нужны и LLM_EMERGENCY_BASE_URL, "
                "и LLM_EMERGENCY_API_KEY"
            )
        for warning in check_distinct_vendors(self.models):
            logger.warning("каскад моделей: %s", warning)

    def _make_client(self, base_url: str, api_key: str, http_client: httpx.AsyncClient | None) -> AsyncOpenAI:
        return AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
            # Повтор делаем сами, меняя модель между попытками.
            max_retries=0,
            timeout=self._settings.llm_timeout_seconds,
            http_client=http_client,
        )

    def _client_for(self, model: str, api_key: str | None) -> AsyncOpenAI:
        """Клиент ступени: шлюз, шлюз с ключом партнёра или второй путь.

        Второй путь — только аварийной ступени и только на ключе платформы.
        Ступень узнаём по имени из настроек, но лишь когда оно не совпало
        с основной или запасной: дубль каскад схлопнул, и отдельной
        аварийной ступени тогда нет.
        """
        assert self._client is not None
        if api_key is not None:
            # Ключ партнёра — тем же клиентом и пулом соединений, только другой Authorization.
            return self._client.with_options(api_key=api_key)
        s = self._settings
        emergency = s.llm_model_emergency.strip()
        if (
            self._emergency_client is not None
            and model == emergency
            and model not in (s.llm_model.strip(), s.llm_model_fallback.strip())
        ):
            return self._emergency_client
        return self._client

    @property
    def models(self) -> list[str]:
        return self._settings.llm_models

    async def generate(
        self,
        messages: list[dict],
        *,
        use_tools: bool = True,
        max_tool_rounds: int = 3,
        api_key: str | None = None,
    ) -> LlmResult:
        """Один вызов слоя модели. Никогда не поднимает исключение.

        `api_key` — ключ модели партнёра на этот ход (С2, Q-186): с ним каскад
        ходит к тому же роутеру, но расход ложится на партнёра. None — ключ
        платформы; пустая строка — честный отказ роутера, подмены нет.
        """
        # маскировка до каскада: запасная ступень не должна увидеть ПД
        masker = MessageMasker(
            allowlist_phones=self._settings.pii_allowlist_phones_list,
            allowlist_emails=self._settings.pii_allowlist_emails_list,
        )
        masked = masker.mask(messages)
        # Тот же маскировщик дописывает метки из результатов инструментов.
        mapping = masker.mapping
        no_key = api_key is None and not self._settings.llm_api_key
        if self._client is None or not self.models or no_key:
            logger.error("слой модели не настроен: нет адреса, ключа или списка моделей")
            return LlmResult(ok=False, mapping=mapping, error=NOT_CONFIGURED)

        attempts: list[AttemptLog] = []
        spent: int | None = None
        try:
            for model in self.models:
                started = time.perf_counter()
                outcome, text, usage = await self._attempt(
                    model,
                    masked,
                    masker,
                    use_tools=use_tools,
                    max_tool_rounds=max_tool_rounds,
                    api_key=api_key,
                )
                seconds = round(time.perf_counter() - started, 3)
                spent = _add(spent, usage.total)
                if outcome == OK:
                    attempts.append(AttemptLog(model, OK, seconds))
                    return LlmResult(
                        ok=True,
                        text=text,
                        parsed=parse_model_reply(text),
                        model=model,
                        attempts=attempts,
                        mapping=mapping,
                        # Сумма — все ступени, включая отказавшие (ревизия 26.09): на ней пределы;
                        # разбивка — удачной ступени, по её модели считается цена (Р2).
                        tokens_used=spent,
                        tokens_input=usage.input,
                        tokens_cached=usage.cached,
                        tokens_output=usage.output,
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
        api_key: str | None = None,
    ) -> tuple[str, str, Usage]:
        """Одна ступень -> (исход, текст, расход по всем её раундам).

        При исходе OK текст — ответ модели; при отказе — короткая нейтральная
        заметка для журнала (код HTTP, причина), без тела ответа и ПД.
        Раунды инструментов идут внутри той же ступени. Любое исключение —
        исход invalid: сбой одной ступени не должен класть остальные.
        """
        client = self._client_for(model, api_key)
        settings = self._settings
        tools = self._tools.specs_for_openai() if use_tools else []
        # Копия: раунды инструментов дописывают сообщения, а следующая
        # ступень должна начать с исходного замаскированного списка.
        convo = list(messages)
        if settings.llm_prompt_cache_mark and vendor_of(model) in _CACHE_MARK_VENDORS:
            convo = _with_cache_mark(convo)
        tokens = Usage()

        try:
            for round_no in range(max_tool_rounds + 1):
                try:
                    response = await client.chat.completions.create(
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

                tokens.add(_usage_of(response))

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
