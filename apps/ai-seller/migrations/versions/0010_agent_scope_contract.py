"""Область агента, шаг «сузить» (DATA_MODEL §20.7 п. 6, SA2.5): ключи по организации уступают ключам по агенту.

Revision ID: 0010
Revises: 0009
Create Date: 2026-09-30

🔴 ОТДЕЛЬНЫЙ РЕЛИЗ. Применяется только после того, как рантайм по `agent_id` (образ с миграцией 0009) выложен и смоуки Luxx зелёные
(`docs/ops/sa25-agent-scope.md` §3–4). Прежний образ бота (до SA2.5) на схеме после этой миграции работать НЕ будет: он читает
подключение WhatsApp и клиента по организации.

Что делает:
  · клиент и документ уникальны в пределах АГЕНТА: снимает `uq_clients_org_channel_external` и `uq_documents_org_hash` (один
    гость у двух агентов одной организации — два клиента; один прайс у двух агентов — две записи);
  · подключение WhatsApp: первичный ключ — `agent_id` (у организации может быть по подключению на агента), `agent_id` NOT NULL;
  · CHECK «строка организации имеет агента» у клиентов, диалогов, документов: забытый писателем агент больше не молчаливый NULL.
Останавливается без изменений, если есть строки организации без агента.

Откат возвращает прежние ключи и отказывает, если данные их уже не выдерживают (у организации несколько агентов с одним гостем,
документом или подключением): молча склеивать чужое нельзя.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: Union[str, Sequence[str], None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CHECKED = ("clients", "conversations", "documents")


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def _wa_primary_key(column: str) -> None:
    """Первичный ключ подключения WhatsApp. Postgres — по имени ограничения; SQLite (только тесты) держит ключ безымянным, и
    пакетный режим сам пересобирает таблицу с новым ключом."""
    if _is_postgres():
        op.execute("ALTER TABLE whatsapp_connections DROP CONSTRAINT whatsapp_connections_pkey")
        op.execute(f"ALTER TABLE whatsapp_connections ADD CONSTRAINT whatsapp_connections_pkey PRIMARY KEY ({column})")
    else:
        with op.batch_alter_table("whatsapp_connections", recreate="always") as batch:
            batch.create_primary_key("whatsapp_connections_pkey", [column])


def _count(sql: str) -> int:
    return int(op.get_bind().execute(sa.text(sql)).scalar() or 0)


def upgrade() -> None:
    for table in CHECKED:
        orphans = _count(f"SELECT count(*) FROM {table} WHERE organization_id IS NOT NULL AND agent_id IS NULL")
        if orphans:
            raise RuntimeError(f"0010 остановлена: в {table} {orphans} строк организации без агента — сначала добрать agent_id")
    if _count("SELECT count(*) FROM whatsapp_connections WHERE agent_id IS NULL"):
        raise RuntimeError("0010 остановлена: подключение WhatsApp без агента")

    op.drop_index("uq_clients_org_channel_external", table_name="clients")
    op.drop_index("uq_documents_org_hash", table_name="documents")
    # дублирует будущий первичный ключ
    op.drop_index("uq_whatsapp_connections_agent", table_name="whatsapp_connections")

    if _is_postgres():
        op.execute("ALTER TABLE whatsapp_connections ALTER COLUMN agent_id SET NOT NULL")
    _wa_primary_key("agent_id")

    for table in CHECKED:
        if _is_postgres():
            op.create_check_constraint(f"ck_{table}_org_has_agent", table, "organization_id IS NULL OR agent_id IS NOT NULL")
        else:
            with op.batch_alter_table(table, recreate="always") as batch:
                batch.create_check_constraint(f"ck_{table}_org_has_agent", "organization_id IS NULL OR agent_id IS NOT NULL")


def downgrade() -> None:
    # прежние ключи возможны, только пока данные их выдерживают
    checks = {
        "clients": "SELECT count(*) FROM (SELECT 1 FROM clients WHERE organization_id IS NOT NULL "
        "GROUP BY organization_id, channel, external_id HAVING count(*) > 1) d",
        "documents": "SELECT count(*) FROM (SELECT 1 FROM documents WHERE organization_id IS NOT NULL "
        "GROUP BY organization_id, file_hash HAVING count(*) > 1) d",
        "whatsapp_connections": "SELECT count(*) FROM (SELECT 1 FROM whatsapp_connections GROUP BY organization_id "
        "HAVING count(*) > 1) d",
    }
    for table, sql in checks.items():
        if _count(sql):
            raise RuntimeError(
                f"0010 не откатывается: в {table} у одной организации несколько агентов делят прежний ключ — "
                "уберите лишние строки или оставьте схему"
            )

    for table in CHECKED:
        if _is_postgres():
            op.drop_constraint(f"ck_{table}_org_has_agent", table, type_="check")
        else:
            with op.batch_alter_table(table, recreate="always") as batch:
                batch.drop_constraint(f"ck_{table}_org_has_agent", type_="check")

    _wa_primary_key("organization_id")
    op.create_index("uq_whatsapp_connections_agent", "whatsapp_connections", ["agent_id"], unique=True)

    op.create_index(
        "uq_documents_org_hash",
        "documents",
        ["organization_id", "file_hash"],
        unique=True,
        postgresql_where=sa.text("organization_id IS NOT NULL"),
        sqlite_where=sa.text("organization_id IS NOT NULL"),
    )
    op.create_index(
        "uq_clients_org_channel_external",
        "clients",
        ["organization_id", "channel", "external_id"],
        unique=True,
        postgresql_where=sa.text("organization_id IS NOT NULL"),
        sqlite_where=sa.text("organization_id IS NOT NULL"),
    )
