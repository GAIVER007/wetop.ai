"""Шаг 4: загрузка системного промпта. Кэш по (путь, mtime): пока файл
не менялся — с диска не читается; правка подхватывается без перезапуска;
нет файла или пустой — ошибка настройки, а не пустая роль."""

import io
import os
from pathlib import Path

import pytest

from src.knowledge.prompt import PromptMissing, load_system_prompt, reset_prompt_cache


@pytest.fixture(autouse=True)
def clean_cache():
    reset_prompt_cache()
    yield
    reset_prompt_cache()


@pytest.fixture
def open_counter(monkeypatch: pytest.MonkeyPatch):
    """Считает открытия файлов НА ЧТЕНИЕ по пути. pathlib и open() оба идут
    через io.open, поэтому счётчик ловит любой способ чтения; записи самого
    теста (write_text) не считаются."""
    counts: dict[str, int] = {}
    real_open = io.open

    def counting_open(file, *args, **kwargs):
        mode = args[0] if args else kwargs.get("mode", "r")
        if isinstance(file, (str, os.PathLike)) and "r" in mode and "+" not in mode:
            key = str(Path(file).resolve())
            counts[key] = counts.get(key, 0) + 1
        return real_open(file, *args, **kwargs)

    monkeypatch.setattr(io, "open", counting_open)
    return counts


def test_loads_text(tmp_path: Path) -> None:
    path = tmp_path / "system_prompt.md"
    path.write_text("Ты продавец. Ёлки-палки, юникод.", encoding="utf-8")
    assert load_system_prompt(path) == "Ты продавец. Ёлки-палки, юникод."
    assert load_system_prompt(str(path)) == "Ты продавец. Ёлки-палки, юникод."


def test_same_mtime_served_from_cache(tmp_path: Path, open_counter: dict[str, int]) -> None:
    path = tmp_path / "system_prompt.md"
    path.write_text("версия 1", encoding="utf-8")
    key = str(path.resolve())
    assert load_system_prompt(path) == "версия 1"
    assert load_system_prompt(path) == "версия 1"
    assert load_system_prompt(path) == "версия 1"
    assert open_counter.get(key) == 1


def test_changed_file_is_reread(tmp_path: Path, open_counter: dict[str, int]) -> None:
    path = tmp_path / "system_prompt.md"
    path.write_text("версия 1", encoding="utf-8")
    assert load_system_prompt(path) == "версия 1"
    stat = path.stat()
    path.write_text("версия 2", encoding="utf-8")
    # mtime сдвигаем явно: запись в ту же секунду могла бы дать тот же штамп.
    os.utime(path, ns=(stat.st_atime_ns, stat.st_mtime_ns + 2_000_000_000))
    assert load_system_prompt(path) == "версия 2"
    assert open_counter.get(str(path.resolve())) == 2


def test_reset_cache_forces_reread(tmp_path: Path, open_counter: dict[str, int]) -> None:
    path = tmp_path / "system_prompt.md"
    path.write_text("версия 1", encoding="utf-8")
    load_system_prompt(path)
    reset_prompt_cache()
    load_system_prompt(path)
    assert open_counter.get(str(path.resolve())) == 2


def test_missing_file(tmp_path: Path) -> None:
    path = tmp_path / "нет_такого.md"
    with pytest.raises(PromptMissing) as info:
        load_system_prompt(path)
    assert str(path) in str(info.value)
    assert issubclass(PromptMissing, FileNotFoundError)


def test_empty_file(tmp_path: Path) -> None:
    path = tmp_path / "system_prompt.md"
    path.write_text("   \n\n", encoding="utf-8")
    with pytest.raises(PromptMissing):
        load_system_prompt(path)


def test_deleted_file_after_load(tmp_path: Path) -> None:
    path = tmp_path / "system_prompt.md"
    path.write_text("версия 1", encoding="utf-8")
    load_system_prompt(path)
    path.unlink()
    with pytest.raises(PromptMissing):
        load_system_prompt(path)
