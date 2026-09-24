"""Описания инструментов для модели и диспетчер их вызовов.

Реестр отдаёт описания в формате OpenAI tools и выполняет вызовы из ответа
модели. Любой сбой инструмента превращается в нейтральную строку для модели:
исключение отсюда уронило бы весь ход, а клиенту нужен хоть какой-то ответ.

Правило 11 кита: сырой ответ инструмента клиенту не показывают — пересказ
делает модель по промпту, здесь только строка для неё.
"""

from __future__ import annotations

import inspect
import json
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

TOOL_UNKNOWN = "инструмент недоступен"
TOOL_BAD_ARGS = "неверные аргументы"
TOOL_FAILED = "инструмент временно недоступен"


@dataclass(frozen=True)
class ToolSpec:
    """Один инструмент: имя и описание для модели, JSON Schema аргументов,
    обработчик, принимающий распакованные аргументы и возвращающий строку."""

    name: str
    description: str
    parameters: dict
    handler: Callable[..., Awaitable[str]]


def _attr(obj: Any, name: str, default: Any = None) -> Any:
    """Поле объекта SDK или ключ словаря: тесты и роутеры отдают оба вида."""
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


class ToolRegistry:
    """Реестр инструментов. Пустой реестр — допустимое состояние:
    модель тогда вызывается без tools."""

    def __init__(self) -> None:
        self._specs: dict[str, ToolSpec] = {}

    def register(self, spec: ToolSpec) -> None:
        # Дубль имени — ошибка настройки: молчаливая замена спрятала бы,
        # какой из двух обработчиков реально работает.
        if spec.name in self._specs:
            raise ValueError(f"инструмент уже зарегистрирован: {spec.name}")
        self._specs[spec.name] = spec

    @property
    def names(self) -> list[str]:
        return list(self._specs)

    def __len__(self) -> int:
        return len(self._specs)

    def specs_for_openai(self) -> list[dict]:
        """Формат tools для chat.completions; пустой реестр -> []."""
        return [
            {
                "type": "function",
                "function": {
                    "name": spec.name,
                    "description": spec.description,
                    "parameters": spec.parameters,
                },
            }
            for spec in self._specs.values()
        ]

    async def _run(self, name: str, raw_arguments: Any) -> str:
        spec = self._specs.get(name)
        if spec is None:
            logger.warning("модель вызвала неизвестный инструмент %s", name)
            return TOOL_UNKNOWN
        if isinstance(raw_arguments, dict):
            arguments = raw_arguments
        else:
            try:
                arguments = json.loads(raw_arguments or "{}")
            except (ValueError, TypeError):
                arguments = None
        if not isinstance(arguments, dict):
            logger.warning("инструмент %s: аргументы не разобраны", name)
            return TOOL_BAD_ARGS
        # Проверка по сигнатуре до вызова: выдуманный моделью ключ — это
        # «неверные аргументы», а не сбой обработчика с трассировкой в журнале.
        try:
            inspect.signature(spec.handler).bind(**arguments)
        except (TypeError, ValueError):
            logger.warning("инструмент %s: аргументы не подходят обработчику", name)
            return TOOL_BAD_ARGS
        try:
            result = await spec.handler(**arguments)
        except Exception:
            # Причина — в журнал; модели и клиенту только нейтральная строка.
            logger.exception("инструмент %s: сбой обработчика", name)
            return TOOL_FAILED
        return result if isinstance(result, str) else str(result)

    async def dispatch(self, tool_calls: list) -> list[dict]:
        """Вызовы из ответа модели (.id, .function.name, .function.arguments)
        -> tool-сообщения для следующего запроса. Исключений не бросает."""
        messages: list[dict] = []
        for call in tool_calls or []:
            function = _attr(call, "function")
            name = _attr(function, "name", "") or ""
            raw_arguments = _attr(function, "arguments", "{}")
            try:
                content = await self._run(name, raw_arguments)
            except Exception:  # страховка: сюда попадать не должно
                logger.exception("инструмент %s: необработанный сбой", name)
                content = TOOL_FAILED
            messages.append(
                {"role": "tool", "tool_call_id": _attr(call, "id"), "content": content}
            )
        return messages
