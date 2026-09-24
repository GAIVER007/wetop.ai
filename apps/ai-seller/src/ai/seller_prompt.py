"""Промпт продавца из профиля, который присылает платформа (ТЗ интеграции, Б6).

🔴 Ядро правил не редактируется. Платформа шлёт профиль полями, а не текстом
промпта: из свободного текста владелец объекта мог бы стереть «не считай
деньги» и «не обещай действий, которых не делаешь», а у профиля такого поля
просто нет. Правила ядра — из sistemnyy-prompt.md кита, раздел 3: там сказано,
что они переносятся целиком и меняется только предмет.

Факты объекта (адрес, заезд, цены) сюда не входят: они приходят отдельно
в базу знаний (Б7) и меняются чаще, чем личность бота.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from src.ai.guardrails import scan_document

Short = Annotated[str, Field(max_length=300)]
Long = Annotated[str, Field(max_length=2000)]


class FaqItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    q: Short
    a: Annotated[str, Field(max_length=1000)]


class SellerProfile(BaseModel):
    """Поля экрана «Настройки» раздела «ИИ-продавец».

    extra='forbid': лишнее поле — отказ, а не молчаливый пропуск. Так в промпт
    ничего не протащить под видом поля, которого бот не знает.
    """

    model_config = ConfigDict(extra="forbid")

    object_name: Annotated[str, Field(min_length=1, max_length=120)]
    bot_name: Annotated[str, Field(max_length=40)] | None = None
    address_form: Literal["vy", "ty"] = "vy"
    emoji: Literal["never", "moderate", "greeting_only"] = "never"
    reply_length: Literal["short", "detailed"] = "short"
    languages: Annotated[list[Annotated[str, Field(max_length=20)]], Field(max_length=6)] = ["русский"]
    greeting: Short = ""
    included_in_price: Annotated[str, Field(max_length=1000)] = ""
    extra_charges: Annotated[str, Field(max_length=1000)] = ""
    house_rules: Long = ""
    prohibitions: Annotated[list[Short], Field(max_length=30)] = []
    call_human_when: Annotated[list[Short], Field(max_length=30)] = []
    faq: Annotated[list[FaqItem], Field(max_length=50)] = []


# 🔴 Ядро. Меняется только вместе с китом, а не под заказчика.
CORE_RULES = """\
1. Не выдумывай. Нет в базе знаний — значит не знаешь. Скажи прямо и предложи спросить у человека.
2. Не называй цифру, которой нет в базе. Ни цену, ни срок, ни остаток.
3. Не считай. Назвать цену из базы можно, складывать и умножать нельзя: названный итог становится обещанием.
4. Не обещай действий, которых не делаешь. Не «я пришлю», а «администратор пришлёт».
5. Не ставь диагнозов. Брак, возврат денег, здоровье, жалобы — сразу человеку, без версий.
6. Не называй точное число свободных мест: только «есть», «мало» или «нет».
7. Не показывай служебные данные: технические ответы, коды, внутренние названия.
8. Спрашивай, а не угадывай. Одно сообщение — один вопрос.
9. Не уходи в режим оператора сам: если нужен человек, скажи об этом и продолжай помогать."""

_FORM = {"vy": "Обращайся на «вы».", "ty": "Обращайся на «ты»."}
_EMOJI = {
    "never": "Эмодзи не используй.",
    "moderate": "Эмодзи — изредка, не больше одного в сообщении.",
    "greeting_only": "Эмодзи — только в приветствии.",
}
_LENGTH = {
    "short": "Отвечай коротко: одна-три фразы.",
    "detailed": "Отвечай развёрнуто, но без воды.",
}


def _bullets(items: list[str]) -> str:
    return "\n".join(f"- {item.strip()}" for item in items if item.strip())


def render(profile: SellerProfile) -> str:
    """Собрать промпт. Порядок разделов — как в скелете кита: роль и границы
    сверху, правила сразу за ними, данные заказчика ниже."""
    name = profile.bot_name.strip() if profile.bot_name else ""
    who = f"Тебя зовут {name}. " if name else ""
    parts = [
        "# Роль",
        f"{who}Ты продавец «{profile.object_name}»: отвечаешь гостям, помогаешь выбрать"
        " размещение и оставить заявку.",
        "",
        "# Границы",
        f"Отвечай только про размещение в «{profile.object_name}» и бронирование."
        " На остальное: «С этим не подскажу, я помогаю с размещением и бронированием».",
        "",
        "# Главные правила",
        CORE_RULES,
        "",
        "# Стиль",
        " ".join((_FORM[profile.address_form], _EMOJI[profile.emoji], _LENGTH[profile.reply_length])),
        f"Языки: {', '.join(profile.languages)}. Отвечай на языке гостя, если он в этом списке.",
    ]
    if profile.greeting.strip():
        parts += ["", "# Приветствие", profile.greeting.strip()]
    if profile.included_in_price.strip() or profile.extra_charges.strip():
        parts += ["", "# Что входит в цену"]
        if profile.included_in_price.strip():
            parts.append(f"Входит: {profile.included_in_price.strip()}")
        if profile.extra_charges.strip():
            parts.append(f"За доплату: {profile.extra_charges.strip()}")
    if profile.house_rules.strip():
        parts += ["", "# Правила проживания", profile.house_rules.strip()]
    if _bullets(profile.prohibitions):
        parts += ["", "# Запреты заказчика", _bullets(profile.prohibitions)]
    call = ["Жалоба, возврат денег, изменение или отмена брони.", *profile.call_human_when]
    parts += ["", "# Когда звать человека", _bullets(call)]
    if profile.faq:
        parts += ["", "# Частые вопросы"]
        parts += [f"В: {item.q.strip()}\nО: {item.a.strip()}" for item in profile.faq]
    return "\n".join(parts).strip() + "\n"


def dirty_fields(profile: SellerProfile) -> list[str]:
    """Поля, в которых спрятана инструкция для модели (слой 9 защиты).

    Поле профиля проверяется так же, как документ базы знаний: инструкция
    в «правилах проживания» работает ровно так же, как присланная в чат.
    """
    texts: dict[str, str] = {
        "bot_name": profile.bot_name or "",
        "object_name": profile.object_name,
        "greeting": profile.greeting,
        "included_in_price": profile.included_in_price,
        "extra_charges": profile.extra_charges,
        "house_rules": profile.house_rules,
        "prohibitions": "\n".join(profile.prohibitions),
        "call_human_when": "\n".join(profile.call_human_when),
        "faq": "\n".join(f"{i.q}\n{i.a}" for i in profile.faq),
    }
    return [name for name, text in texts.items() if text and not scan_document(text).clean]
