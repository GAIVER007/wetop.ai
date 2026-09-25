"""Организации (Э4, ADR-083): один продавец обслуживает много гостиниц.

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-25

Таблица organizations; organization_id у clients, conversations, documents;
уникальности (channel, external_id) и file_hash становятся частичными —
свои в пределах организации и свои для строк без неё (NULL в обычном
уникальном индексе различен, дубли прошли бы молча).

SQLite (только тесты) не умеет ALTER на констрейнты — таблицы пересоздаются
батчем с copy_from: там перечислено, как таблица выглядит ДО правки, и без
copy_from пересоздание потеряло бы CHECK-и перечислений (SQLite их
не отражает). Postgres — обычные ALTER.

Политики RLS создаются и включаются здесь же (Postgres), ключ —
current_setting('app.org_id'). 🔴 Честно: бот сегодня ходит в свою базу
владельцем таблиц, а владелец политики обходит; действующая гарантия
изоляции — фильтры приложения, доказанные tests/test_orgs_isolation.py.
Политики заработают, когда владелец заведёт непривилегированного
пользователя базы (шаг выкладки, план §3).
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from src.db.base import (
    ConversationMode,
    ExternalId,
    FunnelStage,
    JSONType,
    enum_column,
)

revision: str = "0002"
down_revision: Union[str, Sequence[str], None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = sa.Uuid(as_uuid=True)
TZ = sa.DateTime(timezone=True)

# Таблицы с колонкой организации и политикой RLS.
ORG_TABLES = ("clients", "conversations", "documents")


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def _partial_unique(name: str, table: str, columns: list[str], where: str) -> None:
    op.create_index(
        name,
        table,
        columns,
        unique=True,
        postgresql_where=sa.text(where),
        sqlite_where=sa.text(where),
    )


def _org_column(table: str) -> sa.Column:
    # Имя внешнего ключа явное: батч SQLite пересоздаёт таблицу и безымянный
    # констрейнт не принимает («Constraint must have a name»).
    return sa.Column(
        "organization_id",
        UUID,
        sa.ForeignKey("organizations.id", name=f"fk_{table}_organization"),
    )


# ─── Как таблицы выглядят ДО 0002 (для пересоздания в SQLite) ───
# Дословно из 0001: копия должна совпасть с существующей таблицей, иначе
# батч потеряет колонку или ограничение. Констрейнт/unique, который мы
# снимаем, здесь НЕ указан — пересозданная таблица рождается без него.


def _clients_before(metadata: sa.MetaData) -> sa.Table:
    return sa.Table(
        "clients",
        metadata,
        sa.Column("id", UUID, primary_key=True),
        sa.Column("external_id", ExternalId(), nullable=False),
        sa.Column("channel", sa.Text(), nullable=False),
        sa.Column("name", sa.Text()),
        sa.Column("phone", sa.Text()),
        sa.Column("email", sa.Text()),
        sa.Column("created_at", TZ, nullable=False),
        # uq_clients_channel_external_id снят: дальше частичные индексы.
        sa.Index("idx_clients_phone", "phone", sqlite_where=sa.text("phone IS NOT NULL")),
    )


def _conversations_before(metadata: sa.MetaData) -> sa.Table:
    return sa.Table(
        "conversations",
        metadata,
        sa.Column("id", UUID, primary_key=True),
        sa.Column("client_id", UUID, sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("mode", enum_column(ConversationMode, "conversation_mode"), nullable=False),
        sa.Column("funnel_stage", enum_column(FunnelStage, "funnel_stage"), nullable=False),
        sa.Column("lead_data", JSONType, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", TZ, nullable=False),
        sa.Column("last_activity_at", TZ, nullable=False),
        sa.Index("idx_conv_active", "is_active", sa.text("last_activity_at DESC")),
        sa.Index("idx_conv_mode", "mode", sqlite_where=sa.text("mode <> 'bot_active'")),
    )


def _documents_before(metadata: sa.MetaData) -> sa.Table:
    return sa.Table(
        "documents",
        metadata,
        sa.Column("id", UUID, primary_key=True),
        sa.Column("source", sa.Text(), nullable=False),
        # unique=True снят: дальше частичные индексы по организации.
        sa.Column("file_hash", sa.Text(), nullable=False),
        sa.Column("chunk_count", sa.Integer(), nullable=False),
        sa.Column("created_at", TZ, nullable=False),
    )


def upgrade() -> None:
    postgres = _is_postgres()

    op.create_table(
        "organizations",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("public_key", sa.Text(), nullable=False, unique=True),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("hosts", JSONType, nullable=False),
        sa.Column("system_prompt", sa.Text()),
        sa.Column("created_at", TZ, nullable=False),
        sa.Column("updated_at", TZ, nullable=False),
    )

    if postgres:
        op.drop_constraint("uq_clients_channel_external_id", "clients", type_="unique")
        # Имя авто: колонка file_hash была объявлена unique=True без имени.
        op.drop_constraint("documents_file_hash_key", "documents", type_="unique")
        for table in ORG_TABLES:
            op.add_column(table, _org_column(table))
    else:
        metadata = sa.MetaData()
        with op.batch_alter_table("clients", copy_from=_clients_before(metadata)) as batch:
            batch.add_column(_org_column("clients"))
        with op.batch_alter_table(
            "conversations", copy_from=_conversations_before(metadata)
        ) as batch:
            batch.add_column(_org_column("conversations"))
        with op.batch_alter_table("documents", copy_from=_documents_before(metadata)) as batch:
            batch.add_column(_org_column("documents"))

    _partial_unique(
        "uq_clients_org_channel_external",
        "clients",
        ["organization_id", "channel", "external_id"],
        "organization_id IS NOT NULL",
    )
    _partial_unique(
        "uq_clients_channel_external_null",
        "clients",
        ["channel", "external_id"],
        "organization_id IS NULL",
    )
    _partial_unique(
        "uq_documents_org_hash",
        "documents",
        ["organization_id", "file_hash"],
        "organization_id IS NOT NULL",
    )
    _partial_unique(
        "uq_documents_hash_null",
        "documents",
        ["file_hash"],
        "organization_id IS NULL",
    )
    # Отбор панели и сверки: строки одной организации без полного прохода.
    for table in ORG_TABLES:
        op.create_index(
            f"idx_{table}_org",
            table,
            ["organization_id"],
            postgresql_where=sa.text("organization_id IS NOT NULL"),
            sqlite_where=sa.text("organization_id IS NOT NULL"),
        )

    if postgres:
        # RLS: строка видна своей организации; строки без организации —
        # только запросу без app.org_id (см. заголовок файла про честность).
        for table in ORG_TABLES:
            op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
            op.execute(
                f"""
                CREATE POLICY org_isolation_{table} ON {table}
                USING (
                    organization_id IS NOT DISTINCT FROM
                    NULLIF(current_setting('app.org_id', true), '')::uuid
                )
                """
            )


def downgrade() -> None:
    postgres = _is_postgres()
    if postgres:
        for table in ORG_TABLES:
            op.execute(f"DROP POLICY IF EXISTS org_isolation_{table} ON {table}")
            op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    for table in ORG_TABLES:
        op.drop_index(f"idx_{table}_org", table_name=table)
    op.drop_index("uq_documents_hash_null", table_name="documents")
    op.drop_index("uq_documents_org_hash", table_name="documents")
    op.drop_index("uq_clients_channel_external_null", table_name="clients")
    op.drop_index("uq_clients_org_channel_external", table_name="clients")

    if postgres:
        for table in ORG_TABLES:
            op.drop_column(table, "organization_id")
        op.create_unique_constraint(
            "uq_clients_channel_external_id", "clients", ["channel", "external_id"]
        )
        # Восстанавливаем под авто-именем, которое даёт unique=True в 0001:
        # иначе повторный upgrade не найдёт, что снимать.
        op.create_unique_constraint("documents_file_hash_key", "documents", ["file_hash"])
    else:
        metadata = sa.MetaData()
        clients_now = _clients_before(metadata)
        clients_now.append_column(_org_column("clients"))
        with op.batch_alter_table("clients", copy_from=clients_now) as batch:
            batch.drop_column("organization_id")
            batch.create_unique_constraint(
                "uq_clients_channel_external_id", ["channel", "external_id"]
            )
        conversations_now = _conversations_before(metadata)
        conversations_now.append_column(_org_column("conversations"))
        with op.batch_alter_table("conversations", copy_from=conversations_now) as batch:
            batch.drop_column("organization_id")
        documents_now = _documents_before(metadata)
        documents_now.append_column(_org_column("documents"))
        with op.batch_alter_table("documents", copy_from=documents_now) as batch:
            batch.drop_column("organization_id")
            batch.create_unique_constraint("documents_file_hash_key", ["file_hash"])

    op.drop_table("organizations")
