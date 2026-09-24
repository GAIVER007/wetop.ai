"""Шаг 8а: правка части настроек на лету через Redis, по белому списку.

Смысл белого списка: настройка, которую можно менять из панели, — дыра
ровно настолько, насколько список широк.
🔴 Системного промпта в списке нет: его источник правды — файл на томе.
Два источника правды у промпта означают, что однажды поедет тот,
который вы не смотрите.
"""

from __future__ import annotations

import pytest

from src.runtime_settings import (
    all_overrides,
    clear_override,
    effective,
    get_override,
    set_override,
)
from tests.alert_fakes import alert_settings


async def test_allowed_name_is_set_and_read_back(fake_redis, monkeypatch) -> None:
    settings = alert_settings(monkeypatch, LLM_MODEL="base/model")

    await set_override(fake_redis, settings, "llm_model", "other/model")

    assert await get_override(fake_redis, "llm_model") == "other/model"
    assert await effective(fake_redis, settings, "llm_model") == "other/model"


async def test_effective_falls_back_to_settings(fake_redis, monkeypatch) -> None:
    settings = alert_settings(monkeypatch, LLM_MODEL="base/model")
    assert await get_override(fake_redis, "llm_model") is None
    assert await effective(fake_redis, settings, "llm_model") == "base/model"


async def test_name_outside_the_list_is_refused(fake_redis, monkeypatch) -> None:
    settings = alert_settings(monkeypatch)

    with pytest.raises(ValueError) as exc:
        await set_override(fake_redis, settings, "smtp_password", "что-то")

    message = str(exc.value)
    assert "smtp_password" in message
    # Перечисление разрешённых в тексте: оператор должен видеть, что ему можно.
    for name in settings.runtime_settings_allowed_list:
        assert name in message, message
    assert await get_override(fake_redis, "smtp_password") is None


async def test_prompt_is_not_in_the_whitelist(monkeypatch) -> None:
    """🔴 Промпт правится файлом, а не ключом в Redis."""
    settings = alert_settings(monkeypatch)
    allowed = settings.runtime_settings_allowed_list

    assert "prompt_path" not in allowed
    assert not any("prompt" in name for name in allowed), allowed


async def test_clear_returns_the_original_value(fake_redis, monkeypatch) -> None:
    settings = alert_settings(monkeypatch, SLA_SECONDS="300")
    await set_override(fake_redis, settings, "sla_seconds", "60")
    assert await effective(fake_redis, settings, "sla_seconds") == 60

    await clear_override(fake_redis, "sla_seconds")

    assert await get_override(fake_redis, "sla_seconds") is None
    assert await effective(fake_redis, settings, "sla_seconds") == 300


async def test_int_is_cast(fake_redis, monkeypatch) -> None:
    """🔴 Без приведения sla_seconds вернулся бы строкой, и сравнение с числом
    упало бы глубоко в стороже — там, где искать дороже всего."""
    settings = alert_settings(monkeypatch, SLA_SECONDS="300")
    await set_override(fake_redis, settings, "sla_seconds", "900")

    value = await effective(fake_redis, settings, "sla_seconds")
    assert value == 900
    assert isinstance(value, int)


@pytest.mark.parametrize(
    "raw, expected",
    [("1", True), ("true", True), ("yes", True), ("0", False), ("false", False), ("no", False)],
)
async def test_bool_is_cast(fake_redis, monkeypatch, raw: str, expected: bool) -> None:
    settings = alert_settings(monkeypatch, ALERT_HEARTBEAT_ENABLED="true")
    await set_override(fake_redis, settings, "alert_heartbeat_enabled", raw)

    value = await effective(fake_redis, settings, "alert_heartbeat_enabled")
    assert value is expected


async def test_all_overrides_lists_only_what_is_set(fake_redis, monkeypatch) -> None:
    settings = alert_settings(monkeypatch)
    assert await all_overrides(fake_redis, settings) == {}

    await set_override(fake_redis, settings, "llm_model", "other/model")
    await set_override(fake_redis, settings, "guard_max_input_chars", "2000")

    assert await all_overrides(fake_redis, settings) == {
        "llm_model": "other/model",
        "guard_max_input_chars": "2000",
    }


async def test_override_has_no_ttl(fake_redis, monkeypatch) -> None:
    """Настройка, которая молча откатывается через час, — это инцидент,
    который ищут заново каждую ночь. Снимается только явно."""
    settings = alert_settings(monkeypatch)
    await set_override(fake_redis, settings, "llm_model", "other/model")

    assert await fake_redis.ttl("runtime:setting:llm_model") == -1


async def test_broken_redis_gives_the_settings_value(monkeypatch) -> None:
    """Недоступный кэш не должен ронять ход: берём значение из окружения."""
    settings = alert_settings(monkeypatch, SLA_SECONDS="300")

    class BrokenRedis:
        async def get(self, *args, **kwargs):
            raise RuntimeError("redis недоступен")

    assert await effective(BrokenRedis(), settings, "sla_seconds") == 300
