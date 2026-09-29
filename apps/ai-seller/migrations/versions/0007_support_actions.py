"""Журнал действий WETOP Support (S6): что предложил, подтвердил, выполнил или отдал человеку бот.

Revision ID: 0007
Revises: 0006
Create Date: 2026-09-29

Одна новая таблица; существующие не меняются. Живёт в базе бота (plans/ai-agents-wetop-support-2026-09-29.md §3).
В `result` — короткая строка без персональных данных: сводка для человека проходит маску до записи.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

UUID = sa.Uuid(as_uuid=True)
TZ = sa.DateTime(timezone=True)

# Словари записаны здесь, а не импортируются: миграция описывает схему на свой день.
ACTION_CLASSES = ("SAFE", "CONFIRM", "HUMAN_ONLY")
ACTION_STATUSES = ("PROPOSED", "CONFIRMED", "DONE", "FAILED", "CANCELLED", "EXPIRED", "REFUSED", "ESCALATED")


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


revision: str = "0007"
down_revision: Union[str, Sequence[str], None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "support_actions",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("conversation_id", sa.String(64), nullable=True),
        sa.Column("user_ref", sa.String(32), nullable=False),
        sa.Column("action", sa.String(40), nullable=False),
        sa.Column("action_class", sa.String(16), nullable=False),
        sa.Column("args", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("result", sa.String(300), nullable=True),
        sa.Column("created_at", TZ, nullable=False),
        sa.Column("executed_at", TZ, nullable=True),
        sa.CheckConstraint(_in("action_class", ACTION_CLASSES), name="ck_support_actions_class"),
        sa.CheckConstraint(_in("status", ACTION_STATUSES), name="ck_support_actions_status"),
    )
    op.create_index("idx_support_actions_conv", "support_actions", ["conversation_id", "created_at"])


def downgrade() -> None:
    op.drop_index("idx_support_actions_conv", table_name="support_actions")
    op.drop_table("support_actions")
