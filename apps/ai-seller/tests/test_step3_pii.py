"""Шаг 3: персональные данные (слой 5). Извлечение, обратимая маскировка
для модели, необратимая — для журнала. Все номера вымышленные."""

import logging

import pytest

from src.config import get_settings
from src.dependencies import configure_logging
from src.security.pii import (
    PiiLogFilter,
    extract_contacts,
    mask,
    mask_for_log,
    normalize_phone,
    unmask,
)

PHONE_FORMATS = [
    ("Мой телефон +7 701 000 00 00", "77010000000"),
    ("тел.: +7 (701) 000-00-00!!!", "77010000000"),
    ("87010000000,", "77010000000"),
    ("7-701-000-00-00", "77010000000"),
    ("Звоните: 8 707 123 45 67.", "77071234567"),
    ("+7.701.000.00.00 — это мой номер", "77010000000"),
    ("Перезвоните по 8(707)123-45-67 после обеда", "77071234567"),
]


def test_normalize_phone() -> None:
    assert normalize_phone("+7 (701) 000-00-00") == "77010000000"
    assert normalize_phone("8 707 123 45 67") == "77071234567"
    # Десять цифр без кода страны — тот же номер с кодом 7: иначе лид задвоится.
    assert normalize_phone("7010000000") == "77010000000"


@pytest.mark.parametrize(("text", "phone"), PHONE_FORMATS, ids=[t[:30] for t, _ in PHONE_FORMATS])
def test_extract_phone_in_seven_formats(text: str, phone: str) -> None:
    contacts = extract_contacts(text)
    assert contacts.phones == (phone,)
    assert contacts.any


def test_sums_and_dates_are_not_phones() -> None:
    assert extract_contacts("Стирка стоит 15 000 тенге").phones == ()
    assert extract_contacts("6000 тенге за ночь").phones == ()
    assert extract_contacts("Заезд 12.03.2026, выезд 15.03.2026").phones == ()
    assert extract_contacts("Стирка 15 000 тенге").any is False


def test_extract_email_and_handle() -> None:
    contacts = extract_contacts("Пишите на Ivan.Petrov@example.com или @ivan_petrov")
    assert contacts.emails == ("Ivan.Petrov@example.com",)
    assert contacts.handles == ("@ivan_petrov",)
    # Короткий «логин» из трёх символов — не логин.
    assert extract_contacts("см. @ab").handles == ()


def test_same_phone_twice_extracted_once_in_order() -> None:
    contacts = extract_contacts("+7 701 000 00 00, повторю: 8 701 000 00 00, и ещё 8 707 123 45 67")
    assert contacts.phones == ("77010000000", "77071234567")


def test_mask_unmask_roundtrip() -> None:
    text = "Меня зовут Иван, телефон +7 701 000 00 00, почта ivan@example.com, тг @ivan_petrov"
    masked, mapping = mask(text)
    assert "701" not in masked
    assert "example.com" not in masked
    assert "ivan_petrov" not in masked
    assert "Иван" not in masked
    assert "[PHONE_1]" in masked and "[EMAIL_1]" in masked and "[HANDLE_1]" in masked
    assert "[NAME_1]" in masked
    assert mapping["[PHONE_1]"] == "+7 701 000 00 00"
    assert unmask(masked, mapping) == text


def test_mask_address() -> None:
    masked, mapping = mask("Живу по адресу ул. Абая, д. 10, привезите туда")
    assert "Абая" not in masked
    assert "[ADDR_1]" in masked
    assert unmask(masked, mapping).startswith("Живу по адресу ул. Абая, д. 10")


def test_same_value_gets_one_label() -> None:
    masked, mapping = mask("+7 701 000 00 00 и ещё раз +7 701 000 00 00")
    assert masked.count("[PHONE_1]") == 2
    assert "[PHONE_2]" not in masked
    assert list(mapping) == ["[PHONE_1]"]


def test_allowlist_is_not_masked() -> None:
    text = "Наш офис: +7 701 000 00 00, клиент: 8 707 123 45 67, info@example.com"
    masked, mapping = mask(
        text, allowlist_phones=["77010000000"], allowlist_emails=["info@example.com"]
    )
    assert "+7 701 000 00 00" in masked
    assert "info@example.com" in masked
    assert "707" not in masked
    assert list(mapping.values()) == ["8 707 123 45 67"]


