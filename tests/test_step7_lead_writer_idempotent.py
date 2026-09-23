"""Шаг 7: заявка наружу пишется один раз.

🔴 Проверка «уже сделано» стоит ДО вызова внешней системы: доказательство —
счётчик вызовов провайдера, а не отсутствие дубля на их стороне. Дубль,
отфильтрованный внешней системой, — это всё равно лишний вызов и лишний
алерт менеджеру.
"""

from __future__ import annotations

from src.db.base import DeliveryStatus, OutboxKind
from src.integrations.lead_writer import LeadWriter, natural_key
from tests.integration_fakes import (  # noqa: F401 — фикстура lead_env
    EMAIL,
    NAME,
    PHONE,
    PHONE_TYPED,
    lead_data,
    lead_env,
    new_conversation_id,
)

OTHER_PHONE = "77020000000"  # второй вымышленный номер


def _done_key(conversation_id, lead: dict) -> str:
    return "lead:done:" + natural_key(conversation_id, lead)


def _alerts(rows) -> list[str]:
    """Ключи алертов по порядку появления.

    🔴 Шаг 8: один алерт кладётся ДВУМЯ строками outbox — почта и мессенджер,
    у строк к ключу добавлен суффикс канала. Здесь проверяются сами алерты,
    а не строки: провал одной строки не отменяет другую, это и есть смысл
    двух каналов.
    """
    keys: list[str] = []
    for row in rows:
        base = (row.dedup_key or "").rsplit(":", 1)[0]
        if base not in keys:
            keys.append(base)
    return keys


# ─── Натуральный ключ ───


def test_natural_key_ignores_phone_formatting() -> None:
    """Один диалог + один телефон = одна заявка, как бы номер ни записали."""
    conversation_id = new_conversation_id()
    typed = natural_key(conversation_id, lead_data(phone=PHONE_TYPED))
    digits = natural_key(conversation_id, lead_data(phone=PHONE))
    assert typed == digits
    assert len(digits) == 32 and digits.isalnum()


def test_natural_key_differs_by_conversation_and_by_phone() -> None:
    lead = lead_data()
    assert natural_key(new_conversation_id(), lead) != natural_key(new_conversation_id(), lead)
    conversation_id = new_conversation_id()
    assert natural_key(conversation_id, lead) != natural_key(conversation_id, lead_data(phone=OTHER_PHONE))


def test_natural_key_has_no_personal_data_inside() -> None:
    """Ключ — хеш: он уезжает во внешнюю систему и в dedup_key строки outbox."""
    key = natural_key(new_conversation_id(), lead_data())
    assert PHONE not in key and NAME not in key and EMAIL not in key


# ─── Запись ───


async def test_first_call_writes_lead_and_alert(lead_env) -> None:
    conversation_id = new_conversation_id()
    lead = lead_data()
    await lead_env.writer()(conversation_id, lead)

    assert lead_env.providers.count("create_lead") == 1
    key, payload = lead_env.providers.args_of("create_lead")[0]
    assert key == natural_key(conversation_id, lead)
    assert payload["conversation_id"] == str(conversation_id)
    assert payload["phone"] == PHONE and payload["name"] == NAME
    # Служебные поля лида наружу не уходят: они про поведение бота, не про клиента.
    for internal in ("asks", "contact_refused", "lead_created_at", "handle"):
        assert internal not in payload, internal

    assert await lead_env.redis.get(_done_key(conversation_id, lead))

    rows = await lead_env.outbox()
    # 🔴 Два канала на один алерт: почта основная, мессенджер дубль.
    assert [row.transport for row in rows] == ["email", "alert_messenger"]
    assert all(row.kind is OutboxKind.ALERT for row in rows)
    assert all(row.status is DeliveryStatus.PENDING for row in rows)
    assert _alerts(rows) == ["hotlead:" + natural_key(conversation_id, lead)]


async def test_alert_body_has_no_personal_data(lead_env) -> None:
    """🔴 Алерт идёт в чужой мессенджер: в нём только идентификатор диалога
    и тип события. Контакт менеджер смотрит в панели."""
    conversation_id = new_conversation_id()
    await lead_env.writer()(conversation_id, lead_data())
    body = (await lead_env.outbox())[0].body
    assert str(conversation_id) in body
    for secret in (PHONE, PHONE_TYPED, NAME, EMAIL, "студия", "с питомцем"):
        assert secret not in body, f"в алерте есть {secret!r}: {body}"


async def test_empty_recipient_still_writes_the_row(lead_env, monkeypatch) -> None:
    """Получатель не настроен — событие всё равно не теряем: строка с '-'
    останется в outbox, и её увидят при разборе."""
    from src.config import get_settings

    monkeypatch.setenv("ALERT_EMAIL_TO", "")
    get_settings.cache_clear()
    await lead_env.writer()(new_conversation_id(), lead_data())
    assert (await lead_env.outbox())[0].recipient == "-"


async def test_second_call_does_not_touch_external_system(lead_env) -> None:
    """🔴 Повтор того же лида: провайдер не вызван, второго алерта нет."""
    conversation_id = new_conversation_id()
    lead = lead_data()
    writer = lead_env.writer()
    await writer(conversation_id, lead)
    await writer(conversation_id, lead)

    assert lead_env.providers.count("create_lead") == 1
    assert len(_alerts(await lead_env.outbox())) == 1


async def test_second_call_from_new_writer_is_also_skipped(lead_env) -> None:
    """Память о сделанном живёт в Redis, а не в объекте: перезапуск процесса
    не должен приводить к дублю заявки."""
    conversation_id = new_conversation_id()
    lead = lead_data()
    await lead_env.writer()(conversation_id, lead)
    await lead_env.writer()(conversation_id, lead)
    assert lead_env.providers.count("create_lead") == 1


async def test_same_phone_written_differently_is_the_same_lead(lead_env) -> None:
    conversation_id = new_conversation_id()
    writer = lead_env.writer()
    await writer(conversation_id, lead_data(phone=PHONE))
    await writer(conversation_id, lead_data(phone=PHONE_TYPED))
    assert lead_env.providers.count("create_lead") == 1


async def test_other_phone_in_same_conversation_is_a_new_lead(lead_env) -> None:
    """Клиент назвал второй номер — это новая заявка, а не дубль."""
    conversation_id = new_conversation_id()
    writer = lead_env.writer()
    await writer(conversation_id, lead_data())
    await writer(conversation_id, lead_data(phone=OTHER_PHONE))

    assert lead_env.providers.count("create_lead") == 2
    keys = [key for key, _ in lead_env.providers.args_of("create_lead")]
    assert keys[0] != keys[1]
    rows = await lead_env.outbox()
    assert len(_alerts(rows)) == 2


async def test_writer_matches_lead_hook_signature(lead_env) -> None:
    """LeadWriter подставляется движку как lead_hook: вызов — (id, dict) -> None."""
    import inspect

    assert isinstance(lead_env.writer(), LeadWriter)
    assert inspect.iscoroutinefunction(LeadWriter.__call__)
    assert await lead_env.writer()(new_conversation_id(), lead_data()) is None
