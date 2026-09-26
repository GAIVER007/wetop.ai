"""Дневной предел токенов гостиницы на ключе платформы (plans/seller-cost-controls-2026-09-26.md, п. 1).

Решение владельца 26.09: 150 000 токенов в сутки на гостиницу, пока она ходит
ключом платформы. Выше предела продавец модель не зовёт, гостю — нейтральная
фраза «администратор свяжется», диалог помечен для сотрудника, владельцу —
один алерт в сутки. Гостиница со своим ключом (С2) — её расход, предела нет;
помощник (без организации) не трогается. Сутки — по Казахстану (UTC+5).

🔴 До кода красный: предела нет ни в настройках, ни в движке.
"""

from __future__ import annotations

import base64
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import sqlalchemy as sa

from src.ai.engine import NEUTRAL_REPLY
from src.ai.engine_types import IncomingMessage
from src.config import Settings, get_settings
from src.db.base import ConversationMode, FunnelStage, MessageRole, OutboxKind, utcnow
from src.db.models import Client, Conversation, Message, OrganizationLlmKey, OutboxItem
from src.security.llm_keys import encrypt_key
from tests.dashboard_fakes import _all, seed_org, sync_db  # noqa: F401 — sync_db идёт фикстурой
from tests.engine_fakes import MemorySender, ScriptedLlm, engine_env, reply  # noqa: F401

ROOT = Path(__file__).resolve().parent.parent
ORG_A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa"
ORG_B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb"
CAP = 1000
FERNET = base64.urlsafe_b64encode(b"test-secret-32-bytes-for-fernet!").decode()
MODEL_ANSWER = "Здравствуйте! Есть свободные номера."


@pytest.fixture
def cap(monkeypatch):
    """Предел поменьше, чтобы не заводить в базе сотни тысяч токенов."""
    monkeypatch.setenv("LLM_DAILY_TOKENS_PER_ORG", str(CAP))
    get_settings.cache_clear()
    return CAP


KZ = timezone(timedelta(hours=5))


def _day_start(now: datetime) -> datetime:
    """Полночь по Казахстану в UTC — своим расчётом, не кодом бота."""
    local = now.astimezone(KZ)
    return local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)


def _seed_spend(sessions, org: str | None, tokens: int, at: datetime) -> None:
    """Ответ бота гостинице с расходом tokens в момент at — как его пишет движок."""
    with sessions() as session:
        client = Client(
            channel="widget",
            external_id=f"spend-{uuid.uuid4().hex[:8]}",
            organization_id=uuid.UUID(org) if org else None,
            created_at=at,
        )
        session.add(client)
        session.flush()
        conversation = Conversation(
            client_id=client.id,
            organization_id=uuid.UUID(org) if org else None,
            mode=ConversationMode.BOT_ACTIVE,
            funnel_stage=FunnelStage.NEW,
            lead_data={},
            created_at=at,
            last_activity_at=at,
        )
        session.add(conversation)
        session.flush()
        session.add(
            Message(
                conversation_id=conversation.id,
                role=MessageRole.ASSISTANT,
                content="Ответ бота.",
                sent_by_us=True,
                tokens_used=tokens,
                created_at=at,
            )
        )
        session.commit()


def _today() -> datetime:
    """Момент внутри текущих местных суток — и в полночь по UTC+5 тоже."""
    return _day_start(utcnow()) + timedelta(seconds=1)


def _yesterday() -> datetime:
    return _day_start(utcnow()) - timedelta(seconds=1)


def _incoming(external_id: str, org: str | None = ORG_A) -> IncomingMessage:
    return IncomingMessage(
        channel="widget",
        external_id=external_id,
        text="Есть места на завтра?",
        received_at=utcnow(),
        organization_id=org,
    )


def _budget_alert_rows(sessions) -> list[OutboxItem]:
    rows = _all(sessions, sa.select(OutboxItem).where(OutboxItem.kind == OutboxKind.ALERT))
    return [r for r in rows if (r.dedup_key or "").startswith("llm_budget:")]


# ─── Настройка ───


