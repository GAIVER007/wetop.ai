"""Loopback-only support panel for the UI-FIX-01 browser proof.

Uses migrated temporary sqlite, fakeredis and deterministic fake embeddings.
It never loads a repository .env or starts an external channel/model worker.
"""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AI_ROOT = ROOT / "apps" / "ai-seller"
sys.path.insert(0, str(AI_ROOT))

for key in tuple(os.environ):
    if key.endswith(
        ("_API_KEY", "_ACCESS_KEY", "_ACCESS_TOKEN", "_SECRET", "_PASSWORD", "_TOKEN")
    ) or key.startswith(
        (
            "OPENAI_",
            "ANTHROPIC_",
            "GEMINI_",
            "GOOGLE_",
            "AZURE_",
            "COHERE_",
            "MISTRAL_",
            "TOGETHER_",
            "HUGGINGFACE_",
            "HF_",
            "AWS_",
            "S3_",
            "CLOUDFLARE_",
            "VERCEL_",
            "RESEND_",
            "SENDGRID_",
            "SMTP_",
            "TELEGRAM_",
            "WHATSAPP_",
        )
    ):
        os.environ.pop(key, None)

work = tempfile.TemporaryDirectory(prefix="wetop-ui-fix-01-kb-")
work_path = Path(work.name)
os.chdir(work_path)

db_file = work_path / "support.sqlite3"
panel_key = "ui-fix-01-local-service-key"
os.environ.update(
    {
        "DATABASE_URL": f"sqlite+aiosqlite:///{db_file}",
        "REDIS_URL": "redis://127.0.0.1:1/0",
        "APP_ENV": "test",
        "LOG_LEVEL": "warning",
        "BOT_ROLE": "support",
        "SELLER_SERVICE_KEY": panel_key,
        "KB_EMBED_WARMUP": "false",
        "DASHBOARD_PATH_PREFIX": "/ui-fix-01-panel",
        "DASHBOARD_JWT_SECRET": "ui-fix-01-local-dashboard-secret",
        "DASHBOARD_ADMIN_EMAIL": "ui-fix-01@example.invalid",
        "DASHBOARD_ADMIN_PASSWORD_HASH": "disabled-for-service-key-only",
        "DASHBOARD_SESSION_TTL_HOURS": "1",
        "DASHBOARD_ALLOWED_IPS": "",
        "DASHBOARD_2FA_ENABLED": "false",
        "INTERNAL_HEALTH_KEY": "ui-fix-01-local-health-key",
    }
)

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402

alembic = Config(str(AI_ROOT / "alembic.ini"))
alembic.set_main_option("script_location", str(AI_ROOT / "migrations"))
alembic.set_main_option("sqlalchemy.url", f"sqlite:///{db_file}")
command.upgrade(alembic, "heads")

import fakeredis.aioredis  # noqa: E402
import uvicorn  # noqa: E402
from src import dependencies  # noqa: E402
from src.knowledge.embedder import Embedder, set_embedder  # noqa: E402
from src.main import create_app  # noqa: E402
from tests.kb_fakes import HashingBackend  # noqa: E402

fake_redis = fakeredis.aioredis.FakeRedis()
dependencies._resources.redis = fake_redis
set_embedder(Embedder(HashingBackend(), fake_redis, cache_ttl_seconds=60))

uvicorn.run(
    create_app(),
    host="127.0.0.1",
    port=int(os.environ.get("UI_FIX_01_KB_PORT", "8324")),
    log_level="warning",
    access_log=False,
)
