"""Шаг 1: sqlite в тестах проверяет внешние ключи, как Postgres в бою.

Без PRAGMA foreign_keys сироты проходят молча, и тесты на каскады
будущих шагов были бы зелёными по ложной причине.
"""

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from src.db.base import MessageRole, new_uuid, utcnow
from src.db.models import Message


async def test_sqlite_enforces_foreign_keys(db_session) -> None:
    result = await db_session.execute(text("PRAGMA foreign_keys"))
    assert result.scalar() == 1

    orphan = Message(
        conversation_id=new_uuid(),
        role=MessageRole("user"),
        content="сирота",
        created_at=utcnow(),
    )
    db_session.add(orphan)
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()
