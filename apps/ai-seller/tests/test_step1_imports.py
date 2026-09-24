"""Шаг 1: модули каркаса импортируются.

migrations.env здесь не трогаем: его запускает alembic, а не import.
"""

import importlib

import pytest

MODULES = (
    "src.main",
    "src.config",
    "src.dependencies",
    "src.db.base",
    "src.db.models",
)


@pytest.mark.parametrize("name", MODULES)
def test_module_imports(name: str) -> None:
    module = importlib.import_module(name)
    assert module is not None
