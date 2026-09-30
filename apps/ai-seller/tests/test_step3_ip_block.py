"""Шаг 3: блок-лист адресов (слой 0) — отбой на уровне фреймворка, до маршрутов.
Адрес клиента у TestClient — 'testclient'."""

import asyncio

from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.db.ip_block import IpBlockMiddleware, block_ip, is_ip_blocked, unblock_ip

TESTCLIENT_IP = "testclient"


async def test_block_and_unblock(fake_redis) -> None:
    assert await is_ip_blocked(fake_redis, "203.0.113.5") is False
    await block_ip(fake_redis, "203.0.113.5", ttl_seconds=60)
    assert await is_ip_blocked(fake_redis, "203.0.113.5") is True
    assert await fake_redis.ttl("ipblock:203.0.113.5") > 0
    await unblock_ip(fake_redis, "203.0.113.5")
    assert await is_ip_blocked(fake_redis, "203.0.113.5") is False


def _app(fake_redis, prefixes: tuple[str, ...]) -> FastAPI:
    app = FastAPI()
    app.add_middleware(IpBlockMiddleware, protected_prefixes=prefixes, redis_getter=lambda: fake_redis)

    @app.get("/webhooks/x")
    async def webhook() -> dict:
        return {"ok": True}

    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok"}

    return app


# Тесты с TestClient синхронные: клиент крутит свой цикл в отдельном потоке,
# а блок ставим заранее через asyncio.run — как это сделал бы движок.
def test_blocked_ip_gets_403_on_protected_path_only(fake_redis) -> None:
    asyncio.run(block_ip(fake_redis, TESTCLIENT_IP, ttl_seconds=60))
    with TestClient(_app(fake_redis, ("/webhooks", "/widget"))) as client:
        response = client.get("/webhooks/x")
        assert response.status_code == 403
        assert response.json() == {"status": "forbidden"}
        assert client.get("/health").status_code == 200


def test_unblocked_ip_passes(fake_redis) -> None:
    with TestClient(_app(fake_redis, ("/webhooks",))) as client:
        assert client.get("/webhooks/x").status_code == 200


def test_empty_prefixes_protect_nothing(fake_redis) -> None:
    asyncio.run(block_ip(fake_redis, TESTCLIENT_IP, ttl_seconds=60))
    with TestClient(_app(fake_redis, ())) as client:
        assert client.get("/webhooks/x").status_code == 200


def test_real_app_protects_the_widget_but_not_health(fake_redis, client) -> None:
    asyncio.run(block_ip(fake_redis, TESTCLIENT_IP, ttl_seconds=60))
    # Маршрута ещё нет, но middleware стоит до маршрутизации: 403, а не 404.
    assert client.get("/widget/chat").status_code == 403
    assert client.post("/widget/message").status_code == 403
    assert client.get("/health").status_code == 200
    assert client.get("/internal/health", headers={"x-internal-key": "test-key"}).status_code == 200


# ─── Аудит 30.09.2026: блок ставится по CF-Connecting-IP, а middleware смотрела на сокет ───


def test_block_by_cf_connecting_ip_behind_the_tunnel(fake_redis) -> None:
    """🔴 Движок блокирует адрес посетителя (client_ip — CF-Connecting-IP от своих),
    а middleware сравнивала сокет: за cloudflared сокет у всех один, и блок не
    срабатывал никогда. Красный на коде до правки: 200 вместо 403."""
    asyncio.run(block_ip(fake_redis, "203.0.113.7", ttl_seconds=60))
    # Сокет — частная сеть compose, как у контейнера туннеля
    with TestClient(_app(fake_redis, ("/webhooks",)), client=("10.0.0.5", 51000)) as client:
        blocked = client.get("/webhooks/x", headers={"CF-Connecting-IP": "203.0.113.7"})
        assert blocked.status_code == 403, blocked.text
        other = client.get("/webhooks/x", headers={"CF-Connecting-IP": "203.0.113.8"})
        assert other.status_code == 200


def test_cf_connecting_ip_from_outside_is_not_trusted(fake_redis) -> None:
    """Снаружи (сокет — публичный адрес) заголовком чужой блок не выбрать и свой не снять.
    Адрес настоящий публичный: документационные 198.51.100.0/24 и 203.0.113.0/24 ipaddress
    считает частными, и они прошли бы за «своих»."""
    asyncio.run(block_ip(fake_redis, "93.184.216.34", ttl_seconds=60))
    with TestClient(_app(fake_redis, ("/webhooks",)), client=("93.184.216.34", 51000)) as client:
        assert client.get("/webhooks/x", headers={"CF-Connecting-IP": "203.0.113.1"}).status_code == 403
