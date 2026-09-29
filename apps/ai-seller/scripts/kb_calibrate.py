"""Калибровка порогов уверенности поиска по управляемой базе знаний WETOP Support (S3).

Только чтение: ничего не пишет ни в базу, ни в журнал использования. Берёт CSV с вопросами (`question;expected`;
пустое `expected` — вопроса в базе нет и правильный ответ «не знаю»), прогоняет их через настоящий поиск на настоящей
модели эмбеддингов и печатает лучшую запись и оценку по каждому вопросу, а в конце — подобранные пороги.

Запуск на сервере (файл кладётся в `data/`, он виден в контейнере как /app/data):

    cd /opt/wetop-bot/assistant
    docker compose exec -T app python scripts/kb_calibrate.py /app/data/kb-eval.csv

🔴 Поиск идёт как в разговоре с клиентом (audience=client): записи PLATFORM_ADMIN_ONLY и неактивные не участвуют.
🔴 Тексты записей и ответов в вывод не попадают: только название записи и оценка.
Найденные значения вписываются в `.env` как SUPPORT_KB_HIGH и SUPPORT_KB_MEDIUM; перезапуск — `docker compose up -d`.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.dependencies import close_resources, get_sessionmaker  # noqa: E402
from src.knowledge import support_kb as kb  # noqa: E402
from src.knowledge.embedder import get_embedder  # noqa: E402
from src.knowledge.kb_calibration import CalibrationError, parse_eval_csv, suggest_thresholds  # noqa: E402


async def run(path: Path) -> int:
    samples = parse_eval_csv(path.read_text(encoding="utf-8"))
    embedder = get_embedder()
    async with get_sessionmaker()() as session:
        for sample in samples:
            # пороги уверенности здесь не участвуют: нужна сырая оценка лучшей записи
            hits = await kb.search(session, embedder, sample.question, audience="client", top_k=1, high=1.0, medium=0.0)
            if hits:
                sample.top_title, sample.top_score = hits[0].title, hits[0].score

    print(f"{'ожидалось':<28} {'нашлось':<28} {'оценка':>7}  вопрос")
    for x in samples:
        verdict = "-" if x.expected is None else x.expected
        found = x.top_title or "—"
        score = f"{x.top_score:.3f}" if x.top_score is not None else "  —  "
        print(f"{verdict[:27]:<28} {found[:27]:<28} {score:>7}  {x.question[:50]}")

    result = suggest_thresholds(samples)
    print()
    print(f"Вопросов: {len(samples)} (с ответом: {sum(x.expected is not None for x in samples)})")
    print(f"При найденных порогах: верно {result.correct}, «не знаю» там, где ответ был, {result.missed}, "
          f"верное молчание {result.abstained_ok}, ошибочных ответов {result.wrong_answers}")
    for note in result.notes:
        print(f"! {note}")
    print()
    print("Вписать в .env:")
    print(f"SUPPORT_KB_HIGH={result.high}")
    print(f"SUPPORT_KB_MEDIUM={result.medium}")
    return 0


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("Запуск: python scripts/kb_calibrate.py <файл.csv>", file=sys.stderr)
        return 2
    path = Path(argv[1])
    if not path.is_file():
        print(f"Файла нет: {path}", file=sys.stderr)
        return 2
    try:
        return asyncio.run(_guarded(path))
    except CalibrationError as exc:
        print(f"Ошибка: {exc}", file=sys.stderr)
        return 1


async def _guarded(path: Path) -> int:
    try:
        return await run(path)
    finally:
        await close_resources()


if __name__ == "__main__":
    sys.exit(main(sys.argv))
