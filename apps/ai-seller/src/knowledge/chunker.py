"""Нарезка текста на чанки: предложения не рвутся, таблицы разворачиваются построчно.

Чистые функции, без I/O. Разборщики форматов (pdf, docx, xlsx) отдают сюда
уже текст в markdown, таблицы — как markdown-таблицы.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

__all__ = ["Chunk", "split_text"]


@dataclass(frozen=True)
class Chunk:
    """Один чанк документа. meta: kind — 'text' | 'table_row', header — шапка таблицы."""

    index: int
    text: str
    meta: dict


# Строка-разделитель markdown-таблицы: |---|:--:|---|. По GFM хватает одного
# дефиса («|-|-|»): три и больше — частая запись, но не требование.
_TABLE_SEP_RE = re.compile(r"^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$")
# Граница ячейки — «|» без обратного слеша перед ней: «\|» — символ внутри ячейки.
_CELL_SPLIT_RE = re.compile(r"(?<!\\)\|")
_HEADING_RE = re.compile(r"^#{1,6}\s+(.*?)\s*#*\s*$")
# Граница предложения: . ! ? … и за ними пробел или перенос.
_SENTENCE_RE = re.compile(r"(?<=[.!?…])\s+")

# Сокращения, после которых точка не заканчивает предложение. Первый набор
# не бывает в конце фразы («ул. Толе би»), второй бывает («500 тг. Оплата…»),
# поэтому склеивается только когда дальше идёт строчная буква или цифра.
_ALWAYS_ABBR = frozenset(
    "г ул д кв пр пл стр корп оф им обл р-н т.е т.к напр см ср тел № п пп ст гл рис табл".split()
)
_SOFT_ABBR = frozenset(
    "тг руб тыс млн млрд шт ед мин макс кг км м т.д т.п др чел сут".split()
)
_ABBR_TAIL_RE = re.compile(r"(?:^|[\s(«\"])([а-яё.\-№]+)\.$", re.IGNORECASE)


def _continues_sentence(prev: str, nxt: str) -> bool:
    match = _ABBR_TAIL_RE.search(prev)
    if not match:
        return False
    token = match.group(1).lower().rstrip(".")
    if token in _ALWAYS_ABBR:
        return True
    if token in _SOFT_ABBR:
        return nxt[:1].islower() or nxt[:1].isdigit()
    return False


def split_sentences(text: str) -> list[str]:
    """Границы предложений с учётом русских сокращений.

    Голая регулярка режет «г. Алматы, ул. Абая» на пять обрывков; они попадают
    в перекрытие и в жёсткие разрезы посередине адреса.
    """
    parts = [s for s in _SENTENCE_RE.split(text) if s]
    out: list[str] = []
    for part in parts:
        if out and _continues_sentence(out[-1], part):
            out[-1] = f"{out[-1]} {part}"
        else:
            out.append(part)
    return out


def split_text(
    text: str, *, chunk_chars: int = 900, overlap: int = 150, min_chars: int = 80
) -> list[Chunk]:
    """Режет документ на чанки. Пустой текст -> []."""
    if not text or not text.strip():
        return []
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")

    chunks: list[Chunk] = []
    heading: str | None = None  # ближайший заголовок markdown — контекст для строк таблицы
    text_lines: list[str] = []

    def flush_text() -> None:
        for body in _pack_segment(text_lines, chunk_chars, overlap, min_chars):
            chunks.append(Chunk(len(chunks), body, {"kind": "text", "header": None}))
        text_lines.clear()

    i = 0
    while i < len(lines):
        stripped = lines[i].strip()
        if stripped.startswith("|") and i + 1 < len(lines) and _TABLE_SEP_RE.match(lines[i + 1].strip()):
            flush_text()
            end = i + 2
            while end < len(lines) and lines[end].strip().startswith("|"):
                end += 1
            header_cells = _cells(stripped)
            for row_line in lines[i + 2 : end]:
                body = _row_text(header_cells, _cells(row_line.strip()), heading)
                if body:
                    meta = {"kind": "table_row", "header": " | ".join(header_cells)}
                    chunks.append(Chunk(len(chunks), body, meta))
            i = end
            continue
        m = _HEADING_RE.match(stripped)
        if m:
            heading = m.group(1) or None
            # Заголовок — отдельный абзац, даже без пустых строк вокруг: иначе
            # он склеится с текстом под ним, и весь абзац сойдёт за «заголовок».
            text_lines.extend(["", lines[i], ""])
        else:
            text_lines.append(lines[i])
        i += 1
    flush_text()
    return chunks


# ─── Таблицы ───


def _cells(line: str) -> list[str]:
    """Ячейки строки. Экранированная «\\|» (так пишут разборщики docx/xlsx) остаётся «|»."""
    inner = line.strip().strip("|")
    return [c.replace("\\|", "|").strip() for c in _CELL_SPLIT_RE.split(inner)]


def _row_text(headers: list[str], cells: list[str], heading: str | None) -> str:
    """«Шапка1: значение1; Шапка2: значение2» — без шапки «Базовый | 1900 ₽» не читается."""
    if not any(cells):
        return ""
    pairs = []
    for n, value in enumerate(cells):
        name = headers[n] if n < len(headers) and headers[n] else f"Колонка {n + 1}"
        pairs.append(f"{name}: {value}")
    body = "; ".join(pairs)
    return f"{heading} — {body}" if heading else body


# ─── Обычный текст ───


def _pack_segment(lines: list[str], chunk_chars: int, overlap: int, min_chars: int) -> list[str]:
    """Кусок текста между таблицами -> тексты чанков."""
    paragraphs = _paragraphs(lines)
    # Сегмент из одних заголовков не чанк: заголовок уже ушёл контекстом в строки таблицы.
    # Заголовок здесь всегда отдельный абзац (split_text его обособил), поэтому
    # проверка не задевает текст под ним.
    if not paragraphs or all(_HEADING_RE.match(p) for p in paragraphs):
        return []
    # Маркер «#» модели не нужен, текст заголовка — да: он остаётся в чанке.
    paragraphs = [_strip_heading(p) for p in paragraphs]
    sentences = [s for p in paragraphs for s in split_sentences(p)]
    packed = _pack(sentences, chunk_chars, overlap)
    packed = _glue_short(packed, chunk_chars, min_chars)
    return [" ".join(sent) for sent, _ in packed]


def _strip_heading(paragraph: str) -> str:
    m = _HEADING_RE.match(paragraph)
    return m.group(1) if m else paragraph


def _paragraphs(lines: list[str]) -> list[str]:
    result: list[str] = []
    current: list[str] = []
    for line in lines:
        if line.strip():
            current.append(line.strip())
        elif current:
            result.append(" ".join(current))
            current = []
    if current:
        result.append(" ".join(current))
    return result


def _joined_len(sentences: list[str]) -> int:
    return sum(len(s) for s in sentences) + max(len(sentences) - 1, 0)


def _tail(sentences: list[str], overlap: int, chunk_chars: int) -> list[str]:
    """Последние предложения общей длиной около overlap — они повторятся в следующем чанке."""
    if overlap <= 0:
        return []
    tail: list[str] = []
    for s in reversed(sentences):
        if _joined_len([s, *tail]) > overlap:
            break
        tail.insert(0, s)
    # Ни одно не влезло, но последнее короткое: берём его, чтобы перекрытие было хоть каким-то.
    if not tail and len(sentences[-1]) <= chunk_chars // 2:
        tail = [sentences[-1]]
    return tail


def _pack(sentences: list[str], chunk_chars: int, overlap: int) -> list[tuple[list[str], int]]:
    """Упаковка предложений в чанки. Возвращает (предложения, сколько из них перенесено из предыдущего)."""
    packed: list[tuple[list[str], int]] = []
    cur: list[str] = []
    carried = 0

    def flush() -> None:
        nonlocal cur, carried
        if len(cur) > carried:  # чанк из одного перекрытия — дубль предыдущего, не пишем
            packed.append((cur, carried))
            tail = _tail(cur, overlap, chunk_chars)
            cur, carried = list(tail), len(tail)
        else:
            cur, carried = [], 0

    for s in sentences:
        if len(s) > chunk_chars:
            # Предложение длиннее чанка — единственный случай жёсткого разреза.
            flush()
            cur, carried = [], 0
            pieces = [s[k : k + chunk_chars] for k in range(0, len(s), chunk_chars)]
            for piece in pieces[:-1]:
                packed.append(([piece], 0))
            cur = [pieces[-1]]
            continue
        while cur and _joined_len(cur) + 1 + len(s) > chunk_chars:
            flush()
        cur.append(s)
    if len(cur) > carried:
        packed.append((cur, carried))
    return packed


def _glue_short(
    packed: list[tuple[list[str], int]], chunk_chars: int, min_chars: int
) -> list[tuple[list[str], int]]:
    """Чанк короче min_chars приклеивается к предыдущему: обрывки только шумят в выдаче.

    Если склейка не влезает в chunk_chars, предыдущий отдаёт короткому свои
    последние предложения, чтобы оба остались в пределах.
    """
    result: list[tuple[list[str], int]] = []
    for sentences, carried in packed:
        if not result or _joined_len(sentences) >= min_chars:
            result.append((sentences, carried))
            continue
        prev, prev_carried = result[-1]
        fresh = sentences[carried:]  # перенесённые предложения в предыдущем уже есть
        if _joined_len(prev + fresh) <= chunk_chars:
            result[-1] = (prev + fresh, prev_carried)
            continue
        prev = list(prev)
        while len(prev) > 1 and _joined_len(fresh) < min_chars:
            fresh.insert(0, prev.pop())
        result[-1] = (prev, min(prev_carried, len(prev)))
        result.append((fresh, 0))
    return result
