"""Персональные данные: извлечение контактов и маскировка (слои 5 и 6).

Две маскировки, и вторая важнее первой:
- mask()/unmask() — обратимая, для запроса к модели. Один раз, до каскада;
  таблица «метка -> значение» остаётся на сервере и наружу не уходит.
- mask_for_log() — необратимая, для журнала. Белый список номеров и почт
  компании не маскируется (заполняется только в боевом .env).

Извлечение контакта стоит ДО любой защиты: телефон клиента дороже правила.
Телефоны в примерах вымышленные: +7 701 000 00 00, 8 707 123 45 67.
"""

import logging
import re
from collections.abc import Iterable
from dataclasses import dataclass

# ─── Образцы ───
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}")
# Логин мессенджера; lookbehind не даёт откусить домен от почты.
_HANDLE_RE = re.compile(r"(?<![A-Za-z0-9._%+-])@[A-Za-z0-9_]{4,32}(?![A-Za-z0-9_])")
# Даты стираются до поиска телефона: «22.09.2026 15» — это 10 цифр
# с разделителями, и без стирания получилось бы «телефон».
_DATE_RE = re.compile(r"(?<!\d)\d{1,2}[./-]\d{1,2}[./-]\d{2,4}(?!\d)")
# Непрерывный ряд цифр с разделителями (пробел, дефис, точка, скобки).
_DIGIT_RUN_RE = re.compile(r"\+?\(?\d(?:[\s\-.()]*\d)*")
# Внутри ряда длиннее 11 цифр («номер и 2 гостя») ищется номер с кодом.
_STRICT_PHONE_RE = re.compile(r"(?<!\d)(?:\+?7|8)(?:[\s\-.()]*\d){10}")
# Сумма с тысячными группами или диапазон таких сумм: «70 000-90 000»,
# «7 000 000 - 7 500 000». Даёт 10–11 цифр с ведущей 7 или 9 — это не телефон,
# а ложный контакт создаёт фиктивный лид и снимает отбой инъекции.
_SUM_RE = re.compile(r"\d{1,3}(?:[ \u00a0]\d{3})+(?:\s*-\s*\d{1,3}(?:[ \u00a0]\d{3})+)?")
# Ряд цифр, за которым идёт валюта, — сумма, даже без разделителей («70000-90000 тг»).
_CURRENCY_AFTER_RE = re.compile(r"\s*(?:₸|тг\b|тенге|руб|₽|\$|€|kzt|rub|usd|евро|тыс)", re.IGNORECASE)
_ADDR_RE = re.compile(
    r"(?:(?:ул|пр|пер|мкр)(?:\.\s*|\s+)|(?:улица|проспект|переулок|микрорайон)\s+)"
    r"[А-ЯЁа-яёA-Za-z][\w\-]*(?:\s+(?!(?:д|дом)\b)[А-ЯЁа-яёA-Za-z][\w\-]*){0,2}"
    r"\s*,?\s*(?:д\.?|дом)\s*\d+\s*[а-яёА-ЯЁa-zA-Z]?(?:\s*(?:/|корп\.?)\s*\d+)?"
    r"(?:\s*,?\s*(?:кв\.?|квартира|оф\.?|офис)\s*\d+)?",
    re.IGNORECASE,
)
_NAME_RE = re.compile(
    r"(?i:меня\s+зовут|мо[её]\s+имя)\s*[-—:]?\s*"
    r"([А-ЯЁA-Za-zа-яё][а-яёa-z\-]+(?:\s+[А-ЯЁA-Z][а-яёa-z\-]+)?)"
)
_LABEL_RE = re.compile(r"\[(PHONE|EMAIL|HANDLE|ADDR|NAME)_\d+\]")

PHONE, EMAIL, HANDLE, ADDR, NAME = "PHONE", "EMAIL", "HANDLE", "ADDR", "NAME"
# Приоритет при пересечении: почта важнее номера внутри неё.
_PRIORITY = {EMAIL: 0, PHONE: 1, HANDLE: 2, ADDR: 3, NAME: 4}


