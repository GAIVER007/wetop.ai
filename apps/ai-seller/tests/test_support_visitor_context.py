"""Текущий посетитель доезжает от сообщения до инструмента.

Движок про посетителя не знает и знать не должен: канал кладёт Visitor
в contextvar, инструменты берут его оттуда. Так изоляция «только свои
происшествия» держится на подписанном признаке, а не на аргументе,
который модель может подставить сама.

🔴 Что здесь сторожится: инструмент видит ТОГО ЖЕ посетителя, который
прислал сообщение, и ход не оставляет его следующему. Утечка значения
между ходами означала бы, что один пользователь платформы видит журнал
другого — это худшее, что может случиться с этой ролью.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from pathlib import Path

import pytest

from src.ai.engine_types import IncomingMessage
from src.ai.support_tools import build_registry
from src.channels.widget_identity import current_visitor
from tests.dashboard_fakes import sync_db  # noqa: F401 — фикстура из пространства имён модуля
from tests.support_fakes import (
    SAMPLE_CATALOG,
    FakeIncidents,
    anon_visitor,
    call_tool,
    incident,
    signed_visitor,
    support_providers,
    support_settings,
    write_catalog,
)
from tests.widget_fakes import USER_ID, identity_token, widget_app

OTHER_USER = "u-777"


# ─── Инструмент читает contextvar ───


def test_default_is_none() -> None:
    """Вне хода посетителя нет. 🔴 Значение по умолчанию — None, а не
    «какой-нибудь»: иначе инструмент однажды ответит от чужого имени."""
    assert current_visitor.get() is None


async def test_tool_sees_the_visitor_of_this_turn(tmp_path: Path) -> None:
    provider = FakeIncidents(items=[incident()])
    settings = support_settings(catalog=write_catalog(tmp_path, SAMPLE_CATALOG))
    providers = support_providers(incidents=provider)
    registry = build_registry(
        lambda: providers,
        settings_getter=lambda: settings,
        visitor_getter=current_visitor.get,
    )

    token = current_visitor.set(signed_visitor(user_id="u-1", org_id="org-1"))
    try:
        await call_tool(registry, "my_recent_errors")
    finally:
        current_visitor.reset(token)

    assert provider.args_of("recent_for_user")[0]["user_id"] == "u-1"


async def test_two_turns_do_not_mix(tmp_path: Path) -> None:
    """Два хода подряд — два разных пользователя, и каждый видит своё."""
    provider = FakeIncidents(items=[incident()])
    settings = support_settings(catalog=write_catalog(tmp_path, SAMPLE_CATALOG))
    providers = support_providers(incidents=provider)
    registry = build_registry(
        lambda: providers,
        settings_getter=lambda: settings,
        visitor_getter=current_visitor.get,
    )

    async def turn(visitor) -> None:
        token = current_visitor.set(visitor)
        try:
            await call_tool(registry, "my_recent_errors")
        finally:
            current_visitor.reset(token)

    await turn(signed_visitor(user_id="u-1", org_id="org-1"))
    await turn(signed_visitor(user_id="u-2", org_id="org-2"))

    assert [a["user_id"] for a in provider.args_of("recent_for_user")] == ["u-1", "u-2"]


async def test_after_the_turn_nobody_is_current(tmp_path: Path) -> None:
    """🔴 Ход закончился — значения нет: следующий ход не должен получить
    чужого посетителя в наследство."""
    provider = FakeIncidents(items=[incident()])
    settings = support_settings(catalog=write_catalog(tmp_path, SAMPLE_CATALOG))
    providers = support_providers(incidents=provider)
    registry = build_registry(
        lambda: providers,
        settings_getter=lambda: settings,
        visitor_getter=current_visitor.get,
    )

    token = current_visitor.set(signed_visitor())
    current_visitor.reset(token)

    answer = await call_tool(registry, "my_recent_errors")
    assert "не вошли" in answer.lower()
    assert provider.calls == [], "инструмент сходил в журнал без посетителя"


# ─── Ход фоном: значение живёт внутри задачи ───


@dataclass
class RecordingEngine:
    """Движок-заглушка: запоминает, кого видит contextvar во время хода."""

    seen: list = field(default_factory=list)

    async def process_message(self, incoming: IncomingMessage) -> None:
        await asyncio.sleep(0)  # ход правда идёт через цикл событий
        self.seen.append(current_visitor.get())


async def test_background_turn_sees_the_visitor_and_clears_it() -> None:
    """Задача копирует контекст на старте, поэтому посетитель доезжает
    и до фонового хода. После хода в контексте задачи его быть не должно."""
    from src.channels.widget_runner import WidgetRunner

    engine = RecordingEngine()
    runner = WidgetRunner(lambda: engine, None, None, support_settings())

    first = signed_visitor(user_id="u-1", org_id="org-1")
    token = current_visitor.set(first)
    runner.submit(IncomingMessage(channel="widget", external_id=first.key, text="привет", received_at=_now()))
    current_visitor.reset(token)

    runner.submit(IncomingMessage(channel="widget", external_id="anon-2", text="привет", received_at=_now()))
    await runner.drain()

    assert engine.seen[0] is first
    assert engine.seen[1] is None, "посетитель предыдущего хода протёк в следующий"


def _now():
    from src.db.base import utcnow

    return utcnow()


# ─── Канал кладёт посетителя перед ходом ───


@dataclass
class CapturingRunner:
    """Подмена обработчика: запоминает посетителя в момент приёма сообщения."""

    seen: list = field(default_factory=list)
    submitted: list = field(default_factory=list)

    def submit(self, incoming: IncomingMessage) -> object:
        self.seen.append(current_visitor.get())
        self.submitted.append(incoming)
        return incoming

    async def drain(self) -> None:
        return None


@pytest.fixture
def runner() -> CapturingRunner:
    return CapturingRunner()


@pytest.fixture
def app(monkeypatch, fake_redis, sync_db, runner):  # noqa: F811
    with widget_app(monkeypatch, fake_redis, runner=runner, BOT_ROLE="support") as w:
        yield w


def test_signed_message_puts_the_user_into_the_context(app, runner) -> None:
    """🔴 Тот, кого подписала платформа, — и есть текущий посетитель."""
    token = identity_token()
    key = app.new_visitor(identity=token)

    assert app.message(key, "не сохраняется бронь", identity=token).status_code == 200

    visitor = runner.seen[0]
    assert visitor is not None, "канал не положил посетителя в контекст"
    assert visitor.signed is True
    assert visitor.user_id == USER_ID


def test_anonymous_message_puts_an_anonymous_visitor(app, runner) -> None:
    """Аноним тоже кладётся — как аноним, а не как «никто»: инструмент
    по этому признаку и откажет ему в журнале платформы."""
    key = app.new_visitor()

    app.message(key, "здравствуйте")

    visitor = runner.seen[0]
    assert visitor is not None and visitor.signed is False


def test_next_message_does_not_inherit_the_previous_user(app, runner) -> None:
    """🔴 Главная утечка этой роли: пользователь платформы, а следом аноним
    с того же сервера. Второй не должен оказаться первым."""
    token = identity_token()
    signed_key = app.new_visitor(identity=token)
    app.message(signed_key, "не сохраняется бронь", identity=token)

    anon_key = app.new_visitor()
    app.message(anon_key, "здравствуйте")

    assert runner.seen[0].user_id == USER_ID
    assert runner.seen[1].signed is False
    assert runner.seen[1].user_id != USER_ID


def test_two_platform_users_do_not_mix(app, runner) -> None:
    first = identity_token()
    second = identity_token(user_id=OTHER_USER, email="other@example.com")
    first_key = app.new_visitor(identity=first)
    second_key = app.new_visitor(identity=second)

    app.message(first_key, "ошибка в бронях", identity=first)
    app.message(second_key, "ошибка в отчётах", identity=second)

    assert [v.user_id for v in runner.seen] == [USER_ID, OTHER_USER]


def test_anonymous_visitor_helper_is_not_signed() -> None:
    """Страховка самого теста: аноним из подмен и правда без подписи."""
    assert anon_visitor().signed is False
