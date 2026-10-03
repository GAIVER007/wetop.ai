"""Алерт «модель не ответила» и пустой промпт гостиницы (plans/seller-llm-down-alert-2026-09-26.md).

Вид `llm_down` объявлен в шаге 8, но ни одна строка его не выпускала: на отказе модели гость получал
«администратор свяжется», а владелец — ничего, и диалог никто не помечал. Решения владельца 02.10
(«да давай делай» на рекомендацию «оба — да»): Р1 — отказ модели помечает диалог «нужен человек»
(пометка, не перехват); Р2 — пустой промпт гостиницы даёт алерт `prompt_missing` раз в сутки.

🔴 До правки красный: алертов нет, пометки нет, вида `prompt_missing` нет.
"""

from __future__ import annotations

import sqlalchemy as sa

from src.ai.engine import NEUTRAL_REPLY
from src.ai.engine_types import IncomingMessage
from src.ai.llm import AttemptLog, LlmResult
from src.alerts.raise_alert import EVENT_TYPES
from src.db.base import ConversationMode, OutboxKind, utcnow
from src.db.models import Conversation, OutboxItem
from src.knowledge.prompt import PromptMissing
from tests.dashboard_fakes import _all, seed_org, sync_db  # noqa: F401 — sync_db идёт фикстурой
from tests.engine_fakes import MemorySender, ScriptedLlm, engine_env, incoming, reply  # noqa: F401

ORG = "cccccccc-3333-4333-8333-cccccccccccc"
HOTEL = "Гостиница «Тест»"
GUEST_TEXT = "Есть места на завтра? Мой телефон +77011234567"


class FailingCascade:
    """Каскад, у которого отказали все ступени: так его отдаёт CascadeClient."""

    def __init__(self) -> None:
        self.calls = 0

    async def generate(self, messages, **kwargs) -> LlmResult:
        self.calls += 1
        return LlmResult(
            ok=False,
            error="all_models_failed",
            attempts=[
                AttemptLog("openai/gpt-4o-mini", "timeout", 30.0, note="upstream: read timeout"),
                AttemptLog("anthropic/claude-haiku", "http_error", 0.4, note="HTTP 402 Payment Required"),
            ],
        )


def _seller_incoming(external_id: str) -> IncomingMessage:
    return IncomingMessage(
        channel="widget",
        external_id=external_id,
        text=GUEST_TEXT,
        received_at=utcnow(),
        organization_id=ORG,
        agent_id=ORG,  # перенесённый продавец: агент = организации (§20.4)
    )


def _alerts(sessions, prefix: str) -> list[OutboxItem]:
    rows = _all(sessions, sa.select(OutboxItem).where(OutboxItem.kind == OutboxKind.ALERT))
    return [r for r in rows if (r.dedup_key or "").startswith(prefix)]


def _keys(rows: list[OutboxItem]) -> set[str]:
    """Ключ алерта без суффикса канала (почта / мессенджер)."""
    return {r.dedup_key.rsplit(":", 1)[0] for r in rows}


# ─── llm_down ───


async def test_model_failure_raises_one_alert_per_hotel(engine_env, sync_db) -> None:  # noqa: F811
    seed_org(sync_db, ORG, prompt="Ты продавец гостиницы «Тест».", name=HOTEL)
    llm = FailingCascade()
    sender = MemorySender()
    engine = engine_env.engine(llm=llm, sender=sender)
    outcome = await engine.process_message(_seller_incoming("guest-1"))

    assert outcome.reply == NEUTRAL_REPLY and "llm_failed" in outcome.reasons
    alerts = _alerts(sync_db, "llm_down:")
    assert alerts, "владелец узнаёт, что модель не ответила"
    assert _keys(alerts) == {f"llm_down:{ORG}"}
    body = alerts[0].body
    assert HOTEL in body and ORG in body
    assert "all_models_failed" in body
    assert "openai/gpt-4o-mini — timeout" in body and "anthropic/claude-haiku — http_error" in body
    # ни текста гостя, ни его контакта, ни заметок ступеней (в них может быть что угодно от роутера)
    assert "Есть места" not in body and "+77011234567" not in body and "guest-1" not in body
    assert "Payment Required" not in body and "read timeout" not in body

    # второй гость той же гостиницы в окне молчания — нового алерта нет
    first = len(alerts)
    await engine.process_message(_seller_incoming("guest-2"))
    assert len(_alerts(sync_db, "llm_down:")) == first