@dataclass(frozen=True)
class Contacts:
    phones: tuple[str, ...]
    emails: tuple[str, ...]
    handles: tuple[str, ...]

    @property
    def any(self) -> bool:
        return bool(self.phones or self.emails or self.handles)


@dataclass(frozen=True)
class _Span:
    start: int
    end: int
    kind: str
    key: str  # каноническое значение: по нему одинаковые данные получают одну метку


def normalize_phone(raw: str) -> str:
    """Только цифры; 8XXXXXXXXXX -> 7XXXXXXXXXX; 10 цифр без кода -> с кодом 7.

    Один номер в трёх написаниях должен дать одну строку, иначе лид
    задвоится, а белый список не сработает.
    """
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 11 and digits[0] == "8":
        digits = "7" + digits[1:]
    elif len(digits) == 10:
        digits = "7" + digits
    return digits


def _looks_like_phone(digits: str) -> bool:
    # Суммы вида «15 000-20 000» дают 10 цифр: отсекаем по первой цифре.
    if len(digits) == 11:
        return digits[0] in "78"
    if len(digits) == 10:
        return digits[0] in "79"
    return False


def _phone_spans(text: str) -> list[_Span]:
    # Даты заменяются пробелами той же длины: индексы остаются как в тексте.
    scrubbed = _DATE_RE.sub(lambda m: " " * (m.end() - m.start()), text)
    spans: list[_Span] = []
    for run in _DIGIT_RUN_RE.finditer(scrubbed):
        if _SUM_RE.fullmatch(run.group()) or _CURRENCY_AFTER_RE.match(scrubbed, run.end()):
            continue
        digits = re.sub(r"\D", "", run.group())
        if _looks_like_phone(digits):
            spans.append(_Span(run.start(), run.end(), PHONE, normalize_phone(digits)))
        elif len(digits) > 11:
            for m in _STRICT_PHONE_RE.finditer(run.group()):
                start = run.start() + m.start()
                spans.append(_Span(start, run.start() + m.end(), PHONE, normalize_phone(m.group())))
    return spans


def _find_spans(text: str, *, with_extra: bool) -> list[_Span]:
    """Все найденные ПД без пересечений, в порядке появления."""
    spans = [_Span(m.start(), m.end(), EMAIL, m.group().lower()) for m in _EMAIL_RE.finditer(text)]
    spans += [_Span(m.start(), m.end(), HANDLE, m.group()) for m in _HANDLE_RE.finditer(text)]
    spans += _phone_spans(text)
    if with_extra:
        spans += [_Span(m.start(), m.end(), ADDR, m.group().lower()) for m in _ADDR_RE.finditer(text)]
        spans += [_Span(m.start(1), m.end(1), NAME, m.group(1).lower()) for m in _NAME_RE.finditer(text)]
    spans.sort(key=lambda s: (s.start, _PRIORITY[s.kind]))
    result: list[_Span] = []
    for span in spans:
        if result and span.start < result[-1].end:
            continue
        result.append(span)
    return result


def extract_contacts(text: str) -> Contacts:
    """Телефоны нормализованы, без дублей, в порядке появления."""
    phones: list[str] = []
    emails: list[str] = []
    handles: list[str] = []
    for span in _find_spans(text, with_extra=False):
        bucket = {PHONE: phones, EMAIL: emails, HANDLE: handles}[span.kind]
        value = span.key if span.kind == PHONE else text[span.start : span.end]
        if value not in bucket:
            bucket.append(value)
    return Contacts(tuple(phones), tuple(emails), tuple(handles))


def _allowed(span: _Span, allow_phones: set[str], allow_emails: set[str]) -> bool:
    if span.kind == PHONE:
        return span.key in allow_phones
    if span.kind == EMAIL:
        return span.key in allow_emails
    return False


def _prepare_allowlists(phones: Iterable[str], emails: Iterable[str]) -> tuple[set[str], set[str]]:
    return {normalize_phone(p) for p in phones if p}, {e.strip().lower() for e in emails if e}


def _rewrite(text: str, spans: list[_Span], replace) -> str:
    out: list[str] = []
    pos = 0
    for span in spans:
        out.append(text[pos : span.start])
        out.append(replace(span, text[span.start : span.end]))
        pos = span.end
    out.append(text[pos:])
    return "".join(out)


