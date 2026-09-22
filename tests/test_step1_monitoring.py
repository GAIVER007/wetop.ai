"""monitor — отдельный процесс фоновых задач (struktura.txt, compose.yml).

На шаге 1 задач ещё нет, но процесс обязан подниматься: иначе сервис
monitor в compose уходит в бесконечный перезапуск.
"""

import importlib

from src.dependencies import log_file_path


def test_monitoring_module_has_entrypoint() -> None:
    module = importlib.import_module("src.monitoring")
    assert callable(module.main)
    assert callable(module.tick)


async def test_tick_runs_every_registered_job() -> None:
    from src import monitoring

    calls: list[str] = []

    async def first() -> None:
        calls.append("first")

    async def second() -> None:
        calls.append("second")

    await monitoring.tick([first, second])
    assert calls == ["first", "second"]


async def test_tick_survives_failing_job() -> None:
    """Одна упавшая задача не глушит остальные и не роняет процесс."""
    from src import monitoring

    calls: list[str] = []

    async def bad() -> None:
        raise RuntimeError("boom")

    async def good() -> None:
        calls.append("good")

    await monitoring.tick([bad, good])
    assert calls == ["good"]


def test_monitor_writes_its_own_log_file() -> None:
    """Один писатель на файл: журнал monitor не смешивается с журналом app."""
    from src import monitoring

    assert monitoring.LOG_NAME == "monitor"
    assert log_file_path(monitoring.LOG_NAME).name.startswith("monitor-")