async def test_successful_turn_raises_no_alert(engine_env, sync_db) -> None:  # noqa: F811
    seed_org(sync_db, ORG, prompt="Ты продавец гостиницы «Тест».", name=HOTEL)
    engine = engine_env.engine(llm=ScriptedLlm([reply("Есть свободные номера.")]))
    outcome = await engine.process_message(_seller_incoming("guest-3"))
    assert outcome.status == "replied"
    assert _alerts(sync_db, "llm_down:") == []
    assert _alerts(sync_db, "prompt_missing:") == []


async def test_assistant_model_failure_alert_names_the_assistant(engine_env, sync_db) -> None:  # noqa: F811
    engine = engine_env.engine(llm=FailingCascade())
    await engine.process_message(incoming("Как оформить бронь?"))
    alerts = _alerts(sync_db, "llm_down:")
    assert _keys(alerts) == {"llm_down:assistant"}
    assert "помощник" in alerts[0].body
    assert "Как оформить" not in alerts[0].body


async def test_model_exception_is_alerted_too(engine_env, sync_db) -> None:  # noqa: F811
    class ExplodingLlm:
        async def generate(self, messages, **kwargs):
            raise RuntimeError("взрыв внутри слоя модели")

    seed_org(sync_db, ORG, prompt="Ты продавец гостиницы «Тест».", name=HOTEL)
    await engine_env.engine(llm=ExplodingLlm()).process_message(_seller_incoming("guest-4"))
    alerts = _alerts(sync_db, "llm_down:")
    assert alerts, "исключение слоя модели — тоже отказ модели"
    assert "взрыв" not in alerts[0].body


# ─── Р1: пометка «нужен человек» ───


async def test_model_failure_marks_the_dialog_for_staff(engine_env, sync_db) -> None:  # noqa: F811
    seed_org(sync_db, ORG, prompt="Ты продавец гостиницы «Тест».", name=HOTEL)
    outcome = await engine_env.engine(llm=FailingCascade()).process_message(_seller_incoming("guest-5"))
    assert outcome.needs_human is True, "фраза обещает администратора — его надо позвать"
    conversation = _all(sync_db, sa.select(Conversation).where(Conversation.id == outcome.conversation_id))[0]
    assert conversation.mode == ConversationMode.NEEDS_HUMAN


# ─── Р2: пустой промпт гостиницы ───


def test_prompt_missing_is_a_declared_alert_kind() -> None:
    assert "prompt_missing" in EVENT_TYPES


async def test_empty_hotel_prompt_raises_an_alert_once_a_day(engine_env, sync_db) -> None:  # noqa: F811
    seed_org(sync_db, ORG, prompt=None, name=HOTEL)
    llm = ScriptedLlm([reply("Не должно дойти.")])
    engine = engine_env.engine(llm=llm)
    outcome = await engine.process_message(_seller_incoming("guest-6"))
    assert "prompt_missing" in outcome.reasons and llm.calls == 0

    alerts = _alerts(sync_db, "prompt_missing:")
    assert alerts, "владелец узнаёт, что у гостиницы нет промпта"
    assert _keys(alerts) == {f"prompt_missing:{ORG}"}
    assert HOTEL in alerts[0].body and ORG in alerts[0].body
    assert "Есть места" not in alerts[0].body and "+77011234567" not in alerts[0].body

    first = len(alerts)
    await engine.process_message(_seller_incoming("guest-7"))
    assert len(_alerts(sync_db, "prompt_missing:")) == first, "второй гость за сутки алерт не повторяет"
    silence = await engine_env.redis.ttl(f"alert:seen:prompt_missing:{ORG}")
    assert silence > 23 * 3600, silence


async def test_assistant_prompt_file_missing_raises_an_alert(engine_env, sync_db) -> None:  # noqa: F811
    def broken_loader() -> str:
        raise PromptMissing("файл системного промпта не найден")

    await engine_env.engine(llm=ScriptedLlm([reply("-")]), prompt_loader=broken_loader).process_message(
        incoming("Как оформить бронь?")
    )
    alerts = _alerts(sync_db, "prompt_missing:")
    assert _keys(alerts) == {"prompt_missing:assistant"}
    assert "помощник" in alerts[0].body