def mask(
    text: str, *, allowlist_phones: Iterable[str] = (), allowlist_emails: Iterable[str] = ()
) -> tuple[str, dict[str, str]]:
    """Обратимая маскировка для модели: [PHONE_1], [EMAIL_1], [HANDLE_1],
    [ADDR_1], [NAME_1]. Одно значение — одна метка. Возвращает текст
    и таблицу метка -> значение как оно было в тексте."""
    allow_phones, allow_emails = _prepare_allowlists(allowlist_phones, allowlist_emails)
    spans = [s for s in _find_spans(text, with_extra=True) if not _allowed(s, allow_phones, allow_emails)]
    labels: dict[tuple[str, str], str] = {}
    mapping: dict[str, str] = {}
    counters: dict[str, int] = {}

    def replace(span: _Span, original: str) -> str:
        label = labels.get((span.kind, span.key))
        if label is None:
            counters[span.kind] = counters.get(span.kind, 0) + 1
            label = f"[{span.kind}_{counters[span.kind]}]"
            labels[(span.kind, span.key)] = label
            mapping[label] = original
        return label

    return _rewrite(text, spans, replace), mapping


def unmask(text: str, mapping: dict[str, str]) -> str:
    """Обратная подстановка. Метку, которой нет в таблице, оставляем как есть:
    придумать значение хуже, чем показать метку."""
    return _LABEL_RE.sub(lambda m: mapping.get(m.group(), m.group()), text)


def mask_for_log(
    text: str, *, allowlist_phones: Iterable[str] = (), allowlist_emails: Iterable[str] = ()
) -> str:
    """Необратимо: +7***00, и***@example.com, @***, [адрес], И***.
    Белый список не трогаем. Адрес и имя тоже маскируются: журнал читают люди."""
    allow_phones, allow_emails = _prepare_allowlists(allowlist_phones, allowlist_emails)
    spans = [
        s
        for s in _find_spans(text, with_extra=True)
        if not _allowed(s, allow_phones, allow_emails)
    ]

    def replace(span: _Span, original: str) -> str:
        if span.kind == PHONE:
            return "+7***" + span.key[-2:]
        if span.kind == EMAIL:
            local, _, domain = original.partition("@")
            return f"{local[:1]}***@{domain}"
        if span.kind == ADDR:
            return "[адрес]"
        if span.kind == NAME:
            return original[:1] + "***"
        return "@***"

    return _rewrite(text, spans, replace)


class PiiLogFilter(logging.Filter):
    """Маскирует ПД в каждой записи журнала. Ставится на все обработчики:
    журнал уходит в файл на томе и в stdout контейнера, оба читают люди."""

    def __init__(self, allowlist_phones: Iterable[str] = (), allowlist_emails: Iterable[str] = ()) -> None:
        super().__init__()
        self._phones = list(allowlist_phones)
        self._emails = list(allowlist_emails)

    def _mask(self, text: str) -> str:
        return mask_for_log(text, allowlist_phones=self._phones, allowlist_emails=self._emails)

    def filter(self, record: logging.LogRecord) -> bool:
        # Фильтр не защищён Handler.handleError: исключение отсюда вылетает
        # из logger.info() в код приложения. Опечатка в аргументах журнала
        # не должна ронять обработку сообщения — глотаем всё.
        try:
            record.msg = self._mask(record.getMessage())
        except Exception:
            try:
                record.msg = self._mask(str(record.msg))
            except Exception:
                record.msg = "<запись не отформатирована>"
        # Аргументы уже подставлены; иначе форматирование пошло бы второй раз.
        record.args = None
        # Текст исключения и трассировку Formatter добавляет уже после фильтра:
        # форматируем их здесь сами, маскируем и гасим exc_info.
        if record.exc_info:
            try:
                record.exc_text = self._mask(logging.Formatter().formatException(record.exc_info))
            except Exception:
                record.exc_text = "<трассировка не отформатирована>"
            record.exc_info = None
        if record.stack_info:
            try:
                record.stack_info = self._mask(record.stack_info)
            except Exception:
                record.stack_info = None
        return True
