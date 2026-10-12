"""Reuse the bot project's isolated sqlite/fake-embedding fixtures without loading project .env."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

AI_ROOT = Path(__file__).resolve().parents[2] / "apps" / "ai-seller"
sys.path.insert(0, str(AI_ROOT))
spec = importlib.util.spec_from_file_location("ui_fix_01_ai_conftest", AI_ROOT / "tests" / "conftest.py")
if spec is None or spec.loader is None:
    raise RuntimeError("Cannot load ai-seller test fixtures")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

for name in (
    "settings_env",
    "alembic_config",
    "migrated_db",
    "db_session",
    "fake_redis",
    "client",
    "fake_backend",
    "fake_embedder",
):
    globals()[name] = getattr(module, name)
