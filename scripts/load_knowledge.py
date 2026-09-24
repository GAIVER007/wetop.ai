"""Разовая загрузка документации платформы в базу знаний.

Обходит папку KNOWLEDGE_DIR и грузит каждый файл допустимого формата через
ingest_document: он сам проверяет размер, дедуп по хешу содержимого
и слой 9 (инструкция для модели, спрятанная в документе).

Нужны настройки боевого .env в корне: база (DATABASE_URL или POSTGRES_*),
Redis (кэш векторов), модель эмбеддингов и накаченные миграции.

Запуск из корня:  python scripts/load_knowledge.py [папка]

🔴 В вывод не попадает содержимое документов: только имя файла и исход.
Повторный прогон безопасен — документ с тем же содержимым не грузится дважды.
"""

from __future__ import annotations

import asyncio
import logging
import sys
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

# Скрипт лежит в scripts/, а пакет src — в корне: добавляем корень в путь,
# чтобы запуск не зависел от cwd и PYTHONPATH.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import get_settings  # noqa: E402
from src.dependencies import close_resources, configure_logging, get_sessionmaker  # noqa: E402
from src.knowledge.embedder import get_embedder  # noqa: E402
from src.knowledge.ingestor import (  # noqa: E402
    ACCEPTED_FORMATS,
    FileTooLarge,
    SuspiciousDocument,
    UnsupportedFormat,
    ingest_document,
)

logger = logging.getLogger(__name__)

# Служебные файлы файловых менеджеров и офиса: грузить их незачем.
_SKIP_PREFIXES = (".", "~$")


@dataclass
class LoadStats:
    """Итог прогона. Для теста и для строки в конце вывода."""

    loaded: int = 0
    existed: int = 0
    rejected: int = 0
    failed: int = 0


async def load_directory(
    directory: str | Path | None = None,
    *,
    sessionmaker: Callable | None = None,
    embedder=None,
    report: Callable[[str], None] = print,
) -> LoadStats:
    """Грузит все подходящие файлы папки. Сбой одного файла не роняет прогон.

    Папки нет или она пуста — это не ошибка: печатаем строку и выходим,
    иначе первый же запуск на чистой установке выглядит как поломка.
    """
    settings = get_settings()
    root = Path(directory) if directory is not None else Path(settings.knowledge_dir)
    stats = LoadStats()
    if not root.is_dir():
        report(f"папка не найдена: {root}")
        return stats

    files = _collect(root)
    if not files:
        report(f"в папке {root} нет файлов ({', '.join(ACCEPTED_FORMATS)})")
        return stats

    accepted = {ext.lower() for ext in ACCEPTED_FORMATS}

    maker = sessionmaker if sessionmaker is not None else get_sessionmaker()
    model = embedder if embedder is not None else get_embedder()
    for path in files:
        # Имя источника — путь от корня папки: один и тот же файл при запуске
        # из разных мест называется одинаково.
        source = str(PurePosixPath(path.relative_to(root).as_posix()))
        if path.suffix.lower() not in accepted:
            # 🔴 Отбор по расширению именно здесь: файл, отброшенный до цикла,
            # не попал бы ни в строку отказа, ни в счётчики, и владелец
            # посчитал бы документ загруженным.
            stats.failed += 1
            report(
                f"{source}: отказ — формат не поддерживается "
                f"(допустимы: {', '.join(ACCEPTED_FORMATS)})"
            )
            continue
        try:
            data = path.read_bytes()
        except OSError as exc:
            stats.failed += 1
            report(f"{source}: отказ — файл не прочитан ({exc.strerror or 'ошибка чтения'})")
            continue
        async with maker() as session:
            try:
                result = await ingest_document(
                    session,
                    model,
                    source=source,
                    data=data,
                    max_bytes=settings.kb_max_file_mb * 1024 * 1024,
                    chunk_chars=settings.kb_chunk_chars,
                    overlap=settings.kb_chunk_overlap,
                    min_chars=settings.kb_chunk_min_chars,
                )
            except SuspiciousDocument:
                # Слой 9: документ с инструкцией для модели. Прогон продолжаем,
                # причину не цитируем — содержимое в вывод не уходит.
                stats.rejected += 1
                report(f"{source}: отклонён — в документе инструкции для модели")
                continue
            except (UnsupportedFormat, FileTooLarge) as exc:
                stats.failed += 1
                report(f"{source}: отказ — {exc}")
                continue
            except Exception:
                # Дефект: трассировка в журнал, человеку — строка без внутренностей.
                stats.failed += 1
                logger.exception("загрузка %s не удалась", source)
                report(f"{source}: отказ — сбой загрузки, подробности в журнале")
                continue
        if result.created:
            stats.loaded += 1
            report(f"{source}: загружен, кусков {result.chunks_added}")
        else:
            stats.existed += 1
            report(f"{source}: уже был")

    report(
        f"итог: загружено {stats.loaded}, уже было {stats.existed}, "
        f"отклонено {stats.rejected}, отказов {stats.failed}"
    )
    return stats


def _collect(root: Path) -> list[Path]:
    """Все файлы папки, включая вложенные, в устойчивом порядке.

    Формат здесь НЕ проверяется: об отказе по формату говорит цикл прогона,
    иначе файл пропадает из вывода молча. Служебные файлы файловых
    менеджеров и офиса отсеиваются: они не документы владельца.
    """
    found = [
        path
        for path in root.rglob("*")
        if path.is_file() and not path.name.startswith(_SKIP_PREFIXES)
    ]
    return sorted(found, key=lambda p: p.as_posix())


async def _run(directory: str | None) -> LoadStats:
    settings = get_settings()
    configure_logging(settings, name="load_knowledge")
    try:
        return await load_directory(directory)
    finally:
        # Свои ресурсы закрываем сами: скрипт живёт вне жизненного цикла приложения.
        await close_resources()


def main() -> int:
    directory = sys.argv[1] if len(sys.argv) > 1 else None
    stats = asyncio.run(_run(directory))
    # Ненулевой код только на отказах: отклонённый документ — ожидаемый исход.
    return 1 if stats.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