def test_mask_for_log_is_irreversible_and_keeps_two_digits() -> None:
    logged = mask_for_log("клиент +7 701 000 00 67 и ivan@example.com, тг @ivan_petrov")
    assert "701" not in logged
    assert "+7***67" in logged
    assert "i***@example.com" in logged
    assert "ivan@" not in logged
    assert "@***" in logged and "ivan_petrov" not in logged


def test_mask_for_log_respects_allowlist() -> None:
    logged = mask_for_log("офис +7 701 000 00 00", allowlist_phones=["77010000000"])
    assert "+7 701 000 00 00" in logged


def test_pii_log_filter_hides_phone(caplog: pytest.LogCaptureFixture) -> None:
    logger = logging.getLogger("tests.pii")
    pii_filter = PiiLogFilter([], [])
    logger.addFilter(pii_filter)
    try:
        with caplog.at_level(logging.INFO, logger="tests.pii"):
            logger.info("клиент оставил номер %s", "+7 701 000 00 12")
    finally:
        logger.removeFilter(pii_filter)
    record = caplog.records[-1]
    assert "701" not in record.getMessage()
    assert "12" in record.getMessage()
    assert record.args in (None, ())


def test_configure_logging_attaches_pii_filter_to_both_handlers(settings_env) -> None:
    configure_logging(get_settings())
    handlers = {h.get_name(): h for h in logging.getLogger().handlers}
    for name in ("app_stdout", "app_file"):
        assert any(isinstance(f, PiiLogFilter) for f in handlers[name].filters), name


def test_range_of_sums_is_not_phone() -> None:
    # Диапазон сумм даёт 10 цифр с ведущей 7 или 9 — это не телефон.
    assert extract_contacts("Бюджет 70 000-90 000 тенге").phones == ()
    assert extract_contacts("от 90 000-95 000 тг").phones == ()
    assert extract_contacts("7 000 000 - 7 500 000 за сезон").phones == ()
    assert extract_contacts("70000-90000 тенге").phones == ()
    # А настоящий номер рядом с суммой остаётся.
    assert extract_contacts("Бюджет 70 000-90 000, звоните +7 701 000 00 00").phones == ("77010000000",)


def test_mask_for_log_hides_address_and_name() -> None:
    logged = mask_for_log("Меня зовут Иван, живу ул. Абая, д. 10")
    assert "Абая" not in logged
    assert "Иван" not in logged
    assert "[адрес]" in logged
    assert "И***" in logged


def test_pii_log_filter_hides_address(caplog: pytest.LogCaptureFixture) -> None:
    logger = logging.getLogger("tests.pii.addr")
    pii_filter = PiiLogFilter([], [])
    logger.addFilter(pii_filter)
    try:
        with caplog.at_level(logging.INFO, logger="tests.pii.addr"):
            logger.info("клиент: %s", "Меня зовут Иван, живу ул. Абая, д. 10")
    finally:
        logger.removeFilter(pii_filter)
    assert "Абая" not in caplog.text
    assert "Иван" not in caplog.text


def test_pii_log_filter_survives_bad_args(caplog: pytest.LogCaptureFixture) -> None:
    # Опечатка в аргументах логирования не должна ронять обработку сообщения.
    pii_filter = PiiLogFilter([], [])
    record = logging.LogRecord("t", logging.INFO, __file__, 1, "bad %s %s", ("one",), None)
    assert pii_filter.filter(record) is True
    assert record.args is None
    assert isinstance(record.msg, str)


def test_pii_log_filter_masks_exception_text(caplog: pytest.LogCaptureFixture) -> None:
    logger = logging.getLogger("tests.pii.exc")
    pii_filter = PiiLogFilter([], [])
    logger.addFilter(pii_filter)
    try:
        with caplog.at_level(logging.ERROR, logger="tests.pii.exc"):
            try:
                raise ValueError("не дозвонились до +7 701 000 00 45")
            except ValueError:
                logger.exception("сбой обзвона")
    finally:
        logger.removeFilter(pii_filter)
    assert "701 000 00 45" not in caplog.text
    assert "+7***45" in caplog.text
    assert "ValueError" in caplog.text
