"""Логика защиты: нормализация (слой 1) → паттерны (2) → крещендо (3) →
страйки (4); правило неприкосновенности контакта (6); проверка документа
(9); проверка ответа модели (7, клиентонезависимая часть).

Порядок в check_input фиксированный: контакт извлекается ДО любого отбоя,
потому что сообщение с телефоном не может быть отвергнуто ни одним
фильтром — лид дороже правила. Fail-open на подозрении (flag),
fail-closed на подтверждении (refuse).
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, replace
from typing import Literal

from redis.asyncio import Redis

from src.ai.guard_patterns import (
    CRESCENDO_WORDS,
    HOMOGLYPHS_GREEK_TO_CYR,
    HOMOGLYPHS_LATIN_TO_CYR,
    HOMOGLYPHS_OTHER_TO_LATIN,
    INVISIBLE_CHARS,
    PATTERNS,
)
from src.db.injection_tracker import add_strike, is_conversation_blocked
from src.security.pii import Contacts, extract_contacts

Action = Literal["pass", "flag", "refuse", "block"]

FALLBACK_ANSWER = "Уточню у администратора и вернусь к вам."
CONTACT_FALLBACK = "Продолжим здесь, в чате."
ASK_PRICE = "Точную стоимость подтвердит администратор."

_INVISIBLE_TABLE = {ord(c): None for c in INVISIBLE_CHARS}
# В кириллицу: латинские и греческие двойники.
_HOMOGLYPH_TABLE = str.maketrans({**HOMOGLYPHS_LATIN_TO_CYR, **HOMOGLYPHS_GREEK_TO_CYR})
# Обратно: кириллические двойники в «латинском» слове (аудит 26.09, С-51) — только буквы, которые пишутся так же:
# «ь», строчные «н», «м», «т» на «b», «h», «m», «t» не похожи, их не трогаем. Плюс двойники из других
# кириллиц и греческого: «І» украинская, «ѕ» македонская, «Ι» и «Α» греческие (ревизия 26.09).
_CYR_LOOKALIKES = "аеорсхукАВСЕНКМОРТХУ"
_HOMOGLYPH_TABLE_TO_LATIN = str.maketrans(
    {cyr: lat for lat, cyr in HOMOGLYPHS_LATIN_TO_CYR.items() if cyr in _CYR_LOOKALIKES}
    | HOMOGLYPHS_OTHER_TO_LATIN
)
# Слово — любая буква любого алфавита: «[A-Za-zА-Яа-яЁё]» рвал «ІGNОRЕ» на «І» и «GNОRЕ».
_LETTER_RUN = re.compile(r"[^\W\d_]+")
_SPACES = re.compile(r"\s+")
_CRESCENDO_RE = re.compile(
    r"\b(?:" + "|".join(re.escape(w) for w in CRESCENDO_WORDS) + r")\b", re.IGNORECASE
)


# ─── Слой 1. Нормализация ───

def clip(text: str, max_chars: int) -> str:
    """Обрезка входа по длине. Отдельно от normalize: предел — настройка."""
    return text[:max_chars]


def _fix_homoglyphs(word: str) -> str:
    # Латинские двойники меняем только там, где слово в основном кириллическое:
    # «hotel» остаётся латиницей, «пoкaжи» становится «покажи». И наоборот:
    # в основном латинском слове кириллические двойники становятся латиницей —
    # одна кириллическая «о» в «Ignоre» снимала все английские шаблоны (С-51).
    cyr = sum(1 for ch in word if "Ѐ" <= ch <= "ӿ")
    if cyr * 2 > len(word):
        return word.translate(_HOMOGLYPH_TABLE)
    # Таблица трогает только не-ASCII буквы: чистая латиница остаётся как была.
    return word.translate(_HOMOGLYPH_TABLE_TO_LATIN)


def normalize(text: str) -> str:
    """NFKC → без невидимых символов → гомоглифы → одиночные пробелы."""
    text = unicodedata.normalize("NFKC", text).translate(_INVISIBLE_TABLE)
    text = _LETTER_RUN.sub(lambda m: _fix_homoglyphs(m.group(0)), text)
    return _SPACES.sub(" ", text).strip()


# ─── Слой 2. Паттерны ───

@dataclass(frozen=True)
class PatternHit:
    name: str
    severity: str


def _foldings(text: str) -> tuple[str, ...]:
    """Текст как есть, целиком в латинице и целиком в кириллице.

    Нормализация решает по большинству букв в слове, и слово из одних двойников
    уходило не в тот алфавит: «РRОМРТ» (Р, О, М, Р, Т — кириллица) становилось
    кириллицей и не попадало под «prompt» (ревизия 26.09). Шаблон проверяется
    на всех трёх — попадание в любом считается.
    """
    return text, text.translate(_HOMOGLYPH_TABLE_TO_LATIN), text.translate(_HOMOGLYPH_TABLE)


def find_patterns(text: str) -> list[PatternHit]:
    variants = _foldings(text)
    return [
        PatternHit(name, sev)
        for name, sev, rx in PATTERNS
        if any(rx.search(variant) for variant in variants)
    ]


# ─── Слой 3. Крещендо ───

def crescendo_count(messages: list[str], *, window: int) -> int:
    """Сколько из последних window сообщений содержат слово словаря
    (одно сообщение считается один раз, сколько бы слов в нём ни было)."""
    return sum(1 for m in messages[-window:] if _has_crescendo_word(normalize(m)))


def _has_crescendo_word(text: str) -> bool:
    return any(_CRESCENDO_RE.search(variant) for variant in _foldings(text))


# ─── Вердикт по входу ───

@dataclass
class InputVerdict:
    action: Action
    reasons: list[str]
    text: str
    contacts: Contacts
    strike: bool


def check_input(
    raw_text: str,
    *,
    history: list[str],
    max_chars: int,
    crescendo_window: int,
    crescendo_hits: int,
) -> InputVerdict:
    """Чистая функция без Redis: clip → normalize → контакт → паттерны → крещендо."""
    text = normalize(clip(raw_text, max_chars))
    contacts = extract_contacts(text)
    hits = find_patterns(text)
    reasons = [f"pattern:{h.name}" for h in hits]

    # Страйк за крещендо только если текущее сообщение само из словаря:
    # иначе безобидный вопрос после серии получил бы отбой.
    total = crescendo_count(history + [text], window=crescendo_window)
    crescendo = _has_crescendo_word(text) and total >= crescendo_hits
    if crescendo:
        reasons.append(f"crescendo:{total}")

    action: Action = "pass"
    if crescendo or any(h.severity == "refuse" for h in hits):
        action = "refuse"
    elif hits:
        action = "flag"

    strike = action == "refuse"
    # 🔴 Слой 6: контакт дороже правила. Причины остаются — панель их увидит.
    if contacts.any and action == "refuse":
        action, strike = "flag", False
        reasons.append("contact_override")
    return InputVerdict(action=action, reasons=reasons, text=text, contacts=contacts, strike=strike)


# ─── Слой 4. Страйки ───

async def apply_strikes(
    redis: Redis,
    verdict: InputVerdict,
    *,
    conversation_id: str,
    ip: str | None,
    limit: int,
    window_seconds: int,
    block_ttl_seconds: int,
) -> InputVerdict:
    """Заблокированный диалог → 'block'; страйк → счётчик; порог → 'block'.
    Алерт оператору о блокировке — шаг 8, здесь только вердикт."""
    if await is_conversation_blocked(redis, conversation_id):
        return replace(verdict, action="block", reasons=verdict.reasons + ["blocked"])
    if not verdict.strike:
        return verdict
    result = await add_strike(
        redis, conversation_id=conversation_id, ip=ip, limit=limit,
        window_seconds=window_seconds, block_ttl_seconds=block_ttl_seconds,
    )
    reasons = verdict.reasons + [f"strikes:{result.count}"]
    return replace(verdict, reasons=reasons, action="block" if result.blocked else verdict.action)


# ─── Слой 9. Документы базы знаний ───

@dataclass
class DocumentVerdict:
    clean: bool
    hits: list[PatternHit]


def scan_document(text: str) -> DocumentVerdict:
    """Только refuse-паттерны: прайс со словом «правила» легален, крещендо не считаем."""
    hits = [h for h in find_patterns(normalize(text)) if h.severity == "refuse"]
    return DocumentVerdict(clean=not hits, hits=hits)


# ─── Слой 7. Проверка ответа ───

@dataclass
class OutputContext:
    first_turn: bool
    contact_known: bool
    allowed_prices: set[int] | None
    allowed_urls: set[str]


@dataclass
class OutputVerdict:
    text: str
    edits: list[str]


_SENT_SPLIT = re.compile(r"((?<=[.!?…])\s+|\n+)")
_GREETING = re.compile(
    r"^\s*(?:здравствуй(?:те)?|добр(?:ый|ое|ого)\s+(?:день|вечер|утро|утра|дня|вечера"
    r"|времени\s+суток)|привет(?:ствую)?|hello|hi|hey|good\s+(?:morning|afternoon|evening))\b",
    re.IGNORECASE,
)
# «Номер» в отеле — комната («номер брони», «номер люкс»): контактом он
# считается только с притяжательным или словом «телефон».
_CONTACT_WORD = r"(?:(?:ваш|твой|свой|мой)\w*\s+номер\w*|номер\w*\s+телефон\w*|контакт\w*|телефон\w*)"
_FALSE_CONTACT = re.compile(
    r"\b(?:записал|сохранил|передал|зафиксировал|принял)\w*\b[^.!?]{0,30}?"
    r"\b(?:" + _CONTACT_WORD + r"|данные)"
    r"|\b" + _CONTACT_WORD + r"\s+(?:записан|сохран[её]н|передан|зафиксирован)\w*",
    re.IGNORECASE,
)
_ASK_CONTACT = re.compile(
    r"\b(?:оставьте|напишите|укажите|отправьте|пришлите|сообщите|подскажите)\b"
    r"[^.!?]{0,30}?\b" + _CONTACT_WORD
    + r"|\b(?:какой|каков|ваш|твой)\b[^.!?]{0,25}?\bтелефон\w*[^.!?]{0,20}\?"
    + r"|\bпо\s+какому\s+номеру\b[^.!?]{0,30}?\bсвязаться\b",
    re.IGNORECASE,
)
_URL = re.compile(r"(?:https?://|www\.)[^\s<>()\"']+", re.IGNORECASE)
_HOST = re.compile(r"^(?:https?://)?(?:www\.)?([^/:?#]+)", re.IGNORECASE)
# Число не длиннее 14 знаков: без предела [\d\s]* откатывается квадратично
# на длинном цифровом ряду без валюты. «руб» без \w*: «рубашки» — не рубли.
_PRICE = re.compile(
    r"(\d(?:[\d\s ]{0,12}\d)?)\s*(?:₸|тг\b|тенге|руб(?:л[ейяьи]*)?\b|₽|\$|€|kzt|rub|usd|евро)"
    r"|\$\s*(\d(?:[\d\s ]{0,12}\d)?)",
    re.IGNORECASE,
)
_PROMISE = re.compile(
    r"\b(?:я\s+)?(?:(?:прямо\s+)?сейчас\s+|сразу\s+)?(?:я\s+)?(?:пришлю|отправлю|скину|вышлю|перешлю)\b"
    r"(?=[^.!?]{0,25}?\b(?:прайс|файл|фото|документ|ссылк|каталог|презентац|договор|счёт|счет"
    r"|реквизит|расчёт|расчет)\w*)",
    re.IGNORECASE,
)
_DISCLAIMER = re.compile(
    r"\b(?:возможно|наверное|может\s+быть|вероятно)\s*,?\s*(?:это|эта\s+цена|предложение)\s+"
    r"(?:уже\s+)?(?:не\s*актуальн|устарел)\w*"
    r"|\b(?:прежн|предыдущ|стар|та|эта|названн)\w*\s+цен\w*\s+(?:была|оказалась|это)\s+"
    r"(?:ошибк|неверн|неправильн)\w*|\bуже\s+не\s*актуальн\w*",
    re.IGNORECASE,
)


def _host(url: str) -> str:
    m = _HOST.match(url.strip())
    return m.group(1).lower() if m else url.lower()


def _cap(s: str) -> str:
    return s[:1].upper() + s[1:]


def check_output(answer: str, ctx: OutputContext) -> OutputVerdict:
    """Детерминированные правки по предложениям. Промпт это уже запрещал,
    модель всё равно нарушает — поэтому проверяет код, после модели."""
    parts = _SENT_SPLIT.split(answer)
    sents: list[str | None] = parts[0::2]
    seps = parts[1::2]
    edits: list[str] = []
    allowed_hosts = {_host(u) for u in ctx.allowed_urls}
    asked_phone = replaced_price = False

    # (а) Повторное приветствие: снимаем фразу, а если после неё есть
    # содержательный хвост — оставляем хвост.
    if not ctx.first_turn and sents and (m := _GREETING.match(sents[0] or "")):
        rest = sents[0][m.end():].lstrip(" ,!.—-")
        sents[0] = _cap(rest) if len(rest.split()) >= 3 else None
        edits.append("greeting")

    for i, s in enumerate(sents):
        if s is None or not s.strip():
            continue
        if not ctx.contact_known and _FALSE_CONTACT.search(s):  # (б)
            sents[i] = None if asked_phone else CONTACT_FALLBACK
            asked_phone = True
            edits.append("false_contact")
            continue
        if _ASK_CONTACT.search(s):  # (в)
            sents[i] = None
            edits.append("ask_contact")
            continue
        if _DISCLAIMER.search(s):  # (ж)
            sents[i] = None
            edits.append("disclaimer")
            continue
        if ctx.allowed_prices is not None:  # (д)
            nums = [int(re.sub(r"\D", "", g1 or g2)) for g1, g2 in _PRICE.findall(s)]
            if any(n not in ctx.allowed_prices for n in nums):
                sents[i] = None if replaced_price else ASK_PRICE
                replaced_price = True
                edits.append("price")
                continue
        s, n = _PROMISE.subn("администратор пришлёт", s)  # (е)
        if n:
            edits.append("promise_action")
        for url in _URL.findall(s):  # (г)
            url = url.rstrip(".,;:!?")  # точку в конце предложения оставляем
            if _host(url) not in allowed_hosts:
                s = re.sub(r"\s+([.,;:!?])", r"\1", s.replace(url, ""))
                edits.append("url")
        sents[i] = _cap(_SPACES.sub(" ", s).strip())

    out: list[str] = []
    for i, s in enumerate(sents):
        if s is None:
            continue
        out.append(s)
        if i < len(seps):
            out.append(seps[i])
    text = "".join(out).strip()
    if not text:
        text = FALLBACK_ANSWER
        edits.append("empty")
    return OutputVerdict(text=text, edits=edits)
