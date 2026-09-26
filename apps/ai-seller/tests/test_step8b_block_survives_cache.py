"""Блокировка входа переживает потерю кэша.

Счётчик попыток живёт в Redis — это быстро и правильно. Но сама блокировка
уже пишется в базу полем blocked_until, и не читать её значит согласиться,
что перезапуск или очистка кэша снимают блок молча: перебор продолжается
с чистого листа, а в журнале об этом ни строки.
"""

from datetime import timedelta

import pytest
import sqlalchemy as sa

from src.config import get_settings
from src.db.base import utcnow
from src.db.models import DashboardUser
from src.dashboard import security
from src.dependencies import get_sessionmaker
from tests.dashboard_fakes import (  # noqa: F401 — sync_db используется как фикстура
    OWNER_EMAIL,
    OWNER_PASSWORD,
    PANEL,
    get_user,
    make_user,
    panel,
    sync_db,
)

EMAIL = "owner@example.com"
IP = "203.0.113.7"


async def _make_user(hashed: str = "x") -> None:
    async with get_sessionmaker()() as session:
        session.add(
            DashboardUser(
                email=EMAIL,
                password_hash=hashed,
                role="owner",
                created_at=utcnow(),
            )
        )
        await session.commit()


async def _blocked_until(email: str):
    async with get_sessionmaker()() as session:
        row = await session.execute(
            sa.select(DashboardUser.blocked_until).where(DashboardUser.email == email)
        )
        return row.scalar_one_or_none()


async def test_block_is_written_to_the_database(migrated_db, fake_redis) -> None:
    await _make_user()
    settings = get_settings()
    for _ in range(settings.dashboard_login_max_attempts):
        await security.register_failure(
            fake_redis, get_sessionmaker(), settings, email=EMAIL, ip=IP
        )
    assert await _blocked_until(EMAIL) is not None, "блокировка обязана быть в базе"


async def test_block_survives_a_cache_wipe(migrated_db, fake_redis) -> None:
    await _make_user()
    settings = get_settings()
    for _ in range(settings.dashboard_login_max_attempts):
        await security.register_failure(
            fake_redis, get_sessionmaker(), settings, email=EMAIL, ip=IP
        )
    assert await security.is_blocked(fake_redis, email=EMAIL, ip=IP), "блок должен стоять"

    await fake_redis.flushall()  # перезапуск кэша или его очистка

    assert await security.is_blocked(
        fake_redis, email=EMAIL, ip=IP, sessionmaker=get_sessionmaker()
    ), "потеря кэша не должна снимать блокировку: она записана в базу"


async def test_expired_block_in_the_database_does_not_lock_forever(
    migrated_db, fake_redis
) -> None:
    await _make_user()
    async with get_sessionmaker()() as session:
        user = (
            await session.execute(sa.select(DashboardUser).where(DashboardUser.email == EMAIL))
        ).scalar_one()
        user.blocked_until = utcnow() - timedelta(minutes=1)
        await session.commit()

    assert not await security.is_blocked(
        fake_redis, email=EMAIL, ip=IP, sessionmaker=get_sessionmaker()
    ), "истёкшая блокировка в базе не должна держать человека вечно"


def test_login_form_respects_the_database_block(monkeypatch, fake_redis, sync_db) -> None:
    """Долговечный рубеж обязан стоять на живом пути, а не только в функции."""
    make_user(sync_db, email=OWNER_EMAIL, password=OWNER_PASSWORD)
    with sync_db() as session:
        user = get_user(sync_db, OWNER_EMAIL)
        row = session.get(DashboardUser, user.id)
        row.blocked_until = utcnow() + timedelta(minutes=10)
        session.commit()

    with panel(monkeypatch, fake_redis) as p:
        answer = p.client.post(
            f"{PANEL}/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD}
        )
    assert answer.status_code == 429, "верный пароль не должен открывать заблокированную учётку"
