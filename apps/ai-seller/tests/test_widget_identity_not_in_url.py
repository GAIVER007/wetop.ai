"""Признак пользователя и ключ посетителя не уходят в адресе запроса.

В признаке идентификатор и почта человека, ключ анонима — единственный
пропуск к его переписке. Адреса целиком оседают в журналах привратника,
в истории браузера и в заголовке Referer при переходе — там им не место.
Тело запроса и заголовок туда не попадают.
"""

import inspect
import logging
from pathlib import Path

import pytest

from src.channels import widget
from tests.dashboard_fakes import sync_db  # noqa: F401 — фикстура из пространства имён модуля
from tests.widget_fakes import PREFIX, SITE_ORIGIN, seed_visitor, widget_app

ROOT = Path(__file__).resolve().parent.parent
IDENTITY_HEADER = "X-Widget-Identity"
VISITOR_HEADER = "X-Widget-Visitor"
OLD_SCRIPT_KEY = "v-staryy-skript-1001"


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


def test_widget_script_never_puts_the_visitor_key_into_a_url() -> None:
    script = (ROOT / "src" / "site" / "widget.js").read_text(encoding="utf-8")
    for line in script.splitlines():
        if "visitor_key=" in line:
            pytest.fail(f"ключ посетителя склеен в адрес: {line.strip()}")
    assert VISITOR_HEADER.lower() in script.lower(), "скрипт должен слать ключ заголовком"


def test_a_key_in_the_url_still_works_but_is_logged(
    monkeypatch, fake_redis, sync_db, caplog: pytest.LogCaptureFixture  # noqa: F811
) -> None:
    """🔴 Переходный период: старый widget.js живёт в открытых вкладках
    платформы до перезагрузки и кладёт ключ в адрес. Принимаем, но каждый
    такой вход виден в журнале — по нему решают, когда приём из адреса
    убрать. Убирается вместе с этим тестом."""
    with caplog.at_level(logging.WARNING):
        with widget_app(monkeypatch, fake_redis) as app:
            seed_visitor(sync_db, visitor_key=OLD_SCRIPT_KEY, texts=("Здравствуйте",))
            response = app.client.get(
                f"{PREFIX}/messages",
                params={"visitor_key": OLD_SCRIPT_KEY},
                headers={"Origin": SITE_ORIGIN},
            )

    assert response.status_code == 200, response.text
    assert [m["text"] for m in response.json()["messages"]] == ["Здравствуйте"]
    warnings = [r.getMessage().lower() for r in caplog.records if r.levelno >= logging.WARNING]
    assert any("адрес" in text for text in warnings), warnings
    # Сам ключ в журнал не идёт: это пропуск к переписке.
    assert all(OLD_SCRIPT_KEY.lower() not in text for text in warnings), warnings
