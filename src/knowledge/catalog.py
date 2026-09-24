"""Справочник ошибок платформы: чтение data/errors.md и поиск записи.

🔴 У платформы НЕТ кодов ошибок: API отдаёт человеческие тексты по-русски
(«adults — целое ≥ 1»). Поэтому основной поиск — по тексту сообщения,
а поле кода необязательное: заведут коды позже — поиск станет точным
без правки этого модуля.

Справочник — данные, владелец правит его без выкатки. Кэш по (путь,
mtime_ns), как в src/knowledge/prompt.py.

🔴 Ничего не нашли — возвращаем пусто, а не ближайшую запись. Выдуманная
причина ошибки хуже молчания: по ней человек пойдёт что-то чинить.
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

# Значения поля «Состояние». Чужое не роняет разбор: это данные владельца.
STATUSES: tuple[str, ...] = (
    "ожидаемое поведение",
    "известный дефект",
    "чинится",
    "исправлено",
)
STATUS_UNKNOWN = "не указано"

# Доля слов записи, начиная с которой считаем, что это та же ошибка.
# 🔴 Порог высокий намеренно: промах даёт «не знаю», а ложное срабатывание
# даёт человеку чужую причину, по которой он пойдёт чинить не то.
MATCH_THRESHOLD = 0.7
# Слова короче этого в сравнении не участвуют: «при», «или», «нет» есть везде.
_MIN_WORD = 4
# Одно общее слово («бронь») подводит конкретную запись под общую жалобу.
_MIN_COMMON = 2


@dataclass(frozen=True)
class ErrorEntry:
    """Одна запись справочника. raw — исходный текст блока, для базы знаний."""

    title: str
    code: str | None
    section: str | None
    symptom: str
    cause: str
    action: str
    status: str
    raw: str


class CatalogMissing(FileNotFoundError):
    """Файла справочника нет. Пустой файл ошибкой НЕ считается: владелец мог
    ещё не заполнить его, и бот тогда просто зовёт человека."""


# Имя поля в файле -> имя поля в ErrorEntry.
_FIELDS: dict[str, str] = {
    "код": "code",
    "раздел": "section",
    "что видит человек": "symptom",
    "причина": "cause",
    "что делать": "action",
    "состояние": "status",
}
# Без них запись бесполезна: нечего сопоставить и нечего ответить.
_REQUIRED = ("symptom", "cause", "action")

_HEADING_RE = re.compile(r"^##\s+(.*\S)\s*$")
_FIELD_RE = re.compile(r"^\s*[-*]\s*\*\*\s*([^*:]+?)\s*:?\s*\*\*\s*:?\s*(.*)$")
_FENCE_RE = re.compile(r"^\s*(?:```|~~~)")
# Хвост «(код 500)» и «(500)» из текста убираем: кода у платформы нет,
# а цифры мешают сравнению.
_CODE_TAIL_RE = re.compile(r"\(\s*(?:код|code)[^)]*\)|\(\s*\d+\s*\)")
_QUOTED_RE = re.compile(r"«([^»]+)»|“([^”]+)”")
_QUOTE_CHARS = "«»„“”‘’\"'`"
_WORD_RE = re.compile(r"[0-9a-zа-яё_]+")

# (путь) -> (mtime_ns, записи)
_cache: dict[str, tuple[int, list[ErrorEntry]]] = {}


# ─── Чтение ───


def load_catalog(path: str | Path) -> list[ErrorEntry]:
    """Записи справочника с диска или из кэша. Нет файла -> CatalogMissing."""
    file = Path(path)
    key = str(file)
    try:
        mtime_ns = file.stat().st_mtime_ns
        cached = _cache.get(key)
        if cached is not None and cached[0] == mtime_ns:
            return cached[1]
        text = file.read_text(encoding="utf-8")
    except FileNotFoundError:
        # Файл мог исчезнуть и между stat и чтением: исход тот же.
        _cache.pop(key, None)
        raise CatalogMissing(f"файл справочника ошибок не найден: {file}") from None
    entries = parse_catalog(text)
    _cache[key] = (mtime_ns, entries)
    return entries


def reset_catalog_cache() -> None:
    """Сброс кэша: для тестов и после правки справочника."""
    _cache.clear()


def parse_catalog(text: str) -> list[ErrorEntry]:
    """Разбор формата data/errors.md. Пустой текст -> пустой список.

    Строки в ограде ``` полями не считаются: в шапке файла лежит пример
    формата, а незакрытая ограда иначе отдала бы поля следующей записи
    предыдущей — та молча получила бы чужую причину.
    """
    entries: list[ErrorEntry] = []
    title: str | None = None
    # (строка, была ли она в ограде): первое для raw, второе — для полей.
    block: list[tuple[str, bool]] = []
    in_fence = False
    for line in text.splitlines():
        if _FENCE_RE.match(line):
            in_fence = not in_fence
            if title is not None:
                block.append((line, True))
            continue
        heading = None if in_fence else _HEADING_RE.match(line)
        if heading is not None:
            _append(entries, title, block)
            title = heading.group(1).strip()
            block = [(line, False)]
            continue
        if title is not None:
            block.append((line, in_fence))
    _append(entries, title, block)
    if in_fence:
        # Ограду забыли закрыть — часть справочника пропала из разбора.
        logger.warning("справочник: ограда ``` не закрыта, часть записей не прочитана")
    return entries


