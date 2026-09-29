"""Калибровка порогов уверенности поиска по знаниям WETOP Support (S3).

Чистые функции без модели и базы: скрипт `scripts/kb_calibrate.py` прогоняет вопросы через настоящий поиск и отдаёт сюда
пары «лучшая запись, оценка». Здесь — разбор файла вопросов и подбор порогов `support_kb_high` / `support_kb_medium`.

Правило цены ошибки: ответ не той записью или ответ на вопрос, которого в базе нет, хуже молчания (штраф 3);
промах — «не знаю» там, где ответ был, — штраф 1. Так порог выбирается в сторону осторожности: «не уверен» лучше выдумки.
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field

WRONG_COST = 3
MISS_COST = 1
EPS = 0.01


class CalibrationError(ValueError):
    """Файл вопросов или набор оценок непригоден; текст — человеку."""


@dataclass
class Sample:
    question: str
    #: название записи, которая должна ответить; None — вопроса в базе нет, правильный ответ «не знаю»
    expected: str | None
    #: лучшая найденная запись и её оценка; None — поиск ничего не вернул
    top_title: str | None
    top_score: float | None


@dataclass
class Suggestion:
    high: float
    medium: float
    correct: int = 0
    wrong_answers: int = 0
    missed: int = 0
    abstained_ok: int = 0
    overlap: bool = False
    notes: list[str] = field(default_factory=list)


def parse_eval_csv(text: str) -> list[Sample]:
    """`question;expected` (или через запятую). Пустое `expected` — вопроса в базе нет. Оценки заполняет скрипт."""
    body = text.lstrip("﻿")
    lines = [line for line in body.splitlines() if line.strip()]
    if not lines:
        raise CalibrationError("Файл пуст: нужен CSV с колонками question и expected")
    header = lines[0]
    delimiter = ";" if ";" in header else ","
    if "question" not in header.lower() or delimiter not in header:
        raise CalibrationError("Первая строка — заголовок: question;expected")
    rows = csv.reader(io.StringIO("\n".join(lines)), delimiter=delimiter)
    next(rows)
    out: list[Sample] = []
    for row in rows:
        question = (row[0] if row else "").strip()
        if not question:
            continue
        expected = (row[1].strip() if len(row) > 1 else "") or None
        out.append(Sample(question=question, expected=expected, top_title=None, top_score=None))
    if not out:
        raise CalibrationError("В файле нет ни одного вопроса")
    return out


def _cost(sample: Sample, threshold: float) -> int:
    answered = sample.top_score is not None and sample.top_score >= threshold
    if sample.expected is None:
        return WRONG_COST if answered else 0
    if not answered:
        return MISS_COST
    return 0 if sample.top_title == sample.expected else WRONG_COST


def _outcome(samples: list[Sample], threshold: float) -> tuple[int, int, int, int]:
    correct = wrong = missed = abstained = 0
    for x in samples:
        answered = x.top_score is not None and x.top_score >= threshold
        if x.expected is None:
            wrong += 1 if answered else 0
            abstained += 0 if answered else 1
        elif not answered:
            missed += 1
        elif x.top_title == x.expected:
            correct += 1
        else:
            wrong += 1
    return correct, wrong, missed, abstained


def suggest_thresholds(samples: list[Sample]) -> Suggestion:
    if not samples:
        raise CalibrationError("Нет ни одного вопроса для калибровки")
    scores = sorted({x.top_score for x in samples if x.top_score is not None})
    if not scores:
        raise CalibrationError(
            "Поиск не нашёл ничего ни по одному вопросу: в базе нет опубликованных (ACTIVE) записей, доступных клиенту. "
            "Опубликуйте записи и запустите снова; пороги по пустому результату не подбираются"
        )
    covered = [x for x in samples if x.expected is not None]
    uncovered = [x for x in samples if x.expected is None]
    notes: list[str] = []
    if not uncovered:
        notes.append("нет вопросов без ответа: порог не проверен на ложные срабатывания, добавьте 5–10 вопросов не по теме")
    if not covered:
        notes.append("нет вопросов с ответом: подобрать нижнюю границу нельзя, добавьте вопросы с ожидаемой записью")

    top = (scores[-1] + EPS) if scores else 1.0
    candidates = scores + [top]
    # минимальная цена; при равенстве — более высокий порог (осторожнее)
    best_t = min(candidates, key=lambda t: (sum(_cost(x, t) for x in samples), -t))
    lower = [v for v in scores if v < best_t]
    medium = (best_t + lower[-1]) / 2 if lower else best_t - 2 * EPS
    medium = max(0.0, min(1.0, medium))

    correct, wrong, missed, abstained = _outcome(samples, medium)

    # верх: самая низкая оценка, начиная с которой каждый ответ верный и по вопросу с ответом
    high = None
    for candidate in sorted((v for v in scores if v >= medium), reverse=True):
        above = [x for x in samples if x.top_score is not None and x.top_score >= candidate]
        if all(x.expected is not None and x.top_title == x.expected for x in above):
            high = candidate
        else:
            break
    if high is None:
        high = medium + 0.05
    high = max(medium, min(1.0, high))

    correct_scores = [x.top_score for x in covered if x.top_score is not None and x.top_title == x.expected]
    uncovered_scores = [x.top_score for x in uncovered if x.top_score is not None]
    overlap = bool(correct_scores and uncovered_scores and min(correct_scores) <= max(uncovered_scores))
    if overlap:
        notes.append(
            "оценки верных ответов и вопросов без ответа пересекаются: чистого порога нет, часть ответов будет "
            "ошибочной или уйдёт в «не знаю»; улучшайте тексты записей, а не порог"
        )
    if wrong:
        notes.append(f"при этом пороге остаётся ответов не той записью или на вопрос без ответа: {wrong}")
    return Suggestion(
        high=round(high, 3), medium=round(medium, 3), correct=correct, wrong_answers=wrong, missed=missed,
        abstained_ok=abstained, overlap=overlap, notes=notes,
    )
