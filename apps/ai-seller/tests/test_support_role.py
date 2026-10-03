"""Роль бота собирает разный боевой путь: помощник платформы или продавец.

🔴 Зачем этот файл: инструменты помощника могут быть написаны и покрыты
тестами целиком — и не работать, если боевая сборка канала по-прежнему
ставит инструменты отеля и сборщик заявок. Тогда пользователь платформы
получит вопрос «на какие даты бронируем?» вместо ответа про свою ошибку.

Роль — НАСТРОЙКА, а не правка кода: у следующего заказчика другая роль,
ядро при этом не трогается.
"""

from __future__ import annotations

import logging

import pytest

from src.channels.widget_runner import WidgetSender, build_runner
from src.config import get_settings, normalize_bot_role

# С5 (Q-187) добавил четвёртый инструмент — подписку организации
SUPPORT_TOOLS = ["find_error", "my_recent_errors", "my_subscription", "search_knowledge", "get_requester_context", "get_account_status", "get_permissions", "platform_status", "get_integration_health", "get_reservation_status", "get_workspace_health", "list_capabilities", "propose_action", "confirm_action", "cancel_action", "request_human"]
# ADR-143: у продавца ещё бронь из чата (предложение и оформление после явного «да» гостя)
SELLER_TOOLS = ["check_availability", "get_price", "book_quote", "book_confirm"]


def _engine_of(runner):
    """Движок собранного обработчика: собирается фабрикой, тесту важен итог."""
    factory = getattr(runner, "engine_factory", None)
    return factory() if callable(factory) else runner._engine


def _tool_names() -> list[str]:
    from src.ai.llm import get_cascade_client

    return [s["function"]["name"] for s in get_cascade_client()._tools.specs_for_openai()]


@pytest.fixture
async def build(fake_embedder, fake_redis, monkeypatch: pytest.MonkeyPatch):
    """Боевая сборка канала на подменах: сети и модели здесь нет.

    Роль задаётся переменной окружения — тем же путём, каким её задаёт
    владелец в .env.
    """
    from src.ai.llm import reset_cascade_client
    from src.dependencies import close_resources
    from src.integrations.factory import reset_providers

    def make(role: str):
        monkeypatch.setenv("BOT_ROLE", role)
        get_settings.cache_clear()
        reset_providers()
        reset_cascade_client()
        return build_runner(get_settings())

    try:
        yield make
    finally:
        reset_cascade_client()
        reset_providers()
        get_settings.cache_clear()
        await close_resources()


# ─── Помощник платформы ───


async def test_support_role_puts_support_tools(build) -> None:
    build("support")
    assert _tool_names() == SUPPORT_TOOLS


async def test_support_role_has_no_lead_hook(build) -> None:
    """🔴 Заявки не собираем: человек уже внутри платформы, его контакт
    у платформы есть. Сборщик заявок здесь означал бы «оставьте телефон»
    в ответ на вопрос про отчёт."""
    assert _engine_of(build("support"))._lead_hook is None


async def test_support_role_answers_through_the_widget_sender(build) -> None:
    assert isinstance(_engine_of(build("support"))._sender, WidgetSender)


async def test_support_role_is_plain_text(build) -> None:
    """Виджет внутри платформы: ни разметки, ни эмодзи — это рабочий
    инструмент, а не переписка."""
    engine = _engine_of(build("support"))
    assert engine._markdown is False
    assert engine._emoji is False


# ─── Продавец ───


async def test_seller_role_keeps_hotel_tools(build) -> None:
    build("seller")
    assert _tool_names() == SELLER_TOOLS


async def test_seller_role_keeps_the_lead_writer(build) -> None:
    from src.integrations.lead_writer import LeadWriter

    assert isinstance(_engine_of(build("seller"))._lead_hook, LeadWriter)


# ─── Незнакомая роль ───


async def test_unknown_role_refuses_to_start(build) -> None:
    """🔴 Опечатка в .env не проходит молча. До 26.09 она сводилась к помощнику, и у экземпляра продавца это
    открывало диалоги всех гостиниц без отбора (аудит 26.09, С-60). Теперь бот не стартует: его видно по /health."""
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        build("директор")


async def test_empty_role_falls_back_to_support(build) -> None:
    build("")
    assert _tool_names() == SUPPORT_TOOLS


# ─── Нормализация имени роли ───


@pytest.mark.parametrize("raw", ["support", "SUPPORT", " support "])
def test_normalize_keeps_support(raw: str) -> None:
    assert normalize_bot_role(raw) == "support"


@pytest.mark.parametrize("raw", ["seller", "Seller", " seller "])
def test_normalize_keeps_seller(raw: str) -> None:
    assert normalize_bot_role(raw) == "seller"


@pytest.mark.parametrize("raw", ["", None, "директор", "support2"])
def test_normalize_unknown_is_support(raw, caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.WARNING)
    assert normalize_bot_role(raw) == "support"
    assert caplog.records, f"молчаливый выбор роли для {raw!r}"
