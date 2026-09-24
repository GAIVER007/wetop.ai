"""Виджет: скрипт для вставки на сайт платформы.

🔴 Текст сообщений кладётся в DOM через textContent. innerHTML здесь —
это межсайтовый скриптинг с доставкой на дом: ответ модели и реплика
оператора попадают на страницу платформы, где у посетителя своя сессия.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from tests.dashboard_fakes import sync_db  # noqa: F401 — фикстура из пространства имён модуля
from tests.widget_fakes import PREFIX, widget_app

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "src" / "site" / "widget.js"


@pytest.fixture
def app(monkeypatch, fake_redis, sync_db):  # noqa: F811
    with widget_app(monkeypatch, fake_redis) as w:
        yield w


def _text() -> str:
    return SCRIPT.read_text(encoding="utf-8")


def _code() -> str:
    """Скрипт без строк-комментариев: правило запрещает вызов, а не рассказ
    о том, почему его здесь нет."""
    lines = []
    in_block = False
    for line in _text().splitlines():
        stripped = line.strip()
        if in_block:
            in_block = "*/" not in stripped
            continue
        if stripped.startswith("//"):
            continue
        if stripped.startswith("/*"):
            in_block = "*/" not in stripped
            continue
        lines.append(line)
    return "\n".join(lines)


def test_script_is_served_with_the_right_type(app) -> None:
    response = app.client.get(f"{PREFIX}/widget.js")

    assert response.status_code == 200, response.text
    assert "javascript" in response.headers["content-type"]
    # Скрипт меняется редко, а тянут его на каждой странице платформы.
    assert "max-age=3600" in response.headers.get("cache-control", "")
    assert response.text.strip()


def test_served_script_is_the_file_from_the_repository(app) -> None:
    """Отдаётся файл, а не копия в строке модуля: иначе правка уедет мимо."""
    assert app.client.get(f"{PREFIX}/widget.js").text.strip() == _text().strip()


def test_text_goes_to_the_dom_through_text_content() -> None:
    assert "textContent" in _code()


def test_no_inner_html_at_all() -> None:
    """🔴 Правило без исключений: увидели innerHTML — значит, где-то текст
    сообщения станет разметкой. Очистка узла делается через textContent
    или removeChild, они справляются."""
    code = _code()
    assert "innerHTML" not in code
    assert "outerHTML" not in code
    assert "document.write" not in code
    assert "insertAdjacentHTML" not in code


def test_eval_is_not_used() -> None:
    """Ответ сервера в eval — та же дыра, вид сбоку."""
    code = _code()
    assert "eval(" not in code
    assert "new Function" not in code


def test_script_keeps_the_visitor_key_and_the_identity() -> None:
    """Ключ посетителя живёт в браузере, признак пользователя приходит
    от платформы атрибутом тега script, а не выдумывается скриптом."""
    code = _code()
    assert "localStorage" in code
    assert "data-identity" in code or "dataset" in code


def test_script_styles_are_prefixed() -> None:
    """Свой префикс классов: стили платформы и виджета не должны спорить."""
    assert ".pmsw" in _code()


def test_script_is_short_enough_to_read() -> None:
    lines = _text().splitlines()
    assert len(lines) <= 300, f"{len(lines)} строк — скрипт виджета перерос себя"


def test_script_holds_no_secrets_and_no_hardcoded_host() -> None:
    """Адрес бота берётся из адреса самого скрипта: один файл на всех."""
    text = _code().lower()
    assert "http://" not in text
    for needle in ("secret", "token=", "api_key", "apikey"):
        assert needle not in text, needle


def test_the_poll_cannot_hang_forever_or_spin(app) -> None:
    """Зависшее соединение оставляет виджет немым до перезагрузки страницы,
    а нулевой серверный срок превращает опрос в шквал запросов без пауз."""
    code = _code()

    assert "xhr.timeout" in code and "ontimeout" in code
    # Пустой ответ уходит в повтор через паузу, а не сразу.
    assert "IDLE_PAUSE_MS" in code


def test_the_poll_carries_the_identity() -> None:
    """Признак нужен и при опросе: ключ платформы предсказуем.

    Но ходит он заголовком, а не в адресе: адреса попадают в журналы
    привратника и в историю браузера, а в признаке — почта человека.
    """
    code = _text()
    assert "setRequestHeader('X-Widget-Identity'" in code
    poll = code[code.index("function poll("):]
    assert "identity=" not in poll, "признак не должен склеиваться в адрес"


def test_there_is_a_way_to_give_consent() -> None:
    """Слой 0б: механизм без кнопки — тупик, бот не отвечает никогда."""
    code = _code()

    assert "/consent" in code
    assert "consent_required" in code
