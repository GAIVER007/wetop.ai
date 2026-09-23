"""Шаг 8а: мессенджер — дубль алерта, отдельный бот, перебор адресов.

🔴 Порядок адресов проверяется: в инциденте рабочий стоял последним,
мёртвый первым, и перебор упирался в таймаут раньше, чем доходил до живого.
🔴 Разметка HTML, не Markdown: подчёркивание в ссылке открывает курсив,
парсер не находит закрытия, сообщение не уходит — и это тихая потеря.
"""

from __future__ import annotations

import logging

import httpx
import pytest

from src.alerts.messenger import MessengerTransport, build_messenger_transport, to_html
from tests.alert_fakes import TEST_CHAT_ID, TEST_TOKEN, MessengerApi, alert_settings

DEAD = "https://dead.example.test"
ALIVE = "https://alive.example.test"
BODY = "Клиент ждёт ответа 10 мин"


def _settings(monkeypatch: pytest.MonkeyPatch, bases: str, **extra: str):
    return alert_settings(monkeypatch, ALERT_TELEGRAM_API_BASES=bases, **extra)


async def test_fallback_goes_through_the_list_in_order(monkeypatch) -> None:
    settings = _settings(monkeypatch, f"{DEAD}, {ALIVE}")
    api = MessengerApi(fail_hosts={"dead.example.test": 502})

    async with api.client() as http:
        result = await MessengerTransport(settings, http).deliver(TEST_CHAT_ID, BODY)

    assert result.ok is True
    # Оба адреса опрошены, и мёртвый — ПЕРВЫМ: это и есть порядок списка.
    assert api.hosts == ["dead.example.test", "alive.example.test"]


async def test_first_success_stops_the_walk(monkeypatch) -> None:
    settings = _settings(monkeypatch, f"{ALIVE}, {DEAD}")
    api = MessengerApi(fail_hosts={"dead.example.test": 502})

    async with api.client() as http:
        result = await MessengerTransport(settings, http).deliver(TEST_CHAT_ID, BODY)

    assert result.ok is True
    assert api.hosts == ["alive.example.test"]


async def test_all_addresses_dead_returns_the_last_code(monkeypatch) -> None:
    settings = _settings(monkeypatch, f"{DEAD}, {ALIVE}")
    api = MessengerApi(
        fail_hosts={
            "dead.example.test": httpx.ConnectTimeout("нет связи"),
            "alive.example.test": 500,
        }
    )

    async with api.client() as http:
        result = await MessengerTransport(settings, http).deliver(TEST_CHAT_ID, BODY)

    assert result.ok is False
    assert result.error
    assert api.hosts == ["dead.example.test", "alive.example.test"]


async def test_empty_token_returns_code_without_trying(monkeypatch) -> None:
    settings = _settings(monkeypatch, ALIVE, ALERT_TELEGRAM_BOT_TOKEN="")
    api = MessengerApi()

    async with api.client() as http:
        result = await MessengerTransport(settings, http).deliver(TEST_CHAT_ID, BODY)

    assert result.ok is False
    assert result.error == "alert_bot_not_configured"
    assert api.hosts == []


async def test_message_is_html_and_escaped(monkeypatch) -> None:
    settings = _settings(monkeypatch, ALIVE)
    api = MessengerApi()
    text = "Отказ <b> & сбой https://host/a_b_c"

    async with api.client() as http:
        result = await MessengerTransport(settings, http).deliver(TEST_CHAT_ID, text)

    assert result.ok is True
    method, payload = api.calls[0]
    assert method == "sendMessage"
    assert payload["parse_mode"] == "HTML"
    assert payload["chat_id"] == TEST_CHAT_ID
    assert payload["disable_web_page_preview"] is True
    assert "&lt;b&gt;" in payload["text"]
    assert "&amp;" in payload["text"]
    assert "<b>" not in payload["text"]


async def test_to_html_escapes_and_keeps_line_breaks() -> None:
    assert to_html("a & b") == "a &amp; b"
    assert to_html("<i>") == "&lt;i&gt;"
    # Подчёркивания уходят как есть: в HTML они не разметка, в Markdown были бы.
    assert "a_b_c" in to_html("https://host/a_b_c")
    assert "\n" in to_html("первая\nвторая")


async def test_default_base_is_used_when_list_is_empty(monkeypatch) -> None:
    """Пустой список запасных адресов не оставляет алерты без канала:
    берётся адрес канала клиентов."""
    settings = alert_settings(
        monkeypatch, ALERT_TELEGRAM_API_BASES="", CHANNEL_TELEGRAM_API_BASE=ALIVE
    )
    assert settings.alert_telegram_api_base_list == [ALIVE]
    api = MessengerApi()

    async with api.client() as http:
        result = await MessengerTransport(settings, http).deliver(TEST_CHAT_ID, BODY)

    assert result.ok is True
    assert api.hosts == ["alive.example.test"]


async def test_log_holds_neither_token_nor_address(
    monkeypatch, caplog: pytest.LogCaptureFixture
) -> None:
    """🔴 Токен едет в адресе каждого запроса: полный адрес в журнал
    не пишется никогда, и httpx поднят до WARNING именно поэтому."""
    settings = _settings(monkeypatch, f"{DEAD}, {ALIVE}")
    api = MessengerApi(fail_hosts={"dead.example.test": 502, "alive.example.test": 500})

    with caplog.at_level(logging.DEBUG):
        async with api.client() as http:
            await MessengerTransport(settings, http).deliver(TEST_CHAT_ID, BODY)

    logged = caplog.text
    assert TEST_TOKEN not in logged, logged
    assert "https://" not in logged, logged


async def test_httpx_logger_is_raised_to_warning(monkeypatch) -> None:
    logging.getLogger("httpx").setLevel(logging.INFO)
    settings = _settings(monkeypatch, ALIVE)
    api = MessengerApi()

    async with api.client() as http:
        MessengerTransport(settings, http)

    assert logging.getLogger("httpx").level >= logging.WARNING


async def test_builder_returns_transport(monkeypatch) -> None:
    settings = _settings(monkeypatch, ALIVE)
    api = MessengerApi()
    async with api.client() as http:
        assert isinstance(build_messenger_transport(settings, http), MessengerTransport)
