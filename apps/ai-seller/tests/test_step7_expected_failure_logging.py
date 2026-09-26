"""Штатная недоступность и настоящий сбой пишутся в журнал по-разному.

ProviderUnavailable объявлен в интерфейсе: это ожидаемое состояние внешней
системы, а не дефект. Трассировка на каждый обрыв связи топит в журнале
настоящие ошибки, а разбор инцидента начинается с чтения именно их.
"""

import logging

import pytest

from src.ai.hotel_tools import UNKNOWN, build_registry
from src.integrations.providers import Providers, ProviderUnavailable

ARGS = {"arrival": "2099-10-01", "departure": "2099-10-03", "guests": 1, "category": "койка"}


class _Dead:
    """Система недоступна: штатная для интерфейса ситуация."""

    async def check(self, *_args, **_kwargs):
        raise ProviderUnavailable("connection")

    async def quote(self, *_args, **_kwargs):
        raise ProviderUnavailable("connection")


class _Broken:
    """Настоящий дефект реализации: интерфейс такого не обещал."""

    async def check(self, *_args, **_kwargs):
        raise TypeError("реализация провайдера сломана")

    async def quote(self, *_args, **_kwargs):
        raise TypeError("реализация провайдера сломана")


def _providers(impl):
    return Providers(orders=None, customers=None, availability=impl, leads=None, mode="test")


def _tool(impl, name):
    registry = build_registry(lambda: _providers(impl))
    return registry._specs[name].handler


@pytest.mark.parametrize("name", ["check_availability", "get_price"])
async def test_expected_unavailability_is_a_warning_without_traceback(
    name: str, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)
    assert await _tool(_Dead(), name)(**ARGS) == UNKNOWN

    records = [r for r in caplog.records if r.name.startswith("src.ai.hotel_tools")]
    assert records, "штатная недоступность не должна проходить молча"
    assert all(r.levelno == logging.WARNING for r in records)
    assert all(r.exc_info is None for r in records), "трассировки у ожидаемого отказа быть не должно"
    assert any("connection" in r.getMessage() for r in records), "код отказа нужен для разбора"


@pytest.mark.parametrize("name", ["check_availability", "get_price"])
async def test_unexpected_failure_keeps_the_traceback(
    name: str, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)
    assert await _tool(_Broken(), name)(**ARGS) == UNKNOWN

    records = [r for r in caplog.records if r.name.startswith("src.ai.hotel_tools")]
    assert any(r.levelno == logging.ERROR and r.exc_info for r in records), (
        "непредвиденный сбой разбирают по трассировке"
    )


class _DeadSink:
    async def create_lead(self, *_args, **_kwargs):
        raise ProviderUnavailable("connection")


class _BrokenSink:
    async def create_lead(self, *_args, **_kwargs):
        raise TypeError("реализация приёмника сломана")


async def _write(sink, sessionmaker, redis, settings):
    from src.integrations.lead_writer import LeadNotWritten, LeadWriter

    writer = LeadWriter(
        sessionmaker=sessionmaker,
        redis=redis,
        providers_getter=lambda: Providers(
            orders=None, customers=None, availability=None, leads=sink, mode="test"
        ),
        settings=settings,
    )
    import uuid

    with pytest.raises(LeadNotWritten):
        await writer(uuid.uuid4(), {"name": "Пётр", "phone": "+7 701 000 00 00"})


async def test_lead_sink_unavailability_is_a_warning(
    migrated_db, fake_redis, caplog: pytest.LogCaptureFixture
) -> None:
    from src.config import get_settings
    from src.dependencies import get_sessionmaker

    caplog.set_level(logging.DEBUG)
    await _write(_DeadSink(), get_sessionmaker(), fake_redis, get_settings())

    records = [r for r in caplog.records if r.name.startswith("src.integrations.lead_writer")]
    assert records, "потерянная заявка не должна проходить молча"
    assert not any(r.exc_info for r in records), "у ожидаемого отказа трассировки быть не должно"
    assert any("connection" in r.getMessage() for r in records)


async def test_broken_lead_sink_keeps_the_traceback(
    migrated_db, fake_redis, caplog: pytest.LogCaptureFixture
) -> None:
    from src.config import get_settings
    from src.dependencies import get_sessionmaker

    caplog.set_level(logging.DEBUG)
    await _write(_BrokenSink(), get_sessionmaker(), fake_redis, get_settings())

    records = [r for r in caplog.records if r.name.startswith("src.integrations.lead_writer")]
    assert any(r.levelno == logging.ERROR and r.exc_info for r in records)
