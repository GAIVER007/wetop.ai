"""Схема ПОСЛЕ сужения (миграция 0010) для тестов рантайма второго агента (SA2.5).

Рантайм SA2.5 написан под конечную схему: клиент и документ уникальны в пределах АГЕНТА, подключение WhatsApp принадлежит агенту
(первичный ключ, `agent_id`). На рабочей базе прежние ключи по организации снимает миграция сужения 0010 отдельным релизом,
только после доказанного рантайма (plans/…sa25 §10 п. 5). Пока она не выложена, у организации ОДИН агент, и прежних ключей
достаточно: этим занимаются все остальные наборы бота, идущие на схеме шага «расширить» (0009).

Здесь, то, что нужно тестам с ДВУМЯ агентами в одной организации: тот же результат, что даёт 0010, для SQLite. Сама миграция
0010 и её равенство этому хелперу проверяются в ветке сужения.
"""

from __future__ import annotations

import sqlalchemy as sa

from src.db.models import WhatsAppConnection


def apply_contract(url: str) -> None:
    engine = sa.create_engine(url)
    try:
        with engine.begin() as conn:
            conn.execute(sa.text("DROP INDEX IF EXISTS uq_clients_org_channel_external"))
            conn.execute(sa.text("DROP INDEX IF EXISTS uq_documents_org_hash"))
        WhatsAppConnection.__table__.drop(engine)
        WhatsAppConnection.__table__.create(engine)
    finally:
        engine.dispose()
