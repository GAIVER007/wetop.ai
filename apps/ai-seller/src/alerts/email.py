"""Почтовый транспорт алертов: SMTP как основной канал уведомлений владельцу.

Реализует Transport из src.channels.outbox: строку из outbox доставляет
повторный цикл, поэтому исключений наружу нет — отказ возвращается кодом
в SendResult, и строка остаётся pending до конца окна повторов.

🔴 Пароль и адрес сервера в журнал не пишутся никогда: журнал уезжает
в разбор инцидента и в чужие руки, а код отказа для разбора достаточен.

⚠️ Порты 25/465/587 у хостеров часто закрыты наружу. Проверяйте доставку
в первый день, а не в день первого настоящего алерта.
"""

from __future__ import annotations

import logging
from email.message import EmailMessage

from src.channels.sender import SendResult
from src.config import Settings

logger = logging.getLogger(__name__)

# Тема письма — первая строка тела. Длинные темы режут почтовые клиенты,
# режем сами, чтобы обрезка была предсказуемой.
SUBJECT_MAX_CHARS = 120
# Ответа ждём не дольше: висящий SMTP не должен держать проход повторов.
SMTP_TIMEOUT_SECONDS = 20
# Порты, на которых TLS ставится явно: 465 — сразу, 587 — через STARTTLS.
PORT_TLS = 465
PORT_STARTTLS = 587


def build_subject(text: str) -> str:
    """Первая непустая строка тела, обрезанная до предела."""
    for line in text.splitlines():
        line = line.strip()
        if line:
            return line[:SUBJECT_MAX_CHARS]
    return text.strip()[:SUBJECT_MAX_CHARS] or "Алерт"


class EmailTransport:
    """Transport для outbox: одно письмо одному адресату.

    Настройки читаются на каждой отправке из Settings, сложенного при старте;
    клиент aiosmtplib импортируется внутри метода — чтобы модуль грузился
    и там, где почта не настроена, и чтобы тесты подменяли отправку.
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def _build_message(self, recipient: str, text: str) -> EmailMessage:
        message = EmailMessage()
        message["Subject"] = build_subject(text)
        message["From"] = self._settings.alert_email_from
        message["To"] = recipient
        message.set_content(text)
        return message

    def _tls_kwargs(self, port: int) -> dict:
        """TLS ставится по порту. Оба флага сразу aiosmtplib не принимает,
        поэтому на прочих портах решает он сам."""
        if port == PORT_TLS:
            return {"use_tls": True}
        if port == PORT_STARTTLS:
            return {"start_tls": True}
        return {}

    async def deliver(self, recipient: str, text: str) -> SendResult:
        """Отправка письма. Исключений наружу нет: отказ — код в SendResult."""
        settings = self._settings
        if not settings.smtp_host or not settings.alert_email_from:
            # Без сервера и отправителя попытка бессмысленна: строка останется
            # pending и уедет в повтор, когда почту настроят.
            logger.warning("email: почта не настроена, отправка пропущена")
            return SendResult(ok=False, error="smtp_not_configured")

        kwargs: dict = {
            "hostname": settings.smtp_host,
            "port": settings.smtp_port,
            "timeout": SMTP_TIMEOUT_SECONDS,
        }
        if settings.smtp_user:
            kwargs["username"] = settings.smtp_user
        if settings.smtp_password:
            kwargs["password"] = settings.smtp_password
        kwargs.update(self._tls_kwargs(settings.smtp_port))

        try:
            # 🔴 Импорт внутри попытки: модуль алертов грузится и там, где
            # почта не настроена и клиент не поставлен, а отсутствие пакета —
            # такой же отказ доставки, как и любой другой, а не падение хода.
            import aiosmtplib

            await aiosmtplib.send(self._build_message(recipient, text), **kwargs)
        except Exception as exc:  # noqa: BLE001 — текст исключения несёт адрес сервера
            # 🔴 В журнал только тип: текст исключения aiosmtplib содержит
            # хост, а иногда и строку авторизации.
            code = f"smtp_{type(exc).__name__}"[:80]
            logger.warning("email: отказ %s", code)
            return SendResult(ok=False, error=code)
        logger.info("email: письмо отправлено")
        return SendResult(ok=True)


def build_email_transport(settings: Settings) -> EmailTransport:
    """Сборка транспорта для реестра транспортов outbox."""
    return EmailTransport(settings)
