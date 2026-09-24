"""Запасное декодирование cp1251 не должно падать на единственном
неопределённом байте 0x98: файл заказчика важнее одного символа."""

from src.knowledge.ingestor import extract_text


def test_undefined_cp1251_byte_does_not_break_import() -> None:
    data = "Заезд с 14:00.".encode("cp1251") + b"\x98" + " Выезд до 12:00.".encode("cp1251")
    text = extract_text("pravila.txt", data)
    assert "Заезд с 14:00." in text
    assert "Выезд до 12:00." in text
