"""Шаг 3: корпус. Атаки отбиваются, ложные срабатывания проходят,
контакт дороже правила."""

import pytest

from src.ai.guardrails import check_input
from tests.guard_corpus import ATTACKS, CONTACT_BEATS_RULE, FALSE_POSITIVES

GUARD = dict(history=[], max_chars=4000, crescendo_window=10, crescendo_hits=3)


def test_corpus_is_big_enough() -> None:
    assert len(ATTACKS) >= 14
    assert len(FALSE_POSITIVES) >= 12


@pytest.mark.parametrize(("text", "expected"), ATTACKS, ids=[t[:40] for t, _ in ATTACKS])
def test_attack_is_caught(text: str, expected: str) -> None:
    verdict = check_input(text, **GUARD)
    assert verdict.action == expected, verdict.reasons
    if expected == "refuse":
        assert verdict.strike is True
    assert verdict.reasons


@pytest.mark.parametrize(
    ("text", "phone"), FALSE_POSITIVES, ids=[t[:40] for t, _ in FALSE_POSITIVES]
)
def test_false_positive_is_never_refused(text: str, phone: str | None) -> None:
    verdict = check_input(text, **GUARD)
    assert verdict.action in ("pass", "flag"), verdict.reasons
    assert verdict.strike is False
    if phone is not None:
        assert phone in verdict.contacts.phones
    else:
        assert verdict.contacts.phones == (), "сумма или дата принята за телефон"


def test_contact_next_to_injection_is_flagged_not_refused() -> None:
    verdict = check_input(CONTACT_BEATS_RULE, **GUARD)
    assert verdict.action == "flag"
    assert verdict.strike is False
    assert verdict.reasons, "причина срабатывания сохраняется для пометки в панели"
    assert verdict.contacts.phones == ("77071234567",)


def test_email_and_handle_are_extracted() -> None:
    verdict = check_input("Пишите на ivan@example.com или в @ivan_petrov", **GUARD)
    assert "ivan@example.com" in verdict.contacts.emails
    assert "@ivan_petrov" in verdict.contacts.handles
    assert verdict.contacts.any
