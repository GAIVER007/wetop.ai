"""Очередь диалогов для кабинета техподдержки (план `plans/support-assistant-v2-2026-09-29.md`, S1).

🔴 Пустой диалог — не обращение: виджет заводит разговор при открытии окна, и без отбора список
забивается строками «0 сообщений», за которыми нет ни одного вопроса.
🔴 «Ждёт с» — первое сообщение пользователя после последнего ответа, а не последнее: человек, который
написал три раза за десять минут, ждёт десять минут, а не секунду.
🔴 Закрытие — не удаление: диалог остаётся в «Закрытых» с перепиской, а следующее сообщение того же
человека открывает новый диалог (бот ищет диалог клиента по `is_active`).
"""

from __future__ import annotations

import uuid
from datetime import timedelta

import pytest
import sqlalchemy as sa

from src.db.base import ConversationMode, MessageRole, utcnow
from src.dashboard.panel_common import SANDBOX_CHANNEL
from src.db.models import Client, Conversation, Message
from tests.dashboard_fakes import (
    OWNER_EMAIL,
    PANEL,
    make_user,
    owner_actions,
    panel,
    seed_conversation,
    sync_db,  # noqa: F401 — фикстура берётся из пространства имён модуля
)

LIST = f"{PANEL}/conversations"


@pytest.fixture
def board(monkeypatch, fake_redis, sync_db):
    make_user(sync_db, email=OWNER_EMAIL, role="owner")
    with panel(monkeypatch, fake_redis) as p:
        yield p


def seed_dialog(
    sessions,
    *,
    turns: tuple[tuple[MessageRole, str, int], ...],
    external_id: str | None = None,
    channel: str = "widget",
    mode: ConversationMode = ConversationMode.BOT_ACTIVE,
    started_minutes_ago: int = 5,
    active: bool = True,
) -> uuid.UUID:
    """Диалог с ходами (роль, текст, минут назад)."""
    now = utcnow()
    with sessions() as session:
        client = Client(
            channel=channel,
            external_id=external_id or uuid.uuid4().hex,
            name=None,
            created_at=now,
        )
        session.add(client)
        session.flush()
        conversation = Conversation(
            client_id=client.id,
            mode=mode,
            lead_data={},
            is_active=active,
            created_at=now - timedelta(minutes=started_minutes_ago),
            last_activity_at=now - timedelta(minutes=min((t[2] for t in turns), default=started_minutes_ago)),
        )
        session.add(conversation)
        session.flush()
        for role, text, minutes_ago in turns:
            session.add(
                Message(
                    conversation_id=conversation.id,
                    role=role,
                    content=text,
                    sent_by_us=role is not MessageRole.USER,
                    created_at=now - timedelta(minutes=minutes_ago),
                )
            )
        session.commit()
        return conversation.id


def rows(board, **params) -> list[dict]:
    response = board.client.get(LIST, params=params, headers=board.headers())
    assert response.status_code == 200, response.text
    return response.json()["items"]


def ids(items: list[dict]) -> set[str]:
    return {item["id"] for item in items}


def test_nonempty_hides_dialogs_without_messages(board, sync_db) -> None:
    empty = seed_dialog(sync_db, turns=())
    talking = seed_dialog(sync_db, turns=((MessageRole.USER, "Не сохраняется бронь", 1),))

    assert {str(empty), str(talking)} <= ids(rows(board))  # прежний ответ — как был
    assert ids(rows(board, nonempty=1)) == {str(talking)}


def test_row_carries_the_last_message(board, sync_db) -> None:
    long_text = "Ответ помощника " + "очень длинный " * 30
    cid = seed_dialog(
        sync_db,
        turns=(
            (MessageRole.USER, "Где настройки тарифа?", 3),
            (MessageRole.ASSISTANT, long_text, 2),
        ),
    )

    row = next(r for r in rows(board) if r["id"] == str(cid))

    assert row["started_at"]
    assert row["closed"] is False
    assert row["last_message"]["role"] == "assistant"
    assert row["last_message"]["at"]
    assert row["last_message"]["text"].startswith("Ответ помощника")
    assert len(row["last_message"]["text"]) <= 160


def test_waiting_since_is_the_first_unanswered_user_message(board, sync_db) -> None:
    waiting = seed_dialog(
        sync_db,
        turns=(
            (MessageRole.USER, "Привет", 30),
            (MessageRole.ASSISTANT, "Здравствуйте!", 29),
            (MessageRole.USER, "Не могу заселить гостя", 12),
            (MessageRole.USER, "Алло?", 2),
        ),
    )
    answered = seed_dialog(
        sync_db,
        turns=((MessageRole.USER, "Спасибо", 4), (MessageRole.OPERATOR, "Пожалуйста", 3)),
    )

    items = {r["id"]: r for r in rows(board)}

    since = items[str(waiting)]["waiting_since"]
    assert since is not None
    # ждёт с «Не могу заселить гостя» (12 минут назад), а не с «Алло?»
    first_unanswered = utcnow() - timedelta(minutes=12)
    from datetime import datetime

    parsed = datetime.fromisoformat(since)
    assert abs((parsed - first_unanswered).total_seconds()) < 60
    assert items[str(answered)]["waiting_since"] is None


def test_queue_waiting_and_new(board, sync_db) -> None:
    waiting = seed_dialog(sync_db, turns=((MessageRole.USER, "Помогите", 1),))
    answered = seed_dialog(
        sync_db,
        turns=((MessageRole.USER, "Вопрос", 3), (MessageRole.ASSISTANT, "Ответ", 2)),
    )
    old = seed_dialog(
        sync_db,
        turns=((MessageRole.USER, "Старый вопрос", 60 * 30), (MessageRole.ASSISTANT, "Ответ", 60 * 30 - 1)),
        started_minutes_ago=60 * 30,
    )

    assert ids(rows(board, queue="waiting")) == {str(waiting)}
    assert ids(rows(board, queue="new")) == {str(waiting), str(answered)}
    assert str(old) in ids(rows(board))


