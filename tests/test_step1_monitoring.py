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


async def test_every_pass_refreshes_the_alive_file(tmp_path, monkeypatch) -> None:
    """HTTP у monitor нет: проверка здоровья compose смотрит, свежий ли файл-пульс.
    Без него monitor наследовал HTTP-проверку образа и был «unhealthy» всегда."""
    import asyncio

    from src import monitoring

    alive = tmp_path / "monitor-alive"
    monkeypatch.setattr(monitoring, "ALIVE_FILE", alive)
    stop = asyncio.Event()

    async def job() -> None:
        stop.set()

    await monitoring.run(stop, jobs=[job], tick_seconds=0)
    assert alive.exists(), "проход прошёл, а пульса нет"


def test_compose_checks_the_monitor_by_its_alive_file() -> None:
    from pathlib import Path

    from src import monitoring

    compose = (Path(__file__).resolve().parent.parent / "compose.yml").read_text(encoding="utf-8")
    monitor_block = compose.split("\n  monitor:\n", 1)[1].split("\n  postgres:\n", 1)[0]
    assert "healthcheck:" in monitor_block, "без своей проверки monitor наследует HTTP-проверку образа"
    assert str(monitoring.ALIVE_FILE) in monitor_block
    assert "8000/health" not in monitor_block
