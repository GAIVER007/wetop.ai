"""Область агента (SA2.5, DATA_MODEL §20): рантайм продавца находит продавца по АГЕНТУ, а не по организации.

Организация остаётся границей арендатора (права, расширение, лимиты, ключ модели), но ни одна дверь, ни один
писатель и ни один читатель данных продавца не выводит «агент = организация». У перенесённого продавца эти
идентификаторы РАВНЫ (`agents.id = organization_id`, §20.4) — поэтому ключ виджета, адрес вебхука и все прежние данные
не меняются — но равенство ничего не решает: агент называется явно — из ключа в теге, из адреса вебхука, из `X-Agent` панели.

🔴 Идентификатор агента из запроса — недоверенный селектор: по нему находится строка, а организацию, филиал и права
берут из строки и из подписи платформы, не из слов запроса. Чужой, несуществующий и не-UUID — один и тот же отказ.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

import sqlalchemy as sa

from src.db.models import Agent


@dataclass(frozen=True)
class AgentScope:
    """Кому принадлежат строки хода: агент и организация, которой он принадлежит."""

    agent_id: uuid.UUID
    organization_id: uuid.UUID


class AgentError(Exception):
    """Агента нельзя назвать однозначно."""


class UnknownAgent(AgentError):
    """Такого агента нет в этой организации: чужой, несуществующий — не различаем."""


class NoAgent(AgentError):
    """У организации нет ни одного агента: продавец для неё ещё не заведён."""


class AmbiguousAgent(AgentError):
    """У организации несколько агентов, а запрос не назвал, какой нужен."""


async def resolve_agent(session, organization_id: uuid.UUID, requested: uuid.UUID | None) -> AgentScope:
    """Агент вызова панели: названный явно — только если принадлежит организации; не названный — единственный
    агент организации. При двух и более без имени — отказ, а не «самый ранний»: угадывать, чьи данные отдать, нельзя."""
    if requested is not None:
        owner = await session.scalar(sa.select(Agent.organization_id).where(Agent.id == requested))
        if owner != organization_id:
            raise UnknownAgent
        return AgentScope(requested, organization_id)
    ids = list(
        (await session.execute(sa.select(Agent.id).where(Agent.organization_id == organization_id).limit(2))).scalars()
    )
    if not ids:
        raise NoAgent
    if len(ids) > 1:
        raise AmbiguousAgent
    return AgentScope(ids[0], organization_id)


async def scope_of_agent(session, agent_id: uuid.UUID) -> AgentScope | None:
    """Область по идентификатору агента из двери канала (адрес вебхука): организацию даёт строка агента."""
    organization_id = await session.scalar(sa.select(Agent.organization_id).where(Agent.id == agent_id))
    return AgentScope(agent_id, organization_id) if organization_id is not None else None
