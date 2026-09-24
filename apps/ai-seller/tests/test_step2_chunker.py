"""Шаг 2: нарезка текста. Таблицы разворачиваются построчно, предложения не рвутся."""

import dataclasses
import re

import pytest

from src.knowledge.chunker import Chunk, split_text

TABLE = """| Тариф | Цена | Срок |
|---|---|---|
| Базовый | 1900 ₽ | месяц |
| Про | 4900 ₽ | квартал |
| Бизнес | 9900 ₽ | год |
"""

TABLE_WITH_HEADING = "# Цены\n\nНиже актуальные тарифы.\n\n" + TABLE

COLUMNS = ("Тариф", "Цена", "Срок")
ROWS = (
    ("Базовый", "1900", "месяц"),
    ("Про", "4900", "квартал"),
    ("Бизнес", "9900", "год"),
)

SENTENCES = [
    f"Предложение номер {i} рассказывает о правилах заселения, оплате и выезде гостей из хостела."
    for i in range(1, 41)
]
# Один абзац: перекрытие проверяется внутри сплошного текста, без вопроса,
# переносится ли оно через границу абзацев.
LONG_TEXT = " ".join(SENTENCES)

CHUNK_CHARS = 900
OVERLAP = 150
MIN_CHARS = 80


def _split(text: str) -> list[Chunk]:
    return split_text(text, chunk_chars=CHUNK_CHARS, overlap=OVERLAP, min_chars=MIN_CHARS)


def _rows(chunks: list[Chunk]) -> list[Chunk]:
    return [c for c in chunks if c.meta["kind"] == "table_row"]


def test_table_of_three_rows_gives_three_row_chunks() -> None:
    chunks = _split(TABLE)
    assert len(chunks) == 3
    assert all(c.meta["kind"] == "table_row" for c in chunks)
    assert all(c.meta.get("header") for c in chunks)


def test_each_row_chunk_has_all_column_names_and_own_values() -> None:
    rows = _rows(_split(TABLE))
    for chunk, values in zip(rows, ROWS, strict=True):
        for column in COLUMNS:
            assert column in chunk.text, f"в чанке строки нет имени колонки «{column}»"
        for value in values:
            assert value in chunk.text


def test_row_chunks_do_not_mix_rows() -> None:
    rows = _rows(_split(TABLE))
    prices = ("1900", "4900", "9900")
    for chunk in rows:
        assert sum(price in chunk.text for price in prices) == 1


def test_table_rows_ignore_min_chars() -> None:
    # Строка «Базовый: 1900 ₽» короче min_chars, но остаётся отдельным чанком.
    rows = _rows(_split(TABLE))
    assert len(rows) == 3


def test_heading_above_table_goes_into_row_chunks() -> None:
    rows = _rows(_split(TABLE_WITH_HEADING))
    assert len(rows) == 3
    for chunk in rows:
        assert "Цены" in chunk.text
        assert chunk.text.startswith("Цены")


def test_long_text_chunks_respect_chunk_chars() -> None:
    chunks = _split(LONG_TEXT)
    assert len(chunks) > 1
    for chunk in chunks:
        assert chunk.meta["kind"] == "text"
        assert len(chunk.text) <= CHUNK_CHARS


def test_long_text_chunks_overlap() -> None:
    chunks = _split(LONG_TEXT)
    for previous, current in zip(chunks, chunks[1:], strict=False):
        # Перекрытие ~150 символов при предложениях ~90: начало следующего
        # чанка целиком встречается в конце предыдущего.
        head = current.text[:40]
        assert head in previous.text, "начало чанка не повторяет конец предыдущего"


def test_long_text_no_chunk_shorter_than_min_chars() -> None:
    for chunk in _split(LONG_TEXT):
        assert len(chunk.text) >= MIN_CHARS


def test_long_text_no_sentence_is_cut() -> None:
    chunks = _split(LONG_TEXT)
    for sentence in SENTENCES:
        assert any(sentence in c.text for c in chunks), f"предложение разрезано: {sentence}"


