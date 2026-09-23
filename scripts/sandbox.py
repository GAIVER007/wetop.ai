"""Терминальный чат с движком: строка из stdin -> ответ бота в stdout.

Нужны настройки боевого .env в корне проекта: база (DATABASE_URL),
Redis (REDIS_URL), роутер модели (LLM_*), путь к промпту (PROMPT_PATH)
и накаченные миграции. Без них движок ответит нейтральной фразой
и запишет ошибку в журнал — это его штатное поведение, а не сбой скрипта.

Запуск из корня:  python scripts/sandbox.py
Выход:            Ctrl-D (пустая строка пропускается).

Все ходы идут от одного клиента external_id='console' в канале 'sandbox':
диалог продолжается между запусками, как у настоящего клиента.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# Скрипт лежит в scripts/, а пакет src — в корне: добавляем корень в путь,
# чтобы запуск не зависел от cwd и PYTHONPATH.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.ai.engine import IncomingMessage, build_engine  # noqa: E402
from src.channels.sender import SendResult  # noqa: E402
from src.config import get_settings  # noqa: E402
from src.db.base import utcnow  # noqa: E402
from src.dependencies import close_resources, configure_logging  # noqa: E402

CHANNEL = "sandbox"
EXTERNAL_ID = "console"


class ConsoleSender:
    """Отправитель в терминал: печатает ответ и считает его доставленным."""

    async def send(self, *, channel: str, external_id: str, text: str) -> SendResult:
        print(f"бот> {text}", flush=True)
        return SendResult(ok=True)


async def _read_line() -> str:
    """Чтение stdin в потоке, чтобы не блокировать цикл событий движка."""
    sys.stdout.write("вы> ")
    sys.stdout.flush()
    return await asyncio.to_thread(sys.stdin.readline)


async def main() -> None:
    settings = get_settings()
    configure_logging(settings, name="sandbox")
    engine = build_engine(settings, sender=ConsoleSender())
    try:
        while True:
            line = await _read_line()
            if line == "":  # EOF: Ctrl-D
                break
            text = line.strip()
            if not text:
                continue
            outcome = await engine.process_message(
                IncomingMessage(
                    channel=CHANNEL,
                    external_id=EXTERNAL_ID,
                    text=text,
                    received_at=utcnow(),
                )
            )
            if outcome.status != "replied":
                # Ответа не было или он ушёл по особой ветке — оператору
                # полезно видеть, почему, а клиент этого не видит.
                print(f"[{outcome.status}] {', '.join(outcome.reasons)}", file=sys.stderr)
    finally:
        await close_resources()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
