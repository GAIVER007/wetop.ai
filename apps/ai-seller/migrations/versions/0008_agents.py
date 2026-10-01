"""Личность агента (DATA_MODEL §20, SA1.6): таблица agents и agent_id у знаний, клиентов, диалогов и WhatsApp.

Revision ID: 0008
Revises: 0007
Create Date: 2026-09-30

Расширение без сужения: прежний код читает организацию и продолжает работать. Существующий продавец каждой
гостиницы переносится в агента с `id = organization_id` (ключ виджета, адрес вебхука и `phone_number_id` не меняются),
`agent_id` существующих строк заполняется тем же значением. Строки без организации (экземпляр-помощник) агента не имеют.

`agent_id` остаётся NULL-able, а старая уникальность клиента по организации, на месте: `NOT NULL` и снятие старых
ограничений, «сужение» после релиза без происшествий (§20.7 п. 6). owner_actions в этот срез не входит (SA8/SA9).

SQLite (только тесты) не умеет ALTER на констрейнты: колонка добавляется без внешнего ключа, ключ ставит Postgres.
Откат удаляет agent_id и agents, историю не трогает.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from src.db.base import JSONType

revision: str = "0008"
down_revision: Union[str, Sequence[str], None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = sa.Uuid(as_uuid=True)
TZ = sa.DateTime(timezone=True)

# Таблицы с колонкой организации, получающие agent_id
AGENT_TABLES = ("documents", "clients", "conversations", "whatsapp_connections")


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    op.create_table(
        "agents",
        sa.Column("id", UUID, primary_key=True),
        sa.Column(
            "organization_id",
            UUID,
            sa.ForeignKey("organizations.id", ondelete="CASCADE", name="fk_agents_organization"),
            nullable=False,
        ),
        sa.Column("location_id", UUID, nullable=True),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("public_key", sa.Text, nullable=False, unique=True),
        sa.Column("hosts", JSONType, nullable=False),
        sa.Column("system_prompt", sa.Text, nullable=True),
        sa.Column("active", sa.Boolean, nullable=False),
        sa.Column("created_at", TZ, nullable=False),
        sa.Column("updated_at", TZ, nullable=False),
    )
    op.create_index("idx_agents_organization", "agents", ["organization_id"])

    # Перенос: по агенту на каждую гостиницу, id совпадает
    op.execute(
        "INSERT INTO agents (id, organization_id, name, public_key, hosts, system_prompt, active, created_at, updated_at) "
        "SELECT id, id, name, public_key, hosts, system_prompt, active, created_at, updated_at FROM organizations"
    )

    for table in AGENT_TABLES:
        op.add_column(table, sa.Column("agent_id", UUID, nullable=True))
        if _is_postgres():
            op.create_foreign_key(f"fk_{table}_agent", table, "agents", ["agent_id"], ["id"])
        op.execute(f"UPDATE {table} SET agent_id = organization_id WHERE organization_id IS NOT NULL")
        op.create_index(f"idx_{table}_agent", table, ["agent_id"])

    # whatsapp_connections: строка одна на организацию, значит и на агента
    op.create_index(
        "uq_clients_agent_channel_external",
        "clients",
        ["agent_id", "channel", "external_id"],
        unique=True,
        postgresql_where=sa.text("agent_id IS NOT NULL"),
        sqlite_where=sa.text("agent_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_clients_agent_channel_external", table_name="clients")
    for table in AGENT_TABLES:
        op.drop_index(f"idx_{table}_agent", table_name=table)
        if _is_postgres():
            op.drop_constraint(f"fk_{table}_agent", table, type_="foreignkey")
        with op.batch_alter_table(table) as batch:
            batch.drop_column("agent_id")
    op.drop_index("idx_agents_organization", table_name="agents")
    op.drop_table("agents")
