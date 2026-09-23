"""Шаг 5: гейт согласия стоит до модели. Первое сообщение без согласия
получает экран, модель не вызывается; после нажатия — обычный ответ."""

import pytest

from src.channels.consent_gate import consent_screen, grant_consent
from src.config import get_settings
from tests.engine_fakes import (  # noqa: F401 — фикстура engine_env
    MemorySender,
    ScriptedLlm,
    engine_env,
    find_client,
    incoming,
    reply,
)

# Хост политики совпадает с PUBLIC_BASE_URL: проверка выхода не вырежет ссылку.
POLICY_URL = "https://example.com/policy"


@pytest.fixture
def gate_on(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("CONSENT_GATE_ENABLED", "true")
    monkeypatch.setenv("CONSENT_POLICY_URL", POLICY_URL)
    monkeypatch.setenv("CONSENT_POLICY_VERSION", "2026-09-01")
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://example.com")
    get_settings.cache_clear()
    return get_settings()


async def test_first_message_gets_consent_screen(engine_env, gate_on) -> None:
    sender = MemorySender()
    llm = ScriptedLlm([reply("Не должно дойти.")])
    engine = engine_env.engine(sender=sender, llm=llm)

    outcome = await engine.process_message(incoming("Есть места?"))
    assert outcome.status == "consent"
    assert llm.calls == 0
    assert len(sender.sent) == 1
    assert sender.texts[0] == consent_screen(gate_on).text
    assert POLICY_URL in sender.texts[0]

    # Второе сообщение без нажатия — снова экран, диалог не начинается.
    again = await engine.process_message(incoming("Ау, есть кто?"))
    assert again.status == "consent"
    assert llm.calls == 0


async def test_after_grant_normal_reply(engine_env, gate_on) -> None:
    sender = MemorySender()
    llm = ScriptedLlm([reply("Есть студия.")])
    engine = engine_env.engine(sender=sender, llm=llm)
    first = await engine.process_message(incoming("Есть места?"))
    assert first.status == "consent"

    client = await find_client(engine_env.sessionmaker)
    async with engine_env.sessionmaker() as session:
        await grant_consent(
            session, gate_on, client.id, method="button", shown_text=consent_screen(gate_on).text
        )

    second = await engine.process_message(incoming("Так есть места?"))
    assert second.status == "replied"
    assert llm.calls == 1
    # Второй ход — движок вправе дописать просьбу о контакте.
    assert sender.texts[-1].startswith("Есть студия.")


async def test_gate_disabled_does_not_interfere(engine_env) -> None:
    assert engine_env.settings.consent_gate_enabled is False
    llm = ScriptedLlm([reply("Есть.")])
    engine = engine_env.engine(llm=llm)
    outcome = await engine.process_message(incoming("Есть места?"))
    assert outcome.status == "replied"
    assert llm.calls == 1
