"""Скелет системного промпта помощника платформы.

Промпт — ДАННЫЕ: его правит владелец под свою платформу. Но скелет лежит
в репозитории, и тест сторожит в нём ровно две вещи:
🔴 правило «не выдумывать причину ошибки» из него не исчезло — на нём
   держится весь заход;
🔴 в нём нет ни одного настоящего адреса, телефона или ключа: файл
   в репозитории, а секрет оттуда уже не убрать.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
PROMPT = ROOT / "sistemnyy-prompt-pomoshchnik.md"
TOOLS = ["find_error", "my_recent_errors", "platform_status"]
# Разделы устройства промпта: как в sistemnyy-prompt.md кита.
SECTIONS = ["Роль", "Границы", "Инструменты"]


@pytest.fixture(scope="module")
def text() -> str:
    assert PROMPT.exists(), f"нет файла {PROMPT.name}"
    return PROMPT.read_text(encoding="utf-8")


def test_file_is_not_empty(text: str) -> None:
    assert len(text.strip()) > 500, "скелет промпта пустой"


@pytest.mark.parametrize("section", SECTIONS)
def test_has_section(text: str, section: str) -> None:
    """Устройство промпта — не украшение: по нему владелец понимает,
    куда дописывать своё."""
    # Нумерация разделов в промпте допустима: «## 1. Роль».
    assert re.search(rf"^#+\s*(?:\d+[.)]\s*)?{section}\b", text, re.MULTILINE | re.IGNORECASE), section


def test_forbids_inventing_the_cause(text: str) -> None:
    """🔴 Главное правило захода стоит в промпте словами, а не подразумевается."""
    lowered = text.lower()
    assert "причин" in lowered
    assert "не придумыв" in lowered or "не выдумыв" in lowered
    assert "не знаю" in lowered


def test_forbids_promising_a_fix(text: str) -> None:
    """Бот не чинит код: обещание «починили» без подтверждения — ложь,
    а автоматической починки в этом заходе нет вовсе."""
    lowered = text.lower()
    assert "почин" in lowered or "исправ" in lowered


def test_forbids_internal_details(text: str) -> None:
    """Трассировки и имена таблиц человеку не показываем."""
    lowered = text.lower()
    assert "трассиров" in lowered or "стек" in lowered
    assert "табли" in lowered


def test_calls_a_human(text: str) -> None:
    """Не знаешь — зови специалиста. Без этого «не знаю» превращается в тупик."""
    lowered = text.lower()
    assert "специалист" in lowered or "человек" in lowered


def test_it_is_not_a_seller(text: str) -> None:
    """Роль другая: продавать внутри платформы некому."""
    lowered = text.lower()
    variants = ("не продавец", "не продаём", "не продаем", "не продаёшь", "не продавай", "ничего не прода")
    assert any(v in lowered for v in variants), "в промпте не сказано, что бот не продавец"


@pytest.mark.parametrize("tool", TOOLS)
def test_mentions_every_tool(text: str, tool: str) -> None:
    """Инструмент, не описанный в промпте, модель не позовёт."""
    assert tool in text, tool


def test_has_placeholders_for_the_platform(text: str) -> None:
    """Плейсхолдеры в фигурных скобках: владелец подставляет своё,
    не переписывая промпт заново."""
    assert re.search(r"\{[^{}\n]{2,60}\}", text), "нет ни одного плейсхолдера"


# ─── Секретов нет ───


def test_no_real_addresses(text: str) -> None:
    """🔴 Адрес в репозитории — это адрес навсегда. В образце его быть не может."""
    urls = [u for u in re.findall(r"https?://[^\s)\]\"'`]+", text) if "example." not in u]
    assert not urls, f"в скелете есть адрес: {urls}"


def test_no_real_phones(text: str) -> None:
    """Телефон заказчика — персональные данные, а не пример."""
    digits = re.findall(r"\+?\d[\d\s\-()]{9,}\d", text)
    assert not digits, f"в скелете есть телефон: {digits}"


def test_no_real_emails(text: str) -> None:
    emails = [e for e in re.findall(r"[\w.+-]+@[\w.-]+\.\w+", text) if "example." not in e]
    assert not emails, f"в скелете есть почта: {emails}"


def test_no_keys(text: str) -> None:
    """Приметные слова ключей: пусть падает тест, а не разбор инцидента."""
    lowered = text.lower()
    for word in ("api_key", "secret=", "bearer ", "password"):
        assert word not in lowered, word