def _append(entries: list[ErrorEntry], title: str | None, block: list[tuple[str, bool]]) -> None:
    """Собирает запись из блока строк. Неполная — пропускается с warning."""
    if title is None:
        return
    values: dict[str, str] = {}
    for line, fenced in block:
        if fenced:
            continue
        field = _FIELD_RE.match(line)
        if field is None:
            continue
        name = _FIELDS.get(field.group(1).strip().lower())
        if name is None:
            continue
        if name in values:
            # Первое значение побеждает: молчаливая победа последнего —
            # это подмена причины, которую владелец не заметит.
            logger.warning("справочник: в записи «%s» повтор поля, взято первое", title)
            continue
        values[name] = _clean_value(field.group(2))
    missing = [name for name in _REQUIRED if not values.get(name)]
    if missing:
        # 🔴 В журнал только заголовок: содержимое записи туда не уходит.
        logger.warning(
            "справочник: запись «%s» пропущена, нет полей: %s", title, ", ".join(missing)
        )
        return
    # Регистр значения не важен так же, как регистр имени поля.
    status = (values.get("status") or "").strip().lower() or STATUS_UNKNOWN
    if status not in STATUSES and status != STATUS_UNKNOWN:
        logger.warning("справочник: у записи «%s» незнакомое состояние", title)
    entries.append(
        ErrorEntry(
            title=title,
            code=values.get("code") or None,
            section=values.get("section") or None,
            symptom=values["symptom"],
            cause=values["cause"],
            action=values["action"],
            status=status,
            raw="\n".join(line for line, _ in block).strip(),
        )
    )


def _clean_value(value: str) -> str:
    """Пояснение в скобках, прочерк и заготовка в фигурных скобках = пусто.

    🔴 Про заготовку: «{заполните после разбора}» в поле «Причина» прошло бы
    проверку обязательных полей и уехало модели КАК ПРИЧИНА. Пусть запись
    честно выпадет с предупреждением, чем ответит заготовкой.
    """
    text = value.strip()
    if not text or text in {"-", "—", "–"}:
        return ""
    if text.startswith("(") and text.endswith(")"):
        return ""
    if text.startswith("{") and text.endswith("}"):
        return ""
    return text


# ─── Поиск ───


def normalize_message(text: str) -> str:
    """Текст сообщения к сравнимому виду: регистр, кавычки, пробелы, хвост кода."""
    result = str(text or "").lower()
    result = _CODE_TAIL_RE.sub(" ", result)
    result = "".join(" " if ch in _QUOTE_CHARS else ch for ch in result)
    return re.sub(r"\s+", " ", result).strip()


def find_by_code(entries: list[ErrorEntry], code: str | None) -> ErrorEntry | None:
    """Точное совпадение кода, регистр не важен. Кода нет -> None."""
    needle = (code or "").strip().lower()
    if not needle:
        return None
    for entry in entries:
        if entry.code and entry.code.strip().lower() == needle:
            return entry
    return None


def find_by_text(entries: list[ErrorEntry], text: str, *, limit: int = 3) -> list[ErrorEntry]:
    """Поиск по тексту сообщения. Пусто, если ничего не похоже.

    Сначала точное вхождение текста записи в сообщение, потом доля слов
    записи, нашедшихся в сообщении. Сравниваем и с симптомом целиком,
    и с кавычками: в кавычках стоит само сообщение платформы.

    🔴 Обратное вхождение (сообщение — кусок симптома) совпадением НЕ
    считается: тогда «бронь» попадало бы в любую запись про брони.
    """
    normalized = normalize_message(text)
    if not normalized:
        return []
    words = _words(normalized)
    scored: list[tuple[float, int, ErrorEntry]] = []
    for position, entry in enumerate(entries):
        score = max((_score(needle, normalized, words) for needle in _needles(entry)), default=0.0)
        if score >= MATCH_THRESHOLD:
            # position — чтобы порядок одинаковых совпадений не плавал.
            scored.append((score, -position, entry))
    scored.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return [entry for _, _, entry in scored[:limit]]


def _needles(entry: ErrorEntry) -> list[str]:
    """С чем сравниваем сообщение: симптом целиком и куски в кавычках."""
    result = [entry.symptom]
    for source in (entry.symptom, entry.title):
        result.extend(m.group(1) or m.group(2) or "" for m in _QUOTED_RE.finditer(source))
    return [n for n in result if n.strip()]


def _score(needle: str, normalized: str, words: set[str]) -> float:
    """1.0, если текст записи целиком есть в сообщении; иначе доля слов
    записи, нашедшихся в сообщении. Пустая сторона -> 0. 🔴 Доля считается
    от длины ЗАПИСИ, а не от меньшей из двух длин: от меньшей любое короткое
    сообщение получало 1.0 по одному общему слову."""
    needle_norm = normalize_message(needle)
    if not needle_norm:
        return 0.0
    if needle_norm in normalized:
        return 1.0
    needle_words = _words(needle_norm)
    if not needle_words or not words:
        return 0.0
    common = sum(1 for word in needle_words if any(_same_word(word, other) for other in words))
    if common < _MIN_COMMON:
        return 0.0
    return common / len(needle_words)


def _words(text: str) -> set[str]:
    """Слова длиннее трёх букв: короткие есть в любом сообщении."""
    return {w for w in _WORD_RE.findall(text) if len(w) >= _MIN_WORD}


def _same_word(first: str, second: str) -> bool:
    """Одно слово в разных формах: «целое» и «целым», «брони» и «бронь».
    Лемматизация сюда не тянется (лишняя зависимость ради справочника),
    поэтому сравниваем общее начало. Итог ещё проходит через _MIN_COMMON
    и MATCH_THRESHOLD: промах даёт «не знаю», а не догадку."""
    if first == second:
        return True
    common = len(os.path.commonprefix([first, second]))
    if common >= 5:
        return True
    return common >= 3 and len(first) <= 5 and len(second) <= 5
