"""Шаг 5: модули движка импортируются, контракт на месте, песочница подключена."""

import dataclasses
import importlib

import pytest

MODULES = (
    "src.ai.engine",
    "src.ai.lead",
    "src.ai.humanizer",
    "src.channels.sender",
    "src.dashboard_router",
)


@pytest.mark.parametrize("name", MODULES)
def test_module_imports(name: str) -> None:
    importlib.import_module(name)


def test_engine_contract_names() -> None:
    from src.ai import engine

    for name in ("Engine", "IncomingMessage", "TurnOutcome", "PIPELINE", "NEUTRAL_REPLY", "REFUSAL_REPLY", "build_engine"):
        assert hasattr(engine, name), name
    assert dataclasses.is_dataclass(engine.IncomingMessage)
    assert dataclasses.is_dataclass(engine.TurnOutcome)
    assert len(engine.PIPELINE) == 13


def test_lead_contract_names() -> None:
    from src.ai import lead

    for name in (
        "merge_contacts", "merge_model_lead", "is_complete", "contact_refused",
        "needs_ask", "ASK_TEXTS", "REFUSAL_ACK", "reply_already_asks",
    ):
        assert hasattr(lead, name), name
    assert set(lead.ASK_TEXTS) == {"name", "phone", "both"}


def test_sender_contract() -> None:
    from src.channels.sender import SendResult, Sender

    result = SendResult(ok=True)
    assert result.error is None and result.external_message_id is None
    with pytest.raises(dataclasses.FrozenInstanceError):
        result.ok = False  # type: ignore[misc]
    assert hasattr(Sender, "send")


def test_sandbox_route_registered() -> None:
    from src.main import create_app

    def walk(routes):
        # include_router в новых FastAPI кладёт вложенный роутер, а не плоский список.
        for route in routes:
            if getattr(route, "path", None):
                yield route.path
            nested = getattr(route, "original_router", None) or route
            yield from walk(getattr(nested, "routes", []) or [])

    assert "/internal/sandbox" in set(walk(create_app().routes))
