"""Виджет: пределы публичной двери (слой 0).

🔴 Дверь открыта без входа, и за ней деньги: каждое сообщение — ход
с каскадом моделей, каждая сессия — строки в базе, каждое вложение — место
на диске. Поэтому предел считается и по ключу посетителя, и по адресу:
ключ выбирает сам браузер, и один счётчик обходится новым ключом.

🔴 Размер проверяется ДО чтения. Тело без Content-Length читается кусками
и обрывается, а вложение без него не принимается вовсе: разбор multipart
кладёт файл на диск раньше любой проверки.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest

from tests.dashboard_fakes import sync_db  # noqa: F401 — фикстура из пространства имён модуля
from tests.widget_fakes import PNG_BYTES, PREFIX, FakeRunner, widget_app

ATTACHMENTS = Path("data/attachments")


def _chunked(payload: bytes, *, piece: int = 8192, taken: list | None = None) -> Iterator[bytes]:
    """Тело без Content-Length: httpx шлёт его кусками и подаёт следующий
    только тогда, когда приложение попросит. Отсюда видно, сколько оно
    успело прочитать до отказа."""
    for start in range(0, len(payload), piece):
        if taken is not None:
            taken.append(1)
        yield payload[start:start + piece]


@pytest.fixture
def runner() -> FakeRunner:
    return FakeRunner()


# ─── Ключ ───


def test_a_message_without_a_key_is_refused(monkeypatch, fake_redis, sync_db, runner) -> None:  # noqa: F811
    """🔴 Ключ выдаёт только /session. Иначе запрос без ключа получает
    новый счётчик частоты на каждое сообщение — предела нет вовсе."""
    with widget_app(monkeypatch, fake_redis, runner=runner, WIDGET_MESSAGES_PER_HOUR="1") as app:
        codes = [
            app.client.post(f"{PREFIX}/message", json={"text": f"сообщение {i}"},
                            headers=app.headers()).status_code
            for i in range(5)
        ]

    assert codes == [400] * 5, codes
    assert runner.submitted == [], "ход пошёл по запросу без ключа"


# ─── Частота ───


def test_a_new_key_every_time_does_not_dodge_the_limit(monkeypatch, fake_redis, sync_db, runner) -> None:  # noqa: F811
    """Счётчик по адресу: ключи меняются, адрес — нет."""
    with widget_app(monkeypatch, fake_redis, runner=runner, WIDGET_MESSAGES_PER_HOUR="2") as app:
        codes = [app.message(f"v-{i}", "Здравствуйте").status_code for i in range(4)]

    assert codes == [200, 200, 429, 429], codes
    assert len(runner.submitted) == 2


def test_sessions_from_one_address_are_limited(monkeypatch, fake_redis, sync_db, runner) -> None:  # noqa: F811
    """Цикл «сессия → одно сообщение» иначе обходит предел целиком, а каждая
    сессия — это клиент и диалог в базе."""
    with widget_app(monkeypatch, fake_redis, runner=runner, WIDGET_MESSAGES_PER_HOUR="2") as app:
        codes = [app.session().status_code for _ in range(4)]
        # Уже выданный ключ продолжает обслуживаться: предел на выдачу новых.
        served = app.message("v-1001", "Здравствуйте").status_code

    assert codes == [200, 200, 429, 429], codes
    assert served == 200


def test_attachments_are_limited_too(monkeypatch, fake_redis, sync_db) -> None:  # noqa: F811
    """Пять мегабайт на запрос без счёта — это забитый диск за один вечер."""
    with widget_app(monkeypatch, fake_redis, WIDGET_MESSAGES_PER_HOUR="2") as app:
        key = app.new_visitor()
        codes = [app.attach(key, PNG_BYTES).status_code for _ in range(3)]

    assert codes == [200, 200, 429], codes
    assert len(list(ATTACHMENTS.glob("*"))) == 2


def test_an_unknown_visitor_puts_nothing_on_the_disk(monkeypatch, fake_redis, sync_db) -> None:  # noqa: F811
    """Диск открыт знакомому: у незнакомого нет диалога, и снимок не к чему."""
    with widget_app(monkeypatch, fake_redis) as app:
        response = app.attach("v-neznakomyy", PNG_BYTES)

    assert response.status_code == 403, response.text
    assert not ATTACHMENTS.exists() or list(ATTACHMENTS.glob("*")) == []


# ─── Размер до чтения ───


def test_a_chunked_body_over_the_limit_is_refused(monkeypatch, fake_redis, sync_db) -> None:  # noqa: F811
    """Тело без Content-Length отбивается кодом 413, как и заявленное."""
    with widget_app(monkeypatch, fake_redis, WIDGET_MAX_BODY_BYTES="4096") as app:
        response = app.client.post(
            f"{PREFIX}/session",
            content=_chunked(b'{"text":"' + b"a" * 200_000 + b'"}'),
            headers={**app.headers(), "Content-Type": "application/json"},
        )

    assert response.status_code == 413, response.status_code


async def test_the_body_is_cut_on_the_first_extra_byte() -> None:
    """🔴 Двести килобайт не должны оказаться в памяти ради отказа: чтение
    обрывается на пределе, а не меряется после. Проверяем на самом читателе:
    по запросу через клиент этого не видно — транспорт дочитывает тело сам.
    """
    from fastapi import HTTPException

    from src.channels.widget_guards import read_json

    class OneByOne:
        """Запрос без Content-Length: куски подаются по требованию."""

        headers: dict = {}

        def __init__(self) -> None:
            self.taken = 0

        async def stream(self):
            for _ in range(25):
                self.taken += 1
                yield b"a" * 8192

    request = OneByOne()
    with pytest.raises(HTTPException) as failure:
        await read_json(request, 4096)  # type: ignore[arg-type]

    assert failure.value.status_code == 413
    assert request.taken == 1, f"прочитано кусков: {request.taken}"


def test_a_chunked_attachment_is_not_parsed_at_all(monkeypatch, fake_redis, sync_db) -> None:  # noqa: F811
    """🔴 Без внятного Content-Length предел вложения проверить нечем, а разбор
    формы уже уложит файл во временный каталог: отказываем до разбора."""
    body = (
        b"--BOUNDARY\r\n"
        b'Content-Disposition: form-data; name="file"; filename="s.png"\r\n'
        b"Content-Type: image/png\r\n\r\n" + PNG_BYTES + b"\x00" * (3 * 1024 * 1024) +
        b"\r\n--BOUNDARY--\r\n"
    )
    taken: list = []
    with widget_app(monkeypatch, fake_redis) as app:
        key = app.new_visitor()
        response = app.client.post(
            f"{PREFIX}/attachment",
            params={"visitor_key": key},
            content=_chunked(body, taken=taken),
            headers={**app.headers(), "Content-Type": "multipart/form-data; boundary=BOUNDARY"},
        )

    assert response.status_code == 411, response.status_code
    # Ни одного куска: форму даже не начинали разбирать.
    assert taken == [], f"прочитано кусков: {len(taken)}"
    assert not ATTACHMENTS.exists() or list(ATTACHMENTS.glob("*")) == []


# ─── Потолок фоновых ходов ───


async def test_the_runner_stops_taking_new_turns_when_it_is_full(monkeypatch) -> None:
    """🔴 Задачи с каскадом моделей нельзя плодить без счёта: браузеру уже
    ответили «принято», и остановить их некому. Переполнение — честный отказ."""
    import asyncio

    from src.ai.engine_types import IncomingMessage
    from src.channels import widget_runner as module
    from src.db.base import utcnow

    monkeypatch.setattr(module, "MAX_INFLIGHT_TASKS", 2)

    class SlowEngine:
        async def process_message(self, incoming):
            await asyncio.sleep(0.2)

    runner = module.WidgetRunner(lambda: SlowEngine(), None, None, None)
    incoming = IncomingMessage(channel="widget", external_id="v-1", text="привет",
                               received_at=utcnow())

    taken = [runner.submit(incoming) for _ in range(3)]
    await runner.drain()

    assert [t is not None for t in taken] == [True, True, False], taken
