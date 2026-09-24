"""Шаг 8б: диалоги в панели — список, карточка, перехват, ответ оператора.

🔴 В списке контакта нет: список открыт на экране весь день, и телефон
в нём — это утечка на ровном месте. В карточке контакт есть: оператор
за ним и пришёл.
🔴 Диалог не уходит в owner_takeover сам: перехват делает человек кнопкой,
возврат боту — тоже. Иначе бот замолчал, оператор спит, клиент ушёл.
🔴 Запись в историю только после успешной отправки: иначе панель считает,
что ответила, а клиент ждёт.
"""

from __future__ import annotations

import pytest

from src.db.base import ConversationMode, MessageRole
from tests.dashboard_fakes import (
    CLIENT_NAME,
    CLIENT_PHONE,
    MASKED_NAME,
    OPERATOR_EMAIL,
    OWNER_EMAIL,
    PANEL,
    FailingSender,
    MemorySender,
    as_text,
    conversation_mode,
    install_sender,
    make_user,
    messages_of,
    owner_actions,
    panel,
    seed_conversation,
    sync_db,  # noqa: F401 — фикстура берётся из пространства имён модуля
)

LIST = f"{PANEL}/conversations"


@pytest.fixture
def board(monkeypatch, fake_redis, sync_db):
    make_user(sync_db, email=OWNER_EMAIL, role="owner")
    make_user(sync_db, email=OPERATOR_EMAIL, role="operator")
    with panel(monkeypatch, fake_redis) as p:
        yield p


def test_list_masks_the_name_and_hides_the_phone(board, sync_db) -> None:
    seed_conversation(sync_db)

    response = board.client.get(LIST, headers=board.headers())

    assert response.status_code == 200, response.text
    text = as_text(response.json())
    assert CLIENT_PHONE not in text
    assert "".join(ch for ch in CLIENT_PHONE if ch.isdigit()) not in text
    assert CLIENT_NAME not in text
    assert MASKED_NAME in text


def test_list_row_says_what_the_operator_needs(board, sync_db) -> None:
    """Без контакта в строке, но с признаком «контакт есть»: по нему видно,
    куда бежать, и не нужно открывать каждую карточку."""
    conversation_id = seed_conversation(sync_db)

    rows = board.client.get(LIST, headers=board.headers()).json()["items"]
    row = next(r for r in rows if r["id"] == str(conversation_id))

    assert row["channel"] == "telegram"
    assert row["mode"] == ConversationMode.BOT_ACTIVE.value
    assert row["messages"] == 2
    assert row["has_contact"] is True
    assert row["last_activity_at"]


def test_list_filters_by_mode(board, sync_db) -> None:
    bot = seed_conversation(sync_db, external_id="1001")
    waiting = seed_conversation(
        sync_db, external_id="1002", mode=ConversationMode.NEEDS_HUMAN
    )

    rows = board.client.get(
        LIST, params={"mode": ConversationMode.NEEDS_HUMAN.value}, headers=board.headers()
    ).json()["items"]
    ids = {row["id"] for row in rows}

    assert str(waiting) in ids
    assert str(bot) not in ids


def test_card_gives_the_contact_and_the_history(board, sync_db) -> None:
    conversation_id = seed_conversation(sync_db)

    response = board.client.get(f"{LIST}/{conversation_id}", headers=board.headers())

    assert response.status_code == 200, response.text
    body = response.json()
    assert CLIENT_PHONE in as_text(body)  # оператор за контактом и пришёл
    assert [m["text"] for m in body["messages"]] == [
        "Здравствуйте, есть места?",
        "Здравствуйте! Подскажу.",
    ]
    assert body["messages"][1]["sent_by_us"] is True
    assert body["mode"] == ConversationMode.BOT_ACTIVE.value
    assert body["stage"]


def test_opening_a_card_does_not_take_the_dialog_over(board, sync_db) -> None:
    """Просмотр — не перехват: режим меняется только кнопкой."""
    conversation_id = seed_conversation(sync_db, mode=ConversationMode.NEEDS_HUMAN)

    board.client.get(f"{LIST}/{conversation_id}", headers=board.headers())

    assert conversation_mode(sync_db, conversation_id) is ConversationMode.NEEDS_HUMAN
    assert owner_actions(sync_db) == []


