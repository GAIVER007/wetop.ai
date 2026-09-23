"""Шаг 8а: новые настройки есть и в Settings, и в env.example, и скрипт бэкапа на месте.

Настройка, которой нет в env.example, не существует: её не поставит ни один
заказчик, и она молча останется со значением по умолчанию.
"""

from __future__ import annotations

import re
import stat
from pathlib import Path

import pytest

from src.config import Settings, get_settings

ROOT = Path(__file__).resolve().parent.parent
ENV_NAME_RE = re.compile(r"^([A-Z_]+)=", re.MULTILINE)

NEW_NAMES = [
    "ALERT_RATE_LIMIT_PER_HOUR",
    "ALERT_TELEGRAM_API_BASE",
    "ALERT_TELEGRAM_API_BASES",
    "RUNTIME_SETTINGS_ALLOWED",
    "BACKUP_KEEP_DAYS",
]


def _env_text() -> str:
    return (ROOT / "env.example").read_text(encoding="utf-8")


@pytest.mark.parametrize("name", NEW_NAMES)
def test_new_variable_is_in_env_example(name: str) -> None:
    assert name in set(ENV_NAME_RE.findall(_env_text())), name


@pytest.mark.parametrize("name", NEW_NAMES)
def test_new_variable_is_a_settings_field(name: str) -> None:
    assert name.lower() in Settings.model_fields, name


def test_api_bases_are_split_in_order(monkeypatch: pytest.MonkeyPatch) -> None:
    """🔴 Порядок сохраняется дословно: в инциденте рабочий адрес стоял
    последним, и перебор упирался в таймаут раньше, чем доходил до живого."""
    monkeypatch.setenv("ALERT_TELEGRAM_API_BASES", "https://a.test, https://b.test ,,")
    get_settings.cache_clear()
    assert get_settings().alert_telegram_api_base_list == ["https://a.test", "https://b.test"]


def test_empty_api_bases_fall_back_to_the_alert_base(monkeypatch: pytest.MonkeyPatch) -> None:
    """Запасной адрес у бота алертов свой: канала клиентов, у которого его
    раньше одалживали, больше нет."""
    monkeypatch.setenv("ALERT_TELEGRAM_API_BASES", "")
    monkeypatch.setenv("ALERT_TELEGRAM_API_BASE", "https://api.test")
    get_settings.cache_clear()
    assert get_settings().alert_telegram_api_base_list == ["https://api.test"]


