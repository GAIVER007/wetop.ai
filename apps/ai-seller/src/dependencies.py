"""Общие ресурсы процесса: журнал, движок БД, Redis, HTTP-клиент.

По одному экземпляру на процесс: пул соединений и клиент httpx создаются
дорого, а плодить их на каждый запрос значит исчерпать соединения.
"""

import contextvars
import logging
import logging.handlers
import os
from collections.abc import AsyncIterator
from pathlib import Path

import httpx
import redis.asyncio as redis_asyncio
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from src.config import Settings, get_settings
from src.security.pii import PiiLogFilter

# Идентификатор диалога для журнала: по нему собирается всё, что с диалогом
# происходило. Ставится движком на время обработки одного хода.
conversation_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "conversation_id", default=None
)

_LOG_FORMAT = "%(asctime)s | %(levelname)s | %(conversation_id)s | %(name)s | %(message)s"
_STDOUT_HANDLER = "app_stdout"
_FILE_HANDLER = "app_file"


class _ConversationIdFilter(logging.Filter):
    """Подставляет conversation_id из contextvar в каждую запись."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.conversation_id = conversation_id_var.get() or "-"
        return True


def log_file_path(name: str = "app") -> Path:
    """Файл журнала этого процесса: logs/<name>-<pid>.log.

    🔴 Один писатель на файл. RotatingFileHandler не умеет ротировать файл,
    в который пишут несколько процессов (gunicorn --workers 2): после
    переименования второй воркер продолжает писать в уже отвёрнутый файл,
    записи теряются. Поэтому pid в имени, а monitor передаёт своё name —
    он идёт из того же образа на тот же том ./logs.
    Плата: после перезапуска появляется новый файл; старые бережёт
    backupCount только в пределах своего pid.
    """
    return Path("logs") / f"{name}-{os.getpid()}.log"


def configure_logging(settings: Settings, name: str = "app") -> None:
    """Журнал в stdout и в файл с ротацией. Повторный вызов ничего не дублирует.

    Файл нужен, потому что драйвер контейнера держит записи внутри него,
    и пересоздание контейнера уносит их вместе с ним. Но файл — второй
    приёмник: если его не открыть (том смонтирован от root, диск полон),
    сервис всё равно стартует и пишет в stdout.
    """
    root = logging.getLogger()
    level = logging.getLevelName(settings.log_level.upper())
    root.setLevel(level if isinstance(level, int) else logging.INFO)
    _mask_server_loggers(settings)

    existing = {h.get_name() for h in root.handlers}
    if _STDOUT_HANDLER in existing and _FILE_HANDLER in existing:
        return

    formatter = logging.Formatter(_LOG_FORMAT)
    conv_filter = _ConversationIdFilter()
    # Маскировка ПД в журнале — на обработчиках, а не на логгерах: логгеров
    # много, и новый модуль легко забыть; приёмников ровно два.
    pii_filter = PiiLogFilter(
        settings.pii_allowlist_phones_list, settings.pii_allowlist_emails_list
    )

    if _STDOUT_HANDLER not in existing:
        stdout_handler = logging.StreamHandler()
        stdout_handler.set_name(_STDOUT_HANDLER)
        stdout_handler.setFormatter(formatter)
        stdout_handler.addFilter(conv_filter)
        stdout_handler.addFilter(pii_filter)
        root.addHandler(stdout_handler)

    if _FILE_HANDLER not in existing:
        path = log_file_path(name)
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            file_handler = logging.handlers.RotatingFileHandler(
                path,
                maxBytes=settings.log_max_size_mb * 1024 * 1024,
                backupCount=settings.log_keep_files,
                encoding="utf-8",
            )
        except OSError:
            # Сбой второго приёмника не должен класть сервис: stdout уже есть.
            root.warning("Файл журнала %s недоступен, пишем только в stdout", path)
            return
        file_handler.set_name(_FILE_HANDLER)
        file_handler.setFormatter(formatter)
        file_handler.addFilter(conv_filter)
        file_handler.addFilter(pii_filter)
        root.addHandler(file_handler)


# Логгеры сервера со своими обработчиками: их записи до корня не доходят
_SERVER_LOGGERS = ("uvicorn", "uvicorn.error", "uvicorn.access", "gunicorn.error", "gunicorn.access")


def _mask_server_loggers(settings: Settings) -> None:
    """Маска ПД и на обработчиках uvicorn и gunicorn.

    🔴 Под gunicorn с UvicornWorker у этих логгеров свои обработчики, и
    трассировка ошибки базы с параметрами запроса (ключ посетителя, почта,
    ответ оператора) уходила в stderr мимо маски корня (аудит 26.09, С-41).
    Повторный вызов второй фильтр не вешает.
    """
    pii_filter = PiiLogFilter(settings.pii_allowlist_phones_list, settings.pii_allowlist_emails_list)
    for name in _SERVER_LOGGERS:
        for handler in logging.getLogger(name).handlers:
            if not any(isinstance(f, PiiLogFilter) for f in handler.filters):
                handler.addFilter(pii_filter)


class _Resources:
    """Держатель синглтонов. Один объект, а не россыпь глобалов."""

    def __init__(self) -> None:
        self.engine: AsyncEngine | None = None
        self.sessionmaker: async_sessionmaker[AsyncSession] | None = None
        self.redis: redis_asyncio.Redis | None = None
        self.http_client: httpx.AsyncClient | None = None


_resources = _Resources()


def get_engine() -> AsyncEngine:
    """Движок SQLAlchemy. pool_pre_ping: мёртвое соединение из пула не отдаётся."""
    if _resources.engine is None:
        # hide_parameters: текст ошибки базы без значений запроса — в них ключ
        # посетителя, почта, ответ оператора (аудит 26.09, С-41)
        _resources.engine = create_async_engine(
            get_settings().sqlalchemy_url, pool_pre_ping=True, hide_parameters=True
        )
    return _resources.engine


def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    """expire_on_commit=False: после commit объекты читаются без лишнего запроса."""
    if _resources.sessionmaker is None:
        _resources.sessionmaker = async_sessionmaker(
            get_engine(), expire_on_commit=False
        )
    return _resources.sessionmaker


async def get_db_session() -> AsyncIterator[AsyncSession]:
    """Зависимость FastAPI: сессия живёт ровно один запрос.

    Фоновые задачи её не используют — открывают свою через get_sessionmaker().
    """
    async with get_sessionmaker()() as session:
        yield session


def get_redis() -> redis_asyncio.Redis:
    """Клиент Redis, один на процесс."""
    if _resources.redis is None:
        _resources.redis = redis_asyncio.Redis.from_url(get_settings().redis_url)
    return _resources.redis


def get_http_client() -> httpx.AsyncClient:
    """HTTP-клиент с пулом соединений. Таймаут — на одну попытку к модели."""
    if _resources.http_client is None:
        _resources.http_client = httpx.AsyncClient(
            timeout=get_settings().llm_timeout_seconds
        )
    return _resources.http_client


async def close_resources() -> None:
    """Закрывает всё, что было создано, и обнуляет держатель."""
    if _resources.http_client is not None:
        await _resources.http_client.aclose()
    if _resources.redis is not None:
        await _resources.redis.aclose()
    if _resources.engine is not None:
        await _resources.engine.dispose()
    reset_resources()


def reset_resources() -> None:
    """Обнуляет синглтоны без закрытия. Для тестов, где меняются настройки."""
    _resources.engine = None
    _resources.sessionmaker = None
    _resources.redis = None
    _resources.http_client = None
