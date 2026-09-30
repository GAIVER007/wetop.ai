"""Запрос поиска по знаниям на Postgres считает расстояние по чанкам знаний, а не по документам (S3).

Тесты идут на SQLite и ветку pgvector не проходят, поэтому здесь запрос только собирается и компилируется под PostgreSQL:
чужая таблица в FROM даёт декартово произведение и оценки по чужим векторам.
"""

from __future__ import annotations

from sqlalchemy.dialects import postgresql

from src.knowledge import support_kb as kb


def test_the_pg_statement_touches_only_the_support_tables() -> None:
    sql = str(kb.pg_search_statement([0.1, 0.2], ["PUBLIC_SUPPORT"], top_k=3).compile(dialect=postgresql.dialect()))
    assert "support_knowledge_chunks" in sql
    assert "FROM knowledge_chunks" not in sql
    assert ", knowledge_chunks" not in sql
    assert "knowledge_chunks.embedding" not in sql.replace("support_knowledge_chunks.embedding", "")
