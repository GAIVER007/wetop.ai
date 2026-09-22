"""Шаг 3: все новые модули импортируются, контракт имён на месте."""

import importlib

import pytest

MODULES = [
    "src.security",
    "src.security.pii",
    "src.security.signatures",
    "src.db.dedup",
    "src.db.ip_block",
    "src.db.injection_tracker",
    "src.ai",
    "src.ai.guard_patterns",
    "src.ai.guardrails",
    "src.channels",
    "src.channels.consent_gate",
]

NAMES = {
    "src.security.pii": ["Contacts", "normalize_phone", "extract_contacts", "mask", "unmask", "mask_for_log", "PiiLogFilter"],
    "src.security.signatures": ["sign_hmac_sha256", "verify_hmac_sha256", "verify_secret_token"],
    "src.db.dedup": ["is_duplicate"],
    "src.db.ip_block": ["block_ip", "is_ip_blocked", "unblock_ip", "IpBlockMiddleware"],
    "src.db.injection_tracker": ["StrikeResult", "add_strike", "is_conversation_blocked", "clear_strikes"],
    "src.ai.guard_patterns": ["INVISIBLE_CHARS", "HOMOGLYPHS_LATIN_TO_CYR", "CRESCENDO_WORDS", "PATTERNS"],
    "src.ai.guardrails": [
        "normalize", "clip", "PatternHit", "find_patterns", "crescendo_count", "InputVerdict",
        "check_input", "apply_strikes", "DocumentVerdict", "scan_document",
        "OutputContext", "OutputVerdict", "check_output",
    ],
    "src.channels.consent_gate": ["ConsentScreen", "consent_screen", "consent_required", "grant_consent", "revoke_consent"],
}


@pytest.mark.parametrize("module", MODULES)
def test_module_imports(module: str) -> None:
    mod = importlib.import_module(module)
    assert mod.__doc__, f"{module}: нет docstring"
    for name in NAMES.get(module, []):
        assert hasattr(mod, name), f"{module}.{name}"


def test_patterns_have_shape() -> None:
    from src.ai.guard_patterns import PATTERNS

    assert PATTERNS
    for name, severity, regex in PATTERNS:
        assert isinstance(name, str) and name
        assert severity in ("refuse", "flag")
        assert hasattr(regex, "search")


def test_integration_points_wired() -> None:
    import src.dependencies
    import src.knowledge.ingestor
    import src.main

    assert hasattr(src.knowledge.ingestor, "SuspiciousDocument")
    assert src.dependencies.PiiLogFilter is not None
    assert src.main.IpBlockMiddleware is not None
