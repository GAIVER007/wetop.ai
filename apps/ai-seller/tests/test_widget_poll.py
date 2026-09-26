"""Виджет: долгий опрос.

Браузер держит запрос открытым, пока не появится новое сообщение или пока
не выйдет срок. Так ответ бота доходит сразу, а не через фиксированную
паузу, и при этом сервер не получает шквал пустых запросов.

🔴 Опрос отдаёт только сообщения СВОЕГО диалога: ключ посетителя — это
всё, чем он опознан, и чужая переписка по чужому ключу не открывается.
"""

from __future__ import annotations

import time

import pytest

from src.db.base import ConversationMode, MessageRole
from tests.dashboard_fakes import sync_db  # noqa: F401 — фикстура из пространства имён модуля
from tests.widget_fakes import add_message, seed_visitor, widget_app

MINE = "v-1001"
THEIRS = "v-2002"
SECRET_TEXT = "Телефон соседа: +7 900 000 00 00"


@pytest.fixture
def app(monkeypatch, fake_redis, sync_db):  # noqa: F811
    with widget_app(monkeypatch, fake_redis) as w:
        yield w


def test_poll_returns_only_this_dialog(app, sync_db) -> None:  # noqa: F811
    seed_visitor(sync_db, visitor_key=MINE, texts=("Здравствуйте", "Здравствуйте! Подскажу."))
    seed_visitor(sync_db, visitor_key=THEIRS, texts=(SECRET_TEXT,))

    body = app.poll(MINE).json()

    texts = [m["text"] for m in body["messages"]]
    assert texts == ["Здравствуйте", "Здравствуйте! Подскажу."]
    assert SECRET_TEXT not in app.poll(MINE).text


def test_message_shape_is_what_the_widget_draws(app, sync_db) -> None:  # noqa: F811
    seed_visitor(sync_db, visitor_key=MINE, texts=("Здравствуйте", "Здравствуйте! Подскажу."))

    message = app.poll(MINE).json()["messages"][0]

    assert set(message) >= {"id", "role", "text", "at", "from_operator"}
    assert message["role"] == MessageRole.USER.value
    assert message["from_operator"] is False
    assert message["at"]


def test_after_cuts_what_was_already_shown(app, sync_db) -> None:  # noqa: F811
    conversation_id = seed_visitor(sync_db, visitor_key=MINE, texts=("Здравствуйте",))

    first = app.poll(MINE).json()["messages"]
    last_id = first[-1]["id"]
    add_message(sync_db, conversation_id, "Подскажу.")

    again = app.poll(MINE, after=last_id).json()["messages"]

    assert [m["text"] for m in again] == ["Подскажу."]


def test_long_poll_returns_empty_when_the_time_is_up(app, sync_db) -> None:  # noqa: F811
    """Пустой ответ по сроку — это нормальный ответ: браузер спросит снова."""
    seed_visitor(sync_db, visitor_key=MINE, texts=("Здравствуйте",))
    last_id = app.poll(MINE).json()["messages"][-1]["id"]

    started = time.monotonic()
    body = app.poll(MINE, after=last_id).json()
    elapsed = time.monotonic() - started

    assert body["messages"] == []
    # Срок в тестовых настройках — одна секунда: ждал, а не вернулся сразу.
    assert 0.5 <= elapsed < 10, elapsed


def test_new_message_comes_back_at_once(monkeypatch, fake_redis, sync_db) -> None:  # noqa: F811
    """Ответ, который уже есть, не ждёт истечения срока опроса."""
    with widget_app(monkeypatch, fake_redis, WIDGET_POLL_TIMEOUT_SECONDS="10") as app:
        conversation_id = seed_visitor(sync_db, visitor_key=MINE, texts=("Здравствуйте",))
        last_id = app.poll(MINE).json()["messages"][-1]["id"]
        add_message(sync_db, conversation_id, "Подскажу.")

        started = time.monotonic()
        body = app.poll(MINE, after=last_id).json()
        elapsed = time.monotonic() - started

    assert [m["text"] for m in body["messages"]] == ["Подскажу."]
    assert elapsed < 5, f"опрос ждал {elapsed:.1f} с при готовом ответе"


