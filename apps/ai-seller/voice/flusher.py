"""Отправка очереди событий в API платформы: проход, ожидание перед повтором, догон перед выходом."""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass

from voice.outbox import Outbox
from voice.platform import SendResult

logger = logging.getLogger(__name__)

BACKOFF_BASE_SECONDS = 5
BACKOFF_CAP_SECONDS = 900
# Событие, на которое платформа отвечает 404 или 422, повторяется столько раз (около 2,5 часов при потолке паузы), потом откладывается
MAX_LIMITED_ATTEMPTS = 10


@dataclass
class FlushStats:
    sent: int = 0
    retried: int = 0
    rejected: int = 0


def backoff_seconds(attempts: int) -> int:
    """5, 10, 20 ... секунд, не больше 15 минут."""
    return min(BACKOFF_BASE_SECONDS * (2 ** max(attempts, 0)), BACKOFF_CAP_SECONDS)


async def flush_once(outbox: Outbox, client, *, limit: int = 100) -> FlushStats:
    """Один проход. После первого временного отказа проход кончается: не долбим лежащий API, остальное ждёт."""
    stats = FlushStats()
    for _ in range(limit):
        # разбор очереди читает файлы: уводим с цикла событий, по нему идёт звук разговора
        item = await asyncio.to_thread(outbox.take_due)
        if item is None:
            break
        result = await client.send_event(item.payload)
        if result is SendResult.OK:
            item.ack()
            stats.sent += 1
        elif result is SendResult.REJECT:
            item.reject("rejected_by_api")
            stats.rejected += 1
        elif result is SendResult.RETRY_LIMITED and item.attempts + 1 >= MAX_LIMITED_ATTEMPTS:
            item.reject("not_found_after_retries")
            stats.rejected += 1
        else:
            item.retry(backoff_seconds(item.attempts))
            stats.retried += 1
            break
    return stats


async def drain(outbox: Outbox, client, *, timeout_seconds: float = 10, pause_seconds: float = 0.0) -> None:
    """Догнать очередь перед выходом, но не дольше срока и не дольше удачных проходов.

    Нечего отправлять сейчас (всё ждёт срока) или платформа отказала: выходим сразу, слот воркера не держим.
    Что не ушло, остаётся в очереди и уйдёт со следующим звонком или через `python -m voice.flush`.
    """
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        stats = await flush_once(outbox, client)
        if stats.sent == 0:
            return
        if pause_seconds:
            await asyncio.sleep(pause_seconds)


async def run_flusher(outbox: Outbox, client, stop: asyncio.Event, *, interval_seconds: float = 5) -> None:
    """Фоновая отправка во время звонка, пока не выставлен `stop`."""
    outbox.recover()
    while not stop.is_set():
        try:
            await flush_once(outbox, client)
        except Exception as exc:  # noqa: BLE001 - отправка не должна ронять звонок
            logger.error("отправка событий: сбой прохода (%s)", type(exc).__name__)
        try:
            await asyncio.wait_for(stop.wait(), timeout=interval_seconds)
        except asyncio.TimeoutError:
            pass
