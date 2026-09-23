"""Пост-обработка ответа перед отправкой: зачины, разметка, эмодзи.

Модель любит начинать с «Конечно!» и «Отличный вопрос!» — живой продавец
так не пишет. Markdown и эмодзи снимаются там, где канал их не рендерит:
клиент в таком канале видел бы звёздочки и квадратики.

Чистая функция над строкой: ни модели, ни настроек, ни сети.
"""

from __future__ import annotations

import re

# Зачины, которые срезаются с начала ответа. Только начало строки:
# внутри текста «конечно» — обычное слово. Длинные раньше коротких:
# иначе «конечно же» срежется до «конечно» и оставит «же».
_OPENERS = (
    "конечно же",
    "конечно",
    "разумеется",
    "безусловно",
    "отличный вопрос",
    "хороший вопрос",
    "прекрасный вопрос",
    "спасибо за вопрос",
    "спасибо за ваш вопрос",
    "с удовольствием",
)
# Граница слова и обязательный разделитель после зачина: без них
# «Конечность.» резалась до «Сть.» — содержимое, а не зачин.
_OPENER_RE = re.compile(
    r"^\s*(?:" + "|".join(re.escape(o) for o in sorted(_OPENERS, key=len, reverse=True))
    + r")\b(?:\s*[!.,:;—–-]+\s*|\s+)",
    re.IGNORECASE,
)

# Разметка: жирный/курсив, заголовки, маркеры списков, ссылки.
_BOLD_RE = re.compile(r"(\*\*|__)(.+?)\1", re.DOTALL)
_ITALIC_RE = re.compile(r"(?<![\w*])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![\w*])")
_HEADER_RE = re.compile(r"^\s{0,3}#{1,6}\s+", re.MULTILINE)
# Только markdown-маркеры: «–» и «—» в начале строки — диалоговое тире, текст.
_BULLET_RE = re.compile(r"^(\s*)[*•+]\s+", re.MULTILINE)
_LINK_RE = re.compile(r"\[([^\]]+)\]\((\S+?)\)")

# Эмодзи: блоки пиктограмм и флагов плюс явный список дингбатов. Сплошные
# блоки «разных символов» не берём: там ★ (звёздность), ☎, ⌀ — это содержимое.
_EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001FAFF"  # пиктограммы, смайлы, тон кожи
    "\U0001F1E6-\U0001F1FF"  # флаги
    "✅❌❎❗❕❓❔✨✔✖⭐❤⚡⚠⛔☺☹⏰⏳⌛➡⬅⬆⬇✈⛱⛺"
    "‍️"  # соединитель и селектор варианта
    "]+"
)

_MULTI_SPACE_RE = re.compile(r"[ \t]{2,}")
_TRAILING_SPACE_RE = re.compile(r"[ \t]+$", re.MULTILINE)
_MULTI_NEWLINE_RE = re.compile(r"\n(?:[ \t]*\n){2,}")


def _strip_openers(text: str) -> str:
    """Срезает зачины с начала, по одному: «Конечно! Отличный вопрос!» — оба."""
    while True:
        cut = _OPENER_RE.sub("", text, count=1)
        if cut == text:
            return text
        text = cut


def _capitalize_first(text: str) -> str:
    """После среза зачина фраза начинается с маленькой буквы — поднимаем её."""
    for i, ch in enumerate(text):
        if ch.isalpha():
            return text[:i] + ch.upper() + text[i + 1 :]
        if not ch.isspace():
            return text
    return text


def _strip_markdown(text: str) -> str:
    """Снимает разметку построчно. Строки с «|» — таблицы — не трогаем:
    в них звёздочки и дефисы бывают частью выравнивания."""
    out: list[str] = []
    for line in text.split("\n"):
        if "|" in line:
            out.append(line)
            continue
        line = _HEADER_RE.sub("", line)
        line = _BULLET_RE.sub(r"\1- ", line)
        line = _BOLD_RE.sub(r"\2", line)
        line = _ITALIC_RE.sub(r"\1", line)
        line = _LINK_RE.sub(r"\1 \2", line)
        out.append(line)
    return "\n".join(out)


def _tidy_spaces(text: str) -> str:
    """Убирает следы вырезанного: двойные пробелы и хвосты строк.
    Таблицы пропускаем — там пробелы держат колонки."""
    lines = [
        line if "|" in line else _MULTI_SPACE_RE.sub(" ", line) for line in text.split("\n")
    ]
    return _TRAILING_SPACE_RE.sub("", "\n".join(lines))


def humanize(text: str, *, markdown: bool = False, emoji: bool = False) -> str:
    """Готовит ответ модели к каналу.

    markdown=False — снять разметку, emoji=False — убрать эмодзи.
    Тройные переносы схлопываются в двойные, края обрезаются.
    Если после чистки ничего не осталось (ответ был одним «Конечно!»),
    возвращается исходный текст с обрезанными краями: зачин лучше пустоты.
    """
    original = text.strip()
    result = _capitalize_first(_strip_openers(original))
    if not markdown:
        result = _strip_markdown(result)
    if not emoji:
        result = _EMOJI_RE.sub("", result)
    result = _tidy_spaces(result)
    result = _MULTI_NEWLINE_RE.sub("\n\n", result).strip()
    return result or original
