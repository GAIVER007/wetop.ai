"""Подключения WhatsApp Cloud API по организациям (С3 «под ключ», Q-185 (а)).

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-25

Токен и секрет приложения Meta — только шифрованными (секрет хранилища
LLM_KEYS_SECRET); phone_number_id уникален: по нему дверь сверяет,
что тело вебхука — про номер этой гостиницы.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, Sequence[str], None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "whatsapp_connections",
        sa.Column("organization_id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("phone_number_id", sa.Text(), nullable=False, unique=True),
        sa.Column("token_encrypted", sa.LargeBinary(), nullable=False),
        sa.Column("app_secret_encrypted", sa.LargeBinary(), nullable=False),
        sa.Column("verify_token", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_whatsapp_connections_organization",
            ondelete="CASCADE",
        ),
    )


def downgrade() -> None:
    op.drop_table("whatsapp_connections")
