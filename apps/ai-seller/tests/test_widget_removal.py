"""Прежний общий канал Telegram для клиентов удалён и не должен вернуться.

🔴 Этот файл сторожит поворот продукта: основной канал клиентов теперь
виджет на сайте платформы. Вернувшаяся настройка прежнего канала, его скрипт
вебхука или транспорт очереди с прежним именем означают вторую дверь в бота,
о которой никто не помнит.

Исключение по решению владельца (DECISIONS.md, «01.10.2026, Telegram seller
pilot per agent»; 02.10.2026 пилот оставлен): подключение Telegram к одному
агенту, выключенное по умолчанию (`telegram_seller_enabled`), со своим
вебхуком `/channels/telegram/webhook/{agent_id}` и своими тестами
(test_telegram_*.py). Его модули src/channels/telegram*.py разрешены, имена
прежнего канала запрещены по-прежнему.

🔴 Обратная сторона: алерты владельцу в мессенджер — ДРУГОЙ бот и другая
задача. Правило кита требует двух каналов алертов (почта основная,
мессенджер дубль) из-за боевого инцидента с блокировкой адреса. Здесь же
проверяется, что уборка их не задела.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from src.config import get_settings
from src.jobs.outbox_redeliver import build_transports

ROOT = Path(__file__).resolve().parent.parent

# Имена, по которым опознаётся прежний общий канал: переменные окружения и поля
# настроек. Модуля `channels.telegram` здесь больше нет: под этим именем живёт
# пилот по агенту (решение 01.10.2026). Слово «telegram» само по себе не запрещено:
# оно есть в алертах (alert_telegram_*) и в пилоте (telegram_seller_*).
FORBIDDEN = ("CHANNEL_TELEGRAM", "channel_telegram")

GONE = ("scripts/telegram_webhook.py",)

# Что смотрим: исходники и скрипты, без кэшей интерпретатора.
SUFFIXES = (".py", ".js", ".sh", ".html", ".css", ".txt", ".md")


def _sources() -> list[Path]:
    files: list[Path] = []
    for folder in ("src", "scripts"):
        for path in sorted((ROOT / folder).rglob("*")):
            if path.is_file() and path.suffix in SUFFIXES and "__pycache__" not in path.parts:
                files.append(path)
    return files


@pytest.mark.parametrize("needle", FORBIDDEN)
def test_no_trace_of_the_client_channel_in_sources(needle: str) -> None:
    hits = [
        str(path.relative_to(ROOT))
        for path in _sources()
        if needle in path.read_text(encoding="utf-8", errors="replace")
    ]
    assert not hits, f"канал вернулся: {needle} встречается в {hits}"


@pytest.mark.parametrize("relative", GONE)
def test_channel_file_is_deleted(relative: str) -> None:
    assert not (ROOT / relative).exists(), f"{relative} должен быть удалён вместе с каналом"


def test_widget_took_the_place_of_the_channel() -> None:
    """Основная дверь новая: канал клиентов по умолчанию это виджет."""
    assert (ROOT / "src" / "channels" / "widget.py").exists()
    assert (ROOT / "src" / "channels" / "widget_identity.py").exists()
    assert (ROOT / "src" / "site" / "widget.js").exists()


def test_telegram_pilot_is_off_by_default() -> None:
    """Пилот Telegram включают явно: по умолчанию выключен, и его вебхук
    отвечает 503, не читая ни базу, ни тело запроса."""
    import uuid

    from fastapi.testclient import TestClient

    import src.main as main
    from src.config import Settings

    assert Settings.model_fields["telegram_seller_enabled"].default is False
    settings = get_settings().model_copy(update={"telegram_seller_enabled": False})
    client = TestClient(main.create_app(settings))
    response = client.post(f"/channels/telegram/webhook/{uuid.uuid4()}", json={})
    assert response.status_code == 503, response.text


def test_redelivery_has_no_client_channel_transport() -> None:
    """🔴 Виджет — канал с вытягиванием: очередь исходящих ему не нужна,
    сообщение доставлено ровно тогда, когда записано в историю."""
    transports = build_transports(get_settings(), None)
    assert "telegram" not in transports
    assert "widget" not in transports


def test_alerts_are_untouched() -> None:
    """Мессенджер алертов на месте: это второй канал доставки владельцу,
    а не остаток удалённого канала клиентов."""
    assert (ROOT / "src" / "alerts" / "messenger.py").exists()
    transports = build_transports(get_settings(), None)
    assert {"email", "alert_messenger"} <= set(transports)


def test_alert_bot_keeps_its_own_api_base() -> None:
    """Адрес Bot API бота алертов больше не одалживается у канала клиентов:
    иначе удаление канала унесло бы с собой дубль доставки алертов."""
    settings = get_settings()
    assert settings.alert_telegram_api_base == "https://api.telegram.org"
    assert settings.alert_telegram_api_base_list == [settings.alert_telegram_api_base]


def test_no_prefix_of_the_removed_channel_is_guarded() -> None:
    """🔴 Префикс без маршрутов вводит в заблуждение при разборе инцидента:
    строка в списке защищённых читается как «такая дверь есть»."""
    import src.main as main

    source = (ROOT / "src" / "main.py").read_text(encoding="utf-8")
    assert "/webhooks" not in source, "префикс удалённого канала остался под защитой"
    app = main.create_app(get_settings())
    protected = [
        options.get("protected_prefixes")
        for middleware, options in ((m.cls.__name__, m.kwargs) for m in app.user_middleware)
        if middleware == "IpBlockMiddleware"
    ]
    assert protected == [("/widget",)], protected
