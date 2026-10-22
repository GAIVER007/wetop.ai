"""Телефоны: приведение к E.164 и маска для журнала.

Казахстан и Россия делят код +7: «8 700 ...» и «700 ...» читаются как +7.
Номер целиком в журнал и в логи не пишется, только маска.
"""

from __future__ import annotations

import re

MIN_DIGITS = 10
MAX_DIGITS = 15


def normalize_e164(raw: object) -> str | None:
    """Номер в виде +XXXXXXXXXXX или None, если на номер не похоже."""
    if not isinstance(raw, str):
        return None
    text = raw.strip()
    if not text or re.search(r"[A-Za-z]", re.sub(r"^sips?:", "", text, flags=re.I).split("@")[0]):
        return None
    text = re.sub(r"^sips?:", "", text, flags=re.I).split("@")[0]
    has_plus = text.startswith("+")
    digits = re.sub(r"\D", "", text)
    if has_plus:
        pass
    elif len(digits) == 11 and digits[0] == "8":
        digits = "7" + digits[1:]
    elif len(digits) == 10:
        digits = "7" + digits
    if not MIN_DIGITS <= len(digits) <= MAX_DIGITS:
        return None
    return "+" + digits


def mask_phone(raw: object) -> str:
    digits = re.sub(r"\D", "", raw) if isinstance(raw, str) else ""
    if len(digits) < 4:
        return "***"
    return "***" + digits[-4:]
