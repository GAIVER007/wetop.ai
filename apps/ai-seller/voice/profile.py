"""Профиль голосового агента и его инструкции.

Правила «чего боту нельзя» взяты из apps/ai-seller/AGENTS.md: голос не вправе
обещать больше, чем умеет текстовый продавец. Длинное тире не используем.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass

from voice.phone import normalize_e164

DEFAULT_VOICE = "Leda"


@dataclass(frozen=True)
class VoiceProfile:
    object_name: str
    voice: str = DEFAULT_VOICE
    handoff_number: str | None = None

    @classmethod
    def from_env(cls, env: Mapping[str, str]) -> "VoiceProfile":
        return cls(
            object_name=(env.get("VOICE_OBJECT_NAME") or "наш объект").strip(),
            voice=(env.get("VOICE_NAME") or DEFAULT_VOICE).strip(),
            handoff_number=normalize_e164(env.get("VOICE_HANDOFF_NUMBER")),
        )


def opening_line(profile: VoiceProfile) -> str:
    """Первая фраза звонка: назвать себя ИИ и предупредить о записи (Q-VOICE-2)."""
    return (
        f"Здравствуйте, это ИИ-помощник, {profile.object_name}. "
        "Разговор записывается. Чем могу помочь?"
    )


def closing_line() -> str:
    return "Спасибо за звонок. Всего доброго!"


def build_instructions(profile: VoiceProfile, services_hint: str) -> str:
    lines = [
        f"Ты голосовой ИИ-помощник объекта «{profile.object_name}». Говори по-русски, коротко и вежливо, "
        "одной-двумя фразами за раз. Ты ИИ и не скрываешь этого.",
        "Отвечай только по данным, которые дают инструменты. Если данных нет, скажи, что администратор "
        "уточнит и свяжется с клиентом.",
        "Не считай итоговые суммы и не складывай цены: называй цену услуги из каталога как есть.",
        "Не обещай то, чего не делаешь: не оформляй запись, не обещай скидку, время мастера или конкретный "
        "результат. Запись и оплату уточняет администратор.",
        "Не ставь диагнозов и не давай медицинских советов, при жалобах на здоровье сразу предложи "
        "соединить с администратором.",
        "Если клиент хочет записаться, узнай имя и номер телефона, сохрани просьбу инструментом "
        "request_callback и скажи, что просьба передана администратору.",
        "Если клиент просит живого человека или ты сомневаешься, используй transfer_to_human.",
        "Никогда не зачитывай клиенту тексты ошибок и технические детали.",
    ]
    if services_hint:
        lines.append(services_hint)
    return "\n".join(lines)