def test_the_owner_default_is_150000_tokens_a_day() -> None:
    assert Settings.model_fields["llm_daily_tokens_per_org"].default == 150_000


def test_the_setting_is_in_the_template_with_the_same_value() -> None:
    """Настройки, которой нет в env.example, не существует (tests/test_partner_config.py)."""
    text = (ROOT / "env.example").read_text(encoding="utf-8")
    values = dict(re.findall(r"^([A-Z_0-9]+)=([^\s#]*)", text, re.MULTILINE))
    assert values.get("LLM_DAILY_TOKENS_PER_ORG") == "150000"


def test_the_day_is_counted_by_kazakhstan_time() -> None:
    """Сутки — с полуночи UTC+5: 18:59 UTC ещё вчера, 19:00 UTC — уже сегодня."""
    from src.ai.budget import local_day_start

    late = datetime(2026, 9, 26, 18, 59, 59, tzinfo=timezone.utc)
    assert local_day_start(late) == datetime(2026, 9, 25, 19, 0, tzinfo=timezone.utc)
    midnight = datetime(2026, 9, 26, 19, 0, tzinfo=timezone.utc)
    assert local_day_start(midnight) == datetime(2026, 9, 26, 19, 0, tzinfo=timezone.utc)


# ─── Движок ───


async def test_under_the_cap_the_model_answers(engine_env, sync_db, cap) -> None:  # noqa: F811
    seed_org(sync_db, ORG_A, prompt="Ты продавец гостиницы «А».")
    _seed_spend(sync_db, ORG_A, cap - 1, _today())
    llm = ScriptedLlm([reply(MODEL_ANSWER)])
    outcome = await engine_env.engine(llm=llm).process_message(_incoming("guest-1"))
    assert outcome.status == "replied", outcome
    assert llm.calls == 1
    assert outcome.reply == MODEL_ANSWER
    assert _budget_alert_rows(sync_db) == []


async def test_over_the_cap_the_model_is_not_called(engine_env, sync_db, cap) -> None:  # noqa: F811
    seed_org(sync_db, ORG_A, prompt="Ты продавец гостиницы «А».")
    _seed_spend(sync_db, ORG_A, cap, _today())
    llm = ScriptedLlm([reply(MODEL_ANSWER)])
    sender = MemorySender()
    outcome = await engine_env.engine(llm=llm, sender=sender).process_message(_incoming("guest-2"))

    assert llm.calls == 0, "выше предела модель не вызывается"
    assert outcome.reply == NEUTRAL_REPLY
    assert sender.texts == [NEUTRAL_REPLY], "гость получает фразу-передачу, а не тишину"
    assert "daily_budget" in outcome.reasons
    assert outcome.needs_human is True
    conversation = _all(sync_db, sa.select(Conversation).where(Conversation.id == outcome.conversation_id))[0]
    assert conversation.mode == ConversationMode.NEEDS_HUMAN, "сотрудник должен увидеть гостя в панели"
    bot = [m for m in _all(sync_db, sa.select(Message).where(Message.conversation_id == outcome.conversation_id))
           if m.role == MessageRole.ASSISTANT]
    assert [m.content for m in bot] == [NEUTRAL_REPLY]
    assert bot[0].tokens_used is None, "модель не звали — расхода нет"

    alerts = _budget_alert_rows(sync_db)
    assert alerts, "владелец узнаёт, что предел исчерпан"
    body = alerts[0].body
    assert ORG_A in body and str(CAP) in body
    assert "guest-2" not in body and "Есть места" not in body, "в алерте нет данных гостя"


async def test_the_alert_goes_once_a_day(engine_env, sync_db, cap) -> None:  # noqa: F811
    seed_org(sync_db, ORG_A, prompt="Ты продавец гостиницы «А».")
    _seed_spend(sync_db, ORG_A, cap * 3, _today())
    engine = engine_env.engine(llm=ScriptedLlm([reply(MODEL_ANSWER)]))
    await engine.process_message(_incoming("guest-3"))
    first = len(_budget_alert_rows(sync_db))
    await engine.process_message(_incoming("guest-4"))
    await engine.process_message(_incoming("guest-9"))
    assert first > 0
    assert len(_budget_alert_rows(sync_db)) == first, "второй и третий ход за сутки алерт не повторяют"
    keys = {r.dedup_key.rsplit(":", 1)[0] for r in _budget_alert_rows(sync_db)}
    assert len(keys) == 1, keys
    # Окно молчания — сутки, а не десять минут срока ответа: иначе тот же
    # алерт повторялся бы каждые десять минут до полуночи.
    silence = await engine_env.redis.ttl("alert:seen:" + keys.pop())
    assert silence > 23 * 3600, silence


