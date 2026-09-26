"""Окружение Alembic.

URL базы берётся по цепочке: -x url=... → sqlalchemy.url из alembic.ini →
get_settings().sqlalchemy_url. Драйвер асинхронный (asyncpg, aiosqlite) —
идём через async_engine и asyncio.run; синхронный (sqlite:///, postgresql://) —
обычный путь. Тесты гоняют миграции синхронным sqlite:/// в обычной фикстуре,
чтобы не вкладывать asyncio.run в цикл pytest-asyncio.
"""

from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

from alembic import context
from sqlalchemy import create_engine, pool
from sqlalchemy.engine import Connection, make_url
from sqlalchemy.ext.asyncio import create_async_engine

# Корень проекта в sys.path: prepend_sys_path из ini относителен к cwd,
# а тесты могут менять текущую директорию.
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.db.base import Base  # noqa: E402
import src.db.models  # noqa: E402,F401  (регистрирует таблицы в Base.metadata)

config = context.config
target_metadata = Base.metadata

# fileConfig(alembic.ini) здесь намеренно НЕ вызывается: он снимает
# обработчики с корневого логгера и глушит журнал приложения, когда
# миграции гоняются в том же процессе (тесты). Без обработчиков вовсе —
# минимальная настройка, чтобы CLI показывал ход миграции.
if not logging.getLogger().handlers:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s [%(name)s] %(message)s")


def _resolve_url() -> str:
    x_args = context.get_x_argument(as_dictionary=True)
    if x_args.get("url"):
        return x_args["url"]
    ini_url = config.get_main_option("sqlalchemy.url")
    if ini_url:
        return ini_url
    # Импорт здесь: настройки нужны только когда URL не передан явно.
    from src.config import get_settings

    return get_settings().sqlalchemy_url


def _is_async(url: str) -> bool:
    return bool(getattr(make_url(url).get_dialect(), "is_async", False))


def _run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        # SQLite не умеет ALTER: правки таблиц через пересоздание.
        render_as_batch=connection.dialect.name == "sqlite",
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_offline(url: str) -> None:
    """Режим --sql: без подключения, SQL в stdout."""
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        render_as_batch=make_url(url).get_dialect().name == "sqlite",
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_sync(url: str) -> None:
    engine = create_engine(url, poolclass=pool.NullPool)
    try:
        with engine.connect() as connection:
            _run_migrations(connection)
    finally:
        engine.dispose()


async def run_migrations_async(url: str) -> None:
    engine = create_async_engine(url, poolclass=pool.NullPool)
    try:
        async with engine.connect() as connection:
            await connection.run_sync(_run_migrations)
    finally:
        await engine.dispose()


def main() -> None:
    url = _resolve_url()
    if context.is_offline_mode():
        run_migrations_offline(url)
    elif _is_async(url):
        asyncio.run(run_migrations_async(url))
    else:
        run_migrations_sync(url)


main()
