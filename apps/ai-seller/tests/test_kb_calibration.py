"""Калибровка порогов уверенности поиска по знаниям (S3, plans/ai-agents-s3-knowledge-2026-09-29.md).

Модель эмбеддингов в тесте не нужна: считают чистые функции по готовым оценкам. Сам скрипт
`scripts/kb_calibrate.py` прогоняет вопросы через настоящий поиск на сервере и отдаёт сюда пары «оценка, попал ли».
"""

from __future__ import annotations

import pytest

from src.knowledge.kb_calibration import CalibrationError, Sample, parse_eval_csv, suggest_thresholds


def s(expected, title, score) -> Sample:
    return Sample(question="?", expected=expected, top_title=title, top_score=score)


def test_parse_semicolon_csv_with_header_and_blank_expected() -> None:
    text = "question;expected\nКак заселить гостя?;Заселение\nКак приготовить борщ?;\n"
    got = parse_eval_csv(text)
    assert [(x.question, x.expected) for x in got] == [("Как заселить гостя?", "Заселение"), ("Как приготовить борщ?", None)]


def test_parse_comma_csv_bom_and_quotes_and_skips_empty_rows() -> None:
    text = '﻿question,expected\n"Почему, не сохраняется бронь?",Только чтение\n\n'
    got = parse_eval_csv(text)
    assert [(x.question, x.expected) for x in got] == [("Почему, не сохраняется бронь?", "Только чтение")]


def test_parse_rejects_empty_and_headerless_files() -> None:
    with pytest.raises(CalibrationError):
        parse_eval_csv("")
    with pytest.raises(CalibrationError):
        parse_eval_csv("вопрос без разделителя\n")


def test_separable_scores_put_medium_between_the_groups() -> None:
    samples = [
        s("A", "A", 0.90), s("B", "B", 0.88), s("C", "C", 0.86),   # верные попадания
        s(None, "A", 0.70), s(None, "B", 0.72),                     # вопросов нет в базе — оценки низкие
    ]
    r = suggest_thresholds(samples)
    assert 0.72 < r.medium <= 0.86
    assert r.wrong_answers == 0 and r.missed == 0 and r.correct == 3 and r.abstained_ok == 2


def test_high_is_the_lowest_score_above_which_everything_is_correct() -> None:
    samples = [
        s("A", "A", 0.92), s("B", "B", 0.90), s("C", "X", 0.84),     # C: верное — не то, ниже 0.90 промах
        s("D", "D", 0.80), s(None, "A", 0.60),
    ]
    r = suggest_thresholds(samples)
    assert r.high >= 0.90
    assert r.medium <= r.high


def test_wrong_top_hit_costs_more_than_a_miss_so_threshold_rises() -> None:
    samples = [s("A", "A", 0.80), s("B", "X", 0.82), s("C", "C", 0.79)]
    r = suggest_thresholds(samples)
    # ответ не тем документом хуже молчания: порог выше 0.82, чтобы не отвечать по X
    assert r.medium > 0.82
    assert r.wrong_answers == 0


def test_overlap_is_reported_not_hidden() -> None:
    samples = [s("A", "A", 0.80), s(None, "A", 0.81), s("B", "B", 0.79), s(None, "B", 0.78)]
    r = suggest_thresholds(samples)
    assert r.overlap is True
    assert any("пересека" in note for note in r.notes)


def test_no_hits_at_all_are_counted_as_abstain() -> None:
    samples = [s("A", None, None), s(None, None, None), s("B", "B", 0.9)]
    r = suggest_thresholds(samples)
    assert r.correct == 1 and r.missed == 1 and r.abstained_ok == 1


def test_needs_both_kinds_of_questions_or_says_so() -> None:
    only_covered = suggest_thresholds([s("A", "A", 0.9), s("B", "B", 0.85)])
    assert any("нет вопросов без ответа" in n for n in only_covered.notes)
    only_uncovered = suggest_thresholds([s(None, "A", 0.7)])
    assert any("нет вопросов с ответом" in n for n in only_uncovered.notes)


def test_empty_samples_raise() -> None:
    with pytest.raises(CalibrationError):
        suggest_thresholds([])


def test_thresholds_stay_in_unit_interval() -> None:
    r = suggest_thresholds([s("A", "A", 0.999), s(None, "A", 0.5)])
    assert 0.0 <= r.medium <= r.high <= 1.0
