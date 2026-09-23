"""Шаг 6: WebhookRunner — обновление Telegram превращается во входящее
и отдаётся движку; экран согласия получает кнопку; нажатие пишет согласие.

Движок подменный: канал ничего о движке не знает, ему нужен только
process_message. Своя база и свой fake_redis на каждый тест.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

import pytest
import sqlalchemy as sa

from src.ai.engine import IncomingMessage, TurnOutcome
from src.channels.consent_gate import consent_screen
from src.channels.telegram import CONSENT_CALLBACK, TelegramClient, WebhookRunner, consent_keyboard
from src.config import Settings, get_settings
from src.db.models import Client, Consent
from src.dependencies import close_resources, get_sessionmaker
from tests.telegram_fakes import API_BASE, TEST_TOKEN, FakeTelegramApi, callback_update, message_update

CHAT_ID = 555


@dataclass
class FakeEngine:
    """Движок-заглушка: запоминает входящие и отдаёт заданный статус."""

    status: str = "replied"
    fail: bool = False
    received: list[IncomingMessage] = field(default_factory=list)

    async def process_message(self, incoming: IncomingMessage) -> TurnOutcome:
        self.received.append(incoming)
        if self.fail:
            raise RuntimeError("движок сломан")
        return TurnOutcome(
            status=self.status,  # type: ignore[arg-type]
            reply="ответ",
            conversation_id=uuid.uuid4(),
            needs_human=False,
            edits=[],
            reasons=[],
            trace=[],
        )


@dataclass
class RunnerEnv:
    api: FakeTelegramApi
    telegram: TelegramClient
    sessionmaker: object
    settings: Settings

    def runner(self, engine: FakeEngine) -> WebhookRunner:
        return WebhookRunner(engine, self.telegram, self.sessionmaker, self.settings)


@pytest.fixture
async def env(migrated_db, fake_redis, monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[RunnerEnv]:
    monkeypatch.setenv("CONSENT_GATE_ENABLED", "true")
    monkeypatch.setenv("CONSENT_POLICY_URL", "https://example.com/policy")
    monkeypatch.setenv("CONSENT_POLICY_VERSION", "2026-09-01")
    monkeypatch.setenv("CHANNEL_TELEGRAM_BOT_TOKEN", TEST_TOKEN)
    get_settings.cache_clear()
    api = FakeTelegramApi()
    telegram = TelegramClient(TEST_TOKEN, api.client(), api_base=API_BASE)
    try:
        yield RunnerEnv(api=api, telegram=telegram, sessionmaker=get_sessionmaker(), settings=get_settings())
    finally:
        await close_resources()


async def _consents(sessionmaker) -> list[Consent]:
    async with sessionmaker() as session:
        return list((await session.execute(sa.select(Consent))).scalars().all())


async def _client(sessionmaker, external_id: str) -> Client | None:
    async with sessionmaker() as session:
        stmt = sa.select(Client).where(Client.channel == "telegram", Client.external_id == external_id)
        return (await session.execute(stmt)).scalar_one_or_none()


async def test_message_is_passed_to_engine_as_incoming(env: RunnerEnv) -> None:
    engine = FakeEngine()
    runner = env.runner(engine)
    await runner.handle(message_update(chat_id=CHAT_ID, text="Есть места?", first_name="Иван"))

    assert len(engine.received) == 1
    incoming = engine.received[0]
    assert isinstance(incoming, IncomingMessage)
    assert incoming.channel == "telegram"
    assert incoming.external_id == str(CHAT_ID)
    assert incoming.text == "Есть места?"
    assert incoming.client_name == "Иван"
    # Обычный ответ уходит через отправитель движка, а не через runner.
    assert env.api.calls_for("sendMessage") == []


async def test_consent_status_sends_inline_button(env: RunnerEnv) -> None:
    engine = FakeEngine(status="consent")
    runner = env.runner(engine)
    await runner.handle(message_update(chat_id=CHAT_ID))

    sent = env.api.calls_for("sendMessage")
    assert len(sent) == 1
    body = sent[0]
    assert body["chat_id"] == str(CHAT_ID)
    keyboard = body["reply_markup"]["inline_keyboard"]
    assert keyboard[0][0]["callback_data"] == CONSENT_CALLBACK
    assert keyboard[0][0]["text"] == consent_screen(env.settings).button_text
    assert body["reply_markup"] == consent_keyboard(consent_screen(env.settings).button_text)


async def test_replied_status_sends_no_button(env: RunnerEnv) -> None:
    runner = env.runner(FakeEngine(status="replied"))
    await runner.handle(message_update(chat_id=CHAT_ID))
    assert env.api.calls_for("sendMessage") == []


async def test_consent_callback_writes_consent_and_answers(env: RunnerEnv) -> None:
    engine = FakeEngine()
    runner = env.runner(engine)
    await runner.handle(callback_update(chat_id=CHAT_ID, data=CONSENT_CALLBACK, callback_id="cb-7"))

    client = await _client(env.sessionmaker, str(CHAT_ID))
    assert client is not None, "клиент создаётся по нажатию, даже если ещё не писал"
    consents = await _consents(env.sessionmaker)
    assert len(consents) == 1
    consent = consents[0]
    assert consent.client_id == client.id
    assert consent.method == "telegram_button"
    assert consent.shown_text == consent_screen(env.settings).text
    assert consent.policy_version == "2026-09-01"
    assert consent.revoked_at is None

    answers = env.api.calls_for("answerCallbackQuery")
    assert len(answers) == 1
    assert answers[0]["callback_query_id"] == "cb-7"
    sent = env.api.calls_for("sendMessage")
    assert len(sent) == 1
    assert sent[0]["chat_id"] == str(CHAT_ID)
    assert "Спасибо" in sent[0]["text"]
    # Нажатие кнопки — не сообщение: в движок не идёт.
    assert engine.received == []


async def test_consent_callback_twice_keeps_one_consent(env: RunnerEnv) -> None:
    """Повторное нажатие не падает на уникальном индексе и не плодит записи."""
    runner = env.runner(FakeEngine())
    await runner.handle(callback_update(chat_id=CHAT_ID, callback_id="cb-1"))
    await runner.handle(callback_update(chat_id=CHAT_ID, callback_id="cb-2"))
    assert len(await _consents(env.sessionmaker)) == 1
    assert len(env.api.calls_for("answerCallbackQuery")) == 2


async def test_consent_callback_for_existing_client_reuses_it(env: RunnerEnv) -> None:
    from src.db.base import utcnow

    async with env.sessionmaker() as session:
        session.add(Client(channel="telegram", external_id=str(CHAT_ID), name="Иван", created_at=utcnow()))
        await session.commit()

    await env.runner(FakeEngine()).handle(callback_update(chat_id=CHAT_ID))
    async with env.sessionmaker() as session:
        count = (await session.execute(sa.select(sa.func.count()).select_from(Client))).scalar_one()
    assert count == 1
    assert len(await _consents(env.sessionmaker)) == 1


async def test_other_callback_is_answered_without_consent(env: RunnerEnv) -> None:
    engine = FakeEngine()
    await env.runner(engine).handle(callback_update(chat_id=CHAT_ID, data="something:else", callback_id="cb-x"))
    assert await _consents(env.sessionmaker) == []
    answers = env.api.calls_for("answerCallbackQuery")
    assert len(answers) == 1
    assert answers[0]["callback_query_id"] == "cb-x"
    assert engine.received == []


async def test_update_without_text_is_ignored(env: RunnerEnv) -> None:
    engine = FakeEngine()
    await env.runner(engine).handle(message_update(chat_id=CHAT_ID, text=None, photo=True))
    assert engine.received == []
    assert env.api.calls == []


async def test_submit_and_drain_wait_for_all_tasks(env: RunnerEnv) -> None:
    engine = FakeEngine()
    runner = env.runner(engine)
    runner.submit(message_update(chat_id=CHAT_ID, text="раз", update_id=1))
    runner.submit(message_update(chat_id=CHAT_ID, text="два", update_id=2))
    await runner.drain()
    assert sorted(m.text for m in engine.received) == ["два", "раз"]


async def test_engine_exception_does_not_break_handle(env: RunnerEnv) -> None:
    engine = FakeEngine(fail=True)
    runner = env.runner(engine)
    await runner.handle(message_update(chat_id=CHAT_ID))
    assert len(engine.received) == 1
    # И следующий вызов после сбоя тоже работает.
    runner.submit(message_update(chat_id=CHAT_ID, update_id=3))
    await runner.drain()
    assert len(engine.received) == 2


async def test_telegram_failure_on_button_does_not_break_handle(env: RunnerEnv) -> None:
    """Отказ Telegram на кнопке — в журнал, не наружу."""
    env.api.script("sendMessage", 500)
    runner = env.runner(FakeEngine(status="consent"))
    await runner.handle(message_update(chat_id=CHAT_ID))
    assert len(env.api.calls_for("sendMessage")) == 1


async def test_send_failed_with_consent_pending_still_sends_button(env: RunnerEnv) -> None:
    """Экран согласия не доставился — движок отдал 'send_failed', а согласия
    всё ещё нет. Кнопка обязана уйти: без неё клиенту некуда нажать, и
    переписка встаёт до следующего его сообщения."""
    runner = env.runner(FakeEngine(status="send_failed"))
    await runner.handle(message_update(chat_id=CHAT_ID))

    sent = env.api.calls_for("sendMessage")
    assert len(sent) == 1
    assert sent[0]["reply_markup"] == consent_keyboard(consent_screen(env.settings).button_text)


async def test_send_failed_after_consent_sends_no_button(env: RunnerEnv) -> None:
    """Согласие уже есть: 'send_failed' — обычный отказ канала, кнопка не нужна."""
    runner = env.runner(FakeEngine(status="consent"))
    await runner.handle(callback_update(chat_id=CHAT_ID))
    env.api.calls.clear()

    await env.runner(FakeEngine(status="send_failed")).handle(message_update(chat_id=CHAT_ID))
    assert env.api.calls_for("sendMessage") == []
