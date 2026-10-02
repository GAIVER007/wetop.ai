"""Миграция 0010 (SA2.5, «сузить»): ключи по агенту вместо ключей по организации; обратима, пока данные это допускают.

🔴 Что доказывается:
  · до 0010 два агента одной организации не могут делить гостя, документ и подключение (прежние ключи стоят);
  · после 0010, могут; подключение принадлежит агенту (первичный ключ), а строка организации без агента не пишется (CHECK);
  · миграция останавливается, если есть строка организации без агента, ничего не меняя;
  · откат возвращает прежние ключи, если данные их выдерживают, и отказывает, если у организации несколько агентов делят гостя
    или подключение, молча склеивать чужое нельзя; история переписки при откате цела.
"""

from __future__ import annotations

import uuid

import pytest
import sqlalchemy as sa
from alembic import command
from sqlalchemy.exc import IntegrityError

from tests.test_business_agents import ORG, _engine, _legacy_rows

AGENT_2 = "cccccccc-3333-4333-8333-cccccccccccc"


def _pk(engine: sa.Engine) -> list[str]:
    return sa.inspect(engine).get_pk_constraint("whatsapp_connections")["constrained_columns"]


def _second_agent(engine: sa.Engine) -> None:
    now = "2026-09-29 10:00:00.000000"
    org = ORG.replace("-", "")
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "INSERT INTO agents (id, organization_id, name, public_key, hosts, system_prompt, active, created_at, updated_at) "
                "VALUES (:id, :org, 'Второй', :key, '[]', 'Ты второй.', 1, :now, :now)"
            ),
            {"id": AGENT_2.replace("-", ""), "org": org, "key": "sk_" + "c3" * 12, "now": now},
        )


def _client(engine: sa.Engine, agent: str | None, external_id: str = "guest-shared") -> None:
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "INSERT INTO clients (id, organization_id, agent_id, external_id, channel, created_at) "
                "VALUES (:id, :org, :agent, :ext, 'widget', '2026-09-29 10:00:00.000000')"
            ),
            {"id": uuid.uuid4().hex, "org": ORG.replace("-", ""), "agent": agent.replace("-", "") if agent else None, "ext": external_id},
        )


def test_before_0010_the_organization_keys_still_hold(alembic_config) -> None:
    command.upgrade(alembic_config, "0007")
    engine = _engine(alembic_config)
    _legacy_rows(engine)
    command.upgrade(alembic_config, "0009")
    _second_agent(engine)
    _client(engine, ORG)
    with pytest.raises(IntegrityError):
        _client(engine, AGENT_2)  # тот же гость у второго агента той же организации


def test_0010_lets_two_agents_share_a_guest_and_pins_the_key_to_the_agent(alembic_config) -> None:
    command.upgrade(alembic_config, "0007")
    engine = _engine(alembic_config)
    _legacy_rows(engine)
    command.upgrade(alembic_config, "0009")
    _second_agent(engine)
    _client(engine, ORG)

    command.upgrade(alembic_config, "0010")

    _client(engine, AGENT_2)  # теперь можно
    with engine.connect() as conn:
        assert conn.execute(sa.text("SELECT count(*) FROM clients WHERE external_id = 'guest-shared'")).scalar() == 2
        assert conn.execute(sa.text("SELECT count(*) FROM whatsapp_connections")).scalar() == 1, "подключение цело"
    assert _pk(engine) == ["agent_id"]
    with pytest.raises(IntegrityError):
        _client(engine, None, external_id="guest-orphan")  # организация без агента, CHECK
    # строка помощника (без организации) агента не имеет и проходит
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "INSERT INTO clients (id, external_id, channel, created_at) VALUES (:id, 'support-2', 'widget', '2026-09-29 10:00:00.000000')"
            ),
            {"id": uuid.uuid4().hex},
        )


def test_0010_stops_when_a_row_has_no_agent(alembic_config) -> None:
    command.upgrade(alembic_config, "0007")
    engine = _engine(alembic_config)
    _legacy_rows(engine)
    command.upgrade(alembic_config, "0009")
    _client(engine, None, external_id="guest-orphan")  # писатель забыл агента
    with pytest.raises(RuntimeError, match="без агента"):
        command.upgrade(alembic_config, "0010")
    assert _pk(engine) == ["organization_id"], "ничего не изменилось"


def test_0010_downgrade_restores_the_keys_when_the_data_allows(alembic_config) -> None:
    command.upgrade(alembic_config, "0007")
    engine = _engine(alembic_config)
    _legacy_rows(engine)
    command.upgrade(alembic_config, "0010")
    command.downgrade(alembic_config, "0009")
    assert _pk(engine) == ["organization_id"]
    with engine.connect() as conn:
        assert conn.execute(sa.text("SELECT count(*) FROM clients")).scalar() == 2, "история цела"
    indexes = {i["name"] for i in sa.inspect(engine).get_indexes("clients")}
    assert "uq_clients_org_channel_external" in indexes
    command.upgrade(alembic_config, "0010")
    assert _pk(engine) == ["agent_id"]


def test_0010_downgrade_refuses_when_agents_share_a_guest(alembic_config) -> None:
    command.upgrade(alembic_config, "0007")
    engine = _engine(alembic_config)
    _legacy_rows(engine)
    command.upgrade(alembic_config, "0010")
    _second_agent(engine)
    _client(engine, ORG)
    _client(engine, AGENT_2)
    with pytest.raises(RuntimeError, match="делят прежний ключ"):
        command.downgrade(alembic_config, "0009")
    assert _pk(engine) == ["agent_id"], "отказ без изменений"
