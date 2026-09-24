"""Признак пользователя не уходит в адресе запроса.

В нём идентификатор и почта человека. Адреса целиком оседают в журналах
привратника, в истории браузера и в заголовке Referer при переходе — там
персональным данным не место. Тело запроса и заголовок туда не попадают.
"""

import inspect
from pathlib import Path

import pytest

from src.channels import widget

ROOT = Path(__file__).resolve().parent.parent
IDENTITY_HEADER = "X-Widget-Identity"


def test_poll_does_not_take_identity_from_the_query() -> None:
    signature = inspect.signature(widget.poll_messages)
    assert "identity" not in signature.parameters, (
        "признак пользователя не должен приходить параметром адреса"
    )


def test_poll_reads_identity_from_a_header() -> None:
    source = inspect.getsource(widget.poll_messages)
    assert IDENTITY_HEADER.lower() in source.lower(), (
        f"опрос обязан читать признак из заголовка {IDENTITY_HEADER}"
    )


def test_widget_script_never_puts_identity_into_a_url() -> None:
    script = (ROOT / "src" / "site" / "widget.js").read_text(encoding="utf-8")
    for line in script.splitlines():
        if "identity=" in line.lower() and "?" in line or "&identity" in line.lower():
            pytest.fail(f"признак склеен в адрес: {line.strip()}")
    assert IDENTITY_HEADER.lower() in script.lower(), "скрипт должен слать заголовок"


def test_cors_allows_the_identity_header() -> None:
    source = (ROOT / "src" / "channels" / "widget_guards.py").read_text(encoding="utf-8")
    combined = source + inspect.getsource(widget)
    assert IDENTITY_HEADER.lower() in combined.lower(), (
        "заголовок должен быть разрешён в ответе на предварительный запрос, "
        "иначе браузер его не отправит"
    )
