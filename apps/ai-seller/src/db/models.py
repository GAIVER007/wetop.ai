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


class Agent(Base):
    """Личность продавца (DATA_MODEL §20, SA1.6): продавец одного филиала гостиницы.

    Сегодня продавец один на организацию: `id` перенесённого агента равен `organization_id`, поэтому ключ
    виджета и адрес вебхука Meta не меняются. Строка организации остаётся источником, эта — её зеркало на время
    перехода (слушатель в конце модуля обновляет её вместе с организацией). Новые агенты получают свой UUID —
    их заведёт срез SA2.
    """

    __tablename__ = "agents"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID, sa.ForeignKey("organizations.id", ondelete="CASCADE", name="fk_agents_organization"), nullable=False
    )
    # Справочно: филиал агента в PMS. Источник правды — платформа (`seller_agents.location_id`)
    location_id: Mapped[uuid.UUID | None] = mapped_column(UUID)
    name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    public_key: Mapped[str] = mapped_column(sa.Text, nullable=False, unique=True)
    hosts: Mapped[list[Any]] = mapped_column(JSONType, nullable=False, default=list)
    system_prompt: Mapped[str | None] = mapped_column(sa.Text)
    active: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TZ, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(TZ, nullable=False)


def _agent_id_column(table: str) -> Mapped[uuid.UUID | None]:
    """Агент строки (DATA_MODEL §20.5). Значения по умолчанию нет: каждая дверь и каждый писатель называют агента сами.

    До SA2.5 агент подставлялся из организации строки (`agent_id = organization_id`), и это скрывало ошибку «писатель
    забыл агента». Теперь забытый агент — `NULL`, а не молчаливое «агент равен организации»: тесты и (после сужения)
    CHECK базы такую строку не пропускают. Строки помощника (без организации) агента не имеют.
    """
    return mapped_column(UUID, sa.ForeignKey("agents.id", name=f"fk_{table}_agent"))


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

    # Подключение принадлежит АГЕНТУ (DATA_MODEL §20.5, SA2.5): ключ — `agent_id`, секреты WhatsApp — на подключении канала
    # агента. Организация — граница арендатора (и внешний ключ), но не ключ подключения. На рабочей базе первичный ключ по
    # организации снимает миграция сужения 0010: до неё у организации одно подключение, и оно принадлежит одному агенту
    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID, sa.ForeignKey("agents.id", name="fk_whatsapp_connections_agent"), primary_key=True
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID,
        sa.ForeignKey(
            "organizations.id",
            ondelete="CASCADE",
            name="fk_whatsapp_connections_organization",
        ),
        nullable=False,
    )
    phone_number_id: Mapped[str] = mapped_column(sa.Text, nullable=False, unique=True)
    token_encrypted: Mapped[bytes] = mapped_column(sa.LargeBinary, nullable=False)
    app_secret_encrypted: Mapped[bytes] = mapped_column(sa.LargeBinary, nullable=False)
    verify_token: Mapped[str] = mapped_column(sa.Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(TZ, nullable=False)


class Client(Base):
    __tablename__ = "clients"
    __table_args__ = (
        # Строка организации имеет агента (миграция сужения 0010): забытый писателем агент — не молчаливый NULL
        sa.CheckConstraint("organization_id IS NULL OR agent_id IS NOT NULL", name="ck_clients_org_has_agent"),
        # Агент — граница диалога (DATA_MODEL §20.5, SA2.5): один гость у двух агентов, даже одной организации, — два
        # клиента. Прежняя уникальность по организации (`uq_clients_org_channel_external`) из модели снята: на рабочей
        # базе её убирает миграция сужения 0010 после доказанного рантайма, пока агент в организации один — они совпадают
        sa.Index(
            "uq_clients_agent_channel_external",
            "agent_id",
            "channel",
            "external_id",
            unique=True,
            postgresql_where=sa.text("agent_id IS NOT NULL"),
            sqlite_where=sa.text("agent_id IS NOT NULL"),
        ),
        # Строки без организации (помощник, старые диалоги продавца) — своя уникальность:
        # NULL в обычном уникальном индексе различен, дубли прошли бы молча.
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
    agent_id: Mapped[uuid.UUID | None] = _agent_id_column("clients")
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
        sa.CheckConstraint("organization_id IS NULL OR agent_id IS NOT NULL", name="ck_conversations_org_has_agent"),
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
    agent_id: Mapped[uuid.UUID | None] = _agent_id_column("conversations")
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
        sa.CheckConstraint("organization_id IS NULL OR agent_id IS NOT NULL", name="ck_documents_org_has_agent"),
        # Дедуп по хешу — в пределах АГЕНТА (SA2.5): один и тот же прайс у двух агентов, даже одной организации, —
        # две записи, а не молчаливый пропуск второй (Э4). Прежняя уникальность по организации
        # (`uq_documents_org_hash`) из модели снята: на рабочей базе её убирает миграция сужения 0010
        sa.Index(
            "uq_documents_agent_hash",
            "agent_id",
            "file_hash",
            unique=True,
            postgresql_where=sa.text("agent_id IS NOT NULL"),
            sqlite_where=sa.text("agent_id IS NOT NULL"),
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
    agent_id: Mapped[uuid.UUID | None] = _agent_id_column("documents")
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


ACTION_STATUSES = ("PROPOSED", "CONFIRMED", "DONE", "FAILED", "CANCELLED", "EXPIRED", "REFUSED", "ESCALATED")


class SupportAction(Base):
    """Журнал действий WETOP Support (S6): предложил, подтвердил, выполнил, отказал, передал человеку.
    `result` — короткая строка без ПД; `args` — только белый список; `user_ref` — псевдоним, не id."""

    __tablename__ = "support_actions"
    __table_args__ = (sa.Index("idx_support_actions_conv", "conversation_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=new_uuid)
    conversation_id: Mapped[str | None] = mapped_column(sa.String(64))
    user_ref: Mapped[str] = mapped_column(sa.String(32), nullable=False)
    action: Mapped[str] = mapped_column(sa.String(40), nullable=False)
    action_class: Mapped[str] = mapped_column(sa.String(16), nullable=False)
    args: Mapped[dict | None] = mapped_column(sa.JSON())
    status: Mapped[str] = mapped_column(sa.String(16), nullable=False)
    result: Mapped[str | None] = mapped_column(sa.String(300))
    created_at: Mapped[datetime] = mapped_column(TZ, nullable=False)
    executed_at: Mapped[datetime | None] = mapped_column(TZ)


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


# ─── Зеркало организации в агенте (SA1.6) ───


def _mirror_agent(_mapper: Any, connection: sa.Connection, org: Organization) -> None:
    """Строка `agents` с `id = organizations.id` следует за организацией при любой записи — одной транзакцией.

    Слушатель, а не вызов в каждом обработчике: писателей организации несколько (PUT платформы, профиль, инструкция),
    и новый не должен забыть про агента. Сверка нужна, пока читают ещё организацию; когда читателем станет агент,
    источником станет он (SA2).
    """
    values = {
        "organization_id": org.id,
        "name": org.name,
        "public_key": org.public_key,
        "hosts": list(org.hosts or []),
        "system_prompt": org.system_prompt,
        "active": bool(org.active),
        "updated_at": org.updated_at,
    }
    agents = Agent.__table__
    updated = connection.execute(sa.update(agents).where(agents.c.id == org.id).values(**values))
    if updated.rowcount == 0:
        connection.execute(sa.insert(agents).values(id=org.id, created_at=org.created_at, **values))


sa.event.listen(Organization, "after_insert", _mirror_agent)
sa.event.listen(Organization, "after_update", _mirror_agent)


class TelegramConnection(Base):
    """One test Telegram bot per agent. Credentials never appear in read DTOs."""
    __tablename__ = 'telegram_connections'
    __table_args__ = (sa.CheckConstraint("connection_state IN ('CONFIGURED','CONNECTING','CONNECTED','ERROR')", name='ck_telegram_connection_state'),)
    agent_id: Mapped[uuid.UUID] = mapped_column(UUID, sa.ForeignKey('agents.id'), primary_key=True)
    bot_id: Mapped[str] = mapped_column(sa.Text, unique=True, nullable=False)
    bot_username: Mapped[str] = mapped_column(sa.Text, nullable=False)
    token_encrypted: Mapped[bytes] = mapped_column(sa.LargeBinary, nullable=False)
    webhook_secret_encrypted: Mapped[bytes] = mapped_column(sa.LargeBinary, nullable=False)
    allowed_user_ids: Mapped[list] = mapped_column(JSONType, nullable=False)
    enabled: Mapped[bool] = mapped_column(sa.Boolean, nullable=False)
    connection_state: Mapped[str] = mapped_column(sa.Text, nullable=False)
    last_error_code: Mapped[str | None] = mapped_column(sa.Text)
    last_received_at: Mapped[datetime | None] = mapped_column(TZ)
    last_sent_at: Mapped[datetime | None] = mapped_column(TZ)
    updated_at: Mapped[datetime] = mapped_column(TZ, nullable=False)


class TelegramInboundEvent(Base):
    __tablename__ = 'telegram_inbound_events'
    __table_args__ = (
        sa.UniqueConstraint('agent_id', 'update_id', name='uq_telegram_agent_update'),
        sa.CheckConstraint("state IN ('RECEIVED','PROCESSING','DONE','FAILED')", name='ck_telegram_event_state'),
        sa.Index('idx_telegram_event_retry', 'state', 'next_retry_at'),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=new_uuid)
    agent_id: Mapped[uuid.UUID] = mapped_column(UUID, sa.ForeignKey('agents.id'), nullable=False)
    update_id: Mapped[str] = mapped_column(sa.Text, nullable=False)
    received_at: Mapped[datetime] = mapped_column(TZ, nullable=False)
    state: Mapped[str] = mapped_column(sa.Text, nullable=False)
    attempts: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    next_retry_at: Mapped[datetime | None] = mapped_column(TZ)
    error_code: Mapped[str | None] = mapped_column(sa.Text)
    payload_encrypted: Mapped[bytes] = mapped_column(sa.LargeBinary, nullable=False)
