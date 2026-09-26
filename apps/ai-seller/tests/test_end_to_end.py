"""Сквозной тест: входящее сообщение → ответ в канале, без сети.

testy.md: «Один на весь проект, и он главный. Пока он красный, остальные
зелёные ничего не значат». Подменена ровно одна вещь — сеть к роутеру моделей.
Виджет, движок, защита, маскировка, каскад SDK, база и опрос — настоящие.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from src import dependencies
from tests.llm_fakes import LLM_ENV, PRIMARY, ScriptedRouter, chat_response, message_texts
from tests.dashboard_fakes import sync_db  # noqa: F401 — фикстура из пространства имён модуля
from tests.widget_fakes import conversation_of, messages_of, widget_app

PROMPT = "Ты помощник платформы. Отвечай коротко и только по делу."
REPLY = "Здравствуйте! Подскажите, в каком разделе проблема?"


def _answer(text: str) -> dict:
    return chat_response(json.dumps({"reply": text}, ensure_ascii=False), model=PRIMARY)


@pytest.fixture
def live(monkeypatch, fake_redis, fake_embedder, sync_db, tmp_path: Path):  # noqa: F811
    """Всё настоящее, кроме сети к модели. Возвращает (приложение, роутер, базу)."""
    (tmp_path / "data").mkdir(exist_ok=True)
    (tmp_path / "data" / "system_prompt.md").write_text(PROMPT, encoding="utf-8")
    router = ScriptedRouter()
    # Единственная подмена: общий httpx-клиент процесса ходит в сценарий, а не в сеть.
    monkeypatch.setattr(dependencies, "get_http_client", router.http_client)

    def _run():
        return widget_app(monkeypatch, fake_redis, WIDGET_POLL_TIMEOUT_SECONDS="5", **LLM_ENV)

    return _run, router, sync_db


def _turn(app, key: str, text: str) -> list[dict]:
    """Одно сообщение и ожидание ответа тем же опросом, что у браузера."""
    sent = app.message(key, text)
    assert sent.status_code == 200, sent.text
    app.client.portal.call(app.client.app.state.widget_runner.drain)
    polled = app.poll(key)
    assert polled.status_code == 200, polled.text
    return polled.json()["messages"]


def test_message_in_reply_out(live) -> None:
    run, router, db = live
    router.script[PRIMARY] = [_answer(REPLY)]
    with run() as app:
        key = app.new_visitor()
        messages = _turn(app, key, "Не могу сохранить бронь")

    texts = [m["text"] for m in messages]
    assert REPLY in texts, f"ответа бота нет в опросе: {texts}"
    assert len(router.calls) == 1, "модель должна быть вызвана ровно один раз"

    history = messages_of(db, conversation_of(db, key).id)
    roles = [m.role.value for m in history]
    assert roles == ["user", "assistant"], "в истории вопрос и ответ, по порядку"


def test_phone_never_reaches_the_model(live) -> None:
    """Маскировка сквозь весь стек: браузер → виджет → движок → каскад."""
    run, router, _db = live
    router.script[PRIMARY] = [_answer("Спасибо, передам администратору.")]
    with run() as app:
        key = app.new_visitor()
        _turn(app, key, "Перезвоните мне на +7 701 000 00 00")

    sent_to_model = " ".join(message_texts(router.calls[0]))
    assert "701" not in sent_to_model and "0000000" not in sent_to_model.replace(" ", ""), (
        "номер ушёл в модель"
    )
    assert "[PHONE_1]" in sent_to_model


def test_dead_models_give_a_neutral_reply_not_an_error(live) -> None:
    """Все три ступени каскада упали: человек получает нейтральную фразу."""
    run, router, _db = live  # пустой сценарий: каждая модель отвечает 500
    with run() as app:
        key = app.new_visitor()
        messages = _turn(app, key, "Здравствуйте")

    bot = [m["text"] for m in messages if m["role"] == "assistant"]
    assert bot, "человек остался без ответа"
    lowered = " ".join(bot).lower()
    for leak in ("error", "exception", "traceback", "500", "all_models_failed"):
        assert leak not in lowered, f"наружу ушло «{leak}»"
    assert len(router.calls) == 3, "должны быть опрошены все три ступени"
