"""Шаг 1: внешний идентификатор хранится строкой, даже если пришёл числом.

Чужой API однажды отдаст тот же id в другом виде; приводим на границе,
а не там, где решили сравнить.
"""

from sqlalchemy import select

from src.db.base import utcnow
from src.db.models import Client
from src.dependencies import get_sessionmaker


async def test_numeric_external_id_is_stored_and_found_as_string(db_session) -> None:
    db_session.add(Client(channel="telegram", external_id=12345, created_at=utcnow()))
    await db_session.commit()

    async with get_sessionmaker()() as fresh:
        stmt = select(Client).where(Client.channel == "telegram", Client.external_id == "12345")
        found = (await fresh.execute(stmt)).scalar_one_or_none()

    assert found is not None, "поиск по строке '12345' не нашёл запись"
    assert isinstance(found.external_id, str)
    assert found.external_id == "12345"
