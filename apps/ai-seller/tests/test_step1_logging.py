"""Шаг 1: файл журнала — один писатель на файл, и его сбой не роняет сервис.

RotatingFileHandler не ротирует файл, в который пишут два воркера gunicorn:
записи теряются ровно в бою. Сбой файла (том от root) — предупреждение,
а не падение: stdout остаётся.
"""

import logging
import os
from pathlib import Path

from src.config import get_settings
from src.dependencies import configure_logging


def _handlers_by_name() -> dict[str, logging.Handler]:
    return {h.get_name(): h for h in logging.getLogger().handlers}


def test_log_file_is_per_process(settings_env: Path) -> None:
    configure_logging(get_settings())
    handlers = _handlers_by_name()
    assert "app_file" in handlers
    file_handler = handlers["app_file"]
    assert Path(file_handler.baseFilename).name == f"app-{os.getpid()}.log"


def test_monitor_gets_its_own_file(settings_env: Path) -> None:
    configure_logging(get_settings(), name="monitor")
    file_handler = _handlers_by_name()["app_file"]
    assert Path(file_handler.baseFilename).name == f"monitor-{os.getpid()}.log"


def test_unwritable_log_dir_does_not_break_startup(settings_env: Path, tmp_path: Path) -> None:
    # Файл на месте каталога logs: mkdir даёт OSError, как и том от root.
    (tmp_path / "logs").write_text("занято", encoding="utf-8")
    configure_logging(get_settings())
    handlers = _handlers_by_name()
    assert "app_stdout" in handlers
    assert "app_file" not in handlers