def test_indexes_are_sequential_from_zero() -> None:
    chunks = _split(LONG_TEXT)
    assert [c.index for c in chunks] == list(range(len(chunks)))


def test_sentence_longer_than_chunk_chars_is_hard_cut() -> None:
    giant = "а" * 2500 + "."
    chunks = split_text(giant, chunk_chars=900, overlap=0, min_chars=80)
    assert len(chunks) >= 3
    assert all(len(c.text) <= 900 for c in chunks)


def test_short_document_is_single_chunk() -> None:
    text = "Заезд с 14:00."
    chunks = _split(text)
    assert len(chunks) == 1
    assert chunks[0].index == 0
    assert chunks[0].text.strip() == text


def test_empty_text_gives_nothing() -> None:
    assert split_text("") == []


def test_chunk_is_frozen_dataclass() -> None:
    chunk = _split("Заезд с 14:00.")[0]
    assert dataclasses.is_dataclass(chunk)
    with pytest.raises(dataclasses.FrozenInstanceError):
        chunk.text = "другое"  # type: ignore[misc]


def test_text_chunk_meta_shape() -> None:
    chunk = _split("Заезд с 14:00.")[0]
    assert chunk.meta["kind"] == "text"
    assert chunk.meta["header"] is None


def test_sentence_boundaries_are_dot_bang_question() -> None:
    text = "Первое предложение довольно длинное, чтобы пройти минимум! Второе тоже? Третье — да."
    chunks = split_text(text, chunk_chars=70, overlap=0, min_chars=10)
    joined = " ".join(c.text for c in chunks)
    for sentence in re.split(r"(?<=[.!?])\s+", text):
        assert sentence in joined


# ─── Ревью: разделитель таблицы по GFM — от одного дефиса ───


@pytest.mark.parametrize("separator", ["|-|-|-|", "| - | - | - |", "|:-:|:-:|:-:|", "|--|--|--|"])
def test_table_separator_with_fewer_dashes_is_still_a_table(separator: str) -> None:
    table = "| Тариф | Цена | Срок |\n" + separator + "\n" + "\n".join(TABLE.splitlines()[2:]) + "\n"
    rows = _rows(_split(table))
    assert len(rows) == 3
    for chunk, values in zip(rows, ROWS, strict=True):
        for column in COLUMNS:
            assert column in chunk.text
        for value in values:
            assert value in chunk.text


# ─── Ревью: заголовок без пустой строки не съедает текст под ним ───


def test_heading_directly_followed_by_text_keeps_text() -> None:
    text = "# Правила\nЗаезд после четырнадцати часов, выезд до двенадцати часов дня."
    chunks = _split(text)
    assert len(chunks) == 1
    assert "Заезд после четырнадцати часов" in chunks[0].text
    assert "Правила" in chunks[0].text
    assert "#" not in chunks[0].text


def test_intro_sentence_under_heading_before_table_is_kept() -> None:
    intro = "Ниже актуальные тарифы на проживание в хостеле для всех категорий гостей."
    text = "# Цены\n" + intro + "\n" + TABLE
    chunks = _split(text)
    texts = [c for c in chunks if c.meta["kind"] == "text"]
    assert len(texts) == 1
    assert intro in texts[0].text
    assert len(_rows(chunks)) == 3


def test_segment_of_only_heading_gives_no_text_chunk() -> None:
    # Заголовок уже ушёл контекстом в строки таблицы — отдельный чанк «Цены» только шумит.
    chunks = _split("# Цены\n" + TABLE)
    assert all(c.meta["kind"] == "table_row" for c in chunks)
    assert len(chunks) == 3


# ─── Ревью: экранированная «|» в ячейке не сдвигает колонки ───


def test_escaped_pipe_in_cell_does_not_shift_columns() -> None:
    table = "| A | B |\n|---|---|\n| x\\|y | z |\n"
    rows = _rows(_split(table))
    assert len(rows) == 1
    assert rows[0].text == "A: x|y; B: z"
