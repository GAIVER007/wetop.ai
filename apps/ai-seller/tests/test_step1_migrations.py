"""Шаг 1: миграции накатываются и откатываются на чистой базе."""

from alembic import command
from sqlalchemy import create_engine, inspect

CORE_TABLES = {
    "organizations",
    "clients",
    "consents",
    "dashboard_users",
    "conversations",
    "messages",
    "owner_actions",
    "documents",
    "knowledge_chunks",
    "outbox",
}


def _table_names(url: str) -> set[str]:
    engine = create_engine(url)
    try:
        return set(inspect(engine).get_table_names())
    finally:
        engine.dispose()


def test_upgrade_head_creates_all_core_tables(migrated_db: str) -> None:
    present = _table_names(migrated_db)
    missing = CORE_TABLES - present
    assert not missing, f"после upgrade head нет таблиц: {sorted(missing)}"


def test_downgrade_base_removes_all_core_tables(migrated_db: str, alembic_config) -> None:
    assert CORE_TABLES <= _table_names(migrated_db)
    command.downgrade(alembic_config, "base")
    leftover = CORE_TABLES & _table_names(migrated_db)
    assert not leftover, f"после downgrade base остались таблицы: {sorted(leftover)}"
