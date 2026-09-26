"""Сборка контекста для модели и маскировка ПД в готовом списке сообщений.

Промпт собирается как неизменяемый префикс (роль, политики, инструкции
вывода) плюс изменяемый хвост (знания, история, сообщение). Префикс байт
в байт одинаков от вызова к вызову — так роутер кэширует его, и десять тысяч
токенов промпта не платятся заново в каждом запросе.

История для модели — чистый текст: объекты ORM сюда не попадают.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

from src.ai.schemas import FUNNEL_STAGES, LeadFields
from src.security.pii import ADDR, EMAIL, NAME, PHONE, mask, normalize_phone

_LABEL_RE = re.compile(r"\[(?:PHONE|EMAIL|HANDLE|ADDR|NAME)_\d+\]")
_LEAD_FIELDS = ", ".join(name for name in LeadFields.model_fields if name != "extra")

OUTPUT_INSTRUCTIONS: str = (
    "Формат ответа.\n"
    "Отвечай ровно одним JSON-объектом, без markdown и без текста вокруг него.\n"
    "Поля:\n"
    '- "reply" — текст для клиента; это единственное, что он увидит;\n'
    '- "needs_human" — true, если нужен человек (брак, гарантия, возврат, '
    "сроки поставки, точный расчёт стоимости, жалоба);\n"
    '- "human_reason" — короткая причина для оператора или null;\n'
    '- "funnel_stage" — одно из: ' + ", ".join(FUNNEL_STAGES) + " или null;\n"
    '- "lead" — объект с полями ' + _LEAD_FIELDS + " (строка или null) "
    'и "extra" — объект со свободными полями, если промпт их просит.\n'
    "Метки вида [PHONE_1], [EMAIL_1], [NAME_1] — это скрытые данные клиента: "
    "переноси их в ответ как есть, не расшифровывай и не выдумывай значения.\n"
    "Не считай суммы и не называй точный остаток склада; "
    "не обещай действий, которых сам не делаешь."
)

KNOWLEDGE_HEADER = "Факты из базы знаний (отвечай только по ним):"


@dataclass(frozen=True)
class HistoryTurn:
    role: Literal["user", "assistant"]
    text: str


def build_messages(
    *,
    system_prompt: str,
    knowledge: list[str],
    history: list[HistoryTurn],
    user_text: str,
    history_turns: int,
    output_instructions: str = OUTPUT_INSTRUCTIONS,
) -> list[dict]:
    """[system: промпт + инструкции] [system: знания?] [история…] [user]."""
    messages: list[dict] = [{"role": "system", "content": system_prompt + "\n\n" + output_instructions}]
    facts = [fact.strip() for fact in knowledge if fact and fact.strip()]
    if facts:
        messages.append({"role": "system", "content": KNOWLEDGE_HEADER + "\n" + "\n".join(f"- {f}" for f in facts)})
    # Пустые реплики выкидываем до обрезки: иначе они съедают окно истории.
    turns = [t for t in history if t.text and t.text.strip()]
    if history_turns > 0:
        turns = turns[-history_turns:]
    else:
        turns = []
    messages.extend({"role": turn.role, "content": str(turn.text)} for turn in turns)
    messages.append({"role": "user", "content": user_text})
    return messages


def _canonical(label: str, original: str) -> tuple[str, str]:
    """Ключ значения как его считает pii.mask: один номер в разных
    написаниях и в разных сообщениях должен получить одну метку."""
    kind = label[1:].rsplit("_", 1)[0]
    if kind == PHONE:
        return kind, normalize_phone(original)
    if kind in (EMAIL, ADDR, NAME):
        return kind, original.strip().lower()
    return kind, original


class MessageMasker:
    """Маскировщик с общей таблицей меток на весь ход.

    Состояние живёт вне функции, потому что сообщения приходят порциями:
    входной список — до каскада, результаты инструментов — внутри раунда.
    Один номер в истории и в ответе инструмента должен получить одну метку,
    и все метки должны попасть в mapping — иначе движок их не снимет.
    """

    def __init__(self, *, allowlist_phones: list[str], allowlist_emails: list[str]) -> None:
        self._allowlist_phones = allowlist_phones
        self._allowlist_emails = allowlist_emails
        self._labels: dict[tuple[str, str], str] = {}
        self._counters: dict[str, int] = {}
        # Публичный словарь: движок получает ссылку и видит дописанные метки.
        self.mapping: dict[str, str] = {}

    def mask_text(self, content: str) -> str:
        text, local = mask(
            content, allowlist_phones=self._allowlist_phones, allowlist_emails=self._allowlist_emails
        )
        # mask() нумерует метки с единицы в каждом тексте; переводим их
        # в общие одним проходом, чтобы [PHONE_1] значил одно и то же
        # во всём списке и замены не цеплялись друг за друга.
        rename: dict[str, str] = {}
        for local_label, original in local.items():
            key = _canonical(local_label, original)
            label = self._labels.get(key)
            if label is None:
                self._counters[key[0]] = self._counters.get(key[0], 0) + 1
                label = f"[{key[0]}_{self._counters[key[0]]}]"
                self._labels[key] = label
                self.mapping[label] = original
            rename[local_label] = label
        if rename:
            text = _LABEL_RE.sub(lambda m: rename.get(m.group(), m.group()), text)
        return text

    def mask(self, messages: list[dict]) -> list[dict]:
        """Маскирует content каждого сообщения (tool-сообщения тоже).
        Исходный список не мутируется."""
        masked: list[dict] = []
        for message in messages:
            copy = dict(message)
            content = copy.get("content")
            if isinstance(content, str) and content:
                copy["content"] = self.mask_text(content)
            masked.append(copy)
        return masked


def mask_messages(
    messages: list[dict], *, allowlist_phones: list[str], allowlist_emails: list[str]
) -> tuple[list[dict], dict[str, str]]:
    """Маскирует список одной общей таблицей меток. Белый список — номера
    и почта компании: они не утечка."""
    masker = MessageMasker(allowlist_phones=allowlist_phones, allowlist_emails=allowlist_emails)
    return masker.mask(messages), masker.mapping