def test_unknown_queue_is_400(board) -> None:
    assert (
        board.client.get(LIST, params={"queue": "всё"}, headers=board.headers()).status_code == 400
    )


def test_close_moves_the_dialog_to_closed_and_is_written(board, sync_db) -> None:
    cid = seed_dialog(sync_db, turns=((MessageRole.USER, "Разобрались, спасибо", 1),))

    closed = board.client.post(f"{LIST}/{cid}/close", headers=board.headers())

    assert closed.status_code == 200, closed.text
    assert closed.json()["status"] == "ok"
    with sync_db() as session:
        conv = session.execute(sa.select(Conversation).where(Conversation.id == cid)).scalar_one()
        assert conv.is_active is False
    assert owner_actions(sync_db, action="close"), "закрытие не записано"
    assert str(cid) not in ids(rows(board, nonempty=1, closed=0))
    assert str(cid) in ids(rows(board, closed=1))
    # переписка на месте
    card = board.client.get(f"{LIST}/{cid}", headers=board.headers()).json()
    assert card["closed"] is True
    assert [m["text"] for m in card["messages"]] == ["Разобрались, спасибо"]


def test_open_card_says_it_is_not_closed(board, sync_db) -> None:
    cid = seed_conversation(sync_db)

    card = board.client.get(f"{LIST}/{cid}", headers=board.headers()).json()

    assert card["closed"] is False


def test_close_unknown_dialog_is_404(board) -> None:
    assert board.client.post(f"{LIST}/{uuid.uuid4()}/close", headers=board.headers()).status_code == 404


def test_platform_service_key_can_close(monkeypatch, fake_redis, sync_db) -> None:  # noqa: F811
    """Кабинет техподдержки ходит к боту служебным ключом: без маршрута в SERVICE_ROUTES кнопка
    «Закрыть обращение» получала бы 403."""
    cid = seed_dialog(sync_db, turns=((MessageRole.USER, "Вопрос", 1),))
    with panel(monkeypatch, fake_redis, SELLER_SERVICE_KEY="service-key-for-tests-only") as p:
        response = p.client.post(
            f"{LIST}/{cid}/close", headers={"X-Service-Key": "service-key-for-tests-only"}
        )
    assert response.status_code == 200, response.text


def test_sandbox_dialogs_stay_out_of_the_queue(board, sync_db) -> None:
    """🔴 Вкладка «Проверка» заводит клиента канала `sandbox`, и такой диалог ничем не отличался
    от обращения партнёра: 02.10.2026 все четыре строки очереди на рабочей базе были тестами
    агента, один с отметкой «срочно · нужен человек». Прежний ответ (панель продавца,
    старые вызовы) при этом не меняется."""
    partner = seed_dialog(sync_db, turns=((MessageRole.USER, "Не сохраняется бронь", 1),))
    check = seed_dialog(
        sync_db, channel=SANDBOX_CHANNEL, turns=((MessageRole.USER, "Проверка агента", 1),)
    )

    assert {str(partner), str(check)} <= ids(rows(board, nonempty=1))
    assert ids(rows(board, nonempty=1, exclude_sandbox=1)) == {str(partner)}


def test_row_carries_the_first_user_message(board, sync_db) -> None:
    """Категорию обращения платформа считает по первому сообщению пользователя: в последнем
    обычно стоит ответ помощника, по которому «возврат» от «ошибки» не отличить."""
    long_ask = "Вернуть деньги за подписку " + "очень длинная история " * 30
    cid = seed_dialog(
        sync_db,
        turns=(
            (MessageRole.ASSISTANT, "Здравствуйте! Чем помочь?", 5),
            (MessageRole.USER, long_ask, 4),
            (MessageRole.USER, "Алло?", 2),
            (MessageRole.ASSISTANT, "Передал специалисту", 1),
        ),
    )

    row = next(r for r in rows(board) if r["id"] == str(cid))

    assert row["first_message"]["role"] == "user"
    assert row["first_message"]["text"].startswith("Вернуть деньги за подписку")
    assert len(row["first_message"]["text"]) <= 160
    assert row["last_message"]["text"] == "Передал специалисту"


def test_first_message_is_none_without_user_turns(board, sync_db) -> None:
    cid = seed_dialog(sync_db, turns=((MessageRole.ASSISTANT, "Здравствуйте!", 1),))

    row = next(r for r in rows(board) if r["id"] == str(cid))

    assert row["first_message"] is None


def test_summary_can_skip_sandbox(board, sync_db) -> None:
    """Сводка над очередью считала проверки агента вместе с обращениями: «Диалогов за сутки 6»
    при трёх настоящих. Без параметра ответ прежний, продавца это не трогает."""
    seed_dialog(sync_db, turns=((MessageRole.USER, "Не сохраняется бронь", 1),))
    seed_dialog(sync_db, channel=SANDBOX_CHANNEL, turns=((MessageRole.USER, "Проверка агента", 1),))

    both = board.client.get(f"{PANEL}/summary", headers=board.headers()).json()
    clean = board.client.get(
        f"{PANEL}/summary", params={"exclude_sandbox": 1}, headers=board.headers()
    ).json()

    assert both["dialogs"] == 2
    assert clean["dialogs"] == 1
    assert clean["replies"] <= both["replies"]
