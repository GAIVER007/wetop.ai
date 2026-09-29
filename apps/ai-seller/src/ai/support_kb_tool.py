"""Инструмент техподдержки «найти в знаниях WETOP» (S3).

🔴 Аргумент один — вопрос. «Для кого» и «по какой видимости» модель не выбирает: клиентский разговор всегда идёт с
audience="client", то есть PLATFORM_ADMIN_ONLY до модели не доходит совсем, а внутренние записи идут с пометкой
«объясни своими словами, не цитируй». Слабое совпадение — честное «не знаю», а не догадка.

🔴 Идентификаторов записей модель не получает (они пишутся в журнал использования для оператора): клиентский ответ
не может их повторить. Отвечает только ACTIVE (проверяет поиск).
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

from src.ai.tools import ToolRegistry, ToolSpec
from src.knowledge import support_kb as kb

logger = logging.getLogger(__name__)

MAX_HITS = 3
HIT_TEXT_MAX = 2000
_CATEGORY = {
    "PRODUCT": "о продукте", "HOW_TO": "как сделать", "TROUBLESHOOTING": "разбор проблемы", "BILLING": "оплата и подписка",
    "INTEGRATIONS": "интеграции", "SECURITY": "безопасность", "KNOWN_ISSUE": "известная проблема", "RUNBOOK": "регламент",
}
_INTERNAL_NOTE = "внутреннее: объясни своими словами, не цитируй"


def register_kb_tool(
    registry: ToolRegistry,
    *,
    knowledge_getter: Callable[[], Any],
    settings_getter: Callable[[], Any],
    conversation_getter: Callable[[], str | None],
    rules: str = "",
    unknown: str = "не знаю",
) -> None:
    async def search_knowledge(query: str) -> str:
        runtime = None
        try:
            runtime = knowledge_getter()
            settings = settings_getter()
        except Exception:
            logger.exception("search_knowledge: зависимости не получены")
            return unknown
        if runtime is None:
            return unknown
        text = str(query or "").strip()
        if not text:
            return unknown
        high = float(getattr(settings, "support_kb_high", 0.85))
        medium = float(getattr(settings, "support_kb_medium", 0.78))
        top_k = min(int(getattr(settings, "kb_top_k", MAX_HITS) or MAX_HITS), MAX_HITS)
        try:
            async with runtime.session_factory() as session:
                hits = await kb.search(
                    session, runtime.embedder, text, audience="client", top_k=top_k, high=high, medium=medium
                )
                useful = [hit for hit in hits if hit.confidence != "LOW"]
                if not useful:
                    return unknown
                try:
                    conversation = conversation_getter()
                except Exception:
                    conversation = None
                await kb.record_usage(session, conversation_id=conversation, hits=useful)
                await session.commit()
        except Exception:
            logger.exception("search_knowledge: поиск не удался")
            return unknown
        parts = []
        for number, hit in enumerate(useful, start=1):
            notes = [
                _CATEGORY.get(hit.category, hit.category),
                f"версия {hit.version}",
                f"уверенность {hit.confidence}",
            ]
            if hit.visibility == "INTERNAL_SUPPORT":
                notes.append(_INTERNAL_NOTE)
            body = hit.content if len(hit.content) <= HIT_TEXT_MAX else hit.content[:HIT_TEXT_MAX] + "…"
            parts.append(f"[{number}] «{hit.title}» ({'; '.join(notes)}). {body}")
        tail = ""
        if all(hit.confidence == "MEDIUM" for hit in useful):
            tail = " Уверенность средняя: проверь, что вопрос человека действительно об этом, иначе скажи, что уточнит специалист."
        return "\n".join(parts) + tail

    registry.register(
        ToolSpec(
            name="search_knowledge",
            description=(
                "Найти в проверенной базе знаний WETOP ответ на вопрос о продукте: как сделать, что значит режим, какие есть"
                " известные проблемы. Возвращает до трёх записей с уровнем уверенности или «не знаю». Отвечай своими"
                " словами; номера, версии и служебные пометки человеку не называй. Записи с пометкой «внутреннее»"
                " не цитируй. Если знаний нет — скажи, что уточнит специалист." + rules
            ),
            parameters={
                "type": "object",
                "properties": {"query": {"type": "string", "description": "Вопрос человека своими словами"}},
                "required": ["query"],
            },
            handler=search_knowledge,
        )
    )
