"""Вебхук Telegram: зарегистрировать, посмотреть, снять.

Запуск из корня с боевым .env:
    python scripts/telegram_webhook.py set     # адрес из PUBLIC_BASE_URL
    python scripts/telegram_webhook.py info
    python scripts/telegram_webhook.py delete

🔴 set открывает адрес наружу: перед ним прочитайте vykatka.md целиком
и пройдите чек-лист. Скрипт напомнит и спросит подтверждение.
Токен ни в вывод, ни в журнал не попадает: клиент пишет только имя метода.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

# Скрипт лежит в scripts/, пакет src — в корне: запуск не зависит от cwd.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx  # noqa: E402

from src.channels.telegram import WEBHOOK_PATH, TelegramClient  # noqa: E402
from src.config import Settings, get_settings  # noqa: E402


def _missing(settings: Settings, action: str) -> list[str]:
    """Имена незаполненных переменных — без значений."""
    required = {"CHANNEL_TELEGRAM_BOT_TOKEN": settings.channel_telegram_bot_token}
    if action == "set":
        required["PUBLIC_BASE_URL"] = settings.public_base_url
        required["CHANNEL_TELEGRAM_WEBHOOK_SECRET"] = settings.channel_telegram_webhook_secret
    return [name for name, value in required.items() if not value.strip()]


async def _run(action: str, assume_yes: bool) -> int:
    settings = get_settings()
    missing = _missing(settings, action)
    if missing:
        print("Не заданы в .env: " + ", ".join(missing), file=sys.stderr)
        return 2

    async with httpx.AsyncClient(timeout=15) as http:
        telegram = TelegramClient(
            settings.channel_telegram_bot_token, http, api_base=settings.channel_telegram_api_base,
        )
        if action == "set":
            url = settings.public_base_url.rstrip("/") + WEBHOOK_PATH
            print("Адрес открывается наружу. Прочитайте vykatka.md целиком и пройдите чек-лист.")
            print(f"Будет зарегистрирован вебхук: {url}")
            if not assume_yes and input("Продолжить? [y/N] ").strip().lower() not in ("y", "yes"):
                print("Отменено.")
                return 1
            ok = await telegram.set_webhook(url, settings.channel_telegram_webhook_secret)
            print("setWebhook: ok" if ok else "setWebhook: отказ, подробности в журнале")
            return 0 if ok else 1
        if action == "delete":
            ok = await telegram.delete_webhook()
            print("deleteWebhook: ok" if ok else "deleteWebhook: отказ, подробности в журнале")
            return 0 if ok else 1
        info = await telegram.webhook_info()
        print(json.dumps(info, ensure_ascii=False, indent=2) if info else "getWebhookInfo: пусто или отказ")
        return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Вебхук Telegram: set | info | delete")
    parser.add_argument("action", choices=("set", "info", "delete"))
    parser.add_argument("--yes", action="store_true", help="не спрашивать подтверждение перед set")
    args = parser.parse_args()
    # Журнал в stderr: отказы клиента видны, адрес с токеном в них не попадает.
    logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(name)s | %(message)s")
    sys.exit(asyncio.run(_run(args.action, args.yes)))


if __name__ == "__main__":
    main()
