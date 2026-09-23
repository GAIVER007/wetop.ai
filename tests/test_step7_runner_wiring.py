"""Шаг 7: внешняя система подключена к ЖИВОМУ пути, а не только к тестам.

🔴 Зачем этот файл: LeadWriter и инструменты могут быть написаны и покрыты
тестами полностью — и всё равно не работать, если боевая сборка канала
собирает движок без хука, а каскад — с пустым реестром. Тогда заявка наружу
не пишется никогда, алерт «горячий лид» не приходит, а обещание «оператор
получит алерт» держится только на тестах.

Канал сменился с мессенджера на виджет, свойство осталось прежним: сторожим
сборку боевого пути, а не конкретную дверь.

Песочницы панели это не касается: она наружу писать не должна.
"""

from __future__ import annotations

import pytest

from src.channels.widget import WidgetSender, build_runner
from src.config import get_settings
from src.integrations.factory import get_providers, reset_providers
from src.integrations.lead_writer import LeadWriter


def _engine_of(runner):
    """Движок собранного обработчика. Собирается он фабрикой (каждый ход —
    свой движок) либо один раз при сборке; тесту важен результат."""
    factory = getattr(runner, "engine_factory", None)
    return factory() if callable(factory) else runner._engine


@pytest.fixture
async def runner(fake_embedder, fake_redis):
    """Боевая сборка канала на подменах: сети и модели здесь нет."""
    from src.ai.llm import reset_cascade_client
    from src.dependencies import close_resources

    reset_providers()
    reset_cascade_client()
    built = build_runner(get_settings())
    try:
        yield built
    finally:
        reset_cascade_client()
        reset_providers()
        await close_resources()


def test_runner_engine_has_the_lead_hook(runner) -> None:
    """Хук на месте — иначе собранный лид никуда не уходит."""
    hook = _engine_of(runner)._lead_hook  # сборка приватная, проверяем результат
    assert isinstance(hook, LeadWriter)


def test_lead_hook_takes_providers_from_the_factory(runner) -> None:
    """Провайдеры берутся фабрикой по настройке, а не зашиты в канал:
    смена режима — правка .env, а не кода."""
    hook = _engine_of(runner)._lead_hook
    assert hook._providers_getter is get_providers
    assert hook._providers_getter().mode == "stub"


def test_model_sees_both_tools(runner) -> None:
    """Реестр отдан каскаду: без этого модель про наличие и цену не спросит."""
    from src.ai.llm import get_cascade_client

    names = [spec["function"]["name"] for spec in get_cascade_client()._tools.specs_for_openai()]
    assert names == ["check_availability", "get_price"]


def test_engine_answers_through_the_widget_sender(runner) -> None:
    """🔴 Ответ уходит отправителем виджета, а не в очередь исходящих:
    канал с вытягиванием, доставка — это запись в историю, видимая опросом."""
    assert isinstance(_engine_of(runner)._sender, WidgetSender)
