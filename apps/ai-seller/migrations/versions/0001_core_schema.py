"""Схема ядра: всё из shema-bd.sql.

Revision ID: 0001
Revises:
Create Date: 2026-09-22

Postgres: расширения vector и pg_trgm, перечисления как типы, VECTOR(384),
JSONB, частичные индексы, GIN и hnsw. SQLite: JSON вместо JSONB и VECTOR,
частичные индексы через sqlite_where, без GIN/hnsw/FTS.

🔴 Ни у одной временной колонки нет DEFAULT now(): метки ставит приложение
(server_default = время начала транзакции, метки схлопываются).
"""

from __future__ import annotations

import enum
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from src.db.base import (
    ConversationMode,
    DeliveryStatus,
    ExternalId,
    FunnelStage,
    JSONType,
    MessageRole,
    OutboxKind,
    VectorType,
    enum_column,
)

revision: str = "0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

EMBEDDING_DIM = 384
UUID = sa.Uuid(as_uuid=True)
TZ = sa.DateTime(timezone=True)

# Имя типа в базе → перечисление. Порядок не важен, каждый тип у одной таблицы.
ENUMS: dict[str, type[enum.Enum]] = {
    "conversation_mode": ConversationMode,
    "funnel_stage": FunnelStage,
    "message_role": MessageRole,
    "delivery_status_enum": DeliveryStatus,
    "outbox_kind_enum": OutboxKind,
}

TABLES_IN_ORDER = (
    "clients",
    "consents",
    "dashboard_users",
    "conversations",
    "messages",
    "owner_actions",
    "documents",
    "knowledge_chunks",
    "outbox",
)


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def _enum(name: str) -> sa.types.TypeEngine:
    """Тип-перечисление для колонки.

    В Postgres типы создаются явно в upgrade(), поэтому create_type=False:
    иначе create_table попытается создать их второй раз. В SQLite —
    обычный VARCHAR через enum_column из base.py.
    """
    enum_cls = ENUMS[name]
    if _is_postgres():
        return postgresql.ENUM(*[m.value for m in enum_cls], name=name, create_type=False)
    return enum_column(enum_cls, name)


def _partial_index(name: str, table: str, columns: list, where: str, unique: bool = False) -> None:
    op.create_index(
        name,
        table,
        columns,
        unique=unique,
        postgresql_where=sa.text(where),
        sqlite_where=sa.text(where),
    )


