"""Блок-лист адресов с TTL и отбой на уровне фреймворка (слой 0).

Заблокированный адрес не доходит до разбора вебхука: ответ 403 отдаёт
middleware до маршрутов. Ключи в Redis: ipblock:{ip}, истекают сами.
"""

import logging
from collections.abc import Callable

from redis.asyncio import Redis
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from src.channels.widget_guards import client_ip

logger = logging.getLogger(__name__)


def _key(ip: str) -> str:
    return f"ipblock:{ip}"


async def block_ip(redis: Redis, ip: str, ttl_seconds: int) -> None:
    """Блокирует адрес на ttl_seconds. Повторный вызов продлевает срок."""
    await redis.set(_key(ip), "1", ex=ttl_seconds)


async def is_ip_blocked(redis: Redis, ip: str) -> bool:
    return bool(await redis.exists(_key(ip)))


async def unblock_ip(redis: Redis, ip: str) -> None:
    """Снятие блока вручную (оператор). Истёкший ключ удалять не ошибка."""
    await redis.delete(_key(ip))


class IpBlockMiddleware(BaseHTTPMiddleware):
    """403 заблокированному адресу на защищённых префиксах.

    Пустой список префиксов ничего не защищает: /health и панель под отбой
    не попадают, они проверяются своими средствами.
    redis_getter вызывается на каждый запрос, а не один раз в конструкторе:
    тесты подменяют клиент на fakeredis уже после сборки приложения.
    """

    def __init__(
        self,
        app,
        *,
        protected_prefixes: tuple[str, ...],
        redis_getter: Callable[[], Redis],
    ) -> None:
        super().__init__(app)
        self._prefixes = tuple(protected_prefixes)
        self._redis_getter = redis_getter

    def _protected(self, path: str) -> bool:
        return any(path.startswith(prefix) for prefix in self._prefixes)

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if not self._protected(request.url.path) or request.client is None:
            return await call_next(request)

        # 🔴 Тот же адрес, каким его видит движок при блокировке (client_ip):
        # за туннелем cloudflared сокет у всех посетителей один — адрес
        # контейнера туннеля, а блок ставится по CF-Connecting-IP. Сравнивая
        # здесь сокет, middleware не находила ни одного блока (аудит 30.09.2026).
        # CF-Connecting-IP берётся только от своих (loopback, частные сети);
        # снаружи заголовком чужой адрес не выбрать.
        ip = client_ip(request)
        try:
            blocked = await is_ip_blocked(self._redis_getter(), ip)
        except Exception:  # noqa: BLE001 — любой сбой Redis
            # Сбой хранилища — не подтверждение атаки: пропускаем (fail-open
            # на подозрении), но пишем в журнал, чтобы это не прошло молча.
            logger.warning("Проверка блок-листа адресов недоступна, запрос пропущен")
            return await call_next(request)

        if blocked:
            # Тело без имён сервисов и причин: заблокированному ничего не объясняем.
            return JSONResponse({"status": "forbidden"}, status_code=403)
        return await call_next(request)
