import pytest

from voice.phone import mask_phone, normalize_e164


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("+7 (700) 111-22-33", "+77001112233"),
        ("8 700 111 22 33", "+77001112233"),
        ("7001112233", "+77001112233"),
        ("+14155550123", "+14155550123"),
        ("sip:+77001112233@host", "+77001112233"),
    ],
)
def test_normalize_valid(raw, expected):
    assert normalize_e164(raw) == expected


@pytest.mark.parametrize("raw", ["", None, "abc", "12345", "+1234567890123456", "   "])
def test_normalize_invalid_is_none(raw):
    assert normalize_e164(raw) is None


def test_mask_keeps_only_last_four_digits():
    assert mask_phone("+77001112233") == "***2233"
    assert "7001112" not in mask_phone("+77001112233")


def test_mask_of_garbage_does_not_leak_or_raise():
    assert mask_phone(None) == "***"
    assert mask_phone("12") == "***"
