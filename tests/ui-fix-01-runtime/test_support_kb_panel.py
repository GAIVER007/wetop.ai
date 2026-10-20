"""Local bot panel and sqlite storage proof with deterministic fake embeddings, no external AI."""

from __future__ import annotations

import sqlalchemy as sa

from src.db.models import SupportKnowledge, SupportKnowledgeVersion
from tests.dashboard_fakes import PANEL, panel, sync_db  # noqa: F401

KEY = "ui-fix-01-local-service-key"
HEADERS = {"X-Service-Key": KEY}
ROOT = f"{PANEL}/support-knowledge"


def test_saved_b_is_the_version_published_and_read_from_local_storage(
    monkeypatch, fake_redis, fake_embedder, sync_db
) -> None:  # noqa: F811
    with panel(monkeypatch, fake_redis, SELLER_SERVICE_KEY=KEY, BOT_ROLE="support") as board:
        created = board.client.post(
            ROOT,
            headers=HEADERS,
            json={
                "title": "UI-FIX-01 local KB",
                "category": "HOW_TO",
                "visibility": "PUBLIC_SUPPORT",
                "content": "A, сохранённый исходный текст.",
                "by": "ui-fix-01-admin",
            },
        )
        assert created.status_code == 200, created.text
        knowledge_id = created.json()["id"]

        saved_b = board.client.put(
            f"{ROOT}/{knowledge_id}",
            headers=HEADERS,
            json={"content": "B, сохранённый новый текст.", "by": "ui-fix-01-admin"},
        )
        assert saved_b.status_code == 200, saved_b.text
        assert saved_b.json()["status"] == "DRAFT" and saved_b.json()["version"] == 2

        published = board.client.post(
            f"{ROOT}/{knowledge_id}/publish",
            headers=HEADERS,
            json={"approved_by": "ui-fix-01-admin"},
        )
        assert published.status_code == 200, published.text
        assert published.json()["status"] == "ACTIVE" and published.json()["version"] == 2

        readback = board.client.get(f"{ROOT}/{knowledge_id}", headers=HEADERS)
        assert readback.status_code == 200, readback.text
        assert readback.json()["content"] == "B, сохранённый новый текст."
        assert [item["version"] for item in readback.json()["versions"]] == [2, 1]

        with sync_db() as session:
            row = session.execute(sa.select(SupportKnowledge)).scalar_one()
            versions = session.execute(
                sa.select(SupportKnowledgeVersion.version, SupportKnowledgeVersion.content)
                .order_by(SupportKnowledgeVersion.version)
            ).all()
            assert row.status == "ACTIVE" and row.version == 2
            assert row.content == "B, сохранённый новый текст."
            assert versions == [
                (1, "A, сохранённый исходный текст."),
                (2, "B, сохранённый новый текст."),
            ]
