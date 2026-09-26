"""Справочник ошибок платформы: чтение, кэш и поиск по ТЕКСТУ.

🔴 Главный тест захода здесь: по чужому тексту справочник обязан вернуть
пустой список, а не ближайшую запись. Выдуманная причина ошибки хуже
молчания — по ней человек пойдёт что-то чинить.

🔴 Поиск идёт по тексту, а не по коду: у платформы кодов ошибок нет,
её API отдаёт только русские сообщения. Поле кода в справочнике есть
на будущее и необязательно.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

import pytest

from src.knowledge.catalog import (
    CatalogMissing,
    ErrorEntry,
    find_by_code,
    find_by_text,
    load_catalog,
    normalize_message,
    reset_catalog_cache,
)
from tests.support_fakes import (
    BROKEN_ENTRY,
    BROKEN_TITLE,
    CONTENT_MARKER,
    SAMPLE_CATALOG,
    open_counter,  # noqa: F401 — фикстура подключается импортом
    write_catalog,
)

ROOT = Path(__file__).resolve().parent.parent
STATUSES = {"ожидаемое поведение", "известный дефект", "чинится", "исправлено"}

# Тексты платформы дословно: по ним и ищет бот.
ADULTS = "adults — целое ≥ 1"
CATEGORIES = "categoryCodes: непустой список кодов категорий"


@pytest.fixture(autouse=True)
def clean_cache():
    reset_catalog_cache()
    yield
    reset_catalog_cache()


@pytest.fixture
def entries(tmp_path: Path) -> list[ErrorEntry]:
    """Записи из образца: содержимое под контролем теста, а не владельца."""
    return load_catalog(write_catalog(tmp_path))


# ─── Разбор ───


def test_project_catalog_parses() -> None:
    """Образец в репозитории обязан разбираться тем же разборщиком: файл,
    который не читается, владелец правит вслепую."""
    entries = load_catalog(ROOT / "data" / "errors.md")
    assert len(entries) >= 3, "в образце меньше трёх записей"
    for entry in entries:
        assert entry.title.strip()
        assert entry.symptom.strip() and entry.cause.strip() and entry.action.strip()
        assert entry.status in STATUSES, f"{entry.title}: состояние {entry.status!r}"


def test_project_catalog_finds_real_platform_text() -> None:
    """Смысл образца — чтобы по реальному тексту платформы что-то находилось."""
    entries = load_catalog(ROOT / "data" / "errors.md")
    assert find_by_text(entries, f"при сохранении брони пишет «{ADULTS}»")


def test_entry_fields_are_filled(entries: list[ErrorEntry]) -> None:
    first = entries[0]
    assert ADULTS in first.symptom
    assert "Гостей" in first.cause
    assert "взрослого" in first.action
    assert first.section == "Брони"
    assert first.status == "ожидаемое поведение"
    assert ADULTS in first.raw, "raw должен хранить исходный кусок записи"


def test_code_is_optional(entries: list[ErrorEntry]) -> None:
    """🔴 У платформы кодов нет: пустое поле — норма, а не пропуск записи."""
    assert entries[0].code is None
    assert entries[2].code == "RPT-EMPTY"


def test_entry_is_frozen(entries: list[ErrorEntry]) -> None:
    """Справочник — данные для чтения: правка записи в коде означала бы,
    что кто-то чинит содержимое вместо владельца."""
    with pytest.raises(Exception):
        entries[0].title = "другое"  # type: ignore[misc]


# ─── Кэш по mtime ───


def test_same_mtime_served_from_cache(tmp_path: Path, open_counter: dict[str, int]) -> None:
    path = write_catalog(tmp_path)
    load_catalog(path)
    load_catalog(path)
    load_catalog(path)
    assert open_counter.get(str(path.resolve())) == 1


ONE_MORE = """
## Не открывается страница оплаты
- **Код:**
- **Раздел:** Оплаты
- **Что видит человек:** страница оплаты не открывается
- **Причина:** известный дефект перехода из карточки брони
- **Что делать:** откройте оплату из списка оплат, мы чиним
- **Состояние:** чинится
"""


def test_changed_file_is_reread(tmp_path: Path, open_counter: dict[str, int]) -> None:
    """Владелец дописал запись — бот видит её без перезапуска."""
    path = write_catalog(tmp_path)
    assert len(load_catalog(path)) == 3
    stat = path.stat()
    write_catalog(tmp_path, SAMPLE_CATALOG + ONE_MORE)
    # mtime сдвигаем явно: запись в ту же секунду дала бы тот же штамп.
    os.utime(path, ns=(stat.st_atime_ns, stat.st_mtime_ns + 2_000_000_000))
    assert len(load_catalog(path)) == 4
    assert open_counter.get(str(path.resolve())) == 2


def test_reset_cache_forces_reread(tmp_path: Path, open_counter: dict[str, int]) -> None:
    path = write_catalog(tmp_path)
    load_catalog(path)
    reset_catalog_cache()
    load_catalog(path)
    assert open_counter.get(str(path.resolve())) == 2


# ─── Беды с файлом ───


def test_missing_file(tmp_path: Path) -> None:
    path = tmp_path / "нет-такого.md"
    with pytest.raises(CatalogMissing):
        load_catalog(path)
    assert issubclass(CatalogMissing, FileNotFoundError)


def test_empty_file_is_not_an_error(tmp_path: Path) -> None:
    """Владелец мог ещё не заполнить справочник. Это «нечего искать»,
    а не поломка: бот честно скажет «не знаю» и позовёт человека."""
    assert load_catalog(write_catalog(tmp_path, "   \n\n")) == []


def test_broken_entry_is_skipped(tmp_path: Path, caplog: pytest.LogCaptureFixture) -> None:
    """Запись без причины пропускается, остальные читаются."""
    caplog.set_level(logging.WARNING)
    entries = load_catalog(write_catalog(tmp_path, SAMPLE_CATALOG + BROKEN_ENTRY))
    assert len(entries) == 3
    assert BROKEN_TITLE not in [e.title for e in entries]
    assert BROKEN_TITLE in caplog.text, "пропуск записи прошёл молча"


def test_warning_has_no_entry_content(tmp_path: Path, caplog: pytest.LogCaptureFixture) -> None:
    """🔴 В журнал уходит только заголовок: содержимое справочника — данные
    владельца, а журнал читают и пересылают."""
    caplog.set_level(logging.WARNING)
    load_catalog(write_catalog(tmp_path, SAMPLE_CATALOG + BROKEN_ENTRY))
    assert CONTENT_MARKER not in caplog.text


# ─── Нормализация ───


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("  Не   Сохраняется   Бронь  ", "не сохраняется бронь"),
        ("сообщение «adults» при сохранении", "сообщение adults при сохранении"),
        ("сообщение “adults” при сохранении", "сообщение adults при сохранении"),
    ],
)
def test_normalize_message(raw: str, expected: str) -> None:
    assert normalize_message(raw) == expected


def test_normalize_drops_the_numeric_tail() -> None:
    """«(код 500)» в хвосте — это не часть текста ошибки: с ним не совпадёт
    ни одна запись справочника."""
    result = normalize_message("Не сохраняется бронь (код 500)")
    assert result.startswith("не сохраняется бронь")
    assert "500" not in result


def test_normalize_keeps_numbers_inside_the_text() -> None:
    """🔴 А вот «≥ 1» внутри сообщения — часть текста платформы: съев его,
    поиск перестанет находить самую частую ошибку."""
    assert "1" in normalize_message(f"сообщение «{ADULTS}»")


# ─── Поиск по коду ───


def test_find_by_code_exact(entries: list[ErrorEntry]) -> None:
    found = find_by_code(entries, "RPT-EMPTY")
    assert found is not None and found.section == "Отчёты"


def test_find_by_code_ignores_case(entries: list[ErrorEntry]) -> None:
    assert find_by_code(entries, "rpt-empty") is not None


def test_find_by_code_unknown(entries: list[ErrorEntry]) -> None:
    assert find_by_code(entries, "E-404") is None


def test_find_by_code_empty(entries: list[ErrorEntry]) -> None:
    """Пустой код не должен цеплять записи без кода: у платформы кодов нет,
    и «пусто равно пусто» нашло бы первую попавшуюся запись."""
    assert find_by_code(entries, "") is None
    assert find_by_code(entries, None) is None


# ─── Поиск по тексту ───


def test_find_by_text_exact_quote(entries: list[ErrorEntry]) -> None:
    """Человек вставил сообщение платформы целиком — это точное вхождение."""
    found = find_by_text(entries, f"вижу сообщение «{ADULTS}» при сохранении брони")
    assert found and ADULTS in found[0].symptom


def test_find_by_text_short_quote(entries: list[ErrorEntry]) -> None:
    """И наоборот: человек прислал только кусок сообщения платформы."""
    found = find_by_text(entries, ADULTS)
    assert found and ADULTS in found[0].symptom


def test_find_by_text_reworded(entries: list[ErrorEntry]) -> None:
    """🔴 Человек пересказывает сообщение своими словами, и это норма:
    поиск по доле общих слов нужен ровно для этого случая."""
    found = find_by_text(entries, "поле adults должно быть целым ≥ 1")
    assert found and ADULTS in found[0].symptom


def test_find_by_text_second_real_message(entries: list[ErrorEntry]) -> None:
    found = find_by_text(entries, f"тариф не создаётся, пишет «{CATEGORIES}»")
    assert found and CATEGORIES in found[0].symptom


def test_find_by_text_invents_nothing(tmp_path: Path) -> None:
    """🔴 ГЛАВНЫЙ ТЕСТ ЗАХОДА. Текста нет в справочнике — значит пусто.
    Ближайшая запись здесь означала бы, что бот объяснит человеку письмо
    о брони поломкой поля «Гостей», и человек пойдёт чинить не то.
    """
    entries = load_catalog(write_catalog(tmp_path))
    assert find_by_text(entries, "не приходит письмо о брони") == []


def test_find_by_text_invents_nothing_on_any_foreign_text(entries: list[ErrorEntry]) -> None:
    """Тот же запрет на нескольких чужих текстах: одно совпавшее слово
    («бронь», «отчёт») не делает запись ответом."""
    for text in (
        "не приходит письмо о брони",
        "как выгрузить отчёт в почту",
        "не могу войти в систему",
        "",
    ):
        assert find_by_text(entries, text) == [], text


def test_find_by_text_respects_the_limit(entries: list[ErrorEntry]) -> None:
    found = find_by_text(entries, f"«{ADULTS}» и «{CATEGORIES}»", limit=1)
    assert len(found) <= 1


def test_find_by_text_returns_only_matching_entries(entries: list[ErrorEntry]) -> None:
    """Совпала одна запись — вернуться должна одна: добор «похожими»
    подсунул бы модели чужую причину рядом с верной."""
    found = find_by_text(entries, f"вижу сообщение «{ADULTS}» при сохранении брони")
    assert [e.symptom for e in found] == [entries[0].symptom]


def test_find_by_text_on_empty_catalog() -> None:
    assert find_by_text([], "что угодно") == []


# ─── Короткие общие обращения ───

# 🔴 Разбор ревью: на коротком сообщении доля общих слов раньше считалась
# от длины САМОГО КОРОТКОГО текста, поэтому одно общее слово давало 1.0,
# и справочник отвечал конкретной причиной на общую жалобу. Это и есть
# выдуманная причина: человек пойдёт чинить поле «Гостей» из-за слова
# «бронь» в своём вопросе.
SHORT_FOREIGN = (
    "бронь",
    "брони",
    "отчёт",
    "страница",
    "форма",
    "категория",
    "категории",
    "при сохранении",
    "ошибка брони",
    "не работает бронь",
    "не могу сохранить",
    "не сохраняется бронь",
    "бронь не сохраняется, что делать",
    "где найти список кодов категорий",
)


@pytest.mark.parametrize("text", SHORT_FOREIGN)
def test_short_general_complaint_gets_no_guess(entries: list[ErrorEntry], text: str) -> None:
    """🔴 Общая жалоба — это не опознанная ошибка. Ответ здесь «не знаю»."""
    assert find_by_text(entries, text) == [], text


@pytest.mark.parametrize("text", SHORT_FOREIGN)
def test_short_general_complaint_gets_no_guess_in_the_project_catalog(text: str) -> None:
    """То же на боевом образце: в нём записей больше, и промахнуться легче."""
    entries = load_catalog(ROOT / "data" / "errors.md")
    assert find_by_text(entries, text) == [], text


# ─── Заготовки владельца ───


def test_project_catalog_has_no_unfilled_placeholders() -> None:
    """🔴 «{заполните после разбора}» в поле «Причина» уходит модели как
    причина ошибки. Незаполненная заготовка в ответе — это выдуманное
    объяснение в человеческой обёртке."""
    entries = load_catalog(ROOT / "data" / "errors.md")
    for entry in entries:
        for value in (entry.symptom, entry.cause, entry.action):
            assert "{" not in value, f"{entry.title}: в ответе заготовка {value!r}"


def test_placeholder_value_counts_as_empty(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    """Заготовка в фигурных скобках = поле не заполнено: запись пропускается
    с предупреждением, а не отвечает заготовкой."""
    caplog.set_level(logging.WARNING)
    text = SAMPLE_CATALOG + """
