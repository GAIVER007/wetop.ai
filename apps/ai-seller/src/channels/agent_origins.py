"""Домены, с которых открывается виджет агента: вычисляются платформой во время запроса (SA2.5, Q-SA-17).

Allowlist, не копия в агенте, а функция от агента: `Agent → Location → сайты филиала → домены`. Считает платформа
(`GET /bot/agent-origins?agent=`), бот только спрашивает и кэширует ответ на минуты: правка сайтов на платформе доходит до
виджета быстро, а каждый запрос браузера не превращается в вызов платформы.

🔴 Что решает ответ:
  · платформа ответила списком, он и есть allowlist; пустой список, виджет на внешнем сайте не открывается
    (у филиала нет разрешённого домена; черновик агента при этом создаётся);
  · платформа ответила 404, агент ей неизвестен: закрыто;
  · платформа недоступна, кэша нет, прежние `agents.hosts` (то, что платформа уже присылала раньше: не хуже, чем было до
    SA2.5); у новых агентов там пусто, закрыто. Уже полученный ответ переживает сбой платформы сутки (устаревший кэш);
  · платформа не подключена (нет адреса или ключа: разработка, тесты), те же `agents.hosts`.
Идентификатор агента в запросе, недоверенный селектор для платформы: она сама выводит организацию и филиал из строки агента.
"""

from __future__ import annotations

import json
import logging
import uuid

import httpx

from src import dependencies
from src.config import Settings
from src.db.models import Agent

logger = logging.getLogger(__name__)

PATH = "/bot/agent-origins"
KEY_HEADER = "x-wetop-service-key"
FRESH_SECONDS = 60
UNKNOWN_SECONDS = 30
STALE_SECONDS = 24 * 3600


def _fresh(agent_id: uuid.UUID) -> str:
    return f"agent-origins:{agent_id}"


def _stale(agent_id: uuid.UUID) -> str:
    return f"agent-origins-stale:{agent_id}"


def _mirror(agent: Agent) -> list[str]:
    return [str(h) for h in (agent.hosts or [])]


async def origins_for_agent(settings: Settings, agent: Agent) -> list[str]:
    """Разрешённые домены виджета агента (список может быть пустым, тогда дверь закрыта)."""
    base = settings.integration_base_url.rstrip("/")
    key = settings.integration_api_key
    if not base or not key:
        return _mirror(agent)

    redis = dependencies.get_redis()
    try:
        cached = await redis.get(_fresh(agent.id))
    except Exception:  # noqa: BLE001, сбой кэша не должен закрывать виджет
        cached = None
    if cached is not None:
        return list(json.loads(cached))

    try:
        response = await dependencies.get_http_client().get(
            f"{base}{PATH}",
            params={"agent": str(agent.id)},
            headers={KEY_HEADER: key},
            timeout=settings.integration_timeout_seconds,
        )
    except Exception as exc:  # noqa: BLE001, текст исключения несёт адрес
        logger.warning("agent-origins: платформа недоступна (%s)", type(exc).__name__)
        return await _when_unreachable(agent)

    if response.status_code == 404:
        await _remember(agent.id, [], UNKNOWN_SECONDS, keep_stale=False)
        return []
    if response.status_code >= 500:
        logger.warning("agent-origins: платформа ответила %s", response.status_code)
        return await _when_unreachable(agent)
    if response.status_code >= 400:
        # ключ, запрос: расхождение настроек, а не «домены пусты», закрыто и слышно в журнале
        logger.error("agent-origins: платформа отказала %s (ключ или запрос)", response.status_code)
        return []
    try:
        hosts = [str(h) for h in (response.json().get("hosts") or []) if str(h).strip()]
    except Exception:  # noqa: BLE001, форма ответа не наша
        logger.warning("agent-origins: тело ответа не разобрано")
        return await _when_unreachable(agent)
    await _remember(agent.id, hosts, FRESH_SECONDS, keep_stale=True)
    return hosts


async def _remember(agent_id: uuid.UUID, hosts: list[str], seconds: int, *, keep_stale: bool) -> None:
    try:
        redis = dependencies.get_redis()
        blob = json.dumps(hosts)
        await redis.set(_fresh(agent_id), blob, ex=seconds)
        if keep_stale:
            await redis.set(_stale(agent_id), blob, ex=STALE_SECONDS)
        else:
            await redis.delete(_stale(agent_id))
    except Exception:  # noqa: BLE001, кэш вторичен
        logger.warning("agent-origins: кэш недоступен", exc_info=True)


async def _when_unreachable(agent: Agent) -> list[str]:
    """Платформа не ответила: устаревший ответ, иначе прежние `agents.hosts` (у новых агентов там пусто)."""
    try:
        stale = await dependencies.get_redis().get(_stale(agent.id))
    except Exception:  # noqa: BLE001
        stale = None
    if stale is not None:
        return list(json.loads(stale))
    return _mirror(agent)
