"""Детерминированная логика лида: чистые функции над dict lead_data.

lead_data — свободная сумка в conversations. Ядро знает только ключи
LEAD_KEYS; всё нишевое (даты, гости) лежит в extra и ядром не читается.

🔴 Телефон и почта попадают сюда только из детерминированного извлечения
(Contacts). Догадка модели про номер игнорируется: выдуманный номер
превращается в заявку, по которой менеджер звонит в никуда.
"""

from __future__ import annotations

import re
from typing import Literal

from src.ai.schemas import LeadFields
from src.security.pii import Contacts

# name, phone, email, handle — контакт; interest, budget, timeframe, notes,
# extra (dict) — что узнала модель; asks (int) — сколько раз бот уже просил
# контакт; contact_refused (bool) — клиент отказался давать номер;
# lead_created_at (str ISO) — заявка уже создана, второй раз не создаём.
LEAD_KEYS: tuple[str, ...] = (
    "name", "phone", "email", "handle", "interest", "budget", "timeframe",
    "notes", "extra", "asks", "contact_refused", "lead_created_at",
)

Ask = Literal["name", "phone", "both"]

ASK_TEXTS: dict[str, str] = {
    "both": "Подскажите, как к вам обращаться и по какому номеру с вами связаться?",
    "name": "Как к вам обращаться?",
    "phone": "По какому номеру с вами связаться?",
}
REFUSAL_ACK = "Хорошо, напишите, когда будет удобно."

_CONTACT = r"(?:номер\w*|телефон\w*|контакт\w*)"
_GIVE = (
    r"(?:дам|дать|давать|оставлю|оставить|оставлять|напишу|писать|написать|сообщу|"
    r"сообщать|сообщить|укажу|указать|указывать|скажу|говорить|сказать|скину|скинуть|"
    r"скидывать|делиться|поделюсь|диктовать|продиктую)"
)
# «Не хочу номер на первом этаже» — про комнату, не про контакт: явный отказ
# только с глаголом передачи рядом со словом «номер/телефон».
_REFUSAL_RE = re.compile(
    r"\bне\s+(?:хочу\s+|буду\s+|стану\s+|могу\s+)?" + _GIVE + r"\b[^.!?]{0,20}?\b" + _CONTACT,
    re.IGNORECASE,
)
# Короткие формы («без телефона», «позже напишу») — отказ только в ответ
# на просьбу бота: без неё это «без телефона в номере» или планы клиента.
# Флаг contact_refused необратим, ложное срабатывание глушит просьбы навсегда.
_SOFT_REFUSAL_RE = re.compile(
    r"\bбез\s+(?:номера|телефона|контактов)\b"
    + r"|\b(?:позже|потом|позднее)\s+(?:напишу|свяжусь|позвоню|отпишусь)\b"
    + r"|\b(?:напишу|свяжусь|отпишусь)\s+(?:позже|потом|позднее|сам[аи]?)\b",
    re.IGNORECASE,
)
_QUESTION_SPLIT = re.compile(r"(?<=[.!?…])\s+|\n+")
_NAME_Q = re.compile(r"\b(?:зовут|обращаться|имя)\b", re.IGNORECASE)
# «Номер» в отеле — комната («какой номер интересует?»): вопросом о телефоне
# считаем только с притяжательным или словом «телефон» (как в guardrails).
_PHONE_Q = re.compile(
    r"\bтелефон\w*|\b(?:ваш|твой|свой)\w*\s+номер\w*|\bномер\w*\s+телефон\w*"
    r"|\bпо\s+какому\s+номеру|\bсвязаться\b",
    re.IGNORECASE,
)


def merge_contacts(lead: dict, contacts: Contacts) -> dict:
    """Первый номер/почта/логин из Contacts, если ещё не сохранены.
    Уже записанный телефон не перезаписывается: первый — тот, что дал клиент."""
    merged = dict(lead)
    for key, values in (("phone", contacts.phones), ("email", contacts.emails), ("handle", contacts.handles)):
        if values and not merged.get(key):
            merged[key] = values[0]
    return merged


def merge_model_lead(lead: dict, model_lead: LeadFields | None, client_name: str | None) -> dict:
    """Имя — из модели, иначе из канала (если ещё нет). Поля интереса —
    из модели, когда она их дала. phone и email модели игнорируются."""
    merged = dict(lead)
    if model_lead is not None:
        if model_lead.name and model_lead.name.strip() and not merged.get("name"):
            merged["name"] = model_lead.name.strip()
        for key in ("interest", "budget", "timeframe", "notes"):
            value = getattr(model_lead, key)
            if value and value.strip():
                merged[key] = value.strip()
        if model_lead.extra:
            merged["extra"] = {**merged.get("extra", {}), **model_lead.extra}
    if not merged.get("name") and client_name and client_name.strip():
        merged["name"] = client_name.strip()
    return merged


def is_complete(lead: dict) -> bool:
    """Заявка возможна только с именем И телефоном."""
    return bool(lead.get("name")) and bool(lead.get("phone"))


def contact_refused(text: str, *, asked: bool = False) -> bool:
    """Клиент отказывается давать номер или просит не спрашивать.
    asked — бот уже просил контакт: тогда считаются и короткие формы."""
    if _REFUSAL_RE.search(text):
        return True
    return asked and bool(_SOFT_REFUSAL_RE.search(text))


def needs_ask(lead: dict, *, turn_index: int, max_asks: int = 2) -> Ask | None:
    """Что спросить: None — не спрашиваем (всё есть, отказ, лимит просьб
    или первый ход: с порога контакт не просят)."""
    if is_complete(lead) or lead.get("contact_refused") or turn_index < 1:
        return None
    if int(lead.get("asks", 0) or 0) >= max_asks:
        return None
    if not lead.get("name") and not lead.get("phone"):
        return "both"
    return "phone" if lead.get("name") else "name"


def append_sentence(reply: str, sentence: str) -> str:
    """Дописывает предложение к ответу, закрывая предыдущее точкой."""
    base = reply.rstrip()
    if base and base[-1] not in ".!?…":
        base += "."
    return f"{base} {sentence}".strip()


def apply_turn(
    lead: dict, *, text: str, reply: str, model_lead: LeadFields | None, client_name: str | None, turn_index: int
) -> tuple[dict, str]:
    """Правила лида за один ход: слить поля модели, учесть отказ (ответ на него —
    один раз) или дописать просьбу о контакте. Возвращает новый lead и ответ."""
    lead = merge_model_lead(lead, model_lead, client_name)
    if contact_refused(text, asked=int(lead.get("asks", 0) or 0) > 0):
        if not lead.get("contact_refused"):
            lead["contact_refused"] = True
            reply = append_sentence(reply, REFUSAL_ACK)
        return lead, reply
    ask = needs_ask(lead, turn_index=turn_index)
    if ask and not reply_already_asks(reply, ask):
        reply = append_sentence(reply, ASK_TEXTS[ask])
        lead["asks"] = int(lead.get("asks", 0) or 0) + 1
    return lead, reply


def reply_already_asks(reply: str, ask: Ask) -> bool:
    """В ответе модели уже есть вопрос об имени/номере — не дублируем.
    Для both достаточно одного из вопросов: второй зададим следующим ходом."""
    questions = [s for s in _QUESTION_SPLIT.split(reply) if s.strip().endswith("?")]
    asks_name = any(_NAME_Q.search(q) for q in questions)
    asks_phone = any(_PHONE_Q.search(q) for q in questions)
    if ask == "name":
        return asks_name
    if ask == "phone":
        return asks_phone
    return asks_name or asks_phone