def test_email_to_is_split(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ALERT_EMAIL_TO", "one@example.test, two@example.test,")
    get_settings.cache_clear()
    assert get_settings().alert_email_to_list == ["one@example.test", "two@example.test"]

    monkeypatch.setenv("ALERT_EMAIL_TO", "")
    get_settings.cache_clear()
    assert get_settings().alert_email_to_list == []


def test_runtime_whitelist_is_split_and_has_no_prompt() -> None:
    get_settings.cache_clear()
    allowed = get_settings().runtime_settings_allowed_list
    assert "llm_model" in allowed
    assert "sla_seconds" in allowed
    # 🔴 Источник правды промпта — файл, а не ключ в Redis.
    assert not any("prompt" in name for name in allowed), allowed


def test_rate_limit_default_is_a_number() -> None:
    get_settings.cache_clear()
    assert get_settings().alert_rate_limit_per_hour == 10
    assert get_settings().backup_keep_days == 14


# ─── Скрипт бэкапа ───


def test_backup_script_exists_and_is_a_shell_script() -> None:
    script = ROOT / "scripts" / "backup.sh"
    assert script.exists(), "нет scripts/backup.sh"
    text = script.read_text(encoding="utf-8")
    assert text.startswith("#!/"), "нет строки запуска"
    assert "set -euo pipefail" in text, "без этого ошибка в середине проходит незамеченной"


def test_backup_script_mentions_restoring() -> None:
    """🔴 Бэкап не существует, пока из него не восстановились. Правило должно
    стоять в шапке скрипта: его читают тогда, когда уже поздно спрашивать."""
    text = (ROOT / "scripts" / "backup.sh").read_text(encoding="utf-8")
    assert "восстанов" in text.lower(), "нет упоминания восстановления"


def test_backup_script_keeps_the_password_out_of_the_command_line() -> None:
    """Аргументы процесса видит любой, кто выполнит ps."""
    text = (ROOT / "scripts" / "backup.sh").read_text(encoding="utf-8")
    assert "PGPASSWORD" in text
    assert "--password=" not in text
    assert "-W " not in text


def test_backup_script_is_executable() -> None:
    mode = (ROOT / "scripts" / "backup.sh").stat().st_mode
    assert mode & stat.S_IXUSR, "скрипт без бита запуска cron не выполнит"


def test_backup_script_uses_the_keep_days_setting() -> None:
    text = (ROOT / "scripts" / "backup.sh").read_text(encoding="utf-8")
    assert "BACKUP_KEEP_DAYS" in text
    assert "BACKUP_DIR" in text


def test_backup_script_holds_no_secrets() -> None:
    """Пароли, адреса серверов и почта заказчика в репозиторий не попадают."""
    text = (ROOT / "scripts" / "backup.sh").read_text(encoding="utf-8")
    # Присваивание в начале строки — это значение; в комментарии-примере нет.
    assert not re.search(
        r"^\s*(export\s+)?PGPASSWORD\s*=\s*\S", text, re.MULTILINE
    ), "пароль вписан в скрипт"
    assert "@" not in text, "похоже на адрес почты или сервера в скрипте"


# ─── Настройки, оставшиеся от шага 7 ───

UNUSED_ALERT_NAMES = ["ALERT_TRANSPORT", "ALERT_RECIPIENT"]


def _comment_for(text: str, name: str) -> str:
    """Комментарий над настройкой: это всё, что прочитает тот, кто настраивает
    бота у заказчика. Сама строка присваивания не в счёт — в ней нет объяснения."""
    lines = text.splitlines()
    idx = next(i for i, line in enumerate(lines) if line.startswith(f"{name}="))
    block: list[str] = []
    i = idx - 1
    while i >= 0 and lines[i].lstrip().startswith("#"):
        block.append(lines[i])
        i -= 1
    return "\n".join(block)


@pytest.mark.parametrize("name", UNUSED_ALERT_NAMES)
def test_unused_alert_variable_does_not_promise_delivery(name: str) -> None:
    """🔴 Настройка, которая есть и ничего не делает, хуже отсутствующей.

    После шага 8а получателей задают ALERT_EMAIL_TO и ALERT_TELEGRAM_CHAT_ID,
    а эти три имени не читает ни один модуль. Заказчик, заполнивший
    ALERT_RECIPIENT, узнает об этом в день первого настоящего алерта.
    """
    block = _comment_for(_env_text(), name).lower()
    assert "не использ" in block, f"{name} описан как рабочий"
    assert "alert_email_to" in block or "alert_telegram_chat_id" in block, (
        f"{name}: не сказано, чем задаются адресаты"
    )


def test_personal_chat_is_wired_and_documented() -> None:
    """Обратная сторона правила: настройка, которая обещана, обязана работать.

    Личный адрес владельца получает алерт отдельной строкой очереди —
    и в образце окружения об этом сказано, иначе его никто не заполнит.
    """
    source = (ROOT / "src" / "alerts" / "raise_alert.py").read_text(encoding="utf-8")
    assert "alert_telegram_chat_id_personal" in source, (
        "личный адрес обещан образцом окружения и должен читаться кодом"
    )
    block = _comment_for(_env_text(), "ALERT_TELEGRAM_CHAT_ID_PERSONAL").lower()
    assert "не использ" not in block, "комментарий устарел: настройка работает"
    assert "отдельн" in block, "надо сказать, что это отдельная строка доставки"
