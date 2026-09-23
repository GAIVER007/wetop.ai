"""ОСТАНОВКА 3: внешняя система недоступна целиком.

🔴 Что показывает этот файл: клиент не видит ни ошибки, ни выдуманного
ответа. Справочник мест, расчёт и приёмник заявок лежат все сразу —
и всё равно приходит осмысленная человеческая фраза, оператор получает
алерт, а исключение наружу не выходит.

Модель здесь пересказывает вывод инструмента дословно (ToolCallingLlm):
это худший случай. Если бы инструмент отдал текст отказа или число мест,
клиент увидел бы его, и тест бы упал.
"""

from __future__ import annotations

import json
import re

import pytest

from src.ai.hotel_tools import build_registry
from src.integrations.lead_writer import LeadWriter
from tests.engine_fakes import (  # noqa: F401 — фикстура engine_env
    MemorySender,
    engine_env,
    incoming,
    load_conversation,
    load_messages,
    roles,
)
from tests.integration_fakes import (  # noqa: F401 — фикстура alert_spy
    NAME,
    PHONE_TYPED,
    FakeProviders,
    ToolCallingLlm,
    alert_spy,
    tool_call,
)

# Слова, которых клиент не должен увидеть никогда: половина — про наш
# внутренний сбой, половина — про то, чего бот не знает.
FORBIDDEN = (
    "ошибк", "сбой", "exception", "traceback", "unavailable", "error",
    "недоступ", "провайдер", "api", "http", "timeout", "500", "403",
)
# Имя приходит из канала (client_name), телефон — из текста: так лид
# становится полным и LeadWriter получает управление.
ASK = f"Мой номер {PHONE_TYPED}. Есть студия с 1 по 4 октября?"
TOOL_ARGS = json.dumps(
    {"arrival": "2026-10-01", "departure": "2026-10-04", "guests": 2, "category": "Студия"},
    ensure_ascii=False,
)


def _dead_providers() -> FakeProviders:
    """Внешняя система недоступна вся: и справочник, и расчёт, и заявки."""
    return FakeProviders(raise_on={"check", "quote", "create_lead"})


def _llm(providers: FakeProviders) -> ToolCallingLlm:
    registry = build_registry(lambda: providers.as_providers())
    return ToolCallingLlm(registry, [tool_call("c1", "check_availability", TOOL_ARGS)])


def _engine(engine_env, providers: FakeProviders, sender: MemorySender):
    hook = LeadWriter(
        sessionmaker=engine_env.sessionmaker,
        redis=engine_env.redis,
        providers_getter=lambda: providers.as_providers(),
        settings=engine_env.settings,
    )
    return engine_env.engine(sender=sender, llm=_llm(providers), lead_hook=hook)


async def test_dead_external_system_still_answers_the_client(engine_env, alert_spy) -> None:
    providers = _dead_providers()
    sender = MemorySender()

    outcome = await _engine(engine_env, providers, sender).process_message(incoming(ASK, client_name=NAME))

    # 1. Ход не упал и ответ доставлен.
    assert outcome.status == "replied", outcome.reasons
    assert len(sender.texts) == 1
    text = sender.texts[0]
    assert text.strip(), "клиент не получил ничего"

    # 2. Внутренностей в ответе нет.
    lowered = text.lower()
    for word in FORBIDDEN:
        assert word not in lowered, f"клиент увидел {word!r}: {text}"

    # 3. 🔴 Чисел в ответе нет: недоступный справочник не превращается
    #    в «осталось три».
    assert not re.search(r"\d", text), f"бот назвал число: {text}"

    # 4. Обещание тут одно — что уточнит человек.
    assert "администратор" in lowered

    # 5. Внешнюю систему мы честно попробовали.
    assert providers.count("check") == 1


async def test_dead_external_system_alerts_the_operator(engine_env, alert_spy) -> None:
    """Клиент не видит сбоя — значит, его обязан увидеть оператор.

    Алерт ловим перехватом write_alert: строку в outbox на sqlite вторая
    сессия записать не может, пока открыта транзакция хода (см. AlertSpy).
    """
    providers = _dead_providers()
    outcome = await _engine(engine_env, providers, MemorySender()).process_message(incoming(ASK, client_name=NAME))

    assert "lead_hook_failed" in outcome.reasons
    assert alert_spy.keys_like("leadfail:"), "оператору не ушло ничего"
    # Алерт — не пересылка переписки: контактов в нём нет.
    for body in alert_spy.bodies:
        assert NAME not in body and "7701" not in body.replace(" ", "")


async def test_lead_is_not_marked_created_and_history_is_written(engine_env, alert_spy) -> None:
    """Заявка не записана — значит, не помечена созданной; ответ бота
    в истории есть, потому что доставка удалась."""
    providers = _dead_providers()
    outcome = await _engine(engine_env, providers, MemorySender()).process_message(incoming(ASK, client_name=NAME))

    conversation = await load_conversation(engine_env.sessionmaker, outcome.conversation_id)
    assert not conversation.lead_data.get("lead_created_at")
    assert conversation.lead_data.get("phone"), "контакт клиента потерян"
    assert roles(await load_messages(engine_env.sessionmaker, outcome.conversation_id)) == ["user", "assistant"]


async def test_tool_answer_itself_is_the_honest_unknown(engine_env, alert_spy) -> None:
    """Инструмент — последний рубеж: даже модели он отдаёт признак,
    а не текст отказа внешней системы."""
    providers = _dead_providers()
    llm = _llm(providers)
    hook = LeadWriter(
        sessionmaker=engine_env.sessionmaker,
        redis=engine_env.redis,
        providers_getter=lambda: providers.as_providers(),
        settings=engine_env.settings,
    )
    engine = engine_env.engine(sender=MemorySender(), llm=llm, lead_hook=hook)
    await engine.process_message(incoming(ASK, client_name=NAME))

    assert llm.tool_results == ["не знаю: уточнит администратор"]


async def test_no_exception_leaves_the_engine(engine_env, alert_spy) -> None:
    """Прямая проверка: ни один слой не поднял исключение наружу."""
    providers = _dead_providers()
    engine = _engine(engine_env, providers, MemorySender())
    try:
        outcome = await engine.process_message(incoming(ASK, client_name=NAME))
    except Exception as exc:  # pragma: no cover — падение теста само по себе диагноз
        pytest.fail(f"исключение вышло из движка: {exc!r}")
    assert outcome.status != "error"


async def test_recovered_system_answers_normally(engine_env, alert_spy) -> None:
    """Система поднялась — бот снова отвечает по данным, и заявка уходит."""
    providers = _dead_providers()
    sender = MemorySender()
    engine = _engine(engine_env, providers, sender)
    await engine.process_message(incoming(ASK, client_name=NAME))

    providers.availability_kind = "few"
    providers.fix()
    await engine.process_message(incoming("Так что по студии?", client_name=NAME))

    # Гуманизатор поднимает первую букву предложения: сравниваем без регистра.
    assert "мест мало" in sender.texts[-1].lower()
    assert providers.count("create_lead") == 2  # неудачная попытка и удачный повтор
