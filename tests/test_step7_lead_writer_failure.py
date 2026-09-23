"""Шаг 7: заявка не записалась — и об этом известно.

🔴 Ключ «уже сделано» ставится только после успеха. Иначе сбой внешней
системы навсегда пометил бы лид как отданный: менеджер не позвонит,
а в панели будет написано, что заявка создана.

LeadNotWritten поднимается наружу намеренно: по нему движок НЕ ставит
lead_created_at, и попытка повторится на следующем ходе.
"""

from __future__ import annotations

import pytest

from src.db.base import OutboxKind
from src.integrations.lead_writer import LeadNotWritten, natural_key
from src.integrations.providers import ProviderUnavailable
from tests.integration_fakes import (  # noqa: F401 — фикстура lead_env
    NAME,
    PHONE,
    lead_data,
    lead_env,
    new_conversation_id,
)


def _done_key(conversation_id, lead: dict) -> str:
    return "lead:done:" + natural_key(conversation_id, lead)


async def test_unavailable_provider_raises_and_leaves_no_done_key(lead_env) -> None:
    lead_env.providers.raise_on = {"create_lead"}
    conversation_id = new_conversation_id()
    lead = lead_data()

    with pytest.raises(LeadNotWritten):
        await lead_env.writer()(conversation_id, lead)

    # 🔴 Ключа нет: иначе повтора не будет никогда.
    assert await lead_env.redis.get(_done_key(conversation_id, lead)) is None

    rows = await lead_env.outbox()
    assert len(rows) == 1
    assert rows[0].kind is OutboxKind.ALERT
    assert rows[0].dedup_key == "leadfail:" + natural_key(conversation_id, lead)
    for secret in (PHONE, NAME):
        assert secret not in rows[0].body


async def test_unexpected_provider_error_is_also_not_written(lead_env) -> None:
    """Провайдер упал не ProviderUnavailable, а чем угодно: вывод тот же —
    заявка не записана, и молчать об этом нельзя."""

    class Exploding:
        """Приёмник заявок, который ломается не по нашему протоколу."""

        async def create_lead(self, natural_key: str, payload: dict):
            raise ValueError("внешняя система ответила мусором")

    facade = lead_env.providers.as_providers()
    facade.leads = Exploding()
    with pytest.raises(LeadNotWritten):
        await lead_env.writer(facade)(new_conversation_id(), lead_data())
    assert [row.dedup_key.split(":")[0] for row in await lead_env.outbox()] == ["leadfail"]


async def test_retry_after_provider_recovers_creates_the_lead(lead_env) -> None:
    """Следующий ход с починенной системой: заявка создаётся, ключ ставится,
    приходит алерт о горячем лиде."""
    lead_env.providers.raise_on = {"create_lead"}
    conversation_id = new_conversation_id()
    lead = lead_data()
    writer = lead_env.writer()

    with pytest.raises(LeadNotWritten):
        await writer(conversation_id, lead)

    lead_env.providers.fix()
    await writer(conversation_id, lead)

    assert lead_env.providers.count("create_lead") == 2  # первая попытка и удачная
    assert await lead_env.redis.get(_done_key(conversation_id, lead))
    kinds = [row.dedup_key.split(":")[0] for row in await lead_env.outbox()]
    assert kinds == ["leadfail", "hotlead"]

    # Третий вызов уже не идёт наружу: заявка есть.
    await writer(conversation_id, lead)
    assert lead_env.providers.count("create_lead") == 2


async def test_missing_lead_sink_raises_and_alerts(lead_env, caplog: pytest.LogCaptureFixture) -> None:
    """Приёмника заявок нет (режим не настроен) — это не «успех по умолчанию»:
    лид не потерян, попытка повторится, владелец предупреждён."""
    caplog.set_level("WARNING")
    conversation_id = new_conversation_id()
    lead = lead_data()

    with pytest.raises(LeadNotWritten):
        await lead_env.writer(lead_env.providers.without_leads())(conversation_id, lead)

    assert await lead_env.redis.get(_done_key(conversation_id, lead)) is None
    rows = await lead_env.outbox()
    assert len(rows) == 1
    assert "lead_no_provider" in (rows[0].dedup_key or "") + rows[0].body
    assert caplog.records


async def test_provider_unavailable_never_leaks_to_the_caller(lead_env) -> None:
    """Наружу выходит только LeadNotWritten: движок ловит любое исключение,
    но своя ошибка в журнале читается однозначно."""
    lead_env.providers.raise_on = {"create_lead"}
    with pytest.raises(LeadNotWritten) as excinfo:
        await lead_env.writer()(new_conversation_id(), lead_data())
    assert not isinstance(excinfo.value, ProviderUnavailable)
    assert issubclass(LeadNotWritten, RuntimeError)


async def test_broken_idempotency_check_also_alerts_the_operator(lead_env) -> None:
    """🔴 Проверить «уже сделано» нечем — заявка не записана, и оператор
    обязан узнать об этом: строка в журнале контейнера уедет с контейнером.
    """
    from src.integrations.lead_writer import LeadWriter

    class BrokenRedis:
        """Redis лёг ровно на проверке отметки."""

        async def get(self, key: str):
            raise ConnectionError("redis недоступен")

    conversation_id = new_conversation_id()
    lead = lead_data()
    writer = LeadWriter(
        sessionmaker=lead_env.sessionmaker,
        redis=BrokenRedis(),
        providers_getter=lead_env.providers.as_providers,
        settings=lead_env.settings,
    )

    with pytest.raises(LeadNotWritten):
        await writer(conversation_id, lead)

    assert lead_env.providers.count("create_lead") == 0, "наружу не ходим, пока не знаем, писали ли уже"
    rows = await lead_env.outbox()
    assert len(rows) == 1
    assert rows[0].dedup_key == "leadidem:" + natural_key(conversation_id, lead)
    for secret in (PHONE, NAME):
        assert secret not in rows[0].body
