"""Шаг 5: пост-обработка ответа — зачины, разметка, эмодзи, пустой результат."""

from src.ai.humanizer import humanize


def test_openers_are_cut() -> None:
    assert humanize("Конечно! Заезд с 14:00.") == "Заезд с 14:00."
    assert humanize("Отличный вопрос! Заезд с 14:00.") == "Заезд с 14:00."
    assert humanize("Спасибо за вопрос! Заезд с 14:00.") == "Заезд с 14:00."
    assert humanize("Хороший вопрос. Заезд с 14:00.") == "Заезд с 14:00."
    result = humanize("Разумеется, заезд с 14:00.")
    assert not result.lower().startswith("разумеется")
    assert result.lower().endswith("заезд с 14:00.")


def test_opener_inside_text_is_kept() -> None:
    assert humanize("Заезд с 14:00, конечно, можно раньше.") == "Заезд с 14:00, конечно, можно раньше."


def test_opener_cut_only_on_word_boundary() -> None:
    assert humanize("Конечно же, можно.") == "Можно."
    assert humanize("Конечность.") == "Конечность."
    assert humanize("Конечности не режем.") == "Конечности не режем."


def test_dialogue_dash_is_not_a_bullet() -> None:
    assert humanize("— Есть студия.") == "— Есть студия."
    assert humanize("– Есть студия.") == "– Есть студия."
    assert humanize("+ один\n• два") == "- один\n- два"


def test_markdown_removed_by_default() -> None:
    assert humanize("**Цена** — 20 000 тенге") == "Цена — 20 000 тенге"
    assert humanize("Это *важно* знать") == "Это важно знать"
    assert humanize("# Правила\nЗаезд с 14:00.") == "Правила\nЗаезд с 14:00."
    assert humanize("* один\n* два") == "- один\n- два"


def test_markdown_kept_when_channel_supports_it() -> None:
    assert humanize("**Цена** — 20 000 тенге", markdown=True) == "**Цена** — 20 000 тенге"


def test_tables_untouched() -> None:
    table = "| Номер | Цена |\n|---|---|\n| Студия | 20 000 |"
    assert humanize(table) == table


def test_emoji_removed_by_default_and_kept_on_request() -> None:
    result = humanize("Привет 😊 как дела? ✅")
    assert "😊" not in result and "✅" not in result
    assert "Привет" in result and "как дела?" in result
    assert "😊" in humanize("Привет 😊", emoji=True)
    # Буквы и знаки препинания — не эмодзи.
    assert humanize("Ёжик, №5 — «да»!") == "Ёжик, №5 — «да»!"
    # Символы-содержимое: звёздность отеля, значок телефона, диаметр.
    assert humanize("Отель 4★") == "Отель 4★"
    assert humanize("☎ +7 701 000 00 00") == "☎ +7 701 000 00 00"
    assert humanize("⌀ 20 мм") == "⌀ 20 мм"
    assert humanize("Готово ⭐ ❗ ✨ ❌") == "Готово"


def test_triple_newlines_collapse_and_edges_trimmed() -> None:
    assert humanize("  Первое.\n\n\n\nВторое.  \n") == "Первое.\n\nВторое."


def test_empty_result_returns_original() -> None:
    assert humanize("Конечно!") == "Конечно!"
    assert humanize("  😊  ") == "😊"
    assert humanize("") == ""