def test_takeover_and_release_are_written_down(board, sync_db) -> None:
    conversation_id = seed_conversation(sync_db, mode=ConversationMode.NEEDS_HUMAN)

    taken = board.client.post(f"{LIST}/{conversation_id}/takeover", headers=board.headers())

    assert taken.status_code == 200, taken.text
    assert conversation_mode(sync_db, conversation_id) is ConversationMode.OWNER_TAKEOVER
    rows = owner_actions(sync_db, action="takeover")
    assert rows, "перехват не записан"
    assert ConversationMode.NEEDS_HUMAN.value in as_text(rows[-1].payload)
    assert rows[-1].conversation_id == conversation_id

    released = board.client.post(f"{LIST}/{conversation_id}/release", headers=board.headers())

    assert released.status_code == 200, released.text
    assert conversation_mode(sync_db, conversation_id) is ConversationMode.BOT_ACTIVE
    back = owner_actions(sync_db, action="release")
    assert back, "возврат боту не записан"
    assert ConversationMode.OWNER_TAKEOVER.value in as_text(back[-1].payload)


def test_reply_is_sent_and_then_written(board, sync_db, monkeypatch) -> None:
    conversation_id = seed_conversation(sync_db)
    sender = MemorySender()
    install_sender(monkeypatch, sender)

    response = board.client.post(
        f"{LIST}/{conversation_id}/reply",
        json={"text": "Здравствуйте, это оператор. Уже смотрю."},
        headers=board.headers(),
    )

    assert response.status_code == 200, response.text
    assert [text for _, _, text in sender.sent] == ["Здравствуйте, это оператор. Уже смотрю."]
    written = messages_of(sync_db, conversation_id)[-1]
    assert written.role is MessageRole.OPERATOR
    assert written.sent_by_us is True
    assert written.content == "Здравствуйте, это оператор. Уже смотрю."


def test_reply_is_not_written_when_the_channel_refuses(board, sync_db, monkeypatch) -> None:
    """🔴 Отказ канала — не «ответили». Иначе оператор видит свою реплику
    в истории и считает, что клиенту написали."""
    conversation_id = seed_conversation(sync_db)
    before = len(messages_of(sync_db, conversation_id))
    sender = FailingSender()
    install_sender(monkeypatch, sender)

    response = board.client.post(
        f"{LIST}/{conversation_id}/reply",
        json={"text": "Это сообщение не должно уйти в историю."},
        headers=board.headers(),
    )

    assert sender.calls == 1
    # 502: канал не принял. Не 200 и не «ок, но не отправлено».
    assert response.status_code == 502, response.text
    assert len(messages_of(sync_db, conversation_id)) == before


def test_unknown_conversation_is_404(board) -> None:
    import uuid

    response = board.client.get(f"{LIST}/{uuid.uuid4()}", headers=board.headers())

    assert response.status_code == 404


def test_operator_works_with_dialogs(board, sync_db, monkeypatch) -> None:
    """Диалоги — работа оператора: перехват и ответ ему разрешены,
    иначе роль бессмысленна."""
    conversation_id = seed_conversation(sync_db)
    install_sender(monkeypatch, MemorySender())
    headers = board.headers(role="operator", email=OPERATOR_EMAIL)

    assert board.client.get(LIST, headers=headers).status_code == 200
    assert (
        board.client.post(f"{LIST}/{conversation_id}/takeover", headers=headers).status_code == 200
    )
    assert (
        board.client.post(
            f"{LIST}/{conversation_id}/reply", json={"text": "Я на связи."}, headers=headers
        ).status_code
        == 200
    )


def test_dialogs_need_a_session(board, sync_db) -> None:
    conversation_id = seed_conversation(sync_db)

    assert board.client.get(LIST).status_code == 401
    assert board.client.get(f"{LIST}/{conversation_id}").status_code == 401
    assert board.client.post(f"{LIST}/{conversation_id}/takeover").status_code == 401
