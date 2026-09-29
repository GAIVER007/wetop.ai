"""Панель бота: журнал действий диалога для кабинета (S6). Только служебный ключ, клиенту не отдаётся."""

from __future__ import annotations

import uuid

import pytest

from src.ai.support_actions_journal import record
from tests.dashboard_fakes import PANEL, panel, seed_conversation, sync_db  # noqa: F401

KEY = "service-key-for-tests"
SERVICE = {"X-Service-Key": KEY}


@pytest.fixture
def board(monkeypatch, fake_redis, sync_db):  # noqa: F811
    with panel(monkeypatch, fake_redis, SELLER_SERVICE_KEY=KEY, BOT_ROLE="support") as p:
        yield p


@pytest.mark.asyncio
async def test_actions_of_a_conversation_are_listed_for_the_service_key(board, sync_db, db_session) -> None:  # noqa: F811
    conv = str(seed_conversation(sync_db))
    await record(
        db_session, conversation_id=conv, user_ref="u_abc", action="channel_pull", action_class="SAFE",
        status="DONE", result="ревизий получено 3",
    )
    await record(
        db_session, conversation_id=str(uuid.uuid4()), user_ref="u_abc", action="refund", action_class="HUMAN_ONLY",
        status="ESCALATED", result="чужой диалог",
    )
    await db_session.commit()
    response = board.client.get(f"{PANEL}/conversations/{conv}/actions", headers=SERVICE)
    assert response.status_code == 200, response.text
    items = response.json()["items"]
    assert [i["action"] for i in items] == ["channel_pull"]
    assert items[0]["class"] == "SAFE" and items[0]["status"] == "DONE" and items[0]["result"] == "ревизий получено 3"


def test_without_the_service_key_the_journal_is_closed(board, sync_db) -> None:  # noqa: F811
    conv = str(seed_conversation(sync_db))
    assert board.client.get(f"{PANEL}/conversations/{conv}/actions").status_code in (401, 403)
    assert board.client.get(f"{PANEL}/conversations/not-a-uuid/actions", headers=SERVICE).status_code == 400
