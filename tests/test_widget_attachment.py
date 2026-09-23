"""Виджет: снимок экрана от клиента.

🔴 Тип проверяется по первым байтам файла, а не по заголовку от браузера:
заголовок ставит тот, кто загружает, и «image/png» на скрипте — это
обычный способ положить на диск то, что потом кто-нибудь откроет.

🔴 Предел размера проверяется ДО чтения: иначе пятидесятимегабайтный файл
уже в памяти к моменту отказа.

🔴 Имя файла из запроса не используется никак: '../../etc/passwd' — это
тоже имя файла.
"""

from __future__ import annotations

import inspect
from pathlib import Path

import pytest

from tests.dashboard_fakes import sync_db  # noqa: F401 — фикстура из пространства имён модуля
from tests.widget_fakes import NOT_AN_IMAGE, PNG_BYTES, widget_app

# Каталог вложений относительный, а рабочая директория теста — tmp_path.
ATTACHMENTS = Path("data/attachments")


@pytest.fixture
def app(monkeypatch, fake_redis, sync_db):  # noqa: F811
    with widget_app(monkeypatch, fake_redis) as w:
        yield w


def _saved() -> list[Path]:
    return sorted(p for p in ATTACHMENTS.rglob("*") if p.is_file())


def test_png_is_accepted(app) -> None:
    key = app.new_visitor()

    response = app.attach(key, PNG_BYTES)

    assert response.status_code == 200, response.text
    attachment_id = response.json()["attachment_id"]
    assert isinstance(attachment_id, str) and attachment_id
    assert len(_saved()) == 1


def test_text_file_dressed_up_as_png_is_refused(app) -> None:
    """Заголовку от браузера верить нельзя: смотрим сигнатуру."""
    key = app.new_visitor()

    response = app.attach(key, NOT_AN_IMAGE, filename="snimok.png", content_type="image/png")

    assert response.status_code == 415, response.text
    assert _saved() == [], "отвергнутый файл не должен оставаться на диске"


def test_declared_type_outside_the_list_is_refused(app) -> None:
    key = app.new_visitor()

    response = app.attach(key, b"%PDF-1.4\n", filename="dogovor.pdf", content_type="application/pdf")

    assert response.status_code == 415, response.text


def test_file_over_the_limit_is_refused(app) -> None:
    key = app.new_visitor()
    # Предел в тестовых настройках — 1 МБ.
    too_big = PNG_BYTES + b"\x00" * (1024 * 1024 + 1)

    response = app.attach(key, too_big)

    assert response.status_code == 413, response.status_code
    assert _saved() == []


def test_the_size_is_checked_before_the_file_is_read() -> None:
    """🔴 Предел по заявленному размеру стоит ДО чтения файла.

    Смотрим исходник самого обработчика, а не всего модуля: в модуле
    строка 'content-length' нашлась бы у соседней двери, и тест был бы
    зелёным при любом порядке проверок здесь.
    """
    from src.channels import widget

    source = inspect.getsource(widget.upload_attachment)
    declared = source.find("content-length")
    form = source.find("request.form()")
    read = source.find(".read(")
    assert declared != -1, "заявленный размер вложения не проверяется"
    assert form != -1 and declared < form, "форма разбирается раньше проверки предела"
    assert read != -1 and declared < read, "файл читается раньше проверки предела"


def test_attachments_can_be_switched_off(monkeypatch, fake_redis, sync_db) -> None:  # noqa: F811
    """Выключено настройкой — адреса нет вовсе, а не «есть, но отвечает нет»."""
    with widget_app(monkeypatch, fake_redis, WIDGET_ATTACHMENTS_ENABLED="false") as app:
        key = app.new_visitor()
        response = app.attach(key, PNG_BYTES)

    assert response.status_code == 404, response.text


def test_the_name_from_the_request_is_not_used(app) -> None:
    """Имя выдумывает бот. Путь с присланным именем — это запись куда угодно."""
    key = app.new_visitor()
    nasty = "../../vylezli-iz-katologa.png"

    response = app.attach(key, PNG_BYTES, filename=nasty)

    assert response.status_code == 200, response.text
    saved = _saved()
    assert len(saved) == 1
    name = saved[0].name
    assert "vylezli" not in name
    assert ".." not in str(saved[0])
    # Расширение из запроса тоже не берётся: '.png' в имени — это обещание.
    assert not name.endswith(".png")
    assert response.json()["attachment_id"] in name or name in response.json()["attachment_id"]


def test_the_id_travels_to_the_message(app) -> None:
    """Ссылка на вложение уходит в текст хода строкой, разбор снимков — отдельно."""
    key = app.new_visitor()
    attachment_id = app.attach(key, PNG_BYTES).json()["attachment_id"]

    response = app.message(key, "Вот что вижу", attachment_id=attachment_id)

    assert response.status_code == 200, response.text