def test_mode_tells_the_widget_that_a_human_took_over(app, sync_db) -> None:  # noqa: F811
    """Панель перехватила диалог — виджет должен это показать, иначе клиент
    ждёт бота, а отвечает человек (или наоборот)."""
    seed_visitor(sync_db, visitor_key=MINE, texts=("Здравствуйте",))
    seed_visitor(sync_db, visitor_key=THEIRS, mode=ConversationMode.OWNER_TAKEOVER, texts=())

    assert app.poll(MINE).json()["mode"] == ConversationMode.BOT_ACTIVE.value
    assert app.poll(THEIRS).json()["mode"] == ConversationMode.OWNER_TAKEOVER.value


def test_operator_reply_is_marked(app, sync_db) -> None:  # noqa: F811
    """Реплика человека отличима от ответа бота: виджет рисует её иначе."""
    conversation_id = seed_visitor(sync_db, visitor_key=MINE, texts=())
    add_message(sync_db, conversation_id, "Это Иван, оператор.", role=MessageRole.OPERATOR)

    message = app.poll(MINE).json()["messages"][-1]

    assert message["from_operator"] is True
    assert message["text"] == "Это Иван, оператор."


def test_poll_of_an_unknown_key_says_nothing_about_others(app, sync_db) -> None:  # noqa: F811
    seed_visitor(sync_db, visitor_key=THEIRS, texts=(SECRET_TEXT,))

    response = app.poll("v-neznakomyy")

    assert response.status_code in (200, 404), response.text
    assert SECRET_TEXT not in response.text


# ─── Кто спрашивает ───


def test_a_platform_dialog_is_not_read_by_the_key_alone(monkeypatch, fake_redis, sync_db) -> None:  # noqa: F811
    """🔴 Ключ пользователя платформы предсказуем ('pu:' плюс его user_id).
    Писать под чужим ключом нельзя — читать тоже: иначе опознание подписью
    обходится там, где данные и отдаются."""
    from tests.widget_fakes import identity_token

    token = identity_token()
    from tests.widget_fakes import add_message, conversation_of

    with widget_app(monkeypatch, fake_redis) as app:
        key = app.new_visitor(identity=token)
        assert key.startswith("pu:")
        add_message(sync_db, conversation_of(sync_db, key).id, SECRET_TEXT)

        without = app.poll(key)
        with_identity = app.poll(key, identity=token)

    assert without.status_code == 403, without.text
    assert SECRET_TEXT not in without.text
    assert [m["text"] for m in with_identity.json()["messages"]] == [SECRET_TEXT]


def test_a_broken_redis_does_not_hammer_the_database(monkeypatch, fake_redis, sync_db) -> None:  # noqa: F811
    """🔴 Отметка «есть новое» не пришла — заглядываем в базу по расписанию,
    а не каждые полсекунды: иначе опросы утраивают нагрузку на базу ровно
    тогда, когда один узел уже упал."""
    import src.channels.widget as widget
    import src.dependencies as deps

    class Broken:
        async def delete(self, *args, **kwargs):
            raise RuntimeError("redis недоступен")

        async def incr(self, *args, **kwargs):
            raise RuntimeError("redis недоступен")

        async def expire(self, *args, **kwargs):
            raise RuntimeError("redis недоступен")

    calls: list[int] = []
    original = widget.load_messages

    async def counting(*args, **kwargs):
        calls.append(1)
        return await original(*args, **kwargs)

    with widget_app(monkeypatch, fake_redis, WIDGET_POLL_TIMEOUT_SECONDS="2") as app:
        seed_visitor(sync_db, visitor_key=MINE, texts=("Здравствуйте",))
        last_id = app.poll(MINE).json()["messages"][-1]["id"]
        monkeypatch.setattr(deps, "get_redis", lambda: Broken())
        monkeypatch.setattr(widget, "load_messages", counting)
        started = time.monotonic()
        body = app.poll(MINE, after=last_id).json()
        elapsed = time.monotonic() - started

    assert body["messages"] == []
    # Опрос всё-таки ждал, а не вернулся сразу.
    assert elapsed >= 1.5, elapsed
    # Шаг обращений к базе — пять секунд, а не полсекунды: за два секунды
    # это первый заход и последний.
    assert len(calls) <= 3, f"обращений к базе: {len(calls)}"