async def test_yesterday_does_not_count(engine_env, sync_db, cap) -> None:  # noqa: F811
    seed_org(sync_db, ORG_A, prompt="Ты продавец гостиницы «А».")
    _seed_spend(sync_db, ORG_A, cap * 10, _yesterday())
    llm = ScriptedLlm([reply(MODEL_ANSWER)])
    outcome = await engine_env.engine(llm=llm).process_message(_incoming("guest-5"))
    assert llm.calls == 1 and outcome.reply == MODEL_ANSWER


async def test_another_hotel_spend_does_not_count(engine_env, sync_db, cap) -> None:  # noqa: F811
    seed_org(sync_db, ORG_A, prompt="Ты продавец гостиницы «А».")
    seed_org(sync_db, ORG_B, key="sk_" + "cd" * 12, name="Гостиница Б", prompt="Ты продавец «Б».")
    _seed_spend(sync_db, ORG_B, cap * 10, _today())
    llm = ScriptedLlm([reply(MODEL_ANSWER)])
    outcome = await engine_env.engine(llm=llm).process_message(_incoming("guest-6"))
    assert llm.calls == 1 and outcome.reply == MODEL_ANSWER


async def test_a_hotel_with_its_own_key_has_no_platform_cap(
    engine_env, sync_db, cap, monkeypatch  # noqa: F811
) -> None:
    monkeypatch.setenv("LLM_KEYS_SECRET", FERNET)
    get_settings.cache_clear()
    seed_org(sync_db, ORG_A, prompt="Ты продавец гостиницы «А».")
    with sync_db() as session:
        session.add(
            OrganizationLlmKey(
                organization_id=uuid.UUID(ORG_A),
                key_encrypted=encrypt_key("sk-partner-abcd1234", get_settings()),
                last4="1234",
                updated_at=utcnow(),
            )
        )
        session.commit()
    _seed_spend(sync_db, ORG_A, cap * 10, _today())
    llm = ScriptedLlm([reply(MODEL_ANSWER)])
    outcome = await engine_env.engine(llm=llm).process_message(_incoming("guest-7"))
    assert llm.calls == 1, "расход на ключе партнёра — его деньги, предел платформы не действует"
    assert llm.last_api_key == "sk-partner-abcd1234"
    assert outcome.reply == MODEL_ANSWER
    assert _budget_alert_rows(sync_db) == []


async def test_zero_turns_the_cap_off(engine_env, sync_db, monkeypatch) -> None:  # noqa: F811
    monkeypatch.setenv("LLM_DAILY_TOKENS_PER_ORG", "0")
    get_settings.cache_clear()
    seed_org(sync_db, ORG_A, prompt="Ты продавец гостиницы «А».")
    _seed_spend(sync_db, ORG_A, 10_000_000, _today())
    llm = ScriptedLlm([reply(MODEL_ANSWER)])
    outcome = await engine_env.engine(llm=llm).process_message(_incoming("guest-8"))
    assert llm.calls == 1 and outcome.reply == MODEL_ANSWER


async def test_the_support_instance_is_not_capped(engine_env, sync_db, cap) -> None:  # noqa: F811
    """Помощник платформы живёт без организации — предел гостиниц его не касается."""
    _seed_spend(sync_db, None, cap * 10, _today())
    llm = ScriptedLlm([reply(MODEL_ANSWER)])
    outcome = await engine_env.engine(llm=llm, prompt_text="Ты помощник платформы.").process_message(
        _incoming("visitor-1", org=None)
    )
    assert llm.calls == 1 and outcome.reply == MODEL_ANSWER
