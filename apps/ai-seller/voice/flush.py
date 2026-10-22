"""Догнать очередь событий вручную или по расписанию: python -m voice.flush (из apps/ai-seller).

Флаг `--requeue-rejected` возвращает отложенные (rejected) события в очередь после исправления причины.
Нужно, если звонков давно не было, а в очереди остались события (платформа лежала при выходе воркера).
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys

import httpx
from dotenv import load_dotenv

from voice.config import ConfigError, VoiceSettings
from voice.flusher import drain
from voice.outbox import Outbox
from voice.platform import PlatformClient

logger = logging.getLogger("voice.flush")


async def run(cfg: VoiceSettings, *, timeout_seconds: float = 60, requeue_rejected: bool = False) -> tuple[int, int]:
    box = Outbox(cfg.outbox_dir)
    box.recover()
    if requeue_rejected:
        logger.info("возвращено из rejected в очередь: %s", box.requeue_rejected())
    async with httpx.AsyncClient() as http:
        client = PlatformClient(base_url=cfg.wetop_base_url, key=cfg.ingest_key, http=http)
        await drain(box, client, timeout_seconds=timeout_seconds)
    return box.pending_count(), box.rejected_count()


def main() -> None:
    load_dotenv()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    try:
        cfg = VoiceSettings.from_env(os.environ)
    except ConfigError as exc:
        raise SystemExit(f"Настройка воркера: {exc}") from None
    pending, rejected = asyncio.run(run(cfg, requeue_rejected="--requeue-rejected" in sys.argv[1:]))
    logger.info("очередь событий: осталось %s, отложено как отвергнутые %s", pending, rejected)
    raise SystemExit(0 if pending == 0 else 2)


if __name__ == "__main__":
    main()
