"""Шаг 3б: гейт согласия — код, не промпт. Выключен — не мешает; включён —
требует отдельного нажатия и хранит обстоятельства, а не флаг."""

import pytest
from sqlalchemy import func, select

from src.channels.consent_gate import (
    ConsentScreen,
    consent_required,
    consent_screen,
    grant_consent,
    revoke_consent,
)
from src.config import get_settings
from src.db.base import utcnow
from src.db.models import Client, Consent

POLICY_URL = "https://example.com/policy"


@pytest.fixture
def gate_on(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("CONSENT_GATE_ENABLED", "true")
    monkeypatch.setenv("CONSENT_POLICY_URL", POLICY_URL)
    monkeypatch.setenv("CONSENT_POLICY_VERSION", "2026-09-01")
    monkeypatch.setenv("CONSENT_BUTTON_TEXT", "Согласен на обработку")
    get_settings.cache_clear()
    return get_settings()


async def _client(session) -> Client:
    client = Client(external_id="1001", channel="telegram", created_at=utcnow())
    session.add(client)
    await session.commit()
    return client


async def _consents(session) -> int:
    return (await session.execute(select(func.count()).select_from(Consent))).scalar_one()


async def test_gate_disabled_never_requires(db_session) -> None:
    settings = get_settings()
    assert settings.consent_gate_enabled is False
    client = await _client(db_session)
    assert await consent_required(db_session, settings, client.id) is False


async def test_gate_enabled_requires_until_granted(db_session, gate_on) -> None:
    client = await _client(db_session)
    assert await consent_required(db_session, gate_on, client.id) is True


def test_screen_has_text_link_and_button(gate_on) -> None:
    screen = consent_screen(gate_on)
    assert isinstance(screen, ConsentScreen)
    assert POLICY_URL in screen.text
    assert screen.policy_url == POLICY_URL
    assert screen.policy_version == "2026-09-01"
    assert screen.button_text == "Согласен на обработку"
    assert screen.button_text in screen.text
    assert "персональных данных" in screen.text


def test_button_text_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CONSENT_GATE_ENABLED", "true")
    get_settings.cache_clear()
    assert consent_screen(get_settings()).button_text == "Согласен"


async def test_grant_stores_evidence_and_is_idempotent(db_session, gate_on) -> None:
    client = await _client(db_session)
    screen = consent_screen(gate_on)
    consent = await grant_consent(
        db_session, gate_on, client.id, method="telegram_button", shown_text=screen.text
    )
    assert consent.policy_version == "2026-09-01"
    assert consent.policy_url == POLICY_URL
    assert consent.method == "telegram_button"
    assert consent.shown_text == screen.text
    assert consent.granted_at is not None
    assert consent.revoked_at is None
    assert await consent_required(db_session, gate_on, client.id) is False

    again = await grant_consent(
        db_session, gate_on, client.id, method="telegram_button", shown_text=screen.text
    )
    assert again.id == consent.id
    assert await _consents(db_session) == 1


async def test_revoke_marks_record_and_requires_again(db_session, gate_on) -> None:
    client = await _client(db_session)
    consent = await grant_consent(db_session, gate_on, client.id, method="widget", shown_text="т")
    revoked = await revoke_consent(db_session, client.id)
    assert revoked is not None and revoked.id == consent.id
    assert revoked.revoked_at is not None
    # Старая запись не удаляется — она доказательство.
    assert await _consents(db_session) == 1
    assert await consent_required(db_session, gate_on, client.id) is True
    # Повторный отзыв — нечего отзывать.
    assert await revoke_consent(db_session, client.id) is None

    # Новое согласие после отзыва — вторая запись, первая остаётся.
    fresh = await grant_consent(db_session, gate_on, client.id, method="widget", shown_text="т")
    assert fresh.id != consent.id
    assert await _consents(db_session) == 2
