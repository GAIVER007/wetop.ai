"""ORM-модели ядра — ровно таблицы shema-bd.sql, имена таблиц и колонок дословно.

🔴 Ни у одной временной колонки нет server_default: время ставит приложение.
Где SQL даёт DEFAULT now() (dashboard_users.created_at, outbox.created_at) —
Python default=utcnow; где SQL требует NOT NULL без умолчания — метку явно
ставит вызывающий код. Причина: server_default = время начала транзакции,
метки схлопываются, расчёт «за сколько ответили» врёт.

Индексы только для Postgres (GIN по lead_data, hnsw по embedding, GIN
to_tsvector по content) здесь НЕ объявлены — они живут в миграции
0001_core_schema под условием диалекта, потому что SQLite их не знает.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.base import (
    Base,
    ConversationMode,
    DeliveryStatus,
    ExternalId,
    FunnelStage,
    JSONType,
    MessageRole,
    OutboxKind,
    VectorType,
    enum_column,
    new_uuid,
    utcnow,
)

EMBEDDING_DIM = 384  # multilingual-e5-small; меняете модель — меняете число и переиндексируете всё

UUID = sa.Uuid(as_uuid=True)
TZ = sa.DateTime(timezone=True)


# ─── Организации (Э4, ADR-083): один продавец обслуживает много гостиниц ───

# Публичный ключ гостиницы в теге чата: sk_ + hex. Считает его платформа
# (HMAC от служебного ключа), продавец только сверяет строку.
ORG_KEY_RE_TEXT = r"^sk_[0-9a-f]{16,64}$"


class Organization(Base):
    """Гостиница у продавца — так, как её завела платформа (PUT
    /seller/organizations/{id}). id — идентификатор организации платформы.

    🔴 У экземпляра-помощника (BOT_ROLE=support) таблица пуста: его строки
    живут с organization_id IS NULL, и поведение помощника не меняется.
    """

    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True)
    name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    public_key: Mapped[str] = mapped_column(sa.Text, nullable=False, unique=True)
    active: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, default=True)
    # Домены сайтов гостиницы («Настройки сайта» платформы): дверь виджета
    # открывается только с них.
    hosts: Mapped[list[Any]] = mapped_column(JSONType, nullable=False, default=list)
    # Промпт продавца этой гостиницы: ядро правил + профиль из «Настроек».
    system_prompt: Mapped[str | None] = mapped_column(sa.Text)
    created_at: Mapped[datetime] = mapped_column(TZ, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(TZ, nullable=False)


# ─── Клиенты ───


class OrganizationLlmKey(Base):
    """API-ключ модели самого партнёра (С2 «под ключ», Q-186): расход — на нём.

    Хранится только у бота и только шифрованным (Fernet, секрет
    `LLM_KEYS_SECRET`); платформа ключ ставит и проверяет, обратно не читает —
    наружу уходят лишь последние 4 знака. Нет строки — ход идёт ключом
    платформы, как раньше.
    """

    __tablename__ = "organization_llm_keys"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID,
        sa.ForeignKey(
            "organizations.id",
            ondelete="CASCADE",
            name="fk_organization_llm_keys_organization",
        ),
        primary_key=True,
    )
    key_encrypted: Mapped[bytes] = mapped_column(sa.LargeBinary, nullable=False)
    last4: Mapped[str] = mapped_column(sa.Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(TZ, nullable=False)


class WhatsAppConnection(Base):
    """Подключение WhatsApp Cloud API гостиницы (С3 «под ключ», Q-185 (а)).

    Номер и приложение Meta — партнёра: бот хранит `phone_number_id`, токен
    и секрет приложения (шифрованными, секрет хранилища `LLM_KEYS_SECRET`)
    и проверочное слово вебхука, которое партнёр вписывает в консоль Meta.
    """

    __tablename__ = "whatsapp_connections"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID,
        sa.ForeignKey(
            "organizations.id",
            ondelete="CASCADE",
            name="fk_whatsapp_connections_organization",
        ),
        primary_key=True,
    )
    phone_number_id: Mapped[str] = mapped_column(sa.Text, nullable=False, unique=True)
    token_encrypted: Mapped[bytes] = mapped_column(sa.LargeBinary, nullable=False)
    app_secret_encrypted: Mapped[bytes] = mapped_column(sa.LargeBinary, nullable=False)
    verify_token: Mapped[str] = mapped_column(sa.Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(TZ, nullable=False)


class Client(Base):
    __tablename__ = "clients"
    __table_args__ = (
        # Уникальность внешнего id — в пределах организации (Э4). Строки без
        # организации (помощник, старые диалоги продавца) — своя уникальность:
        # NULL в обычном уникальном индексе различен, дубли прошли бы молча.
        sa.Index(
            "uq_clients_org_channel_external",
            "organization_id",
            "channel",
            "external_id",
            unique=True,
            postgresql_where=sa.text("organization_id IS NOT NULL"),
            sqlite_where=sa.text("organization_id IS NOT NULL"),
        ),
        sa.Index(
            "uq_clients_channel_external_null",
            "channel",
            "external_id",
            unique=True,
            postgresql_where=sa.text("organization_id IS NULL"),
            sqlite_where=sa.text("organization_id IS NULL"),
        ),
        sa.Index(
            "idx_clients_phone",
            "phone",
            postgresql_where=sa.text("phone IS NOT NULL"),
            sqlite_where=sa.text("phone IS NOT NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=new_uuid)
    # NULL — строка помощника или диалог продавца до Э4 (в панели не виден).
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID, sa.ForeignKey("organizations.id")
    )
    # Всегда строка, даже если канал прислал число: приводит тип ExternalId.
    external_id: Mapped[str] = mapped_column(ExternalId, nullable=False)
    channel: Mapped[str] = mapped_column(sa.Text, nullable=False)
    name: Mapped[str | None] = mapped_column(sa.Text)
    phone: Mapped[str | None] = mapped_column(sa.Text)
    email: Mapped[str | None] = mapped_column(sa.Text)
    created_at: Mapped[datetime] = mapped_column(TZ, nullable=False)

    conversations: Mapped[list["Conversation"]] = relationship(back_populates="client")


# ─── Согласие на обработку данных ───


class Consent(Base):
    __tablename__ = "consents"
    __table_args__ = (
        # Одно активное согласие на клиента: частичный уникальный индекс.
        sa.Index(
            "idx_consents_active",
            "client_id",
            unique=True,
            postgresql_where=sa.text("revoked_at IS NULL"),
            sqlite_where=sa.text("revoked_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=new_uuid)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID, sa.ForeignKey("clients.id"), nullable=False)
    policy_version: Mapped[str] = mapped_column(sa.Text, nullable=False)
    policy_url: Mapped[str] = mapped_column(sa.Text, nullable=False)
    method: Mapped[str] = mapped_column(sa.Text, nullable=False)
    shown_text: Mapped[str] = mapped_column(sa.Text, nullable=False)
    granted_at: Mapped[datetime] = mapped_column(TZ, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(TZ)


# ─── Люди, которые заходят в панель ───


class DashboardUser(Base):
    __tablename__ = "dashboard_users"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(sa.Text, nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(sa.Text, nullable=False)
    role: Mapped[str] = mapped_column(sa.Text, nullable=False)
    totp_secret: Mapped[str | None] = mapped_column(sa.Text)
    totp_confirmed_at: Mapped[datetime | None] = mapped_column(TZ)
    totp_last_step: Mapped[int | None] = mapped_column(sa.BigInteger)
    backup_codes: Mapped[list[Any]] = mapped_column(JSONType, nullable=False, default=list)
    failed_logins: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=0)
    blocked_until: Mapped[datetime | None] = mapped_column(TZ)
    last_login_at: Mapped[datetime | None] = mapped_column(TZ)
    created_at: Mapped[datetime] = mapped_column(TZ, nullable=False, default=utcnow)


# ─── Диалоги ───


class Conversation(Base):
    __tablename__ = "conversations"
    __table_args__ = (
        sa.Index(
            "idx_conv_mode",
            "mode",
            postgresql_where=sa.text("mode <> 'bot_active'"),
            sqlite_where=sa.text("mode <> 'bot_active'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=new_uuid)
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID, sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    # Дублирует организацию клиента намеренно: политика RLS и панель
    # отбирают диалоги без соединения с clients.
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID, sa.ForeignKey("organizations.id")
    )
    mode: Mapped[ConversationMode] = mapped_column(
        enum_column(ConversationMode, "conversation_mode"),
        nullable=False,
        default=ConversationMode.BOT_ACTIVE,
    )
    funnel_stage: Mapped[FunnelStage] = mapped_column(
        enum_column(FunnelStage, "funnel_stage"), nullable=False, default=FunnelStage.NEW
    )
    lead_data: Mapped[dict[str, Any]] = mapped_column(JSONType, nullable=False, default=dict)
    is_active: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TZ, nullable=False)
    last_activity_at: Mapped[datetime] = mapped_column(TZ, nullable=False)

    client: Mapped["Client"] = relationship(back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )


# Индекс с DESC объявлен здесь: в __table_args__ строкой направление не задать.
sa.Index("idx_conv_active", Conversation.is_active, Conversation.last_activity_at.desc())


# ─── Сообщения ───


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (sa.Index("idx_msg_conv", "conversation_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=new_uuid)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID, sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[MessageRole] = mapped_column(enum_column(MessageRole, "message_role"), nullable=False)
    content: Mapped[str] = mapped_column(sa.Text, nullable=False)
    sent_by_us: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, default=False)
    audio_url: Mapped[str | None] = mapped_column(sa.Text)
    tokens_used: Mapped[int | None] = mapped_column(sa.Integer)
    # Разбивка расхода ответа (Р2, миграция 0005): вход, из него кэш, выход —
    # цена у них разная. tokens_used остаётся суммой: на ней дневной предел.
    llm_model: Mapped[str | None] = mapped_column(sa.Text)
    tokens_input: Mapped[int | None] = mapped_column(sa.Integer)
    tokens_cached: Mapped[int | None] = mapped_column(sa.Integer)
    tokens_output: Mapped[int | None] = mapped_column(sa.Integer)
    created_at: Mapped[datetime] = mapped_column(TZ, nullable=False)

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")


# ─── Действия оператора ───


class OwnerAction(Base):
    __tablename__ = "owner_actions"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=new_uuid)
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID, sa.ForeignKey("conversations.id", ondelete="CASCADE")
    )
    action: Mapped[str] = mapped_column(sa.Text, nullable=False)
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSONType)
    created_at: Mapped[datetime] = mapped_column(TZ, nullable=False)


# ─── База знаний ───


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        # Дедуп по хешу — в пределах организации: один и тот же прайс у двух
        # гостиниц — две записи, а не молчаливый пропуск второй (Э4).
        sa.Index(
            "uq_documents_org_hash",
            "organization_id",
            "file_hash",
            unique=True,
            postgresql_where=sa.text("organization_id IS NOT NULL"),
            sqlite_where=sa.text("organization_id IS NOT NULL"),
        ),
        sa.Index(
            "uq_documents_hash_null",
            "file_hash",
            unique=True,
            postgresql_where=sa.text("organization_id IS NULL"),
            sqlite_where=sa.text("organization_id IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=new_uuid)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID, sa.ForeignKey("organizations.id")
    )
    source: Mapped[str] = mapped_column(sa.Text, nullable=False)
    file_hash: Mapped[str] = mapped_column(sa.Text, nullable=False)
    chunk_count: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(TZ, nullable=False)

    chunks: Mapped[list["KnowledgeChunk"]] = relationship(
        back_populates="document", cascade="all, delete-orphan", order_by="KnowledgeChunk.chunk_index"
    )


class KnowledgeChunk(Base):
    """Индексы idx_chunks_vec (hnsw) и idx_chunks_fts (GIN) — только в миграции, Postgres."""

    __tablename__ = "knowledge_chunks"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=new_uuid)
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID, sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    chunk_index: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    content: Mapped[str] = mapped_column(sa.Text, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(VectorType(EMBEDDING_DIM))
    # Колонка в базе — meta; атрибут — chunk_metadata: имя metadata занято DeclarativeBase.
    chunk_metadata: Mapped[dict[str, Any] | None] = mapped_column("meta", JSONType)
    created_at: Mapped[datetime] = mapped_column(TZ, nullable=False)

    document: Mapped["Document"] = relationship(back_populates="chunks")


# ─── База знаний WETOP Support (S3, plans/ai-agents-s3-knowledge-2026-09-29.md) ───

KB_CATEGORIES = (
    "PRODUCT", "HOW_TO", "TROUBLESHOOTING", "BILLING", "INTEGRATIONS", "SECURITY", "KNOWN_ISSUE", "RUNBOOK",
)
KB_VISIBILITIES = ("PUBLIC_SUPPORT", "INTERNAL_SUPPORT", "PLATFORM_ADMIN_ONLY")
KB_STATUSES = ("DRAFT", "ACTIVE", "OUTDATED", "ARCHIVED")


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


class SupportKnowledge(Base):
    """Запись управляемой базы знаний. Отвечает клиенту только ACTIVE; публикует главный администратор."""

    __tablename__ = "support_knowledge"
    __table_args__ = (
        sa.CheckConstraint(_in("category", KB_CATEGORIES), name="ck_support_knowledge_category"),
        sa.CheckConstraint(_in("visibility", KB_VISIBILITIES), name="ck_support_knowledge_visibility"),
        sa.CheckConstraint(_in("status", KB_STATUSES), name="ck_support_knowledge_status"),
        sa.Index("idx_support_knowledge_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=new_uuid)
    title: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    category: Mapped[str] = mapped_column(sa.String(20), nullable=False)
    visibility: Mapped[str] = mapped_column(sa.String(24), nullable=False)
    status: Mapped[str] = mapped_column(sa.String(12), nullable=False)
    version: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=1)
    source: Mapped[str] = mapped_column(sa.String(200), nullable=False, default="manual")
    content: Mapped[str] = mapped_column(sa.Text, nullable=False)
    approved_by: Mapped[str | None] = mapped_column(sa.String(200))
    approved_at: Mapped[datetime | None] = mapped_column(TZ)
    created_at: Mapped[datetime] = mapped_column(TZ, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(TZ, nullable=False)


class SupportKnowledgeVersion(Base):
    """Снимок записи при каждой смене версии: история для оператора и откат вручную."""

    __tablename__ = "support_knowledge_versions"
    __table_args__ = (sa.UniqueConstraint("knowledge_id", "version", name="uq_support_knowledge_version"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=new_uuid)
    knowledge_id: Mapped[uuid.UUID] = mapped_column(
        UUID, sa.ForeignKey("support_knowledge.id", ondelete="CASCADE"), nullable=False
    )
    version: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    title: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    category: Mapped[str] = mapped_column(sa.String(20), nullable=False)
    visibility: Mapped[str] = mapped_column(sa.String(24), nullable=False)
    content: Mapped[str] = mapped_column(sa.Text, nullable=False)
    saved_by: Mapped[str | None] = mapped_column(sa.String(200))
    saved_at: Mapped[datetime] = mapped_column(TZ, nullable=False)


class SupportKnowledgeChunk(Base):
    """Чанки и векторы АКТИВНОЙ версии записи. Индекс hnsw — в миграции, только Postgres."""

    __tablename__ = "support_knowledge_chunks"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=new_uuid)
    knowledge_id: Mapped[uuid.UUID] = mapped_column(
        UUID, sa.ForeignKey("support_knowledge.id", ondelete="CASCADE"), nullable=False
    )
    version: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    chunk_index: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    content: Mapped[str] = mapped_column(sa.Text, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(VectorType(EMBEDDING_DIM))
    created_at: Mapped[datetime] = mapped_column(TZ, nullable=False)


class SupportKnowledgeUsage(Base):
    """Какие знания легли в ответ: оператор видит это в кабинете, клиент — нет."""

    __tablename__ = "support_knowledge_usage"
    __table_args__ = (sa.Index("idx_support_kb_usage_conv", "conversation_id", "used_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=new_uuid)
    conversation_id: Mapped[str | None] = mapped_column(sa.String(64))
    knowledge_id: Mapped[uuid.UUID] = mapped_column(
        UUID, sa.ForeignKey("support_knowledge.id", ondelete="CASCADE"), nullable=False
    )
    version: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    visibility: Mapped[str] = mapped_column(sa.String(24), nullable=False)
    score: Mapped[float] = mapped_column(sa.Float, nullable=False)
    used_at: Mapped[datetime] = mapped_column(TZ, nullable=False)


# ─── Исходящие: outbox ───


class OutboxItem(Base):
    __tablename__ = "outbox"
    __table_args__ = (
        sa.Index(
            "idx_outbox_pending",
            "status",
            "expires_at",
            postgresql_where=sa.text("status = 'pending'"),
            sqlite_where=sa.text("status = 'pending'"),
        ),
        sa.Index(
            "idx_outbox_dedup",
            "dedup_key",
            "created_at",
            postgresql_where=sa.text("dedup_key IS NOT NULL"),
            sqlite_where=sa.text("dedup_key IS NOT NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(
        sa.BigInteger().with_variant(sa.Integer, "sqlite"), primary_key=True, autoincrement=True
    )
    kind: Mapped[OutboxKind] = mapped_column(enum_column(OutboxKind, "outbox_kind_enum"), nullable=False)
    transport: Mapped[str] = mapped_column(sa.Text, nullable=False)
    recipient: Mapped[str] = mapped_column(sa.Text, nullable=False)
    body: Mapped[str] = mapped_column(sa.Text, nullable=False)
    dedup_key: Mapped[str | None] = mapped_column(sa.Text)
    status: Mapped[DeliveryStatus] = mapped_column(
        enum_column(DeliveryStatus, "delivery_status_enum"),
        nullable=False,
        default=DeliveryStatus.PENDING,
    )
    attempts: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=0)
    last_error: Mapped[str | None] = mapped_column(sa.Text)
    last_attempt_at: Mapped[datetime | None] = mapped_column(TZ)
    sent_at: Mapped[datetime | None] = mapped_column(TZ)
    expires_at: Mapped[datetime] = mapped_column(TZ, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TZ, nullable=False, default=utcnow)
