"""Ключ модели партнёра (С2 «под ключ», Q-186): шифрованный, по организации.

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-25

Новая таблица — обычный CREATE, батчей SQLite не требуется. Ключ лежит
только шифрованным (Fernet, секрет LLM_KEYS_SECRET из окружения бота);
удаление организации уносит и ключ (ON DELETE CASCADE).
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0003"
down_revision: Union[str, Sequence[str], None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "organization_llm_keys",
        sa.Column("organization_id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("key_encrypted", sa.LargeBinary(), nullable=False),
        sa.Column("last4", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_organization_llm_keys_organization",
            ondelete="CASCADE",
        ),
    )


def downgrade() -> None:
    op.drop_table("organization_llm_keys")
