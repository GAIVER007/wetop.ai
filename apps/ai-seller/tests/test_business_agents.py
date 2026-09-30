"""Business Agent в базе бота (DATA_MODEL §20, SA1.6): личность агента и перенос существующего продавца.

🔴 Существующий продавец каждой гостиницы становится агентом с `id = organization_id`: ключ виджета, адрес вебхука
Meta и `phone_number_id` не меняются, переписка, знания и подключение WhatsApp переходят к нему без потерь.
🔴 Строка `organizations` остаётся источником, `agents` — её зеркало на время перехода: любой писатель
(PUT организации, инструкция, профиль) обновляет обе строки.
🔴 Панельный вызов с `X-Agent` проверяет, что агент принадлежит организации запроса; без заголовка — агент
с `id`, равным организации, как до миграции.
"""

from __future__ import annotations

import uuid

import pytest
import sqlalchemy as sa
from alembic import command

from src.db.models import Agent, Client, Conversation, Document, Organization, WhatsAppConnection
from tests.dashboard_fakes import (  # noqa: F401 — sync_db используется как фикстура
    PANEL,
    _all,
    panel,
    seed_org,
    sync_db,
)
from tests.test_whatsapp import ORG, ORG_B, SERVICE, FERNET, KEY, _connect, app, net  # noqa: F401

ORG_HEADERS = {**SERVICE, "X-Organization": ORG}


# ─── Миграция 0008: перенос данных ───


def _legacy_rows(engine: sa.Engine) -> None:
    """Продавец до миграции: гостиница, клиент, диалог, документ и подключение WhatsApp."""
    now = "2026-09-29 10:00:00.000000"
    org = ORG.replace("-", "")
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "INSERT INTO organizations (id, name, public_key, active, hosts, system_prompt, created_at, updated_at) "
                "VALUES (:id, 'Стенд', :key, 1, '[\"stend.test\"]', 'Ты продавец.', :now, :now)"
            ),
            {"id": org, "key": "sk_" + "ab" * 12, "now": now},
        )
        conn.execute(
            sa.text(
                "INSERT INTO clients (id, organization_id, external_id, channel, created_at) "
                "VALUES (:id, :org, 'guest-1', 'whatsapp', :now)"
            ),
            {"id": uuid.uuid4().hex, "org": org, "now": now},
        )
        conn.execute(
            sa.text(
                "INSERT INTO documents (id, organization_id, source, file_hash, chunk_count, created_at) "
                "VALUES (:id, :org, 'prays.pdf', 'h1', 0, :now)"
            ),
            {"id": uuid.uuid4().hex, "org": org, "now": now},
        )
        conn.execute(
            sa.text(
                "INSERT INTO whatsapp_connections (organization_id, phone_number_id, token_encrypted, "
                "app_secret_encrypted, verify_token, updated_at) VALUES (:org, '555000111', x'01', x'02', 'word', :now)"
            ),
            {"org": org, "now": now},
        )
        # Строка помощника: без организации, агента у неё быть не должно
        conn.execute(
            sa.text(
                "INSERT INTO clients (id, organization_id, external_id, channel, created_at) "
                "VALUES (:id, NULL, 'support-1', 'widget', :now)"
            ),
            {"id": uuid.uuid4().hex, "now": now},
        )


def _engine(alembic_config) -> sa.Engine:
    return sa.create_engine(alembic_config.get_main_option("sqlalchemy.url"))


def test_migration_moves_the_existing_seller_into_an_agent_with_the_same_id(alembic_config) -> None:
    command.upgrade(alembic_config, "0007")
    engine = _engine(alembic_config)
    _legacy_rows(engine)

    command.upgrade(alembic_config, "0008")

    with engine.connect() as conn:
        agents = conn.execute(sa.text("SELECT id, organization_id, name, public_key, system_prompt, active FROM agents")).all()
        assert len(agents) == 1
        assert uuid.UUID(agents[0].id) == uuid.UUID(ORG) == uuid.UUID(agents[0].organization_id)
        assert agents[0].name == "Стенд" and agents[0].public_key == "sk_" + "ab" * 12
        assert agents[0].system_prompt == "Ты продавец." and agents[0].active == 1
        for table in ("clients", "documents", "whatsapp_connections"):
            rows = conn.execute(sa.text(f"SELECT organization_id, agent_id FROM {table} WHERE organization_id IS NOT NULL")).all()
            assert rows, table
            assert all(uuid.UUID(r.agent_id) == uuid.UUID(ORG) for r in rows), f"{table}: agent_id не равен организации"
        support = conn.execute(sa.text("SELECT agent_id FROM clients WHERE organization_id IS NULL")).all()
        assert [r.agent_id for r in support] == [None], "у строки помощника агента быть не должно"


