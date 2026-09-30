"""Миграция 0009 (SA2.5, «расширить»): добирает агентов и `agent_id`, ничего не сужает, обратима, и рантайм по `agent_id`
работает на схеме ПОСЛЕ неё (то есть до сужения 0010 — так выкладка и идёт).

🔴 Что доказывается:
  · агент организации без строки `agents` появляется; `agent_id` строк с организацией добирается; строки помощника
    (без организации) агента не получают;
  · прежние ключи по организации НА МЕСТЕ: сужение — отдельный релиз;
  · откат снимает только добавленные индексы, данные остаются;
  · перенесённый продавец на этой схеме отвечает так же: клиент, диалог, документ и подключение по агенту читаются и пишутся.
"""

from __future__ import annotations

import uuid

import pytest
import sqlalchemy as sa
from alembic import command

from tests.test_business_agents import ORG, _engine, _legacy_rows


def _indexes(engine: sa.Engine, table: str) -> dict[str, bool]:
    return {i["name"]: bool(i["unique"]) for i in sa.inspect(engine).get_indexes(table)}


def test_0009_fills_the_gaps_and_keeps_every_organization_key(alembic_config) -> None:
    command.upgrade(alembic_config, "0007")
    engine = _engine(alembic_config)
    _legacy_rows(engine)
    command.upgrade(alembic_config, "0008")
    now = "2026-09-29 10:00:00.000000"
    other = "bbbbbbbb2222422282228bbbbbbbbbbb"
    with engine.begin() as conn:
        # организация, заведённая после 0008 прежним кодом: агент у неё есть (слушатель), а `agent_id` строк — нет
        conn.execute(
            sa.text(
                "INSERT INTO organizations (id, name, public_key, active, hosts, system_prompt, created_at, updated_at) "
                "VALUES (:id, 'Позже', :key, 1, '[]', 'Ты продавец.', :now, :now)"
            ),
            {"id": other, "key": "sk_" + "cd" * 12, "now": now},
        )
        conn.execute(
            sa.text(
                "INSERT INTO clients (id, organization_id, external_id, channel, created_at) "
                "VALUES (:id, :org, 'guest-2', 'widget', :now)"
            ),
            {"id": uuid.uuid4().hex, "org": other, "now": now},
        )

    command.upgrade(alembic_config, "0009")

    with engine.connect() as conn:
        agents = {uuid.UUID(r.id) for r in conn.execute(sa.text("SELECT id FROM agents"))}
        assert agents == {uuid.UUID(ORG), uuid.UUID(other)}, "агент у каждой организации"
        rows = conn.execute(sa.text("SELECT organization_id, agent_id FROM clients WHERE organization_id IS NOT NULL")).all()
        assert rows and all(uuid.UUID(r.agent_id) == uuid.UUID(r.organization_id) for r in rows), "agent_id добран"
        support = conn.execute(sa.text("SELECT agent_id FROM clients WHERE organization_id IS NULL")).all()
        assert [r.agent_id for r in support] == [None]

    clients = _indexes(engine, "clients")
    assert clients["uq_clients_org_channel_external"] is True, "прежняя уникальность по организации на месте (сужение — 0010)"
    assert clients["uq_clients_agent_channel_external"] is True
    assert _indexes(engine, "documents")["uq_documents_org_hash"] is True
    assert _indexes(engine, "documents")["uq_documents_agent_hash"] is True
    assert _indexes(engine, "whatsapp_connections")["uq_whatsapp_connections_agent"] is True
    pk = sa.inspect(engine).get_pk_constraint("whatsapp_connections")["constrained_columns"]
    assert pk == ["organization_id"], "первичный ключ подключения по организации на месте (сужение — 0010)"


def test_0009_is_reversible_without_touching_the_data(alembic_config) -> None:
    command.upgrade(alembic_config, "0007")
    engine = _engine(alembic_config)
    _legacy_rows(engine)
    command.upgrade(alembic_config, "0009")

    command.downgrade(alembic_config, "0008")
    assert "uq_whatsapp_connections_agent" not in _indexes(engine, "whatsapp_connections")
    assert "uq_documents_agent_hash" not in _indexes(engine, "documents")
    with engine.connect() as conn:
        assert conn.execute(sa.text("SELECT count(*) FROM agents")).scalar() == 1
        assert conn.execute(sa.text("SELECT count(*) FROM clients WHERE agent_id IS NOT NULL")).scalar() == 1

    command.upgrade(alembic_config, "0009")
    assert _indexes(engine, "documents")["uq_documents_agent_hash"] is True


@pytest.mark.parametrize("_", [0])
def test_the_runtime_by_agent_works_on_the_expand_schema(alembic_config, _) -> None:
    """Схема 0009 — то, что стоит на рабочей базе, пока не выложено сужение: код, читающий по `agent_id`, обязан работать."""
    from sqlalchemy.orm import sessionmaker

    from src.db.base import utcnow
    from src.db.models import Client, Conversation, Document, WhatsAppConnection

    command.upgrade(alembic_config, "0007")
    engine = _engine(alembic_config)
    _legacy_rows(engine)
    command.upgrade(alembic_config, "0009")

    org = uuid.UUID(ORG)
    with sessionmaker(engine, expire_on_commit=False)() as session:
        client = Client(channel="widget", external_id="guest-new", organization_id=org, agent_id=org, created_at=utcnow())
        session.add(client)
        session.flush()
        session.add(Conversation(client_id=client.id, organization_id=org, agent_id=org, lead_data={},
                                 created_at=utcnow(), last_activity_at=utcnow()))
        session.add(Document(organization_id=org, agent_id=org, source="novyy.md", file_hash="h-new", chunk_count=0,
                             created_at=utcnow()))
        session.commit()
        # подключение читается по агенту (у перенесённого продавца — тот же идентификатор), а не по первичному ключу базы
        connection = session.get(WhatsAppConnection, org)
        assert connection is not None and connection.agent_id == org
        assert session.scalar(sa.select(sa.func.count()).select_from(Client).where(Client.agent_id == org)) == 2
