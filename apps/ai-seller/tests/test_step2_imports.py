"""Шаг 2: модули базы знаний импортируются, и импорт не тянет модель эмбеддингов.

sentence_transformers весит вместе с torch секунды на импорт и грузится
лениво внутри бэкенда; на уровне модуля его быть не должно.
"""

import importlib
import importlib.util
import subprocess
import sys
from pathlib import Path

import pytest

MODULES = [
    "src.knowledge",
    "src.knowledge.chunker",
    "src.knowledge.embedder",
    "src.knowledge.retriever",
    "src.knowledge.ingestor",
]
# parsers.py — по желанию сборщика: есть — проверяем, нет — не требуем.
if importlib.util.find_spec("src.knowledge.parsers") is not None:
    MODULES.append("src.knowledge.parsers")


@pytest.mark.parametrize("name", MODULES)
def test_module_imports(name: str) -> None:
    module = importlib.import_module(name)
    assert module is not None


def test_import_does_not_load_sentence_transformers() -> None:
    # В чистом интерпретаторе: в общем прогоне модель уже подняли другие тесты (ингест настоящим
    # эмбеддером, когда sentence-transformers установлен), и sys.modules этого процесса о времени
    # импорта ничего не говорит — 26.09.2026 тест был красным только в полном наборе.
    code = "\n".join(
        [f"import {name}" for name in [*MODULES, "src.main"]]
        + [
            "import sys",
            "assert 'sentence_transformers' not in sys.modules, 'sentence_transformers'",
            "assert 'torch' not in sys.modules, 'torch'",
        ]
    )
    root = Path(__file__).resolve().parent.parent
    result = subprocess.run([sys.executable, "-c", code], cwd=root, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr[-2000:]


def test_package_docstring() -> None:
    package = importlib.import_module("src.knowledge")
    assert package.__doc__ and "База знаний" in package.__doc__
