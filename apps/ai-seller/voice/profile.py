"""Профиль голосового агента и его инструкции.

Правила «чего боту нельзя» взяты из apps/ai-seller/AGENTS.md: голос не вправе
обещать больше, чем умеет текстовый продавец. Длинное тире не используем.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass

from voice.phone import normalize_e164

DEFAULT_VOICE = "Leda"
VERTICALS = ("HOSPITALITY", "BEAUTY", "FOOD_SERVICE")
DEFAULT_VERTICAL = "BEAUTY"


@dataclass(frozen=True)
class VoiceProfile:
    object_name: str
    voice: str = DEFAULT_VOICE
    handoff_number: str | None = None
    greeting_tail: str = ""
    vertical: str = DEFAULT_VERTICAL
    # Бронь по телефону (только гостиница): выключатель и лимит объекта с платформы; из окружения всегда выключено
    booking_enabled: bool = False
    booking_max_per_call: int = 3

    @property
    def can_book(self) -> bool:
        return self.vertical == "HOSPITALITY" and self.booking_enabled

    @classmethod
    def from_api(cls, data) -> "VoiceProfile":
        """Профиль с платформы (`GET /voice/profile`): имя объекта, голос, номер администратора, хвост приветствия."""
        return cls(
            object_name=(data.object_name or "наш объект").strip(),
            voice=(data.voice_name or DEFAULT_VOICE).strip(),
            handoff_number=normalize_e164(data.handoff_phone),
            greeting_tail=data.greeting_tail or "",
            vertical=data.vertical if data.vertical in VERTICALS else DEFAULT_VERTICAL,
            booking_enabled=bool(getattr(data, "booking_enabled", False)),
            booking_max_per_call=int(getattr(data, "booking_max_per_call", 3) or 3),
        )

    @classmethod
    def from_env(cls, env: Mapping[str, str]) -> "VoiceProfile":
        return cls(
            object_name=(env.get("VOICE_OBJECT_NAME") or "наш объект").strip(),
            voice=(env.get("VOICE_NAME") or DEFAULT_VOICE).strip(),
            handoff_number=normalize_e164(env.get("VOICE_HANDOFF_NUMBER")),
            vertical=_vertical(env.get("VOICE_VERTICAL")),
        )


def _clean(text: str, limit: int = 300) -> str:
    """Текст владельца для озвучивания: без служебных знаков, одной строкой, не длиннее предела."""
    kept = "".join(ch if ch.isprintable() else " " for ch in text or "")
    return " ".join(kept.split())[:limit]


def _vertical(raw: object) -> str:
    text = str(raw or "").strip().upper()
    return text if text in VERTICALS else DEFAULT_VERTICAL


def opening_line(profile: VoiceProfile) -> str:
    """Первая фраза звонка: назвать себя ИИ и предупредить о записи (Q-VOICE-2)."""
    tail = _clean(profile.greeting_tail)
    middle = f" {tail}" if tail else ""
    return (
        f"Здравствуйте, это ИИ-помощник, {profile.object_name}. "
        f"Разговор записывается.{middle} Чем могу помочь?"
    )


def closing_line() -> str:
    return "Спасибо за звонок. Всего доброго!"


# Что агент может называть по справочнику, зависит от направления: только то, что даёт читающий адрес платформы
CATALOG_RULE = {
    "BEAUTY": (
        "Про услуги и цены отвечай только через инструмент get_services: названия, длительность и цены берутся из каталога. "
        "Цену называй такой, как в каталоге."
    ),
    "FOOD_SERVICE": (
        "Про часы работы и периоды обслуживания (завтрак, обед, ужин) отвечай только через инструмент get_service_hours. "
        "Меню, цены и наличие столов по телефону ты не знаешь: скажи, что администратор уточнит."
    ),
    "HOSPITALITY": (
        "Справочника по номерам, ценам и свободным датам по телефону у тебя нет. На вопросы о наличии номеров, стоимости "
        "проживания и бронировании отвечай, что администратор уточнит и свяжется с гостем, и предложи оставить номер телефона."
    ),
}


HOTEL_BOOKING_RULE = (
    "Свободные номера и цены ты узнаёшь только инструментом check_availability: даты заезда и выезда в формате ГГГГ-ММ-ДД и число "
    "гостей. Называй категории и цены ровно так, как вернул инструмент, ничего не считай и не обещай скидок. "
    "Чтобы забронировать, сначала вызови quote_stay для категории из последнего результата и перескажи условия: категория, "
    "даты, число гостей и цену. Спроси имя, фамилию и телефон и получи явное согласие звонящего словом «да» на эти условия. "
    "Только после явного согласия вызови confirm_booking. Платежей, паспортных данных и карт по телефону нет. "
    "Отмену и перенос по телефону ты не делаешь: предложи оставить просьбу или соединить с администратором."
)


def build_instructions(profile: VoiceProfile, services_hint: str) -> str:
    vertical = profile.vertical if profile.vertical in VERTICALS else DEFAULT_VERTICAL
    booking = profile.can_book
    lines = [
        f"Ты голосовой ИИ-помощник объекта «{profile.object_name}». Говори по-русски, коротко и вежливо, "
        "одной-двумя фразами за раз. Ты ИИ и не скрываешь этого.",
        "Отвечай только по данным, которые дают инструменты. Если данных нет, скажи, что администратор "
        "уточнит и свяжется с клиентом.",
        HOTEL_BOOKING_RULE if booking else CATALOG_RULE[vertical],
        "Не считай итоговые суммы и не складывай цены: называй цену из справочника как есть.",
        (
            "Не обещай то, чего не делаешь: не обещай скидку и не называй суммы, которых не вернул инструмент. "
            "Оплату уточняет администратор."
            if booking
            else "Не обещай то, чего не делаешь: не оформляй запись, бронь или стол, не обещай скидку, время мастера или "
            "конкретный результат. Запись и оплату уточняет администратор."
        ),
        "Не ставь диагнозов и не давай медицинских советов, при жалобах на здоровье сразу предложи "
        "соединить с администратором.",
        (
            "Если бронь не получается или клиент просит что-то сверх этого, сохрани просьбу инструментом request_callback "
            "и скажи, что администратор свяжется с клиентом."
            if booking
            else "Если клиент хочет записаться или забронировать, узнай имя и номер телефона, сохрани просьбу инструментом "
            "request_callback и скажи, что просьба записана и администратор свяжется с клиентом."
        ),
        "Если клиент просит живого человека или ты сомневаешься, используй transfer_to_human.",
        "Никогда не зачитывай клиенту тексты ошибок и технические детали.",
    ]
    if services_hint:
        lines.append(services_hint)
    return "\n".join(lines)
