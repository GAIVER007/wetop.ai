"""Область агента, шаг «расширить» (DATA_MODEL §20, SA2.5): всё, что нужно рантайму, читающему по `agent_id`.

Revision ID: 0009
Revises: 0008
Create Date: 2026-09-30

Расширение без сужения (`plans/business-ai-seller-sa25-2026-09-30.md` §10 п. 5): ни один ключ и ни одно ограничение по
организации не снимается, прежний образ бота продолжает работать на этой схеме. Сужение — миграция 0010 в отдельном
релизе, только после доказанного рантайма.

Что делает:
  1. добирает агентов: организация без строки `agents` получает её (id = организации, как при переносе 0008);
  2. добирает `agent_id` строкам с организацией, у которых он пуст (записи между 0008 и выкладкой кода);
  3. уникальный индекс `whatsapp_connections(agent_id)` — будущий первичный ключ подключения; сейчас у организации одно
     подключение и оно принадлежит одному агенту, значит уникальность выполняется;
  4. уникальность документа по агенту `(agent_id, file_hash)`: рядом со старой по организации (`uq_documents_org_hash`,
     снимается в 0010), пока агент в организации один, они совпадают; индекс диалогов (агент, последняя активность).

Откат снимает только добавленные индексы: данные (агенты, `agent_id`) остаются — прежним кодом они не читаются.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: Union[str, Sequence[str], None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

AGENT_TABLES = ("documents", "clients", "conversations", "whatsapp_connections")


def upgrade() -> None:
    op.execute(
        "INSERT INTO agents (id, organization_id, name, public_key, hosts, system_prompt, active, created_at, updated_at) "
        "SELECT o.id, o.id, o.name, o.public_key, o.hosts, o.system_prompt, o.active, o.created_at, o.updated_at "
        "FROM organizations o WHERE NOT EXISTS (SELECT 1 FROM agents a WHERE a.id = o.id)"
    )
    for table in AGENT_TABLES:
        op.execute(f"UPDATE {table} SET agent_id = organization_id WHERE agent_id IS NULL AND organization_id IS NOT NULL")

    op.create_index("uq_whatsapp_connections_agent", "whatsapp_connections", ["agent_id"], unique=True)
    op.create_index("idx_conversations_agent_activity", "conversations", ["agent_id", "last_activity_at"])
    op.create_index(
        "uq_documents_agent_hash",
        "documents",
        ["agent_id", "file_hash"],
        unique=True,
        postgresql_where=sa.text("agent_id IS NOT NULL"),
        sqlite_where=sa.text("agent_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_documents_agent_hash", table_name="documents")
    op.drop_index("idx_conversations_agent_activity", table_name="conversations")
    op.drop_index("uq_whatsapp_connections_agent", table_name="whatsapp_connections")