## Запись с заготовкой
- **Раздел:** Брони
- **Что видит человек:** страница не открывается
- **Причина:** {заполните после разбора: что именно отказало}
- **Что делать:** обновите страницу
- **Состояние:** известный дефект
"""
    entries = load_catalog(write_catalog(tmp_path, text))
    assert "Запись с заготовкой" not in [e.title for e in entries]
    assert "Запись с заготовкой" in caplog.text


# ─── Разбор: ограда и повторы полей ───


def test_fenced_lines_are_not_fields(tmp_path: Path, caplog: pytest.LogCaptureFixture) -> None:
    """🔴 Незакрытая ограда ``` раньше проглатывала следующую запись, и поля
    из неё попадали в предыдущую: запись молча получала ЧУЖУЮ причину."""
    caplog.set_level(logging.WARNING)
    text = """# Справочник

## Первая ситуация
- **Раздел:** Брони
- **Что видит человек:** первый симптом
- **Причина:** первая причина
- **Что делать:** первое действие
- **Состояние:** известный дефект

```
## Вторая ситуация
- **Раздел:** Отчёты
- **Что видит человек:** второй симптом
- **Причина:** вторая причина
- **Что делать:** второе действие
- **Состояние:** чинится
"""
    entries = load_catalog(write_catalog(tmp_path, text))
    assert [e.cause for e in entries] == ["первая причина"], "поля из ограды попали в запись"
    assert "ограда" in caplog.text.lower(), "незакрытая ``` прошла молча"


def test_repeated_field_keeps_the_first_value(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    """Поле повторено по недосмотру владельца: берём первое и предупреждаем.
    Молчаливая победа последнего значения — это подмена причины."""
    caplog.set_level(logging.WARNING)
    text = """## Ситуация
- **Что видит человек:** симптом
- **Причина:** первая причина
- **Причина:** вторая причина
- **Что делать:** действие
- **Состояние:** чинится
"""
    entries = load_catalog(write_catalog(tmp_path, text))
    assert [e.cause for e in entries] == ["первая причина"]
    assert "повтор" in caplog.text.lower()


def test_status_case_does_not_matter(tmp_path: Path, caplog: pytest.LogCaptureFixture) -> None:
    """Имена полей уже разбираются без оглядки на регистр, значение
    «Состояние» — тоже: «ИСПРАВЛЕНО» это то же состояние."""
    caplog.set_level(logging.WARNING)
    text = """## Ситуация
- **Что видит человек:** симптом
- **Причина:** причина
- **Что делать:** действие
- **Состояние:** ИСПРАВЛЕНО
"""
    entries = load_catalog(write_catalog(tmp_path, text))
    assert [e.status for e in entries] == ["исправлено"]
    assert "незнакомое состояние" not in caplog.text
