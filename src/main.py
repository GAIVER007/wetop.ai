"""Точка входа FastAPI: сборка приложения, проверки живости, обработка ошибок.

Наружу отдаётся минимум: ни документации API, ни версий, ни текстов
исключений. Всё для диагностики — в журнале и на /internal/health по ключу.
"""

import logging
import secrets
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from src import dashboard_router
from src.config import Settings, get_settings
from src.dependencies import (
    close_resources,
    configure_logging,
    get_engine,
    get_redis,
)
from src.db.ip_block import IpBlockMiddleware
from src.knowledge.embedder import get_embedder

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Собирает приложение. settings передают тесты; в бою берётся из окружения."""
    app_settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        configure_logging(app_settings)
        # Прогрев модели эмбеддингов: без него первый клиент ждёт загрузку
        # ~450 МБ. Не прогрелась — процесс живёт, но /health отвечает 503:
        # compose увидит и не пустит трафик на пустую базу знаний.
        if app_settings.kb_embed_warmup:
            try:
                await get_embedder().warmup()
            except Exception:
                logger.exception("Прогрев модели эмбеддингов не удался")
                app.state.ready = False
        try:
            yield
        finally:
            await close_resources()

    # debug=False всегда: отладочный режим отдаёт трассировку клиенту.
    # Документация API наружу не публикуется — это карта системы.
    app = FastAPI(
        debug=False,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        lifespan=lifespan,
    )
    app.state.settings = app_settings
    app.state.ready = True

    origins = app_settings.cors_origins_list
    if origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # Блок-лист адресов (слой 0): отбой на уровне фреймворка, до маршрутов.
    # Защищены только входы клиентов; /health и /internal/health — нет.
    # lambda, а не get_redis напрямую: имя разрешается на каждый запрос,
    # и тесты подменяют его на fakeredis.
    app.add_middleware(
        IpBlockMiddleware,
        protected_prefixes=("/webhooks", "/widget"),
        redis_getter=lambda: get_redis(),
    )

    @app.exception_handler(Exception)
    async def unhandled_exception(request: Request, exc: Exception) -> JSONResponse:
        """Клиенту нейтральный ответ, подробности только в журнал."""
        logger.exception("Необработанная ошибка: %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"status": "error"})

    @app.get("/health")
    async def health(request: Request) -> JSONResponse:
        """Публичная живость: только статус. Ничего не пингует.

        Имена сервисов, окружение и версии сюда не попадают: это первое,
        что собирает сканер, чтобы подобрать уязвимости под версии.
        """
        if getattr(request.app.state, "ready", True) is False:
            return JSONResponse(status_code=503, content={"status": "unavailable"})
        return JSONResponse(status_code=200, content={"status": "ok"})

    @app.get("/internal/health")
    async def internal_health(request: Request) -> JSONResponse:
        """Подробная проверка по ключу. Пустой ключ в настройках — закрыта."""
        expected = request.app.state.settings.internal_health_key
        provided = request.headers.get("x-internal-key", "")
        # Сравниваем байты: compare_digest(str, str) падает на не-ASCII,
        # а Starlette отдаёт заголовок как latin-1 — чужой байт дал бы 500.
        if not expected or not secrets.compare_digest(
            provided.encode("utf-8"), expected.encode("utf-8")
        ):
            return JSONResponse(status_code=403, content={"status": "forbidden"})

        checks: dict[str, str] = {}
        try:
            async with get_engine().connect() as conn:
                await conn.execute(text("SELECT 1"))
            checks["db"] = "ok"
        except Exception:
            logger.exception("Проверка базы не прошла")
            checks["db"] = "error"
        try:
            await get_redis().ping()
            checks["redis"] = "ok"
        except Exception:
            logger.exception("Проверка Redis не прошла")
            checks["redis"] = "error"

        return JSONResponse(status_code=200, content={"status": "ok", "checks": checks})

    app.include_router(dashboard_router.router)

    return app


# Точка входа для uvicorn/gunicorn: src.main:app
app = create_app()
