"""Выбор реализации внешней системы по настройке.

Режим меняется настройкой, а не правкой кода: у следующего заказчика другая
система — добавляется файл реализации и ветка здесь, ядро (providers.py)
не трогается.

🔴 Недонастроенный или незнакомый режим не роняет сервис: работаем на
заглушке и говорим об этом в журнал. Падение на старте из-за опечатки
в .env оставит клиентов без ответа вообще, а заглушка честно скажет
«уточнит администратор».
"""

from __future__ import annotations

import logging

import httpx

from src import dependencies
from src.config import Settings, get_settings
from src.config import normalize_bot_role
from src.integrations.providers import Providers
from src.integrations.stub import StubProviders

logger = logging.getLogger(__name__)

MODE_STUB = "stub"
MODE_WETOP = "wetop"


def _stub() -> Providers:
    """Один объект заглушки на все роли продавца.

    🔴 incidents и health остаются None намеренно: инструменты помощника
    ответят «не знаю». Подставить сюда заглушку значило бы сказать человеку
    «всё работает» и «ошибок у вас нет» тогда, когда мы просто не смотрели.
    """
    stub = StubProviders()
    return Providers(
        orders=stub, customers=stub, availability=stub, leads=stub, mode=MODE_STUB,
        incidents=None, health=None,
    )


def build_providers(
    settings: Settings, *, http_client: httpx.AsyncClient | None = None
) -> Providers:
    """Собирает набор провайдеров по settings.integration_mode."""
    mode = (settings.integration_mode or "").strip().lower()

    if mode == MODE_WETOP:
        if not settings.integration_base_url or not settings.integration_api_key:
            logger.warning("режим wetop без адреса или ключа, работаем на заглушке")
            return _stub()
        # Импорт ленивый: реализация под заказчика не должна грузиться там,
        # где её не включали (и не должна ломать старт, если её выбросили).
        from src.integrations.wetop import WetopProviders

        # Через модуль, а не импортом имени: тесты подменяют get_http_client.
        client = http_client or dependencies.get_http_client()
        wetop = WetopProviders(settings, client)
        role = normalize_bot_role(settings.bot_role)
        if role == "seller":
            # Продавец (Q-166 в объёме чтения, ADR-085): наличие и цена своей
            # гостиницы узким ключом котировки. Брони из чата НЕТ — заявка
            # остаётся как была (заглушка, lead_data + панель) до базы в РК
            # (Q-166б, ADR-086); ошибки человека и здоровье — пути помощника.
            stub = StubProviders()
            return Providers(
                orders=None, customers=None, availability=wetop, leads=stub,
                mode=MODE_WETOP, incidents=None, health=None,
            )
        # Помощник: ошибки человека и состояние платформы (ТЗ, Б1 поверх П4)
        # своим узким ключом ASSISTANT_READ_KEY; наличие и цены — не его работа.
        return Providers(
            orders=None,
            customers=None,
            availability=None,
            leads=StubProviders(),
            mode=MODE_WETOP,
            incidents=wetop,
            health=wetop,
        )

    if mode != MODE_STUB:
        logger.warning(
            "неизвестный режим внешней системы %r, работаем на заглушке", mode
        )
    return _stub()


# ─── Синглтон ───


class _Holder:
    """Держатель синглтона: один объект вместо голого глобала."""

    def __init__(self) -> None:
        self.providers: Providers | None = None


_holder = _Holder()


def get_providers() -> Providers:
    """Один набор на процесс: провайдер держит соединения и настройки."""
    if _holder.providers is None:
        _holder.providers = build_providers(get_settings())
    return _holder.providers


def set_providers(providers: Providers | None) -> None:
    """Подмена для тестов и песочницы."""
    _holder.providers = providers


def reset_providers() -> None:
    """Следующий get_providers() соберёт заново (после смены настроек)."""
    _holder.providers = None
