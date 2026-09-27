"""Разбивка расхода модели у ответа бота (plans/seller-cost-controls-2026-09-26.md, Р2).

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-26

messages: модель ответа, входные токены, из них кэшированные, выходные.
Цена ИИ-продавца считается от расхода гостиницы, а вход, кэш и выход стоят
по-разному — одной суммы мало. tokens_used остаётся суммой, как раньше: на ней
дневной предел гостиницы и старые строки. У старых ответов и у реплик без
модели новые колонки пустые.

Только добавление колонок без умолчаний: Postgres делает это без перезаписи
таблицы. SQLite (тесты) снимает колонку своим DROP COLUMN — таблица не
пересоздаётся, CHECK перечисления роли не теряется.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, Sequence[str], None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLUMNS = (
    ("llm_model", sa.Text),
    ("tokens_input", sa.Integer),
    ("tokens_cached", sa.Integer),
    ("tokens_output", sa.Integer),
)


def upgrade() -> None:
    for name, type_ in COLUMNS:
        op.add_column("messages", sa.Column(name, type_(), nullable=True))


def downgrade() -> None:
    for name, _ in reversed(COLUMNS):
        op.drop_column("messages", name)