def upgrade() -> None:
    postgres = _is_postgres()
    if postgres:
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
        op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
        bind = op.get_bind()
        for name, enum_cls in ENUMS.items():
            postgresql.ENUM(*[m.value for m in enum_cls], name=name).create(bind, checkfirst=True)

    # ─── Клиенты ───
    op.create_table(
        "clients",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("external_id", ExternalId(), nullable=False),
        sa.Column("channel", sa.Text(), nullable=False),
        sa.Column("name", sa.Text()),
        sa.Column("phone", sa.Text()),
        sa.Column("email", sa.Text()),
        sa.Column("created_at", TZ, nullable=False),
        sa.UniqueConstraint("channel", "external_id", name="uq_clients_channel_external_id"),
    )
    _partial_index("idx_clients_phone", "clients", ["phone"], "phone IS NOT NULL")

    # ─── Согласия ───
    op.create_table(
        "consents",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("client_id", UUID, sa.ForeignKey("clients.id"), nullable=False),
        sa.Column("policy_version", sa.Text(), nullable=False),
        sa.Column("policy_url", sa.Text(), nullable=False),
        sa.Column("method", sa.Text(), nullable=False),
        sa.Column("shown_text", sa.Text(), nullable=False),
        sa.Column("granted_at", TZ, nullable=False),
        sa.Column("revoked_at", TZ),
    )
    _partial_index("idx_consents_active", "consents", ["client_id"], "revoked_at IS NULL", unique=True)

    # ─── Панель ───
    op.create_table(
        "dashboard_users",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("email", sa.Text(), nullable=False, unique=True),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("totp_secret", sa.Text()),
        sa.Column("totp_confirmed_at", TZ),
        sa.Column("totp_last_step", sa.BigInteger()),
        sa.Column("backup_codes", JSONType, nullable=False),
        sa.Column("failed_logins", sa.Integer(), nullable=False),
        sa.Column("blocked_until", TZ),
        sa.Column("last_login_at", TZ),
        sa.Column("created_at", TZ, nullable=False),
    )

    # ─── Диалоги ───
    op.create_table(
        "conversations",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("client_id", UUID, sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("mode", _enum("conversation_mode"), nullable=False),
        sa.Column("funnel_stage", _enum("funnel_stage"), nullable=False),
        sa.Column("lead_data", JSONType, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", TZ, nullable=False),
        sa.Column("last_activity_at", TZ, nullable=False),
    )
    op.create_index(
        "idx_conv_active", "conversations", ["is_active", sa.text("last_activity_at DESC")]
    )
    _partial_index("idx_conv_mode", "conversations", ["mode"], "mode <> 'bot_active'")

    # ─── Сообщения ───
    op.create_table(
        "messages",
        sa.Column("id", UUID, primary_key=True),
        sa.Column(
            "conversation_id", UUID, sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("role", _enum("message_role"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("sent_by_us", sa.Boolean(), nullable=False),
        sa.Column("audio_url", sa.Text()),
        sa.Column("tokens_used", sa.Integer()),
        sa.Column("created_at", TZ, nullable=False),
    )
    op.create_index("idx_msg_conv", "messages", ["conversation_id", "created_at"])

    # ─── Действия оператора ───
    op.create_table(
        "owner_actions",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("conversation_id", UUID, sa.ForeignKey("conversations.id", ondelete="CASCADE")),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("payload", JSONType),
        sa.Column("created_at", TZ, nullable=False),
    )

    # ─── База знаний ───
    op.create_table(
        "documents",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("file_hash", sa.Text(), nullable=False, unique=True),
        sa.Column("chunk_count", sa.Integer(), nullable=False),
        sa.Column("created_at", TZ, nullable=False),
    )
    op.create_table(
        "knowledge_chunks",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("document_id", UUID, sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding", VectorType(EMBEDDING_DIM)),
        sa.Column("meta", JSONType),
        sa.Column("created_at", TZ, nullable=False),
    )

    # ─── Outbox ───
    op.create_table(
        "outbox",
        sa.Column(
            "id", sa.BigInteger().with_variant(sa.Integer(), "sqlite"), primary_key=True, autoincrement=True
        ),
        sa.Column("kind", _enum("outbox_kind_enum"), nullable=False),
        sa.Column("transport", sa.Text(), nullable=False),
        sa.Column("recipient", sa.Text(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("dedup_key", sa.Text()),
        sa.Column("status", _enum("delivery_status_enum"), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("last_error", sa.Text()),
        sa.Column("last_attempt_at", TZ),
        sa.Column("sent_at", TZ),
        sa.Column("expires_at", TZ, nullable=False),
        sa.Column("created_at", TZ, nullable=False),
    )
    _partial_index("idx_outbox_pending", "outbox", ["status", "expires_at"], "status = 'pending'")
    _partial_index("idx_outbox_dedup", "outbox", ["dedup_key", "created_at"], "dedup_key IS NOT NULL")

    # ─── Индексы только для Postgres: SQLite не знает GIN, hnsw и to_tsvector ───
    if postgres:
        op.execute("CREATE INDEX idx_conv_lead ON conversations USING GIN (lead_data)")
        op.execute("CREATE INDEX idx_chunks_vec ON knowledge_chunks USING hnsw (embedding vector_cosine_ops)")
        op.execute("CREATE INDEX idx_chunks_fts ON knowledge_chunks USING GIN (to_tsvector('russian', content))")


def downgrade() -> None:
    # Индексы уходят вместе с таблицами; порядок обратный из-за внешних ключей.
    for table in reversed(TABLES_IN_ORDER):
        op.drop_table(table)
    if _is_postgres():
        bind = op.get_bind()
        for name in ENUMS:
            postgresql.ENUM(name=name).drop(bind, checkfirst=True)
        # Расширения не трогаем: ими могут пользоваться другие схемы.
