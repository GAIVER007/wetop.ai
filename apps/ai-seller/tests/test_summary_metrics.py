"""S2.9: доля диалогов без человека, передачи человеку и время первого ответа в сводке продавца.

🔴 Нет диалогов или нет ответов: null, а не 0. Ноль секунд и 0 % выглядели бы как «всё мгновенно» и «никто не справился».
"""

from __future__ import annotations

from datetime import timedelta

import pytest

from src.db.base import ConversationMode, FunnelStage, MessageRole, utcnow
from src.db.models import Client, Conversation, Message
from tests.dashboard_fakes import OPERATOR_EMAIL, OWNER_EMAIL, PANEL, make_user, panel, sync_db  # noqa: F401


@pytest.fixture
def board(monkeypatch, fake_redis, sync_db):
    make_user(sync_db, email=OWNER_EMAIL, role="owner")
    make_user(sync_db, email=OPERATOR_EMAIL, role="operator")
    with panel(monkeypatch, fake_redis) as p:
        yield p


def _dialog(sessions, ext, *, reply_after=None, operator=False, mode=ConversationMode.BOT_ACTIVE, channel="widget"):
    now = utcnow()
    start = now - timedelta(minutes=30)
    with sessions() as session:
        client = Client(channel=channel, external_id=ext, name=None, phone=None, created_at=now)
        session.add(client)
        session.flush()
        conv = Conversation(
            client_id=client.id, mode=mode, funnel_stage=FunnelStage.NEW, lead_data={},
            is_active=True, created_at=start, last_activity_at=now,
        )
        session.add(conv)
        session.flush()
        session.add(Message(conversation_id=conv.id, role=MessageRole.USER, content="Есть места?", sent_by_us=False, created_at=start))
        if reply_after is not None:
            session.add(Message(
                conversation_id=conv.id, role=MessageRole.ASSISTANT, content="Да", sent_by_us=True,
                created_at=start + timedelta(seconds=reply_after),
            ))
        if operator:
            session.add(Message(
                conversation_id=conv.id, role=MessageRole.OPERATOR, content="Я подключился", sent_by_us=True,
                created_at=start + timedelta(minutes=5),
            ))
        session.commit()


def _summary(board, **params):
    return board.client.get(f"{PANEL}/summary", params=params, headers=board.headers()).json()


def test_no_dialogs_means_null_not_zero(board) -> None:
    body = _summary(board)
    assert body["handoffs"] == 0
    assert body["automated_permille"] is None
    assert body["avg_first_reply_seconds"] is None


def test_share_without_a_human_and_first_reply_time(board, sync_db) -> None:
    _dialog(sync_db, "a", reply_after=10)
    _dialog(sync_db, "b", reply_after=30)
    _dialog(sync_db, "c", reply_after=20, operator=True)  # оператор вмешался
    _dialog(sync_db, "d", mode=ConversationMode.NEEDS_HUMAN)  # ждёт человека, ответа продавца нет
    body = _summary(board)
    assert body["dialogs"] == 4
    assert body["handoffs"] == 2
    assert body["automated_permille"] == 500
    assert body["avg_first_reply_seconds"] == 20  # (10 + 30 + 20) / 3, диалог без ответа не в счёте


def test_owner_takeover_counts_as_a_handoff(board, sync_db) -> None:
    _dialog(sync_db, "a", reply_after=5, mode=ConversationMode.OWNER_TAKEOVER)
    _dialog(sync_db, "b", reply_after=5)
    assert _summary(board)["automated_permille"] == 500


def test_sandbox_checks_stay_out_when_asked(board, sync_db) -> None:
    _dialog(sync_db, "real", reply_after=10)
    _dialog(sync_db, "check", reply_after=100, mode=ConversationMode.NEEDS_HUMAN, channel="sandbox")
    all_ = _summary(board)
    assert all_["handoffs"] == 1
    clean = _summary(board, exclude_sandbox=1)
    assert clean["handoffs"] == 0
    assert clean["automated_permille"] == 1000
    assert clean["avg_first_reply_seconds"] == 10
