"""Шаг 6: остановка приложения дожидается задач канала.

Обновления обрабатываются в фоновых задачах, а на вебхук уже ответили 200 —
Telegram их не повторит. Если закрыть движок БД и http-клиент под живой
задачей, ход оборвётся посреди себя: реплика клиента в истории есть,
ответа нет, и повтор её не подберёт.
"""

from __future__ import annotations

import asyncio

import pytest


class SlowRunner:
    """Подмена WebhookRunner: одна долгая задача и запись порядка остановки."""

    def __init__(self) -> None:
        self.done = False
        self.drained = False
        self._task: asyncio.Task | None = None

    def submit(self, update: dict) -> asyncio.Task:
        self._task = asyncio.create_task(self._work())
        return self._task

    async def _work(self) -> None:
        await asyncio.sleep(0.2)
        self.done = True

    async def drain(self) -> None:
        self.drained = True
        if self._task is not None:
            await asyncio.gather(self._task, return_exceptions=True)


class HangingRunner(SlowRunner):
    """Задача, которая не кончается: остановка не должна висеть вечно."""

    async def _work(self) -> None:
        await asyncio.sleep(3600)

    async def drain(self) -> None:
        self.drained = True
        await asyncio.sleep(3600)


@pytest.fixture
def app(fake_redis, monkeypatch: pytest.MonkeyPatch):
    from src.config import get_settings
    from src.main import create_app

    monkeypatch.setenv("KB_EMBED_WARMUP", "false")
    get_settings.cache_clear()
    return create_app()


async def _run_lifespan(app, runner) -> None:
    async with app.router.lifespan_context(app):
        app.state.telegram_runner = runner
        runner.submit({"update_id": 1})


async def test_shutdown_waits_for_runner_tasks(app, monkeypatch: pytest.MonkeyPatch) -> None:
    closed: list[bool] = []

    async def fake_close() -> None:
        closed.append(True)

    monkeypatch.setattr("src.main.close_resources", fake_close)
    runner = SlowRunner()
    await _run_lifespan(app, runner)

    assert runner.drained is True
    assert runner.done is True, "ресурсы закрылись под живой задачей обработки"
    assert closed == [True]


async def test_shutdown_does_not_hang_on_stuck_task(app, monkeypatch: pytest.MonkeyPatch) -> None:
    """Потолок по времени: зависшая задача не держит остановку вечно."""
    closed: list[bool] = []

    async def fake_close() -> None:
        closed.append(True)

    monkeypatch.setattr("src.main.close_resources", fake_close)
    monkeypatch.setattr("src.main.GRACEFUL_STOP_SECONDS", 0.05)
    runner = HangingRunner()
    await asyncio.wait_for(_run_lifespan(app, runner), timeout=5)
    assert closed == [True]


async def test_shutdown_without_runner_is_fine(app, monkeypatch: pytest.MonkeyPatch) -> None:
    closed: list[bool] = []

    async def fake_close() -> None:
        closed.append(True)

    monkeypatch.setattr("src.main.close_resources", fake_close)
    async with app.router.lifespan_context(app):
        pass
    assert closed == [True]
