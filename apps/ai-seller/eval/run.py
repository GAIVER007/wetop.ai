"""Прогон качества ответов (testy.md, «Проверка ответов»).

Живёт отдельно от тестов кода: требует живой модели, денег и минуты времени.
Бот отвечает тем же конвейером, что у живого пользователя (сборка виджета
с инструментами роли), судья — ДРУГАЯ модель, и по каждому признаку говорит
только «да» или «нет». Итог — сколько признаков из скольких выполнено.
🔴 Провал по «чего быть не должно» блокирует сдачу, даже если балл вырос.

Запуск из корня, с боевым .env и EVAL_JUDGE_MODEL:
    python eval/run.py --note "что менялось перед прогоном"
Код выхода 1 — есть блокирующие строки.
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import sys
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Awaitable, Callable

HERE = Path(__file__).resolve().parent
DATASET = HERE / "набор.csv"
JOURNAL = HERE / "журнал.csv"
SEP = "|"  # разделитель признаков внутри ячейки
JOURNAL_HEADER = ["дата", "что_менялось", "модель", "балл", "упавшие_строки", "блокирующие_строки", "судья"]
JUDGE_SYSTEM = "Ты проверяешь ответ бота. Отвечай ровно одним словом: да или нет."


@dataclass
class Row:
    question: str
    must: list[str]
    must_not: list[str]
    answer: str = ""


@dataclass
class Result:
    passed: int = 0
    total: int = 0
    failed_rows: list[int] = field(default_factory=list)
    blocking_rows: list[int] = field(default_factory=list)

    @property
    def blocked(self) -> bool:
        return bool(self.blocking_rows)


def _signs(cell: str) -> list[str]:
    return [s.strip() for s in (cell or "").split(SEP) if s.strip()]


def load_dataset(path: Path) -> list[Row]:
    """utf-8-sig и «;»: владелец правит набор в Excel, а тот иначе ломает кириллицу."""
    with path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=";")
        return [
            Row(r["вопрос"].strip(), _signs(r["должно_быть"]), _signs(r["не_должно_быть"]), r.get("ответ") or "")
            for r in reader
            if (r.get("вопрос") or "").strip()
        ]


def save_dataset(path: Path, rows: list[Row]) -> None:
    """Ответы — в четвёртую колонку, как велит кит: набор читается вместе с ответами."""
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["вопрос", "должно_быть", "не_должно_быть", "ответ"])
        for r in rows:
            w.writerow([r.question, f" {SEP} ".join(r.must), f" {SEP} ".join(r.must_not), r.answer])


def parse_verdict(text: str) -> bool | None:
    """Только первое слово: «да» или «нет». Остальное — не ответ судьи."""
    word = (text or "").strip().split(maxsplit=1)[0].strip(".,!:;").lower() if (text or "").strip() else ""
    return {"да": True, "нет": False}.get(word)


Ask = Callable[[str, int], Awaitable[str]]
Judge = Callable[[str, str], Awaitable["bool | None"]]


async def evaluate(rows: list[Row], *, ask: Ask, judge: Judge) -> Result:
    """Прогон по строкам. Номера строк — с единицы, как видит их человек в файле."""
    result = Result()
    for number, row in enumerate(rows, start=1):
        row.answer = await ask(row.question, number)
        failed = blocking = False
        for sign in row.must:
            ok = await judge(row.answer, sign) is True
            result.total += 1
            result.passed += ok
            failed |= not ok
        for sign in row.must_not:
            present = await judge(row.answer, sign)
            # 🔴 None тоже блокирует: судья не подтвердил, что запретного нет.
            ok = present is False
            result.total += 1
            result.passed += ok
            failed |= not ok
            blocking |= not ok
        if failed:
            result.failed_rows.append(number)
        if blocking:
            result.blocking_rows.append(number)
    return result


def append_journal(path: Path, *, date: str, note: str, model: str, judge: str, result: Result) -> None:
    new = not path.exists()
    with path.open("a", encoding="utf-8-sig" if new else "utf-8", newline="") as f:
        w = csv.writer(f, delimiter=";")
        if new:
            w.writerow(JOURNAL_HEADER)
        w.writerow([
            date, note, model, f"{result.passed}/{result.total}",
            " ".join(map(str, result.failed_rows)), " ".join(map(str, result.blocking_rows)), judge,
        ])


def check_judge(judge: str, *, answering: list[str]) -> None:
    """Судья — вторая модель. Та же модель оценивает себя снисходительно."""
    if not judge:
        raise SystemExit("EVAL_JUDGE_MODEL не задан: судья — отдельная модель")
    if judge in answering:
        raise SystemExit(f"судья {judge} совпадает с моделью каскада: нужна другая")


async def _live(note: str) -> int:
    sys.path.insert(0, str(HERE.parent))
    from openai import AsyncOpenAI

    from src.ai.engine import IncomingMessage
    from src.ai.llm import vendor_of
    from src.channels.widget_runner import build_runner
    from src.config import get_settings
    from src.db.base import utcnow
    from src.dependencies import close_resources, configure_logging

    settings = get_settings()
    configure_logging(settings, name="eval")
    check_judge(settings.eval_judge_model, answering=settings.llm_models)
    if vendor_of(settings.eval_judge_model) in {vendor_of(m) for m in settings.llm_models}:
        print("предупреждение: судья того же вендора, что каскад", file=sys.stderr)

    engine = build_runner(settings).engine  # тот же путь, что у живого пользователя
    client = AsyncOpenAI(api_key=settings.llm_api_key, base_url=settings.llm_base_url)
    run_id = utcnow().strftime("%Y%m%d%H%M%S")

    async def ask(question: str, number: int) -> str:
        # Свой диалог на строку: контекст соседних вопросов не подсказывает ответ.
        outcome = await engine.process_message(IncomingMessage(
            channel="eval", external_id=f"eval-{run_id}-{number}", text=question, received_at=utcnow(),
        ))
        return outcome.reply or ""

    async def judge(answer: str, sign: str) -> bool | None:
        response = await client.chat.completions.create(
            model=settings.eval_judge_model,
            temperature=0,
            messages=[
                {"role": "system", "content": JUDGE_SYSTEM},
                {"role": "user", "content": f"Ответ бота:\n<<<\n{answer}\n>>>\n\nЕсть ли в ответе следующее: {sign}?"},
            ],
        )
        return parse_verdict(response.choices[0].message.content or "")

    try:
        rows = load_dataset(DATASET)
        result = await evaluate(rows, ask=ask, judge=judge)
        save_dataset(DATASET, rows)
        append_journal(JOURNAL, date=date.today().isoformat(), note=note, model=settings.llm_model,
                       judge=settings.eval_judge_model, result=result)
    finally:
        await close_resources()
    print(f"балл {result.passed}/{result.total}; упали строки: {result.failed_rows or 'нет'}")
    if result.blocked:
        print(f"🔴 БЛОКИРУЕТ СДАЧУ — запретное в строках {result.blocking_rows}", file=sys.stderr)
        return 1
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Прогон качества ответов")
    parser.add_argument("--note", required=True, help="что менялось перед прогоном")
    raise SystemExit(asyncio.run(_live(parser.parse_args().note)))


if __name__ == "__main__":
    main()
