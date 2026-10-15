"""Отчёт о расходе модели по гостиницам за месяц (plans/seller-cost-controls-2026-09-26.md, п. 3).

Ментор 26.09: цена ИИ-продавца строится от расхода гостиницы — токены из
журнала бота за месяц. Команда `python -m src.jobs.usage_report --month 2026-09`
печатает по гостиницам: диалоги, ответы бота, токены (вход, кэш, выход)
и оценку стоимости по ценам моделей из LLM_PRICES. Помощник платформы
(без организации) в отчёт не входит. Текста переписки и данных гостей
в отчёте нет. Месяц — по времени Казахстана (UTC+5), как дневной предел.

🔴 До кода красный: команды нет.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pytest

from src.config import get_settings
from src.db.base import ConversationMode, FunnelStage, MessageRole, utcnow
from src.db.models import Client, Conversation, Message, OrganizationLlmKey
from tests.dashboard_fakes import seed_org, sync_db  # noqa: F401 — sync_db идёт фикстурой

ROOT = Path(__file__).resolve().parent.parent
ORG_A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa"
ORG_B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb"
GUEST_TEXT = "Меня зовут Иван Петров, мой номер +7 701 111 22 33"
SEPT = datetime(2026, 9, 15, 12, 0, tzinfo=timezone.utc)


def _utc(*args: int) -> datetime:
    return datetime(*args, tzinfo=timezone.utc)


def _conversation(sessions, org: str | None, external_id: str) -> uuid.UUID:
    with sessions() as session:
        client = Client(channel="widget", external_id=external_id,
                        organization_id=uuid.UUID(org) if org else None,
                        agent_id=uuid.UUID(org) if org else None, created_at=SEPT)  # агент = организации (§20.4)
        session.add(client)
        session.flush()
        conversation = Conversation(client_id=client.id, organization_id=uuid.UUID(org) if org else None,
                                    agent_id=uuid.UUID(org) if org else None,
                                    mode=ConversationMode.BOT_ACTIVE, funnel_stage=FunnelStage.NEW,
                                    lead_data={}, created_at=SEPT, last_activity_at=SEPT)
        session.add(conversation)
        session.commit()
        return conversation.id


def _message(sessions, conversation_id: uuid.UUID, *, at: datetime = SEPT, role=MessageRole.ASSISTANT,
             content: str = "Ответ бота.", tokens: int | None = None, model: str | None = None,
             inp: int | None = None, cached: int | None = None, out: int | None = None) -> None:
    with sessions() as session:
        session.add(Message(conversation_id=conversation_id, role=role, content=content,
                            sent_by_us=role != MessageRole.USER, tokens_used=tokens, llm_model=model,
                            tokens_input=inp, tokens_cached=cached, tokens_output=out, created_at=at))
        session.commit()


@pytest.fixture
def seeded(sync_db):  # noqa: F811
    """Гостиница А: два диалога в сентябре; гостиница Б со своим ключом — один;
    помощник — один. Плюс строки на границах месяца и реплики не бота."""
    seed_org(sync_db, ORG_A, name="Luxx Aparts")
    seed_org(sync_db, ORG_B, key="sk_" + "cd" * 12, name="Гостиница Б")
    with sync_db() as session:
        session.add(OrganizationLlmKey(organization_id=uuid.UUID(ORG_B), key_encrypted=b"x", last4="1234",
                                       updated_at=utcnow()))
        session.commit()

    a1 = _conversation(sync_db, ORG_A, "guest-a1")
    _message(sync_db, a1, role=MessageRole.USER, content=GUEST_TEXT)
    _message(sync_db, a1, tokens=1500, model="openai/x", inp=1200, cached=400, out=300)
    _message(sync_db, a1, tokens=1000, model="openai/x", inp=900, cached=600, out=100)
    _message(sync_db, a1, role=MessageRole.OPERATOR, content="Ответ сотрудника.")
    a2 = _conversation(sync_db, ORG_A, "guest-a2")
    # 31.08 20:00 UTC = 01.09 01:00 по Казахстану — это сентябрь
    _message(sync_db, a2, at=_utc(2026, 8, 31, 20, 0), tokens=700, model="google/y", inp=600, cached=None, out=100)
    # 30.09 19:30 UTC = 01.10 00:30 по Казахстану — это уже октябрь
    _message(sync_db, a2, at=_utc(2026, 9, 30, 19, 30), tokens=99_999, model="openai/x", inp=99_000, out=999)
    # Строка до разбивки (старый продавец): только сумма
    _message(sync_db, a2, tokens=500)

    b1 = _conversation(sync_db, ORG_B, "guest-b1")
    _message(sync_db, b1, tokens=2000, model="openai/x", inp=1800, cached=0, out=200)

    s1 = _conversation(sync_db, None, "visitor-1")
    _message(sync_db, s1, tokens=77_777, model="openai/x", inp=70_000, cached=0, out=7_777)
    return sync_db


def _collect(month: str = "2026-09", prices: str = ""):
    import asyncio

    from src.dependencies import close_resources, get_sessionmaker
    from src.jobs.usage_report import collect, parse_month, parse_prices

    async def run():
        try:
            async with get_sessionmaker()() as session:
                return await collect(session, month=parse_month(month), prices=parse_prices(prices)[0])
        finally:
            await close_resources()

    return asyncio.run(run())


def test_the_month_is_counted_by_kazakhstan_time() -> None:
    from src.ai.budget import local_month_bounds

    assert local_month_bounds(2026, 9) == (_utc(2026, 8, 31, 19, 0), _utc(2026, 9, 30, 19, 0))
    assert local_month_bounds(2026, 12) == (_utc(2026, 11, 30, 19, 0), _utc(2026, 12, 31, 19, 0))


def test_hotels_are_counted_apart_and_the_assistant_is_left_out(seeded) -> None:
    report = _collect()
    by_org = {str(r.organization_id): r for r in report.rows}
    assert set(by_org) == {ORG_A, ORG_B}, "помощник (без гостиницы) в отчёт не входит"

    a = by_org[ORG_A]
    assert a.name == "Luxx Aparts" and a.own_key is False
    assert a.conversations == 2
    assert a.replies == 4, "ответы бота за сентябрь; гость, сотрудник и октябрь не считаются"
    assert a.tokens == 1500 + 1000 + 700 + 500
    assert (a.input, a.cached, a.output) == (1200 + 900 + 600, 400 + 600, 300 + 100 + 100)
    assert a.unsplit_replies == 1

    b = by_org[ORG_B]
    assert b.own_key is True and b.conversations == 1 and b.replies == 1 and b.tokens == 2000
    assert report.total.tokens == a.tokens + b.tokens


def test_cost_uses_the_input_cache_and_output_prices(seeded) -> None:
    report = _collect(prices="openai/x=2/0.5/8,google/y=1/0.25/4")
    a = next(r for r in report.rows if str(r.organization_id) == ORG_A)
    openai_x = ((1200 + 900 - 1000) * 2 + 1000 * 0.5 + (300 + 100) * 8) / 1_000_000
    google_y = (600 * 1 + 0 * 0.25 + 100 * 4) / 1_000_000
    assert a.cost == pytest.approx(openai_x + google_y)
    assert report.unpriced_models == set()


def test_models_without_a_price_are_named_not_guessed(seeded) -> None:
    report = _collect(prices="openai/x=2/0.5/8")
    assert report.unpriced_models == {"google/y"}
    a = next(r for r in report.rows if str(r.organization_id) == ORG_A)
    assert a.cost_partial is True


def test_prices_parse_and_bad_entries_are_reported() -> None:
    from src.jobs.usage_report import parse_prices

    prices, errors = parse_prices("openai/x=2/0.5/8, google/y = 1/0.25/4,broken,z=1/2")
    assert set(prices) == {"openai/x", "google/y"}
    assert prices["google/y"].cached == pytest.approx(0.25)
    assert errors == ["broken", "z=1/2"]


def test_the_command_prints_the_report_without_guest_data(seeded, capsys) -> None:
    from src.jobs.usage_report import main

    assert main(["--month", "2026-09"]) == 0
    out = capsys.readouterr().out
    assert "2026-09" in out and "Luxx Aparts" in out and "Гостиница Б" in out
    assert re.search(r"3\s?700", out), "токены гостиницы А видны в отчёте"
    for private in ("Иван", "701", "guest-a1", "visitor-1", "Ответ сотрудника"):
        assert private not in out, f"{private!r} — данные переписки в отчёте"


def test_a_bad_month_is_refused(seeded) -> None:
    from src.jobs.usage_report import main

    with pytest.raises(SystemExit) as exc:
        main(["--month", "2026-13"])
    assert exc.value.code == 2


def test_prices_setting_is_in_the_template_empty() -> None:
    assert get_settings().llm_prices == ""
    text = (ROOT / "env.example").read_text(encoding="utf-8")
    values = dict(re.findall(r"^([A-Z_0-9]+)=([^\s#]*)", text, re.MULTILINE))
    assert values.get("LLM_PRICES") == ""
