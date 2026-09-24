"""Точка входа отдельного процесса monitor: фоновые петли.

Отдельный процесс, а не поток внутри app: подвиснет фоновая задача —
веб продолжит отвечать; упадёт веб — фоновые задачи доработают.
Запуск: python -m src.monitoring (см. compose.yml).

Задачи регистрируются в JOBS через default_jobs(): повторная доставка
outbox (шаг 6), сторож сроков ответа и суточная проверка канала алертов
(шаг 8).
🔴 Каждая задача открывает СВОЮ сессию БД (get_sessionmaker()), а не берёт
чужую: сессия из запроса закрывается вместе с ним, и запись теряется молча.
"""

import asyncio
import contextlib
import logging
import signal
from collections.abc import Awaitable, Callable
from pathlib import Path

from src.config import get_settings
from src.dependencies import close_resources, configure_logging

LOG_NAME = "monitor"
TICK_SECONDS = 60
# Пульс для проверки здоровья compose: HTTP у monitor нет. Свежий файл —
# петля жива; старый — зависла, хотя процесс ещё есть.
ALIVE_FILE = Path("/tmp/monitor-alive")

Job = Callable[[], Awaitable[None]]
JOBS: list[Job] = []

logger = logging.getLogger(__name__)


def default_jobs() -> list[Job]:
    """Список задач боевого процесса. Импорт внутри: src.jobs тянет каналы
    и движок, а они импортируют настройки и dependencies — цикл на уровне
    модулей. Заполняет и JOBS, чтобы старое имя показывало то же самое."""
    from src.jobs import heartbeat, outbox_redeliver, watchdog

    # Порядок: сначала добить очередь, потом наполнить её новыми алертами —
    # так алерт этого прохода уходит следующим, а не ждёт лишний тик.
    jobs: list[Job] = [outbox_redeliver.run_once, watchdog.run_once, heartbeat.run_once]
    JOBS[:] = jobs
    return jobs


async def tick(jobs: list[Job]) -> None:
    """Один проход по задачам. Каждая в своём try/except: одна упавшая
    не глушит остальные и не роняет процесс."""
    for job in jobs:
        try:
            await job()
        except Exception:
            logger.exception("Фоновая задача %s упала", getattr(job, "__name__", repr(job)))


async def run(stop: asyncio.Event, jobs: list[Job] = JOBS, tick_seconds: int = TICK_SECONDS) -> None:
    """Петля до сигнала остановки. Ждёт между проходами, но просыпается сразу по stop."""
    logger.info("monitor запущен, задач: %d", len(jobs))
    while not stop.is_set():
        await tick(jobs)
        with contextlib.suppress(OSError):
            ALIVE_FILE.touch()
        try:
            await asyncio.wait_for(stop.wait(), timeout=tick_seconds)
        except TimeoutError:
            pass
    logger.info("monitor остановлен")


def main() -> None:
    settings = get_settings()
    configure_logging(settings, name=LOG_NAME)

    async def _main() -> None:
        stop = asyncio.Event()
        loop = asyncio.get_running_loop()
        # SIGTERM шлёт compose при остановке: завершаем проход и выходим,
        # а не умираем посреди записи.
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, stop.set)
        try:
            await run(stop, jobs=default_jobs())
        finally:
            await close_resources()

    asyncio.run(_main())


if __name__ == "__main__":
    main()
