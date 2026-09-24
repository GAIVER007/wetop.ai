"""Шаг 2: модули базы знаний импортируются, и импорт не тянет модель эмбеддингов.

sentence_transformers весит вместе с torch секунды на импорт и грузится
лениво внутри бэкенда; на уровне модуля его быть не должно.
"""

import importlib
import importlib.util
import sys

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
    for name in MODULES:
        importlib.import_module(name)
    importlib.import_module("src.main")
    assert "sentence_transformers" not in sys.modules
    assert "torch" not in sys.modules


def test_package_docstring() -> None:
    package = importlib.import_module("src.knowledge")
    assert package.__doc__ and "База знаний" in package.__doc__
