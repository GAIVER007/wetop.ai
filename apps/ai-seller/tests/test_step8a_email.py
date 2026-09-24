"""Шаг 8а: почтовый транспорт — основной канал алертов.

Отказ возвращается кодом, а не исключением: транспорт зовут из outbox,
и его падение остановило бы доставку остальных строк.
🔴 Пароль и адрес сервера в журнал не пишутся ни при каком исходе.
"""

from __future__ import annotations

import logging

import pytest

from src.alerts.email import EmailTransport, build_email_transport
from tests.alert_fakes import FakeSmtp, alert_settings

PASSWORD = "sekret-app-password"
BODY = "Клиент ждёт ответа 10 мин\nдиалог abc, канал telegram"


def _configured(monkeypatch: pytest.MonkeyPatch, **extra: str):
    """Настройки с рабочим SMTP; extra перекрывает любое из значений."""
    values = {
        "SMTP_HOST": "smtp.example.test",
        "SMTP_PORT": "465",
        "SMTP_USER": "bot@example.test",
        "SMTP_PASSWORD": PASSWORD,
        "ALERT_EMAIL_FROM": "bot@example.test",
    }
    values.update(extra)
    return alert_settings(monkeypatch, **values)


async def test_not_configured_returns_code_without_trying(monkeypatch) -> None:
    """Пустой SMTP_HOST — отказ без попытки: ходить некуда, а таймаут
    съел бы окно доставки остальных строк."""
    settings = alert_settings(monkeypatch, SMTP_HOST="")
    smtp = FakeSmtp().install(monkeypatch)

    result = await EmailTransport(settings).deliver("owner@example.test", BODY)

    assert result.ok is False
    assert result.error == "smtp_not_configured"
    assert smtp.calls == []


async def test_missing_sender_returns_code_without_trying(monkeypatch) -> None:
    settings = _configured(monkeypatch, ALERT_EMAIL_FROM="")
    smtp = FakeSmtp().install(monkeypatch)

    result = await EmailTransport(settings).deliver("owner@example.test", BODY)

    assert result.ok is False
    assert result.error == "smtp_not_configured"
    assert smtp.calls == []


async def test_configured_sends_to_the_right_host_and_port(monkeypatch) -> None:
    settings = _configured(monkeypatch)
    smtp = FakeSmtp().install(monkeypatch)

    result = await EmailTransport(settings).deliver("owner@example.test", BODY)

    assert result.ok is True
    assert len(smtp.calls) == 1
    call = smtp.calls[0]
    assert call.hostname == "smtp.example.test"
    assert call.port == 465
    assert call.to == "owner@example.test"
    assert call.sender == "bot@example.test"
    assert BODY in call.body


async def test_subject_is_the_first_line_cut_to_120(monkeypatch) -> None:
    """Тема — первая строка: в списке писем видно, что случилось, без открытия."""
    settings = _configured(monkeypatch)
    smtp = FakeSmtp().install(monkeypatch)

    await EmailTransport(settings).deliver("owner@example.test", BODY)
    assert smtp.calls[0].subject == "Клиент ждёт ответа 10 мин"

    long_line = "я" * 300
    await EmailTransport(settings).deliver("owner@example.test", long_line + "\nхвост")
    subject = smtp.calls[1].subject
    assert len(subject) <= 120
    assert subject == long_line[:120]


async def test_port_465_uses_tls_and_587_uses_starttls(monkeypatch) -> None:
    """Порт выбирает способ шифрования: 465 — TLS сразу, 587 — STARTTLS.
    Перепутать их значит получить таймаут, а не понятную ошибку."""
    smtp = FakeSmtp().install(monkeypatch)

    settings = _configured(monkeypatch, SMTP_PORT="465")
    await EmailTransport(settings).deliver("owner@example.test", BODY)
    assert smtp.calls[0].kwargs.get("use_tls") is True

    settings = _configured(monkeypatch, SMTP_PORT="587")
    await EmailTransport(settings).deliver("owner@example.test", BODY)
    assert smtp.calls[1].kwargs.get("start_tls") is True


async def test_exception_becomes_a_code_and_never_leaks_the_password(
    monkeypatch, caplog: pytest.LogCaptureFixture
) -> None:
    settings = _configured(monkeypatch)
    FakeSmtp(raises=TimeoutError(f"не достучались до smtp.example.test, пароль {PASSWORD}")).install(
        monkeypatch
    )

    with caplog.at_level(logging.DEBUG):
        result = await EmailTransport(settings).deliver("owner@example.test", BODY)

    assert result.ok is False
    assert result.error == "smtp_TimeoutError"
    logged = caplog.text
    assert PASSWORD not in logged, logged
    assert "smtp.example.test" not in logged, logged


async def test_builder_returns_transport(monkeypatch) -> None:
    settings = _configured(monkeypatch)
    assert isinstance(build_email_transport(settings), EmailTransport)
