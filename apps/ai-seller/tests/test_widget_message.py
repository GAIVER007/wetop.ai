"""Виджет: приём сообщения.

🔴 Ответ на приём отдаётся БЫСТРО, а ход идёт фоновой задачей: ход
с каскадом моделей длится до минуты, браузер столько не ждёт и обрывает
соединение — клиент остаётся без ответа, которого бот уже не повторит.
Браузер узнаёт ответ следующим опросом.

🔴 Предел размера тела проверяется ДО чтения: иначе мегабайтное тело уже
в памяти к моменту, когда его отвергли.
"""

from __future__ import annotations

import inspect
import time

import pytest

from src.ai.engine_types import IncomingMessage
from tests.dashboard_fakes import sync_db  # noqa: F401 — фикстура из пространства имён модуля
from tests.widget_fakes import (
    CHANNEL,
    PREFIX,
    EchoRunner,
    FakeRunner,
    identity_token,
    make_sender,
    messages_of,
    seed_visitor,
    widget_app,
)

VISITOR = "v-1001"


@pytest.fixture
def runner() -> FakeRunner:
    return FakeRunner()


@pytest.fixture
def app(monkeypatch, fake_redis, sync_db, runner):  # noqa: F811
    with widget_app(monkeypatch, fake_redis, runner=runner) as w:
        yield w


def test_message_is_accepted_right_away(app, runner) -> None:
    key = app.new_visitor()

    started = time.monotonic()
    response = app.message(key, "Здравствуйте, есть места?")
    elapsed = time.monotonic() - started

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "accepted"
    # Ход ещё даже не начинался: приём не ждёт модель.
    assert elapsed < 2.0, f"приём занял {elapsed:.1f} с — ход идёт не фоном"


def test_the_engine_gets_a_widget_message(app, runner) -> None:
    key = app.new_visitor()

    app.message(key, "Сколько стоит?")

    assert len(runner.submitted) == 1
    incoming = runner.submitted[0]
    assert isinstance(incoming, IncomingMessage)
    assert incoming.channel == CHANNEL
    # 🔴 Внешний идентификатор — строкой, приведён на границе с каналом.
    assert incoming.external_id == key
    assert isinstance(incoming.external_id, str)
    assert incoming.text == "Сколько стоит?"
    assert incoming.received_at is not None


def test_signed_visitor_comes_with_a_name(app, runner) -> None:
    """Имя из подписанного признака — то, что увидит оператор в панели."""
    token = identity_token()
    key = app.new_visitor(identity=token)

    app.message(key, "Здравствуйте", identity=token)

    assert runner.submitted[-1].client_name


def test_attachment_id_travels_inside_the_text(app, runner) -> None:
    """Модель на этом шаге картинку не смотрит: в ход уходит только ссылка."""
    key = app.new_visitor()

    app.message(key, "Вот снимок", attachment_id="abc123")

    assert "abc123" in runner.submitted[-1].text


def test_body_over_the_limit_is_refused(app, runner) -> None:
    key = app.new_visitor()
    too_long = "я" * 200_000

    response = app.message(key, too_long)

    assert response.status_code == 413, response.status_code
    # Переросток не дошёл до хода: значит, его отбили на входе.
    assert runner.submitted == []


def test_the_size_is_checked_before_the_body_is_read() -> None:
    """🔴 Проверка стоит ДО чтения тела, а не после.

    Заявленный размер отбивается по Content-Length, а тело без него
    читается кусками с обрывом — целиком в память оно не попадает никогда.
    """
    from src.channels import widget_guards

    source = inspect.getsource(widget_guards.read_json)
    header = source.find("content-length")
    assert header != -1, "предел тела не проверяется по Content-Length"
    # Тело целиком за один раз не читается: только поток кусками.
    assert "await request.body()" not in source, "тело читается целиком до проверки"
    assert "request.stream()" in source


def test_rate_limit_answers_neutrally(monkeypatch, fake_redis, sync_db, runner) -> None:  # noqa: F811
    """Предел частоты на сессию: иначе одна вкладка выжигает каскад моделей."""
    with widget_app(monkeypatch, fake_redis, runner=runner, WIDGET_MESSAGES_PER_HOUR="2") as app:
        key = app.new_visitor()
        codes = [app.message(key, f"сообщение {i}").status_code for i in range(3)]
        last = app.message(key, "ещё одно")

    assert codes == [200, 200, 429], codes
    assert last.status_code == 429
    # Нейтральное тело: ни ключа посетителя, ни внутренностей счётчика.
    assert key not in last.text
    assert "redis" not in last.text.lower()
    assert len(last.text) < 200, last.text
    assert len(runner.submitted) == 2


def test_the_reply_shows_up_in_the_history(monkeypatch, fake_redis, sync_db) -> None:  # noqa: F811
    """🔴 Виджет — канал с вытягиванием: доставка и есть запись в историю.
    Ход идёт фоном, ответ подбирается следующим опросом."""
    echo = None
    with widget_app(monkeypatch, fake_redis) as app:
        from src.dependencies import get_sessionmaker

        echo = EchoRunner(sessionmaker=get_sessionmaker(), sender=make_sender(fake_redis))
        app.client.app.state.widget_runner = echo
        import src.channels.widget_runner as widget_runner

        monkeypatch.setattr(widget_runner, "build_runner", lambda _s: echo)

        key = app.new_visitor()
        assert app.message(key, "Здравствуйте").json()["status"] == "accepted"
        # Долгий опрос ждёт ответа сам: отдельной паузы в тесте не нужно.
        polled = app.poll(key).json()

    assert echo.submitted, "ход не запускался"
    texts = [m["text"] for m in polled["messages"]]
    assert echo.reply in texts, polled


def test_message_of_an_unknown_visitor_does_not_crash(app, runner) -> None:
    """Ключ из старого localStorage после чистки базы: сессия заводится сама
    или запрос отбивается понятным кодом, но не пятисоткой."""
    response = app.message("v-neznakomyy", "Здравствуйте")

    assert response.status_code in (200, 400, 404), response.text
    assert response.status_code != 500


def test_widget_prefix_is_under_the_ip_block(app) -> None:
    """Префикс /widget уже под блок-листом адресов (слой 0): вход клиентов
    защищён на уровне фреймворка, до маршрутов."""
    middlewares = [str(m) for m in app.client.app.user_middleware]
    assert any("IpBlockMiddleware" in m for m in middlewares), middlewares
    assert PREFIX == "/widget"


def test_seeded_history_is_what_the_poll_reads(app, sync_db) -> None:  # noqa: F811
    """Посев мимо запроса сессии: на нём видно, что опрос читает историю
    диалога, а не что-то своё."""
    conversation_id = seed_visitor(sync_db, visitor_key=VISITOR, texts=("Здравствуйте",))

    assert [m.content for m in messages_of(sync_db, conversation_id)] == ["Здравствуйте"]
    polled = app.poll(VISITOR).json()
    assert [m["text"] for m in polled["messages"]] == ["Здравствуйте"]


def test_a_message_over_the_character_limit_is_refused(app, runner) -> None:
    """🔴 Аудит 30.09.2026: тело в 64 КБ отбивало только переростков, а реплика до
    предела тела ложилась в историю целиком и уходила в модель 20 ходов подряд.
    Красный на коде до правки: 200 и ход в очереди."""
    key = app.new_visitor()
    response = app.message(key, "я" * 4001)
    assert response.status_code == 413, response.status_code
    assert runner.submitted == []
    assert app.message(key, "я" * 4000).status_code == 200
    assert len(runner.submitted) == 1