def test_migration_is_reversible_and_repeatable_without_losing_history(alembic_config) -> None:
    command.upgrade(alembic_config, "0007")
    engine = _engine(alembic_config)
    _legacy_rows(engine)
    command.upgrade(alembic_config, "0008")

    command.downgrade(alembic_config, "0007")
    with engine.connect() as conn:
        tables = {r[0] for r in conn.execute(sa.text("SELECT name FROM sqlite_master WHERE type='table'"))}
        assert "agents" not in tables
        assert conn.execute(sa.text("SELECT count(*) FROM clients")).scalar() == 2
        assert conn.execute(sa.text("SELECT count(*) FROM documents")).scalar() == 1
        assert conn.execute(sa.text("SELECT count(*) FROM whatsapp_connections")).scalar() == 1
        assert "agent_id" not in {r[1] for r in conn.execute(sa.text("PRAGMA table_info(clients)"))}

    command.upgrade(alembic_config, "0008")
    with engine.connect() as conn:
        assert conn.execute(sa.text("SELECT count(*) FROM agents")).scalar() == 1
        assert conn.execute(sa.text("SELECT count(*) FROM clients WHERE agent_id IS NOT NULL")).scalar() == 1


# ─── Зеркало: agents следует за organizations ───


def test_organization_put_creates_and_updates_the_agent_row(monkeypatch, fake_redis, sync_db) -> None:  # noqa: F811
    with panel(monkeypatch, fake_redis, SELLER_SERVICE_KEY=KEY, BOT_ROLE="seller", LLM_KEYS_SECRET=FERNET) as p:
        body = {"name": "Гостиница А", "public_key": "sk_" + "cd" * 12, "active": True, "hosts": ["a.test"]}
        assert p.client.put(f"{PANEL}/seller/organizations/{ORG}", json=body, headers=SERVICE).status_code == 200

        rows = _all(sync_db, sa.select(Agent))
        assert [str(r.id) for r in rows] == [ORG] and str(rows[0].organization_id) == ORG
        assert rows[0].name == "Гостиница А" and rows[0].hosts == ["a.test"] and rows[0].active is True

        body.update(name="Гостиница А (новая)", active=False, hosts=["b.test"])
        assert p.client.put(f"{PANEL}/seller/organizations/{ORG}", json=body, headers=SERVICE).status_code == 200
        rows = _all(sync_db, sa.select(Agent))
        assert len(rows) == 1
        assert rows[0].name == "Гостиница А (новая)" and rows[0].active is False and rows[0].hosts == ["b.test"]


def test_prompt_of_the_organization_reaches_the_agent_row(app, sync_db) -> None:  # noqa: F811
    _connect(app)  # организация ORG заведена фикстурой app, подключение — этим вызовом
    with sync_db() as session:
        row = session.get(Organization, uuid.UUID(ORG))
        row.system_prompt = "Новая инструкция"
        session.commit()
    agent = _all(sync_db, sa.select(Agent).where(Agent.id == uuid.UUID(ORG)))[0]
    assert agent.system_prompt == "Новая инструкция"


# ─── Новые строки получают агента ───


def test_new_rows_get_the_agent_of_their_organization(app, sync_db) -> None:  # noqa: F811
    _connect(app)
    # Строки, созданные с организацией, получают агента без участия вызывающего кода
    from src.db.base import utcnow

    with sync_db() as session:
        session.add(Client(channel="widget", external_id="guest-3", organization_id=uuid.UUID(ORG), created_at=utcnow()))
        session.add(Document(organization_id=uuid.UUID(ORG), source="a.txt", file_hash="hh", chunk_count=0, created_at=utcnow()))
        session.commit()
    with sync_db() as session:
        assert session.execute(sa.select(Client.agent_id).where(Client.external_id == "guest-3")).scalar_one() == uuid.UUID(ORG)
        assert session.execute(sa.select(Document.agent_id).where(Document.source == "a.txt")).scalar_one() == uuid.UUID(ORG)
        connection = session.get(WhatsAppConnection, uuid.UUID(ORG))
        assert connection is not None and connection.agent_id == uuid.UUID(ORG)


def test_rows_without_an_organization_have_no_agent(app, sync_db) -> None:  # noqa: F811
    from src.db.base import utcnow

    with sync_db() as session:
        session.add(Client(channel="widget", external_id="support-9", created_at=utcnow()))
        session.commit()
    with sync_db() as session:
        assert session.execute(sa.select(Client.agent_id).where(Client.external_id == "support-9")).scalar_one() is None


# ─── Проверка «агент принадлежит организации» ───


def test_own_agent_header_is_accepted_and_absent_header_means_the_legacy_agent(app) -> None:  # noqa: F811
    absent = app.client.get(f"{PANEL}/conversations", headers=ORG_HEADERS)
    own = app.client.get(f"{PANEL}/conversations", headers={**ORG_HEADERS, "X-Agent": ORG})
    assert absent.status_code == 200, absent.text
    assert own.status_code == 200, own.text


def test_foreign_or_unknown_agent_is_refused(app) -> None:  # noqa: F811
    foreign = app.client.get(f"{PANEL}/conversations", headers={**ORG_HEADERS, "X-Agent": ORG_B})
    unknown = app.client.get(f"{PANEL}/conversations", headers={**ORG_HEADERS, "X-Agent": str(uuid.uuid4())})
    garbage = app.client.get(f"{PANEL}/conversations", headers={**ORG_HEADERS, "X-Agent": "not-a-uuid"})
    assert foreign.status_code == 403, foreign.text
    assert unknown.status_code == 403, unknown.text
    assert garbage.status_code in (400, 403), garbage.text
