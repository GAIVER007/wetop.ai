"""Шаг 7: выбор реализации внешней системы — настройкой, а не правкой кода.

🔴 Любой неясный режим и любая недонастроенная боевая реализация сводятся
к заглушке с предупреждением в журнал. Молчаливое падение на старте лишило бы
клиентов ответов целиком; заглушка оставляет диалог живым, а предупреждение —
след для владельца.
"""

from __future__ import annotations

import httpx
import pytest

from src.config import Settings, get_settings
from src.integrations.factory import (
    build_providers,
    get_providers,
    reset_providers,
    set_providers,
)
from src.integrations.providers import Providers
from src.integrations.stub import StubProviders


def _settings(**overrides) -> Settings:
    """Настройки теста поверх текущих: окружение ставит фикстура settings_env."""
    return get_settings().model_copy(update=overrides)


def _mock_client() -> httpx.AsyncClient:
    """Клиент без сети: в этих тестах запросов не будет, но реализация
    вправе требовать клиент в конструкторе."""
    return httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(200, json={})))


@pytest.fixture(autouse=True)
def _clean_singleton():
    reset_providers()
    yield
    reset_providers()


def test_stub_mode_builds_stub() -> None:
    providers = build_providers(_settings(integration_mode="stub"))
    assert isinstance(providers, Providers)
    assert providers.mode == "stub"
    assert isinstance(providers.leads, StubProviders)
    assert isinstance(providers.availability, StubProviders)


def test_wetop_without_address_or_key_falls_back_to_stub(caplog: pytest.LogCaptureFixture) -> None:
    """Режим боевой, а подключиться нечем: работаем на заглушке и говорим об этом."""
    caplog.set_level("WARNING")
    providers = build_providers(
        _settings(integration_mode="wetop", integration_base_url="", integration_api_key=""),
        http_client=_mock_client(),
    )
    assert isinstance(providers.leads, StubProviders)
    assert providers.mode == "stub"
    assert caplog.records, "предупреждения в журнале нет"
    assert "wetop" in caplog.text.lower()


def test_wetop_with_key_but_no_address_falls_back_to_stub(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level("WARNING")
    providers = build_providers(
        _settings(integration_mode="wetop", integration_base_url="", integration_api_key="k"),
        http_client=_mock_client(),
    )
    assert isinstance(providers.leads, StubProviders)
    assert caplog.records


def test_unknown_mode_falls_back_to_stub_with_warning(caplog: pytest.LogCaptureFixture) -> None:
    """Опечатка в настройке не должна стоить клиентам ответов."""
    caplog.set_level("WARNING")
    providers = build_providers(_settings(integration_mode="crm-v2"))
    assert isinstance(providers.leads, StubProviders)
    assert providers.mode == "stub"
    assert caplog.records
    assert "crm-v2" in caplog.text


def test_wetop_for_the_seller_wires_only_the_quote(caplog) -> None:
    """Продавец (Q-166 в объёме чтения, ADR-085): наличие и цена своей
    гостиницы; брони из чата нет — заявка остаётся заглушкой (Q-166б,
    ADR-086); ошибки человека и здоровье платформы — пути помощника."""
    from src.integrations.wetop import WetopProviders

    providers = build_providers(
        _settings(
            integration_mode="wetop",
            integration_base_url="https://example.com",
            integration_api_key="test-key",
            bot_role="seller",
        ),
        http_client=_mock_client(),
    )
    assert providers.mode == "wetop"
    assert isinstance(providers.availability, WetopProviders)
    assert isinstance(providers.leads, StubProviders)
    assert providers.incidents is None and providers.health is None


def test_wetop_for_the_support_wires_only_errors_and_health() -> None:
    """Помощник: ошибки человека и состояние платформы своим узким ключом;
    наличие и цены — не его работа."""
    from src.integrations.wetop import WetopProviders

    providers = build_providers(
        _settings(
            integration_mode="wetop",
            integration_base_url="https://example.com",
            integration_api_key="test-key",
            bot_role="support",
        ),
        http_client=_mock_client(),
    )
    assert providers.mode == "wetop"
    assert providers.availability is None
    assert isinstance(providers.incidents, WetopProviders)
    assert isinstance(providers.health, WetopProviders)


def test_singleton_set_and_reset() -> None:
    """Подмена на время теста и возврат к сборке по настройкам."""
    first = get_providers()
    assert get_providers() is first, "синглтон пересобирается на каждый вызов"

    own = StubProviders()
    fake = Providers(orders=own, customers=own, availability=own, leads=own, mode="test")
    set_providers(fake)
    assert get_providers() is fake

    reset_providers()
    rebuilt = get_providers()
    assert rebuilt is not fake
    assert rebuilt.mode == "stub"


def test_default_mode_is_stub() -> None:
    """🔴 По умолчанию — заглушка: пока способ подключения не решён,
    бот не делает вид, что ходит во внешнюю систему."""
    assert Settings.model_fields["integration_mode"].default == "stub"
    assert build_providers(get_settings()).mode == "stub"
