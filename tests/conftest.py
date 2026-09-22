"""Общие фикстуры шага 1.

Весь набор гоняется без поднятых сервисов: база — sqlite в tmp_path,
Redis — fakeredis. Настройки читаются только через переменные окружения,
которые ставит фикстура settings_env; боевой .env из корня не подхватывается,
потому что рабочая директория на время теста переезжает в tmp_path.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config

from src.config import get_settings
from src.dependencies import close_resources, reset_resources

# Корень проекта нужен абсолютным: cwd на время теста — tmp_path.
ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture(autouse=True)
def settings_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    """Окружение теста: sqlite-файл в tmp_path, ключ подробной проверки, тихий журнал.

    Возвращает путь к файлу базы: его же используют миграции (синхронный URL)
    и приложение (asyncio URL).
    """
    db_file = tmp_path / "test.sqlite3"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("INTERNAL_HEALTH_KEY", "test-key")
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("LOG_LEVEL", "warning")
    # Журнал (папка logs/) и поиск .env идут от cwd — уводим их в tmp_path.
    monkeypatch.chdir(tmp_path)

    get_settings.cache_clear()
    reset_resources()
    yield db_file
    get_settings.cache_clear()
    reset_resources()
    # Обработчики приложения висят на root-логгере процесса и указывали бы
    # на logs/ ПЕРВОГО теста; снимаем, чтобы следующий тест настроил свои.
    root = logging.getLogger()
    for handler in [h for h in root.handlers if h.get_name() in ("app_stdout", "app_file")]:
        root.removeHandler(handler)
        handler.close()


@pytest.fixture
def alembic_config(settings_env: Path) -> Config:
    """Конфиг Alembic, привязанный к sqlite-файлу теста.

    URL синхронный (sqlite:///), чтобы миграции шли обычным путём и не
    вкладывали asyncio.run в цикл pytest-asyncio.
    """
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "migrations"))
    cfg.set_main_option("sqlalchemy.url", f"sqlite:///{settings_env}")
    return cfg


@pytest.fixture
def migrated_db(alembic_config: Config) -> str:
    """Накатывает alembic upgrade head на sqlite теста. Возвращает синхронный URL."""
    command.upgrade(alembic_config, "head")
    return alembic_config.get_main_option("sqlalchemy.url")


@pytest.fixture
async def db_session(migrated_db: str) -> AsyncIterator:
    """Сессия SQLAlchemy поверх мигрированной базы; в конце закрывает ресурсы."""
    from sqlalchemy import event

    from src.dependencies import get_engine, get_sessionmaker

    engine = get_engine()
    if engine.dialect.name == "sqlite":
        # sqlite по умолчанию не проверяет внешние ключи: сироты и каскады
        # прошли бы молча, и тесты были бы зелёными по ложной причине.
        def _enable_fk(dbapi_connection, _record) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        event.listen(engine.sync_engine, "connect", _enable_fk)

    session = get_sessionmaker()()
    try:
        yield session
    finally:
        await session.close()
        # Закрываем в том же цикле, где движок создавался: иначе aiosqlite
        # оставит висящий поток соединения.
        await close_resources()


@pytest.fixture
def fake_redis(monkeypatch: pytest.MonkeyPatch):
    """Подменяет get_redis на fakeredis — и в dependencies, и в main, если он
    импортировал имя напрямую (иначе подмена его не достанет)."""
    import fakeredis.aioredis

    import src.dependencies
    import src.main

    fake = fakeredis.aioredis.FakeRedis()
    monkeypatch.setattr(src.dependencies, "get_redis", lambda: fake)
    monkeypatch.setattr(src.main, "get_redis", lambda: fake, raising=False)
    return fake


@pytest.fixture
def client() -> Iterator:
    """Тестовый клиент приложения. Контекстный менеджер нужен, чтобы отработал
    lifespan: журнал настроился, ресурсы закрылись на выходе."""
    from fastapi.testclient import TestClient

    from src.main import create_app

    with TestClient(create_app(), raise_server_exceptions=False) as c:
        yield c
