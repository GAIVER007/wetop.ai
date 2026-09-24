"""Шаг 2: настройки базы знаний есть в Settings, размерность совпадает со схемой."""

import re
from pathlib import Path

from src.config import Settings, get_settings
from src.db import models

ROOT = Path(__file__).resolve().parent.parent
KB_NAME_RE = re.compile(r"^(KB_[A-Z_]+)=", re.MULTILINE)

EXPECTED_DEFAULTS = {
    "kb_chunk_chars": 900,
    "kb_chunk_overlap": 150,
    "kb_chunk_min_chars": 80,
    "kb_max_file_mb": 10,
    "kb_embed_model": "intfloat/multilingual-e5-small",
    "kb_embed_dim": 384,
    "kb_embed_cache_ttl_seconds": 604800,
    "kb_embed_warmup": True,
    "kb_top_k": 5,
}


def _kb_names_from_env_example() -> list[str]:
    text = (ROOT / "env.example").read_text(encoding="utf-8")
    return KB_NAME_RE.findall(text)


def test_kb_variables_from_env_example_are_settings_fields() -> None:
    names = _kb_names_from_env_example()
    assert names, "в env.example нет блока базы знаний"
    missing = [n for n in names if n.lower() not in Settings.model_fields]
    assert not missing, f"в Settings нет полей для: {missing}"


def test_every_kb_field_is_documented_in_env_example() -> None:
    documented = {n.lower() for n in _kb_names_from_env_example()}
    assert set(EXPECTED_DEFAULTS) <= documented


def test_kb_defaults() -> None:
    fields = Settings.model_fields
    for name, default in EXPECTED_DEFAULTS.items():
        assert fields[name].default == default, name


def test_embedding_dim_matches_schema() -> None:
    assert get_settings().kb_embed_dim == models.EMBEDDING_DIM


def test_tests_run_without_warmup() -> None:
    # conftest выключает прогрев: иначе client-фикстура полезла бы за моделью.
    assert get_settings().kb_embed_warmup is False
