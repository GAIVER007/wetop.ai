"""Шаг 4: все новые модули импортируются, контракт имён на месте."""

import importlib
import inspect

import pytest

MODULES = [
    "src.ai.llm",
    "src.ai.schemas",
    "src.ai.tools",
    "src.ai.context",
    "src.knowledge.prompt",
]

NAMES = {
    "src.ai.llm": [
        "AttemptLog",
        "LlmResult",
        "vendor_of",
        "check_distinct_vendors",
        "CascadeClient",
        "get_cascade_client",
        "set_cascade_client",
        "reset_cascade_client",
    ],
    "src.ai.schemas": ["LeadFields", "ModelReply", "MODEL_REPLY_JSON_SCHEMA", "parse_model_json", "parse_model_reply"],
    "src.ai.tools": ["ToolSpec", "ToolRegistry"],
    "src.ai.context": ["HistoryTurn", "OUTPUT_INSTRUCTIONS", "build_messages", "mask_messages"],
    "src.knowledge.prompt": ["PromptMissing", "load_system_prompt", "reset_prompt_cache"],
}


@pytest.mark.parametrize("module", MODULES)
def test_module_imports(module: str) -> None:
    mod = importlib.import_module(module)
    assert mod.__doc__, f"{module}: нет docstring"
    for name in NAMES[module]:
        assert hasattr(mod, name), f"{module}.{name}"


def test_no_router_addresses_in_llm_module() -> None:
    # Адрес и ключ — только из Settings: в коде роутеров нет.
    source = inspect.getsource(importlib.import_module("src.ai.llm"))
    assert "https://" not in source
    assert "api.openai.com" not in source


def test_sdk_retries_disabled() -> None:
    source = inspect.getsource(importlib.import_module("src.ai.llm"))
    assert "max_retries=0" in source.replace(" ", "")


def test_cascade_singleton_roundtrip(monkeypatch: pytest.MonkeyPatch) -> None:
    from src.ai.llm import CascadeClient, get_cascade_client, reset_cascade_client, set_cascade_client
    from tests.llm_fakes import ScriptedRouter, llm_env

    settings = llm_env(monkeypatch)
    own = CascadeClient(settings, http_client=ScriptedRouter().http_client())
    set_cascade_client(own)
    try:
        assert get_cascade_client() is own
    finally:
        reset_cascade_client()
    fresh = get_cascade_client()
    assert fresh is not own
    assert isinstance(fresh, CascadeClient)
    assert get_cascade_client() is fresh
    reset_cascade_client()
