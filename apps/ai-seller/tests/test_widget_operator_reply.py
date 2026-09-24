"""Реплика оператора из панели видна в виджете.

🔴 Ответ человека уходит тем же путём, что ответ бота: записью в историю,
которую подберёт опрос браузера. Отдельный путь означал бы, что реплика
оператора теряется ровно тогда, когда она нужнее всего.

🔴 В историю пишем только после успешной отправки — это правило шага 8б,
и смена канала его не отменяет.
"""

from __future__ import annotations

import pytest

from src.db.base import ConversationMode, MessageRole
from tests.dashboard_fakes import (
    PANEL,
    FailingSender,
    install_sender,
    make_user,
    messages_of,
    panel,
    seed_conversation,
    sync_db,  # noqa: F401 — фикстура берётся из пространства имён модуля
)
from tests.widget_fakes import CHANNEL, PREFIX, SITE_ORIGIN, WIDGET_ENV

VISITOR = "v-1001"
REPLY = "Это Иван, оператор. Сейчас посмотрю."


@pytest.fixture
def board(monkeypatch, fake_redis, sync_db):  # noqa: F811
    make_user(sync_db)
    with panel(monkeypatch, fake_redis, **WIDGET_ENV) as p:
        yield p


def _poll(board, visitor_key: str = VISITOR) -> dict:
    response = board.client.get(
        f"{PREFIX}/messages",
        params={"visitor_key": visitor_key},
        headers={"Origin": SITE_ORIGIN},
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_reply_sender_is_the_widget_one(board) -> None:
    """🔴 Отправитель панели тот же, что у движка: одна дверь к клиенту."""
    from src.channels.widget import WidgetSender
    from src.dashboard.panel_conversations import build_reply_sender

    assert isinstance(build_reply_sender(board.settings), WidgetSender)


def test_operator_reply_is_seen_by_the_widget(board, sync_db) -> None:  # noqa: F811
    conversation_id = seed_conversation(
        sync_db, channel=CHANNEL, external_id=VISITOR, mode=ConversationMode.OWNER_TAKEOVER
    )

    response = board.client.post(
        f"{PANEL}/conversations/{conversation_id}/reply",
        json={"text": REPLY},
        headers=board.headers(),
    )

    assert response.status_code == 200, response.text
    body = _poll(board)
    last = body["messages"][-1]
    assert last["text"] == REPLY
    assert last["from_operator"] is True
    assert body["mode"] == ConversationMode.OWNER_TAKEOVER.value


def test_operator_reply_is_written_down_as_operator(board, sync_db) -> None:  # noqa: F811
    conversation_id = seed_conversation(sync_db, channel=CHANNEL, external_id=VISITOR)

    board.client.post(
        f"{PANEL}/conversations/{conversation_id}/reply",
        json={"text": REPLY},
        headers=board.headers(),
    )

    last = messages_of(sync_db, conversation_id)[-1]
    assert last.role is MessageRole.OPERATOR
    assert last.sent_by_us is True


def test_failed_delivery_keeps_the_reply_out_of_the_history(
    monkeypatch, fake_redis, sync_db  # noqa: F811
) -> None:
    """Отказ отправителя — и реплики нет ни в истории, ни в опросе:
    иначе оператор считает, что ответил, и второй раз не напишет."""
    make_user(sync_db)
    with panel(monkeypatch, fake_redis, **WIDGET_ENV) as board:
        conversation_id = seed_conversation(sync_db, channel=CHANNEL, external_id=VISITOR)
        install_sender(monkeypatch, FailingSender())

        response = board.client.post(
            f"{PANEL}/conversations/{conversation_id}/reply",
            json={"text": REPLY},
            headers=board.headers(),
        )

        assert response.status_code == 502, response.text
        assert REPLY not in _poll(board)["messages"][-1]["text"]

    assert all(m.content != REPLY for m in messages_of(sync_db, conversation_id))
