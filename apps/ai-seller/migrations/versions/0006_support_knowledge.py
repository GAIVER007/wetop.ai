"""База знаний WETOP Support: записи, версии, чанки, использование (S3).

Revision ID: 0006
Revises: 0005
Create Date: 2026-09-29

Четыре новые таблицы; существующие не меняются. Записи знаний живут в базе бота, а не в базе стойки
(plans/ai-agents-wetop-support-2026-09-29.md §3). Индекс hnsw по векторам — только в Postgres.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from src.db.base import VectorType

UUID = sa.Uuid(as_uuid=True)
TZ = sa.DateTime(timezone=True)
EMBEDDING_DIM = 384  # multilingual-e5-small, как в 0001

# Словари записаны здесь, а не импортируются: миграция описывает схему на свой день и не должна менять её вслед за моделью.
KB_CATEGORIES = (
    "PRODUCT", "HOW_TO", "TROUBLESHOOTING", "BILLING", "INTEGRATIONS", "SECURITY", "KNOWN_ISSUE", "RUNBOOK",
)
KB_VISIBILITIES = ("PUBLIC_SUPPORT", "INTERNAL_SUPPORT", "PLATFORM_ADMIN_ONLY")
KB_STATUSES = ("DRAFT", "ACTIVE", "OUTDATED", "ARCHIVED")


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"

revision: str = "0006"
down_revision: Union[str, Sequence[str], None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "support_knowledge",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("visibility", sa.String(24), nullable=False),
        sa.Column("status", sa.String(12), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(200), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("approved_by", sa.String(200)),
        sa.Column("approved_at", TZ),
        sa.Column("created_at", TZ, nullable=False),
        sa.Column("updated_at", TZ, nullable=False),
        sa.CheckConstraint(_in("category", KB_CATEGORIES), name="ck_support_knowledge_category"),
        sa.CheckConstraint(_in("visibility", KB_VISIBILITIES), name="ck_support_knowledge_visibility"),
        sa.CheckConstraint(_in("status", KB_STATUSES), name="ck_support_knowledge_status"),
    )
    op.create_index("idx_support_knowledge_status", "support_knowledge", ["status"])
    op.create_table(
        "support_knowledge_versions",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("knowledge_id", UUID, sa.ForeignKey("support_knowledge.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("visibility", sa.String(24), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("saved_by", sa.String(200)),
        sa.Column("saved_at", TZ, nullable=False),
        sa.UniqueConstraint("knowledge_id", "version", name="uq_support_knowledge_version"),
    )
    op.create_table(
        "support_knowledge_chunks",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("knowledge_id", UUID, sa.ForeignKey("support_knowledge.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding", VectorType(EMBEDDING_DIM)),
        sa.Column("created_at", TZ, nullable=False),
    )
    op.create_table(
        "support_knowledge_usage",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("conversation_id", sa.String(64)),
        sa.Column("knowledge_id", UUID, sa.ForeignKey("support_knowledge.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("visibility", sa.String(24), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("used_at", TZ, nullable=False),
    )
    op.create_index("idx_support_kb_usage_conv", "support_knowledge_usage", ["conversation_id", "used_at"])
    if op.get_bind().dialect.name == "postgresql":
        op.execute(
            "CREATE INDEX idx_support_kb_chunks_vec ON support_knowledge_chunks USING hnsw (embedding vector_cosine_ops)"
        )


def downgrade() -> None:
    for table in (
        "support_knowledge_usage",
        "support_knowledge_chunks",
        "support_knowledge_versions",
        "support_knowledge",
    ):
        op.drop_table(table)
