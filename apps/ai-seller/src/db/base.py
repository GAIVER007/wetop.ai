"""Основание ORM: DeclarativeBase, перечисления и типы, совместимые с SQLite.

Бой — Postgres (asyncpg, pgvector, JSONB), тесты — SQLite (aiosqlite).
Поэтому каждый «постгресовый» тип здесь имеет запасной вариант для SQLite,
а модели и миграция берут типы отсюда, чтобы не разъехаться.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone
from typing import Any

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.types import TypeDecorator


class Base(DeclarativeBase):
    """Корень всех моделей. Base.metadata — источник правды для Alembic."""


def utcnow() -> datetime:
    """Текущее время, aware, UTC. Метки ставит приложение, не база (см. shema-bd.sql)."""
    return datetime.now(timezone.utc)


def new_uuid() -> uuid.UUID:
    """Первичный ключ генерирует Python, а не gen_random_uuid(): одинаково на обеих базах."""
    return uuid.uuid4()


# ─── Перечисления: значения дословно как в shema-bd.sql ───


class ConversationMode(str, enum.Enum):
    BOT_ACTIVE = "bot_active"
    NEEDS_HUMAN = "needs_human"
    OWNER_TAKEOVER = "owner_takeover"


class FunnelStage(str, enum.Enum):
    NEW = "new"
    QUALIFYING = "qualifying"
    PRESENTING = "presenting"
    OBJECTION = "objection"
    CLOSING = "closing"
    WON = "won"
    LOST = "lost"


class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    OPERATOR = "operator"


class DeliveryStatus(str, enum.Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    SKIPPED = "skipped"


class OutboxKind(str, enum.Enum):
    REPLY = "reply"
    ALERT = "alert"


def enum_column(enum_cls: type[enum.Enum], name: str) -> sa.Enum:
    """Колонка-перечисление: в Postgres — нативный тип с именем name, в SQLite — VARCHAR.

    values_callable: в базу уходят значения ('bot_active'), а не имена членов
    ('BOT_ACTIVE'), иначе строки в базе не совпадут с shema-bd.sql.
    """
    return sa.Enum(
        enum_cls,
        name=name,
        native_enum=True,
        values_callable=lambda e: [m.value for m in e],
    )


# ─── Типы ───

# JSONB в Postgres, обычный JSON в SQLite.
JSONType = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


class VectorType(TypeDecorator):
    """Вектор эмбеддинга: pgvector в Postgres, список чисел в JSON в SQLite.

    В SQLite поиска по вектору нет и не нужно — тесты проверяют логику,
    а не косинусное расстояние.
    """

    impl = sa.JSON
    cache_ok = True

    def __init__(self, dim: int) -> None:
        super().__init__()
        self.dim = dim

    def load_dialect_impl(self, dialect: sa.Dialect) -> sa.types.TypeEngine:
        if dialect.name == "postgresql":
            # Импорт здесь: тестам на SQLite pgvector не нужен.
            from pgvector.sqlalchemy import Vector

            return dialect.type_descriptor(Vector(self.dim))
        return dialect.type_descriptor(sa.JSON())

    def process_bind_param(self, value: Any, dialect: sa.Dialect) -> Any:
        if value is None:
            return None
        # numpy-массив в JSON не сериализуется; список — везде.
        return [float(x) for x in value]

    def process_result_value(self, value: Any, dialect: sa.Dialect) -> Any:
        return value


class ExternalId(TypeDecorator):
    """Идентификатор во внешней системе — всегда строка.

    Чужой API сегодня отдаёт число, завтра строку; приводим на границе
    (при записи), а не там, где решили сравнить. 12345 -> '12345'.
    """

    impl = sa.Text
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: sa.Dialect) -> str | None:
        if value is None:
            return None
        return str(value)

    def process_result_value(self, value: Any, dialect: sa.Dialect) -> str | None:
        return value
