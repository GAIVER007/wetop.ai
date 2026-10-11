"""S2.6: ответственный, следующий шаг и внутренние заметки к диалогу.

🔴 Заметка внутренняя: в журнал действий идёт её длина, а не текст (в заметке бывает что угодно о госте).
🔴 Поле, которого в теле нет, не трогаем: смена шага не должна снимать ответственного.
"""

from __future__ import annotations

import uuid

import pytest
import sqlalchemy as sa

from src.db.models import ConversationNote
from tests.dashboard_fakes import (
    OPERATOR_EMAIL,
    OWNER_EMAIL,
    PANEL,
    as_text,
    make_user,
    owner_actions,
    panel,
    seed_conversation,
    sync_db,  # noqa: F401 — фикстура берётся из пространства имён модуля
)

LIST = f"{PANEL}/conversations"
STAFF = str(uuid.uuid4())


@pytest.fixture
def board(monkeypatch, fake_redis, sync_db):
    make_user(sync_db, email=OWNER_EMAIL, role="owner")
    make_user(sync_db, email=OPERATOR_EMAIL, role="operator")
    with panel(monkeypatch, fake_redis) as p:
        yield p


def _card(board, conv) -> dict:
    return board.client.get(f"{LIST}/{conv}", headers=board.headers()).json()


def test_card_without_handling_says_nobody_and_nothing(board, sync_db) -> None:
    conv = seed_conversation(sync_db)
    card = _card(board, conv)
    assert card["handling"] == {"assignee": None, "next_step": None}
    assert card["notes"] == []


def test_assignee_and_next_step_are_saved_and_shown(board, sync_db) -> None:
    conv = seed_conversation(sync_db)
    response = board.client.patch(
        f"{LIST}/{conv}/handling",
        json={"next_step": "  Перезвонить до 18:00  ", "assignee_user_id": STAFF, "assignee_name": "Алия"},
        headers=board.headers(),
    )
    assert response.status_code == 200, response.text
    card = _card(board, conv)
    assert card["handling"]["next_step"] == "Перезвонить до 18:00"
    assert card["handling"]["assignee"] == {"user_id": STAFF, "name": "Алия"}
    rows = owner_actions(sync_db, action="handling")
    assert rows and "Перезвонить" not in as_text(rows[-1].payload)


def test_changing_the_step_keeps_the_assignee_and_empty_clears(board, sync_db) -> None:
    conv = seed_conversation(sync_db)
    board.client.patch(
        f"{LIST}/{conv}/handling",
        json={"assignee_user_id": STAFF, "assignee_name": "Алия", "next_step": "Позвонить"},
        headers=board.headers(),
    )
    board.client.patch(f"{LIST}/{conv}/handling", json={"next_step": "Выслать цены"}, headers=board.headers())
    handling = _card(board, conv)["handling"]
    assert handling["next_step"] == "Выслать цены"
    assert handling["assignee"]["name"] == "Алия"
    board.client.patch(f"{LIST}/{conv}/handling", json={"next_step": ""}, headers=board.headers())
    board.client.patch(f"{LIST}/{conv}/handling", json={"assignee_name": None}, headers=board.headers())
    assert _card(board, conv)["handling"] == {"assignee": None, "next_step": None}


def test_handling_rejects_empty_body_long_step_and_unknown_dialog(board, sync_db) -> None:
    conv = seed_conversation(sync_db)
    assert board.client.patch(f"{LIST}/{conv}/handling", json={}, headers=board.headers()).status_code == 400
    long_step = board.client.patch(
        f"{LIST}/{conv}/handling", json={"next_step": "я" * 201}, headers=board.headers()
    )
    assert long_step.status_code == 400
    missing = board.client.patch(
        f"{LIST}/{uuid.uuid4()}/handling", json={"next_step": "x"}, headers=board.headers()
    )
    assert missing.status_code == 404


def test_note_is_saved_in_order_and_the_log_has_no_text(board, sync_db) -> None:
    conv = seed_conversation(sync_db)
    for text in ("Гость просил тихий номер", "Перезвонил, договорились"):
        response = board.client.post(
            f"{LIST}/{conv}/notes",
            json={"body": text, "author_user_id": STAFF, "author_name": "Алия"},
            headers=board.headers(),
        )
        assert response.status_code == 200, response.text
    notes = _card(board, conv)["notes"]
    assert [n["text"] for n in notes] == ["Гость просил тихий номер", "Перезвонил, договорились"]
    assert notes[0]["author"] == "Алия"
    rows = owner_actions(sync_db, action="note")
    assert len(rows) == 2
    assert "тихий" not in as_text([r.payload for r in rows])
    assert rows[0].payload == {"length": len("Гость просил тихий номер")}


def test_note_rejects_empty_long_and_anonymous(board, sync_db) -> None:
    conv = seed_conversation(sync_db)
    post = lambda body: board.client.post(f"{LIST}/{conv}/notes", json=body, headers=board.headers())  # noqa: E731
    assert post({"body": "   ", "author_name": "Алия"}).status_code == 400
    assert post({"body": "я" * 2001, "author_name": "Алия"}).status_code == 400
    assert post({"body": "текст", "author_name": "  "}).status_code == 400
    assert board.client.post(
        f"{LIST}/{uuid.uuid4()}/notes", json={"body": "x", "author_name": "A"}, headers=board.headers()
    ).status_code == 404
    with sync_db() as session:
        assert session.execute(sa.select(sa.func.count()).select_from(ConversationNote)).scalar() == 0


def test_handling_migration_does_not_need_the_contraction(alembic_config) -> None:
    """0012 ветка от 0009: рабочая база стоит на 0009, 0010 и 0011 выкладываются отдельно и вручную."""
    from alembic import command

    command.upgrade(alembic_config, "0009")
    command.upgrade(alembic_config, "0012")
    engine = sa.create_engine(alembic_config.get_main_option("sqlalchemy.url"))
    try:
        inspector = sa.inspect(engine)
        assert {"assignee_user_id", "assignee_name", "next_step"} <= {c["name"] for c in inspector.get_columns("conversations")}
        assert "conversation_notes" in inspector.get_table_names()
        with engine.connect() as conn:
            assert [r[0] for r in conn.execute(sa.text("SELECT version_num FROM alembic_version"))] == ["0012"]
    finally:
        engine.dispose()
    # сужение остаётся отдельным шагом и применяется поверх, не мешая
    command.upgrade(alembic_config, "0010")
    engine = sa.create_engine(alembic_config.get_main_option("sqlalchemy.url"))
    try:
        with engine.connect() as conn:
            assert sorted(r[0] for r in conn.execute(sa.text("SELECT version_num FROM alembic_version"))) == ["0010", "0012"]
    finally:
        engine.dispose()
