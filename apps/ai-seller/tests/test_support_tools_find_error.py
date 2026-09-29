"""Инструмент find_error: справочник ошибок платформы глазами модели.

🔴 Правило шага 7: «не найдено» и «справочника нет» — это ПРИЗНАК-строка,
а не исключение. Исключение уронило бы ход, а человеку нужен ответ.

🔴 И главное правило захода: не нашли — говорим «не знаю». Ближайшая запись
вместо ответа отправит человека чинить не то.
"""

from __future__ import annotations

import logging
from pathlib import Path

import pytest

from src.ai.support_tools import UNKNOWN, build_registry
from tests.support_fakes import (
    SAMPLE_CATALOG,
    call_tool,
    support_providers,
    support_settings,
    write_catalog,
)

ADULTS = "adults — целое ≥ 1"
TOOLS = ["find_error", "my_recent_errors", "my_subscription", "search_knowledge", "get_requester_context", "get_account_status", "get_permissions", "platform_status", "get_integration_health", "get_reservation_status", "get_workspace_health"]


@pytest.fixture(autouse=True)
def clean_catalog_cache():
    from src.knowledge.catalog import reset_catalog_cache

    reset_catalog_cache()
    yield
    reset_catalog_cache()


def registry_for(catalog: Path | str | None, *, visitor=None, providers=None):
    """Реестр помощника: справочник, настройки и посетитель — снаружи."""
    settings = support_settings(catalog=catalog)
    return build_registry(
        lambda: providers if providers is not None else support_providers(),
        settings_getter=lambda: settings,
        visitor_getter=lambda: visitor,
    )


@pytest.fixture
def registry(tmp_path: Path):
    return registry_for(write_catalog(tmp_path, SAMPLE_CATALOG))


# ─── Реестр ───


def test_registry_exposes_the_support_tools(registry) -> None:
    names = [spec["function"]["name"] for spec in registry.specs_for_openai()]
    assert names == TOOLS


def test_descriptions_forbid_inventing_a_cause(registry) -> None:
    """Описание — единственное, что модель читает перед вызовом. Запрет
    выдумывать причину должен стоять именно там, а не только в коде."""
    for spec in registry.specs_for_openai():
        text = spec["function"]["description"].lower()
        assert "не знаю" in text, spec["function"]["name"]
        assert "придум" in text or "выдум" in text, spec["function"]["name"]
        assert "специалист" in text or "человек" in text, spec["function"]["name"]


# ─── Нашли ───


async def test_known_error_by_text(registry) -> None:
    answer = await call_tool(registry, "find_error", message=f"при сохранении брони «{ADULTS}»", code=None)
    assert answer != UNKNOWN
    assert "Гостей" in answer, "в ответе нет причины"
    assert "взрослого" in answer, "в ответе нет того, что делать"
    assert "ожидаемое поведение" in answer, "в ответе нет состояния"


async def test_known_error_by_code(registry) -> None:
    """Код у платформы появится позже — поиск по нему уже работает."""
    answer = await call_tool(registry, "find_error", message="отчёт", code="RPT-EMPTY")
    assert "известный дефект" in answer
    assert "половинам периода" in answer


async def test_unknown_code_falls_back_to_text(registry) -> None:
    """🔴 Кодов у платформы нет, модель их выдумывает. Выдуманный код не
    должен рушить поиск: ищем дальше по тексту."""
    answer = await call_tool(registry, "find_error", message=f"пишет «{ADULTS}»", code="E-500")
    assert "Гостей" in answer


async def test_answer_has_no_file_paths(tmp_path: Path) -> None:
    """🔴 Внутренних путей в ответе нет: это правило vykatka.md про публичные
    адреса, и оно же про то, что бот говорит человеку."""
    path = write_catalog(tmp_path, SAMPLE_CATALOG)
    answer = await call_tool(registry_for(path), "find_error", message=ADULTS, code=None)
    assert str(path) not in answer
    assert "errors.md" not in answer


# ─── Не нашли ───


async def test_unknown_message_is_unknown(registry) -> None:
    """🔴 ГЛАВНОЕ: чужой текст — «не знаю», а не ближайшая запись."""
    assert await call_tool(registry, "find_error", message="не приходит письмо о брони", code=None) == UNKNOWN


async def test_empty_message_is_unknown(registry) -> None:
    assert await call_tool(registry, "find_error", message="", code=None) == UNKNOWN


async def test_missing_catalog_is_unknown_not_a_crash(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    """Справочника нет — инструмент отвечает признаком и предупреждает
    в журнал. Исключение отсюда уронило бы весь ход."""
    caplog.set_level(logging.WARNING)
    registry = registry_for(tmp_path / "нет-такого.md")
    assert await call_tool(registry, "find_error", message=ADULTS, code=None) == UNKNOWN
    assert caplog.records, "пропавший справочник прошёл молча"
    assert "Traceback" not in caplog.text, "штатная нехватка файла не трассировка"


async def test_empty_catalog_is_unknown(tmp_path: Path) -> None:
    """Владелец ещё не заполнил справочник: это «не знаю», а не поломка."""
    registry = registry_for(write_catalog(tmp_path, ""))
    assert await call_tool(registry, "find_error", message=ADULTS, code=None) == UNKNOWN


async def test_message_may_be_omitted_by_the_model(registry) -> None:
    """Модель зовёт инструмент без обязательного аргумента чаще, чем хочется.
    Это «не знаю», а не сбой обработчика."""
    answer = await call_tool(registry, "find_error", message=None, code=None)
    assert answer == UNKNOWN


async def test_unknown_phrase_is_the_same_everywhere() -> None:
    """Одна честная фраза на все «не знаю»: по разным формулировкам модель
    начнёт догадываться, какая из них означает «можно и самому придумать»."""
    assert UNKNOWN == "не знаю: уточнит человек"
