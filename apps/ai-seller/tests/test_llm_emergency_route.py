"""Второй путь к аварийной модели (plans/seller-cost-controls-2026-09-26.md, п. 2, решение Р3).

Все три ступени каскада ходили через один шлюз (LLM_BASE_URL + LLM_API_KEY):
лёг шлюз — легли все три, сколько бы вендоров ни стояло в каскаде. Теперь
аварийная ступень может идти своим адресом и ключом поставщика напрямую
(LLM_EMERGENCY_BASE_URL + LLM_EMERGENCY_API_KEY). Только на ключе платформы:
ход гостиницы со своим ключом (С2) второго пути не получает — ключ платформы
за чужих гостей не платит. Без переменных всё как раньше.

🔴 До кода красный: второго пути нет, аварийная ступень идёт в лежащий шлюз.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path

import httpx
import pytest

from src.ai.llm import CascadeClient
from tests.llm_fakes import EMERGENCY, FALLBACK, PRIMARY, chat_response, llm_env

ROOT = Path(__file__).resolve().parent.parent
GATEWAY, DIRECT = "router.test", "direct.test"
DIRECT_KEY = "direct-key-for-tests"
MESSAGES = [{"role": "user", "content": "Здравствуйте, есть места?"}]
GOOD = '{"reply": "Здравствуйте! Места есть.", "needs_human": false}'


class TwoRoutes:
    """Шлюз и прямой адрес поставщика в одном транспорте: различаются по хосту.

    gateway: "down" — нет соединения; "500" — ошибка; "up" — отвечает всем
    моделям. Прямой адрес отвечает всегда. calls — кто, куда и с каким ключом.
    """

    def __init__(self, gateway: str) -> None:
        self.gateway = gateway
        self.calls: list[tuple[str, str, str]] = []

    def _handle(self, request: httpx.Request) -> httpx.Response:
        model = json.loads(request.content or b"{}").get("model", "")
        self.calls.append((request.url.host, model, request.headers.get("authorization", "")))
        if request.url.host == GATEWAY and self.gateway == "down":
            raise httpx.ConnectError("шлюз лёг", request=request)
        if request.url.host == GATEWAY and self.gateway == "500":
            return httpx.Response(500, json={"error": {"message": "x"}}, request=request)
        return httpx.Response(200, json=chat_response(GOOD, model=model), request=request)

    def client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(transport=httpx.MockTransport(self._handle))

    def hosts(self) -> list[str]:
        return [host for host, _, _ in self.calls]


def _cascade(monkeypatch: pytest.MonkeyPatch, routes: TwoRoutes, **env: str) -> CascadeClient:
    settings = llm_env(monkeypatch, **env)
    return CascadeClient(settings, http_client=routes.client())


SECOND_ROUTE = {"LLM_EMERGENCY_BASE_URL": f"http://{DIRECT}/v1", "LLM_EMERGENCY_API_KEY": DIRECT_KEY}


async def test_gateway_down_the_emergency_model_answers_by_the_second_route(monkeypatch, caplog) -> None:
    caplog.set_level(logging.DEBUG)
    routes = TwoRoutes("down")
    result = await _cascade(monkeypatch, routes, **SECOND_ROUTE).generate(MESSAGES, use_tools=False)

    assert result.ok, result.error
    assert result.model == EMERGENCY
    assert [a.outcome for a in result.attempts] == ["connection", "connection", "ok"]
    assert routes.calls[:2] == [(GATEWAY, PRIMARY, "Bearer test"), (GATEWAY, FALLBACK, "Bearer test")]
    assert routes.calls[2] == (DIRECT, EMERGENCY, f"Bearer {DIRECT_KEY}")
    assert DIRECT_KEY not in caplog.text, "ключа второго пути в журнале нет"


async def test_without_the_variables_the_emergency_goes_through_the_gateway(monkeypatch) -> None:
    routes = TwoRoutes("down")
    result = await _cascade(monkeypatch, routes).generate(MESSAGES, use_tools=False)
    assert result.ok is False, "без второго пути лежащий шлюз кладёт все три ступени — как раньше"
    assert routes.hosts() == [GATEWAY, GATEWAY, GATEWAY]


async def test_the_first_two_steps_never_take_the_second_route(monkeypatch) -> None:
    routes = TwoRoutes("up")
    result = await _cascade(monkeypatch, routes, **SECOND_ROUTE).generate(MESSAGES, use_tools=False)
    assert result.ok and result.model == PRIMARY
    assert routes.hosts() == [GATEWAY]


async def test_a_partner_key_turn_never_takes_the_second_route(monkeypatch) -> None:
    """С2: ход гостиницы с её ключом идёт только её ключом — прямой ключ
    платформы за чужих гостей не платит, даже когда шлюз лежит."""
    routes = TwoRoutes("down")
    cascade = _cascade(monkeypatch, routes, **SECOND_ROUTE)
    result = await cascade.generate(MESSAGES, use_tools=False, api_key="partner-777")
    assert result.ok is False
    assert routes.hosts() == [GATEWAY, GATEWAY, GATEWAY]
    assert {auth for _, _, auth in routes.calls} == {"Bearer partner-777"}


async def test_one_variable_is_not_enough_and_the_log_says_so(monkeypatch, caplog) -> None:
    caplog.set_level(logging.WARNING)
    routes = TwoRoutes("500")
    cascade = _cascade(monkeypatch, routes, LLM_EMERGENCY_BASE_URL=f"http://{DIRECT}/v1")
    assert "второй путь" in caplog.text, "полунастроенный второй путь не должен молчать"
    result = await cascade.generate(MESSAGES, use_tools=False)
    assert result.ok is False
    assert routes.hosts() == [GATEWAY, GATEWAY, GATEWAY]


async def test_emergency_model_equal_to_the_primary_is_not_rerouted(monkeypatch) -> None:
    """Дубль имени в каскаде схлопывается (Settings.llm_models): основная ступень
    с тем же именем не должна уйти вторым путём."""
    routes = TwoRoutes("up")
    cascade = _cascade(monkeypatch, routes, LLM_MODEL_EMERGENCY=PRIMARY, **SECOND_ROUTE)
    result = await cascade.generate(MESSAGES, use_tools=False)
    assert result.ok and result.model == PRIMARY
    assert routes.hosts() == [GATEWAY]


def test_the_template_lists_both_names_with_empty_values() -> None:
    """Настройки без строки в env.example не существует; адрес и ключ в шаблоне пусты."""
    text = (ROOT / "env.example").read_text(encoding="utf-8")
    values = dict(re.findall(r"^([A-Z_0-9]+)=([^\s#]*)", text, re.MULTILINE))
    for name in ("LLM_EMERGENCY_BASE_URL", "LLM_EMERGENCY_API_KEY"):
        assert name in values, f"{name} нет в env.example"
        assert values[name] == "", f"{name} в шаблоне должен быть пустым"
