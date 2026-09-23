"""Шаг 6: повтор доставки outbox зарегистрирован в monitor и переживает
отсутствие токена и недоступную базу — фоновая задача не роняет процесс.
"""

from __future__ import annotations

import pytest

from src import monitoring
from src.channels.telegram import TelegramClient
from src.config import get_settings
from src.dependencies import close_resources, get_http_client, get_sessionmaker, reset_resources
from src.jobs import outbox_redeliver


def test_default_jobs_contains_outbox_redeliver() -> None:
    jobs = monitoring.default_jobs()
    assert outbox_redeliver.run_once in jobs
    assert all(callable(job) for job in jobs)


def test_tick_is_still_sixty_seconds() -> None:
    """Кит: повтор раз в 60 с. Имена шага 1 остаются на месте."""
    assert monitoring.TICK_SECONDS == 60
    assert callable(monitoring.tick)
    assert callable(monitoring.run)
    assert callable(monitoring.main)


def test_build_transports_without_token_has_no_client_channel() -> None:
    """Без токена канала клиенту доставлять нечем.

    Шаг 8 добавил в тот же словарь два транспорта алертов: они есть всегда,
    потому что ненастроенный вернёт код отказа, а отсутствие ключа означало
    бы, что алерт владельцу не доставит никто.
    """
    settings = get_settings()
    assert settings.channel_telegram_bot_token == ""
    assert "telegram" not in outbox_redeliver.build_transports(settings, None)


def test_build_transports_with_token_has_telegram(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CHANNEL_TELEGRAM_BOT_TOKEN", "test-token")
    get_settings.cache_clear()
    transports = outbox_redeliver.build_transports(get_settings(), get_http_client())
    assert "telegram" in transports
    assert isinstance(transports["telegram"], TelegramClient)


async def test_run_once_without_token_does_not_fail(migrated_db, fake_redis) -> None:
    from datetime import timedelta

    from src.db.base import DeliveryStatus, OutboxKind, utcnow
    from src.db.models import OutboxItem

    try:
        sessionmaker = get_sessionmaker()
        async with sessionmaker() as session:
            now = utcnow()
            item = OutboxItem(
                kind=OutboxKind.REPLY,
                transport="telegram",
                recipient="1001",
                body="ответ",
                dedup_key="reply:-:abc",
                status=DeliveryStatus.PENDING,
                attempts=0,
                created_at=now,
                expires_at=now + timedelta(hours=24),
            )
            session.add(item)
            await session.commit()
            item_id = item.id

        await outbox_redeliver.run_once()

        async with sessionmaker() as session:
            row = await session.get_one(OutboxItem, item_id)
        # Транспорта нет — строка ждёт, а не теряется и не падает.
        assert row.status is DeliveryStatus.PENDING
        assert row.attempts == 0
    finally:
        await close_resources()


async def test_run_once_survives_broken_database(monkeypatch: pytest.MonkeyPatch, fake_redis) -> None:
    """Исключений наружу нет: monitor.tick и так ловит, но задача обязана
    держать удар сама, чтобы в журнале был понятный отчёт, а не трассировка."""
    monkeypatch.setenv("DATABASE_URL", "sqlite+aiosqlite:////nonexistent-dir-for-test/x.sqlite3")
    get_settings.cache_clear()
    reset_resources()
    try:
        await outbox_redeliver.run_once()
    finally:
        await close_resources()
