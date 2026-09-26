"""Загрузка системного промпта с кэшем в процессе.

Промпт — данные, а не код: лежит на томе (PROMPT_PATH) и правится из панели
без выкатки. Кэш по (путь, mtime_ns): пока файл не менялся, диск не читается;
после правки другой mtime — перечитываем. Нет файла или он пуст — ошибка
настройки, а не пустая роль для модели.
"""

from __future__ import annotations

from pathlib import Path


class PromptMissing(FileNotFoundError):
    """Файл промпта отсутствует или пуст."""


# (путь) -> (mtime_ns, текст)
_cache: dict[str, tuple[int, str]] = {}


def load_system_prompt(path: str | Path) -> str:
    """Текст промпта с диска или из кэша. Пустой файл -> PromptMissing."""
    file = Path(path)
    key = str(file)
    try:
        mtime_ns = file.stat().st_mtime_ns
    except FileNotFoundError:
        _cache.pop(key, None)
        raise PromptMissing(f"файл системного промпта не найден: {file}") from None
    cached = _cache.get(key)
    if cached is not None and cached[0] == mtime_ns:
        return cached[1]
    try:
        text = file.read_text(encoding="utf-8")
    except FileNotFoundError:
        _cache.pop(key, None)
        raise PromptMissing(f"файл системного промпта не найден: {file}") from None
    if not text.strip():
        _cache.pop(key, None)
        raise PromptMissing(f"файл системного промпта пуст: {file}")
    _cache[key] = (mtime_ns, text)
    return text


def reset_prompt_cache() -> None:
    """Сброс кэша: для тестов и после правки промпта из панели."""
    _cache.clear()
