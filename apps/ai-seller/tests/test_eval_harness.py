"""Логика прогона качества ответов — без сети (testy.md, «Проверка ответов»).

Сам прогон идёт живой моделью и в общий набор не входит. Здесь проверяется
то, что может соврать молча: разбор набора, разбор ответа судьи, подсчёт
балла и главное правило — провал по «чего быть не должно» блокирует сдачу.
"""

from __future__ import annotations

import csv
import importlib.util
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location("eval_run", ROOT / "eval" / "run.py")
run = importlib.util.module_from_spec(_spec)
# Классы данных ищут свой модуль в sys.modules: без записи загрузка по пути падает.
sys.modules["eval_run"] = run
_spec.loader.exec_module(run)


def test_the_real_dataset_is_well_formed() -> None:
    rows = run.load_dataset(ROOT / "eval" / "набор.csv")
    assert 20 <= len(rows) <= 30, "кит: двадцать-тридцать строк"
    for row in rows:
        assert row.question.strip()
        assert row.must or row.must_not, f"строка «{row.question}» без признаков"


@pytest.mark.parametrize(
    ("text", "expected"),
    [("да", True), ("Да.", True), ("нет", False), ("Нет, не выполнен", False), ("возможно", None), ("", None)],
)
def test_the_judge_answer_is_read_strictly(text: str, expected) -> None:
    """Судья своих оценок не добавляет: только «да» или «нет»."""
    assert run.parse_verdict(text) is expected


def _row(must=("A",), must_not=("B",)):
    return run.Row(question="вопрос", must=list(must), must_not=list(must_not))


async def test_score_counts_signs_not_rows() -> None:
    """Итог — сколько признаков из скольких, а не сколько строк зелёных."""
    rows = [_row(must=("A", "C")), _row()]
    verdicts = {"A": True, "C": False, "B": False}  # B отсутствует — это хорошо

    async def judge(answer: str, sign: str) -> bool | None:
        return verdicts[sign]

    result = await run.evaluate(rows, ask=_ask("ответ"), judge=judge)
    # Строка 1: A да, C нет, B отсутствует. Строка 2: A да, B отсутствует. 4 из 5.
    assert (result.passed, result.total) == (4, 5)
    assert result.failed_rows == [1]
    assert result.blocking_rows == []


async def test_a_forbidden_sign_blocks_even_with_a_high_score() -> None:
    """🔴 Кит: падение по «чего быть не должно» блокирует сдачу, даже если балл вырос."""
    rows = [_row(must=("A",) * 5, must_not=("B",))]

    async def judge(answer: str, sign: str) -> bool | None:
        return True  # всё «есть»: и нужное, и запретное

    result = await run.evaluate(rows, ask=_ask("ответ"), judge=judge)
    assert result.passed == 5 and result.total == 6
    assert result.blocking_rows == [1]
    assert result.blocked is True


async def test_an_unreadable_judge_verdict_on_a_forbidden_sign_blocks() -> None:
    """Судья не ответил «да» или «нет»: отсутствие запретного не доказано."""
    async def judge(answer: str, sign: str) -> bool | None:
        return None

    result = await run.evaluate([_row(must=(), must_not=("B",))], ask=_ask("ответ"), judge=judge)
    assert result.blocked is True


async def test_answers_are_written_back_into_the_fourth_column(tmp_path: Path) -> None:
    dataset = tmp_path / "набор.csv"
    with dataset.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["вопрос", "должно_быть", "не_должно_быть", "ответ"])
        w.writerow(["привет", "вежливость", "грубость", ""])
    rows = run.load_dataset(dataset)
    rows[0].answer = "Здравствуйте!"
    run.save_dataset(dataset, rows)
    with dataset.open(encoding="utf-8-sig", newline="") as f:
        saved = list(csv.reader(f, delimiter=";"))
    assert saved[1][3] == "Здравствуйте!"


def test_the_journal_line_has_what_the_kit_asks(tmp_path: Path) -> None:
    """Дата, что менялось, модель, балл, номера упавших строк."""
    journal = tmp_path / "журнал.csv"
    result = run.Result(passed=5, total=6, failed_rows=[3], blocking_rows=[3])
    run.append_journal(journal, date="2026-09-24", note="новый промпт", model="m1", judge="m2", result=result)
    run.append_journal(journal, date="2026-09-25", note="ещё", model="m1", judge="m2", result=result)
    with journal.open(encoding="utf-8-sig", newline="") as f:
        lines = list(csv.reader(f, delimiter=";"))
    assert lines[0][:5] == ["дата", "что_менялось", "модель", "балл", "упавшие_строки"]
    assert len(lines) == 3, "заголовок пишется один раз"
    assert lines[1][3] == "5/6" and lines[1][4] == "3"


@pytest.mark.parametrize("judge", ["", "openai/a"])
def test_the_judge_must_be_another_model(judge: str) -> None:
    """Судья — вторая модель, не та, что отвечала."""
    with pytest.raises(SystemExit):
        run.check_judge(judge, answering=["openai/a", "anthropic/b", "google/c"])


def test_a_different_judge_is_accepted() -> None:
    run.check_judge("mistral/j", answering=["openai/a", "anthropic/b", "google/c"])


def _ask(answer: str):
    async def ask(question: str, number: int) -> str:
        return answer

    return ask
