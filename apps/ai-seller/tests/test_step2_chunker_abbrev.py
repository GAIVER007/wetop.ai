"""Нарезка с учётом предложений не должна рвать русские сокращения.

«ул. Толе би» или «т.е.» — не конец предложения. Разрыв на них даёт
обрывки, которые попадают в перекрытие и в жёсткие разрезы посередине адреса.
"""

from src.knowledge.chunker import split_sentences


def test_address_abbreviations_do_not_end_sentence() -> None:
    text = "Адрес: г. Алматы, ул. Толе би, д. 286/8. Заезд с 14:00. Выезд до 12:00."
    assert split_sentences(text) == [
        "Адрес: г. Алматы, ул. Толе би, д. 286/8.",
        "Заезд с 14:00.",
        "Выезд до 12:00.",
    ]


def test_common_abbreviations_do_not_end_sentence() -> None:
    text = "Стирка, т.е. одна загрузка, стоит 500 тг. Оплата на месте, напр. Kaspi."
    assert split_sentences(text) == [
        "Стирка, т.е. одна загрузка, стоит 500 тг.",
        "Оплата на месте, напр. Kaspi.",
    ]


def test_ordinary_sentences_still_split() -> None:
    assert split_sentences("Первое. Второе! Третье?") == ["Первое.", "Второе!", "Третье?"]
