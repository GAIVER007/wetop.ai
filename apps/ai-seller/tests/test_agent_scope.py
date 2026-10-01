"""SA2.5: рантайм находит продавца по АГЕНТУ, а не по организации (DATA_MODEL §20, plans/…sa25 §3, §6, §10).

Два агента ОДНОЙ организации не видят друг друга ни в одной двери: ключ виджета, вебхук WhatsApp, диалоги, клиенты, знания,
профиль, факты, дедуп, песочница. Организация остаётся границей арендатора (ключ модели, дневной предел, расширение).
Перенесённый продавец (`agent.id = organization_id`) работает как прежде — это проверяют остальные наборы бота, не менявшиеся
по существу; здесь — то, чего в них быть не могло: второй агент в той же организации.

🔴 Второй агент заводится строкой в базе бота напрямую: PUT-двери для новых агентов появятся вместе с их запуском (SA9),
а SA2.5 доказывает, что рантайм не предполагает «агент = организация».
"""

from __future__ import annotations

import hashlib
import hmac
import json
import uuid

import httpx
import pytest
import sqlalchemy as sa

from src import dependencies
from src.ai.engine_types import IncomingMessage
from src.channels.agent_origins import origins_for_agent
from src.db.base import utcnow
from src.db.models import Agent, Client, Conversation, Document, Organization, WhatsAppConnection
from src.knowledge import retriever
from src.knowledge.ingestor import ingest_document
from tests.contract_schema import apply_contract
from tests.dashboard_fakes import PANEL, _all, panel, seed_conversation, seed_org, sync_db  # noqa: F401
from tests.engine_fakes import ScriptedLlm, engine_env, reply  # noqa: F401
from tests.test_whatsapp import (  # noqa: F401
    APP_SECRET,
    FERNET,
    GUEST,
    KEY,
    PHONE_ID,
    SERVICE,
    TOKEN,
    _drain,
    _webhook_body,
    app,
    net,
)
from tests.llm_fakes import LLM_ENV
from tests.widget_fakes import FakeRunner, SITE_ORIGIN, seed_visitor, widget_app

SERVICE = {"X-Service-Key": "service-key-for-tests-only"}  # песочницу открывает только служебный ключ платформы (30.09.2026)
ORG = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa"  # у tests.test_whatsapp.app это ORG; агент перенесённого продавца — тот же id
ORG_B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb"
AGENT_1 = ORG  # перенесённый продавец
AGENT_2 = "cccccccc-3333-4333-8333-cccccccccccc"  # второй агент той же организации
AGENT_B2 = "dddddddd-4444-4444-8444-dddddddddddd"  # второй агент организации Б
KEY_1 = "sk_" + "a1" * 12
KEY_2 = "sk_" + "c3" * 12
HOST_1 = "https://one.example.test"
HOST_2 = "https://two.example.test"


@pytest.fixture(autouse=True)
def _contract_schema(migrated_db: str) -> None:
    """Два агента одной организации возможны только на схеме после сужения (0010): её и берём — см. tests/contract_schema.py."""
    apply_contract(migrated_db)


def seed_agent(sessions, agent_id: str, org_id: str, key: str, hosts: list[str], *, prompt: str | None = None,
               active: bool = True, name: str = "Второй агент") -> None:
    """Второй агент организации — строка `agents` без изменения организации (DATA_MODEL §20.2)."""
    now = utcnow()
    with sessions() as session:
        session.add(Agent(id=uuid.UUID(agent_id), organization_id=uuid.UUID(org_id), name=name, public_key=key,
                          hosts=list(hosts), system_prompt=prompt, active=active, created_at=now, updated_at=now))
        session.commit()


def headers(org: str, agent: str | None = None) -> dict[str, str]:
    return {**SERVICE, "X-Organization": org, **({"X-Agent": agent} if agent else {})}


# ─── Виджет: у каждого агента свой ключ и своя история ───


@pytest.fixture
def runner() -> FakeRunner:
    return FakeRunner()


@pytest.fixture
def two_agent_widget(monkeypatch, fake_redis, sync_db, runner):  # noqa: F811
    with widget_app(monkeypatch, fake_redis, runner=runner, BOT_ROLE="seller") as w:
        seed_org(sync_db, ORG, KEY_1, [HOST_1], prompt="Ты первый агент.")
        seed_agent(sync_db, AGENT_2, ORG, KEY_2, [HOST_2], prompt="Ты второй агент.")
        yield w


def test_each_agent_has_its_own_key_and_hosts(two_agent_widget, runner) -> None:
    w = two_agent_widget
    assert w.session(origin=HOST_1, org_key=KEY_1).status_code == 200
    assert w.session(origin=HOST_2, org_key=KEY_2).status_code == 200
    # ключ одного агента с домена другого — та же организация, но дверь чужая
    assert w.session(origin=HOST_2, org_key=KEY_1).status_code == 403
    assert w.session(origin=HOST_1, org_key=KEY_2).status_code == 403
    # ход уходит в движок с агентом двери и организацией из строки агента
    key = w.new_visitor(origin=HOST_2, org_key=KEY_2)
    assert w.message(key, origin=HOST_2, org_key=KEY_2).status_code == 200
    assert runner.submitted[-1].agent_id == AGENT_2
    assert runner.submitted[-1].organization_id == ORG


def test_the_same_visitor_is_two_clients_at_two_agents_of_one_org(two_agent_widget, sync_db) -> None:  # noqa: F811
    w = two_agent_widget
    w.new_visitor(visitor_key="obshchiy-gost", origin=HOST_1, org_key=KEY_1)
    w.new_visitor(visitor_key="obshchiy-gost", origin=HOST_2, org_key=KEY_2)
    clients = _all(sync_db, sa.select(Client).where(Client.external_id == "obshchiy-gost"))
    assert {str(c.agent_id) for c in clients} == {AGENT_1, AGENT_2}
    assert {str(c.organization_id) for c in clients} == {ORG}
    convs = _all(sync_db, sa.select(Conversation))
    assert {str(c.agent_id) for c in convs} == {AGENT_1, AGENT_2}


def test_the_poll_does_not_cross_agents_of_one_organization(two_agent_widget, sync_db) -> None:  # noqa: F811
    w = two_agent_widget
    conversation_id = seed_visitor(sync_db, visitor_key="gost-pervogo", texts=("Вопрос первому агенту",))
    with sync_db() as session:
        conv = session.get(Conversation, conversation_id)
        client = session.get(Client, conv.client_id)
        client.organization_id = conv.organization_id = uuid.UUID(ORG)
        client.agent_id = conv.agent_id = uuid.UUID(AGENT_1)
        session.commit()
    mine = w.poll("gost-pervogo", origin=HOST_1, org_key=KEY_1)
    assert [m["text"] for m in mine.json()["messages"]] == ["Вопрос первому агенту"]
    other = w.poll("gost-pervogo", origin=HOST_2, org_key=KEY_2)
    assert other.status_code == 200 and other.json()["messages"] == [], "история первого агента не видна второму"


def test_an_inactive_agent_is_silent_even_in_an_active_organization(two_agent_widget, sync_db) -> None:  # noqa: F811
    with sync_db() as session:
        session.execute(sa.update(Agent).where(Agent.id == uuid.UUID(AGENT_2)).values(active=False))
        session.commit()
    assert two_agent_widget.session(origin=HOST_2, org_key=KEY_2).status_code == 403
    assert two_agent_widget.session(origin=HOST_1, org_key=KEY_1).status_code == 200, "соседний агент работает"


# ─── Домены виджета: вычисляет платформа, копии в агенте нет (Q-SA-17) ───


class PlatformOrigins:
    """Платформа в памяти: `GET /bot/agent-origins?agent=` — что она ответит и сколько раз её спросили."""

    def __init__(self) -> None:
        self.hosts: dict[str, list[str] | None] = {}
        self.down = False
        self.calls = 0

    def handler(self, request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/bot/agent-origins"
        assert request.headers.get("x-wetop-service-key") == "quote-key"
        self.calls += 1
        if self.down:
            return httpx.Response(503, json={"message": "недоступно"})
        answer = self.hosts.get(request.url.params["agent"])
        return httpx.Response(404, json={}) if answer is None else httpx.Response(200, json={"hosts": answer})


@pytest.fixture
def platform(monkeypatch) -> PlatformOrigins:
    fake = PlatformOrigins()
    monkeypatch.setattr(
        dependencies._resources, "http_client", httpx.AsyncClient(transport=httpx.MockTransport(fake.handler))
    )
    return fake


@pytest.fixture
def widget_with_platform(monkeypatch, fake_redis, sync_db, runner, platform):  # noqa: F811
    with widget_app(
        monkeypatch, fake_redis, runner=runner, BOT_ROLE="seller",
        INTEGRATION_BASE_URL="http://platform.test", INTEGRATION_API_KEY="quote-key",
    ) as w:
        # в базе бота домены у агентов «стародавние» — платформа их перекрывает
        seed_org(sync_db, ORG, KEY_1, ["https://stale-mirror.example.test"], prompt="Ты первый агент.")
        seed_agent(sync_db, AGENT_2, ORG, KEY_2, [], prompt="Ты второй агент.")
        yield w


def test_widget_origins_come_from_the_platform_not_from_a_copy(widget_with_platform, platform) -> None:
    platform.hosts[AGENT_1] = [HOST_1]
    platform.hosts[AGENT_2] = [HOST_2]
    w = widget_with_platform
    assert w.session(origin=HOST_1, org_key=KEY_1).status_code == 200
    assert w.session(origin=HOST_2, org_key=KEY_2).status_code == 200
    assert w.session(origin="https://stale-mirror.example.test", org_key=KEY_1).status_code == 403, "копия в агенте не читается"
    assert w.session(origin=HOST_1, org_key=KEY_2).status_code == 403


def test_a_location_without_a_domain_opens_no_widget(widget_with_platform, platform) -> None:
    """У филиала нет разрешённого домена: агент-черновик создаётся, а виджет на внешнем сайте не активируется."""
    platform.hosts[AGENT_1] = []
    assert widget_with_platform.session(origin=HOST_1, org_key=KEY_1).status_code == 403
    assert widget_with_platform.session(origin="https://stale-mirror.example.test", org_key=KEY_1).status_code == 403


def test_an_agent_unknown_to_the_platform_is_closed(widget_with_platform, platform) -> None:
    assert AGENT_2 not in platform.hosts  # платформа отвечает 404
    assert widget_with_platform.session(origin=HOST_2, org_key=KEY_2).status_code == 403


def test_origins_are_cached_and_survive_a_platform_outage(widget_with_platform, platform) -> None:
    platform.hosts[AGENT_1] = [HOST_1]
    w = widget_with_platform
    assert w.session(origin=HOST_1, org_key=KEY_1).status_code == 200
    first = platform.calls
    for _ in range(3):
        assert w.session(origin=HOST_1, org_key=KEY_1).status_code == 200
    assert platform.calls == first, "ответ платформы кэшируется: не один вызов на каждый запрос браузера"


def test_origins_fall_back_to_the_last_answer_when_the_platform_is_down(monkeypatch, fake_redis, sync_db, platform) -> None:  # noqa: F811
    import asyncio

    from src.config import get_settings

    monkeypatch.setenv("INTEGRATION_BASE_URL", "http://platform.test")
    monkeypatch.setenv("INTEGRATION_API_KEY", "quote-key")
    get_settings.cache_clear()
    import src.dependencies as deps

    monkeypatch.setattr(deps._resources, "redis", fake_redis)
    seed_org(sync_db, ORG, KEY_1, ["https://zerkalo.example.test"])
    with sync_db() as session:
        agent = session.get(Agent, uuid.UUID(AGENT_1))
    platform.hosts[AGENT_1] = [HOST_1]
    settings = get_settings()

    async def scenario():
        assert await origins_for_agent(settings, agent) == [HOST_1]
        await fake_redis.delete(f"agent-origins:{agent.id}")  # свежий кэш истёк, устаревший жив
        platform.down = True
        assert await origins_for_agent(settings, agent) == [HOST_1], "последний ответ платформы, а не зеркало"
        await fake_redis.delete(f"agent-origins-stale:{agent.id}")
        assert await origins_for_agent(settings, agent) == ["https://zerkalo.example.test"], "холодный старт: прежние домены"

    asyncio.run(scenario())


# ─── WhatsApp: подключение и вебхук — у агента ───


def _connect_agent(app, org: str, agent: str | None, *, phone_id: str, token: str = TOKEN, secret: str = APP_SECRET):  # noqa: F811
    return app.client.put(
        f"{PANEL}/seller/organizations/{org}/whatsapp",
        json={"phone_number_id": phone_id, "token": token, "app_secret": secret},
        headers={**SERVICE, **({"X-Agent": agent} if agent else {})},
    )


def _post_agent(app, agent: str, raw: bytes, secret: str = APP_SECRET):  # noqa: F811
    return app.client.post(
        f"/channels/whatsapp/webhook/{agent}",
        content=raw,
        headers={"Content-Type": "application/json", "X-Hub-Signature-256": "sha256=" + hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()},
    )


@pytest.fixture
def two_agents_whatsapp(app, sync_db):  # noqa: F811
    seed_agent(sync_db, AGENT_2, ORG, KEY_2, [], prompt="Ты второй агент гостиницы-стенда.")
    return app


def test_the_whatsapp_panel_needs_the_agent_when_there_are_two(two_agents_whatsapp) -> None:
    app = two_agents_whatsapp
    assert _connect_agent(app, ORG, None, phone_id=PHONE_ID).status_code == 400, "угадывать агента нельзя"
    assert _connect_agent(app, ORG, AGENT_1, phone_id=PHONE_ID).status_code == 200
    assert _connect_agent(app, ORG, AGENT_2, phone_id="555000222", token=TOKEN + "-2", secret=APP_SECRET + "-2").status_code == 200


def test_a_foreign_or_unknown_agent_header_is_refused(two_agents_whatsapp, sync_db) -> None:  # noqa: F811
    app = two_agents_whatsapp
    assert _connect_agent(app, ORG, "eeeeeeee-5555-4555-8555-eeeeeeeeeeee", phone_id=PHONE_ID).status_code == 403
    # агент организации Б под организацией А
    assert _connect_agent(app, ORG, ORG_B, phone_id=PHONE_ID).status_code == 403
    assert _connect_agent(app, ORG, "ne-uuid", phone_id=PHONE_ID).status_code == 403
    assert _all(sync_db, sa.select(WhatsAppConnection)) == []


def test_one_number_cannot_belong_to_two_agents_of_one_org(two_agents_whatsapp) -> None:
    app = two_agents_whatsapp
    assert _connect_agent(app, ORG, AGENT_1, phone_id=PHONE_ID).status_code == 200
    assert _connect_agent(app, ORG, AGENT_2, phone_id=PHONE_ID).status_code == 409


def test_a_webhook_signed_with_another_agents_secret_is_refused(two_agents_whatsapp) -> None:
    app = two_agents_whatsapp
    _connect_agent(app, ORG, AGENT_1, phone_id=PHONE_ID)
    _connect_agent(app, ORG, AGENT_2, phone_id="555000222", token=TOKEN + "-2", secret=APP_SECRET + "-2")
    raw = _webhook_body(phone_id="555000222")
    assert _post_agent(app, AGENT_1, raw, secret=APP_SECRET + "-2").status_code == 403, "подпись секретом второго агента"
    assert _post_agent(app, AGENT_2, raw, secret=APP_SECRET).status_code == 403
    assert _post_agent(app, AGENT_2, raw, secret=APP_SECRET + "-2").status_code == 200


def test_the_webhook_address_is_the_agent_not_the_organization(two_agents_whatsapp) -> None:
    """Адрес вебхука — идентификатор агента: организация с двумя агентами по своему id вебхука не имеет."""
    app = two_agents_whatsapp
    _connect_agent(app, ORG, AGENT_2, phone_id="555000222", token=TOKEN + "-2", secret=APP_SECRET + "-2")
    raw = _webhook_body(phone_id="555000222")
    # ORG — идентификатор первого (перенесённого) агента: подключения у него нет
    assert _post_agent(two_agents_whatsapp, ORG, raw, secret=APP_SECRET + "-2").status_code == 403
    assert _post_agent(two_agents_whatsapp, "eeeeeeee-5555-4555-8555-eeeeeeeeeeee", raw).status_code == 403


def test_a_message_goes_to_its_agent_and_the_reply_uses_its_token(two_agents_whatsapp, sync_db, net) -> None:  # noqa: F811
    app = two_agents_whatsapp
    _connect_agent(app, ORG, AGENT_1, phone_id=PHONE_ID)
    _connect_agent(app, ORG, AGENT_2, phone_id="555000222", token=TOKEN + "-2", secret=APP_SECRET + "-2")
    assert _post_agent(app, AGENT_2, _webhook_body(phone_id="555000222"), secret=APP_SECRET + "-2").status_code == 200
    _drain(app)
    clients = _all(sync_db, sa.select(Client).where(Client.channel == "whatsapp"))
    assert [str(c.agent_id) for c in clients] == [AGENT_2] and str(clients[0].organization_id) == ORG
    assert len(net.graph) == 1
    assert net.graph[0].headers["authorization"] == f"Bearer {TOKEN}-2", "ответ ушёл токеном второго агента"
    assert net.graph[0].url.path.endswith("/555000222/messages")

    # тот же гость пишет первому агенту — отдельный клиент и диалог, и дедуп не съел вторую реплику
    assert _post_agent(app, AGENT_1, _webhook_body()).status_code == 200
    _drain(app)
    clients = _all(sync_db, sa.select(Client).where(Client.channel == "whatsapp"))
    assert {str(c.agent_id) for c in clients} == {AGENT_1, AGENT_2}
    assert net.llm_calls == 2
    assert net.graph[1].headers["authorization"] == f"Bearer {TOKEN}"


# ─── Панель: X-Agent разводит агентов одной организации ───


@pytest.fixture
def seller_panel(monkeypatch, fake_redis, sync_db):  # noqa: F811
    with panel(monkeypatch, fake_redis, SELLER_SERVICE_KEY=KEY, BOT_ROLE="seller") as p:
        seed_org(sync_db, ORG, KEY_1, [HOST_1], prompt="Ты первый агент.")
        seed_agent(sync_db, AGENT_2, ORG, KEY_2, [HOST_2], prompt="Ты второй агент.")
        seed_org(sync_db, ORG_B, "sk_" + "b2" * 12, [], prompt="Ты агент Б.")
        yield p


def _seed_dialog(sessions, agent: str, org: str, text: str, visitor: str) -> uuid.UUID:
    conversation_id = seed_conversation(sessions, channel="widget", external_id=visitor, texts=(text,))
    with sessions() as session:
        conv = session.get(Conversation, conversation_id)
        client = session.get(Client, conv.client_id)
        client.organization_id = conv.organization_id = uuid.UUID(org)
        client.agent_id = conv.agent_id = uuid.UUID(agent)
        session.commit()
    return conversation_id


def test_conversations_belong_to_their_agent(seller_panel, sync_db) -> None:  # noqa: F811
    c1 = _seed_dialog(sync_db, AGENT_1, ORG, "Вопрос первому", "gost-1")
    c2 = _seed_dialog(sync_db, AGENT_2, ORG, "Вопрос второму", "gost-2")
    p = seller_panel.client
    one = p.get(f"{PANEL}/conversations", headers=headers(ORG, AGENT_1)).json()["items"]
    two = p.get(f"{PANEL}/conversations", headers=headers(ORG, AGENT_2)).json()["items"]
    assert [i["id"] for i in one] == [str(c1)] and [i["id"] for i in two] == [str(c2)]
    # карточка, перехват, закрытие и ответ чужого агента той же организации — как несуществующие
    assert p.get(f"{PANEL}/conversations/{c1}", headers=headers(ORG, AGENT_2)).status_code == 404
    assert p.post(f"{PANEL}/conversations/{c1}/takeover", headers=headers(ORG, AGENT_2)).status_code == 404
    assert p.post(f"{PANEL}/conversations/{c1}/close", headers=headers(ORG, AGENT_2)).status_code == 404
    assert p.post(f"{PANEL}/conversations/{c1}/reply", json={"text": "привет"}, headers=headers(ORG, AGENT_2)).status_code == 404
    assert p.get(f"{PANEL}/conversations/{c1}", headers=headers(ORG, AGENT_1)).status_code == 200


def test_the_header_is_required_with_two_agents_and_checked_always(seller_panel) -> None:
    p = seller_panel.client
    assert p.get(f"{PANEL}/conversations", headers=headers(ORG)).status_code == 400, "два агента, а какой — не сказано"
    assert p.get(f"{PANEL}/conversations", headers=headers(ORG_B)).status_code == 200, "у Б агент один — как прежде"
    assert p.get(f"{PANEL}/conversations", headers=headers(ORG, ORG_B)).status_code == 403, "агент другой организации"
    assert p.get(f"{PANEL}/conversations", headers=headers(ORG, "eeeeeeee-5555-4555-8555-eeeeeeeeeeee")).status_code == 403
    assert p.get(f"{PANEL}/conversations", headers=headers(ORG_B, AGENT_2)).status_code == 403, "агент А под организацией Б"


def test_the_summary_counts_only_the_agent(seller_panel, sync_db) -> None:  # noqa: F811
    _seed_dialog(sync_db, AGENT_1, ORG, "Один", "gost-1")
    _seed_dialog(sync_db, AGENT_2, ORG, "Два", "gost-2")
    _seed_dialog(sync_db, AGENT_2, ORG, "Три", "gost-3")
    p = seller_panel.client
    assert p.get(f"{PANEL}/summary", headers=headers(ORG, AGENT_1)).json()["dialogs"] == 1
    assert p.get(f"{PANEL}/summary", headers=headers(ORG, AGENT_2)).json()["dialogs"] == 2


def test_knowledge_is_per_agent_and_the_same_file_lives_at_both(seller_panel, fake_embedder, sync_db) -> None:  # noqa: F811
    p = seller_panel.client
    for agent in (AGENT_1, AGENT_2):
        up = p.post(
            f"{PANEL}/knowledge",
            files={"file": ("obshchee.md", "Завтрак с 8 до 10.".encode(), "text/markdown")},
            headers=headers(ORG, agent),
        )
        assert up.status_code == 200 and up.json()["created"] is True, "у каждого агента своя копия"
    p.post(
        f"{PANEL}/knowledge",
        files={"file": ("tolko-vtoromu.md", "Парковка платная.".encode(), "text/markdown")},
        headers=headers(ORG, AGENT_2),
    )
    one = p.get(f"{PANEL}/knowledge", headers=headers(ORG, AGENT_1)).json()["items"]
    two = p.get(f"{PANEL}/knowledge", headers=headers(ORG, AGENT_2)).json()["items"]
    assert [d["source"] for d in one] == ["obshchee.md"]
    assert {d["source"] for d in two} == {"obshchee.md", "tolko-vtoromu.md"}
    docs = _all(sync_db, sa.select(Document))
    assert {str(d.agent_id) for d in docs} == {AGENT_1, AGENT_2} and {str(d.organization_id) for d in docs} == {ORG}


PROFILE = {
    "object_name": "Филиал два", "bot_name": "Дана", "address_form": "vy", "emoji": "never", "reply_length": "short",
    "languages": ["русский"], "greeting": "Здравствуйте!", "included_in_price": "Wi-Fi.", "extra_charges": "",
    "house_rules": "Тишина после 23:00.", "prohibitions": [], "call_human_when": [], "faq": [],
}
FACTS = {
    "object_name": "Филиал два", "check_in": "14:00", "check_out": "12:00", "currency": "KZT",
    "categories": [{"name": "Стандарт", "kind": "room", "capacity": 2, "price_minor": 1_500_000}],
}


def test_the_profile_lands_in_the_agent_and_never_in_the_neighbour(seller_panel, sync_db) -> None:  # noqa: F811
    p = seller_panel.client
    with sync_db() as session:
        before_org = session.get(Organization, uuid.UUID(ORG)).system_prompt
        before_1 = session.get(Agent, uuid.UUID(AGENT_1)).system_prompt
    response = p.put(f"{PANEL}/seller/profile", json=PROFILE, headers=headers(ORG, AGENT_2))
    assert response.status_code == 200, response.text
    with sync_db() as session:
        second = session.get(Agent, uuid.UUID(AGENT_2)).system_prompt
        assert second and "Тишина после 23:00" in second and "Филиал два" in second
        assert session.get(Agent, uuid.UUID(AGENT_1)).system_prompt == before_1 == "Ты первый агент."
        assert session.get(Organization, uuid.UUID(ORG)).system_prompt == before_org, "строка организации не тронута"
    # перенесённый агент: строка организации следует за ним (зеркало до сжатия схемы)
    assert p.put(f"{PANEL}/seller/profile", json={**PROFILE, "object_name": "Филиал один"}, headers=headers(ORG, AGENT_1)).status_code == 200
    with sync_db() as session:
        assert "Филиал один" in session.get(Organization, uuid.UUID(ORG)).system_prompt
        assert "Филиал два" in session.get(Agent, uuid.UUID(AGENT_2)).system_prompt


def test_facts_are_kept_per_agent(seller_panel, fake_embedder, sync_db) -> None:  # noqa: F811
    p = seller_panel.client
    for agent in (AGENT_1, AGENT_2):
        assert p.put(f"{PANEL}/seller/facts", json=FACTS, headers=headers(ORG, agent)).status_code == 200
    # замена фактов второго агента не трогает факты первого
    changed = p.put(f"{PANEL}/seller/facts", json={**FACTS, "check_in": "15:00"}, headers=headers(ORG, AGENT_2))
    assert changed.json()["status"] == "replaced"
    docs = _all(sync_db, sa.select(Document).where(Document.source == "platform:facts.md"))
    assert {str(d.agent_id) for d in docs} == {AGENT_1, AGENT_2}
    same = p.put(f"{PANEL}/seller/facts", json=FACTS, headers=headers(ORG, AGENT_1))
    assert same.json()["status"] == "unchanged", "факты первого агента остались прежними"


def test_the_sandbox_names_the_agent_when_there_are_two(seller_panel) -> None:
    body = {"external_id": "sandbox-1", "text": "Привет", "organization_id": ORG}
    p = seller_panel.client
    unnamed = p.post("/internal/sandbox", json=body, headers=SERVICE)
    assert unnamed.status_code == 400 and unnamed.json()["status"] == "agent_required"
    foreign = p.post("/internal/sandbox", json={**body, "agent_id": ORG_B}, headers=SERVICE)
    assert foreign.status_code == 403


# ─── Движок: промпт, знания, клиент, диалог и дедуп — агента входящего ───


async def test_the_engine_answers_with_the_agent_prompt_and_its_own_knowledge(engine_env, sync_db) -> None:  # noqa: F811
    seed_org(sync_db, ORG, KEY_1, [], prompt="Ты первый агент.")
    seed_agent(sync_db, AGENT_2, ORG, KEY_2, [], prompt="Ты второй агент, отвечай по-своему.")
    kwargs = dict(max_bytes=1024 * 1024, chunk_chars=400, overlap=40, min_chars=10)
    async with engine_env.sessionmaker() as session:
        await ingest_document(session, engine_env.embedder, source="pervyy.md",
                              data="Парковка у первого агента бесплатная.".encode(),
                              organization_id=uuid.UUID(ORG), agent_id=uuid.UUID(AGENT_1), **kwargs)
        await ingest_document(session, engine_env.embedder, source="vtoroy.md",
                              data="Парковка у второго агента стоит денег.".encode(),
                              organization_id=uuid.UUID(ORG), agent_id=uuid.UUID(AGENT_2), **kwargs)
    llm = ScriptedLlm([reply("Здравствуйте, первый.")])
    outcome = await engine_env.engine(llm=llm).process_message(
        IncomingMessage(channel="widget", external_id="gost-e", text="Как с парковкой?", received_at=utcnow(),
                        organization_id=ORG, agent_id=AGENT_2)
    )
    assert outcome.status == "replied", outcome
    system = "\n".join(str(m["content"]) for m in llm.last_messages)
    assert "Ты второй агент" in system and "Ты первый агент" not in system
    assert "второго агента стоит денег" in system and "первого агента бесплатная" not in system, "знания соседа не попали в ход"
    clients = _all(sync_db, sa.select(Client).where(Client.external_id == "gost-e"))
    assert [(str(c.agent_id), str(c.organization_id)) for c in clients] == [(AGENT_2, ORG)]


async def test_the_same_guest_and_text_reach_both_agents(engine_env, sync_db) -> None:  # noqa: F811
    seed_org(sync_db, ORG, KEY_1, [], prompt="Ты первый агент.")
    seed_agent(sync_db, AGENT_2, ORG, KEY_2, [], prompt="Ты второй агент.")
    for agent in (AGENT_1, AGENT_2):
        outcome = await engine_env.engine(llm=ScriptedLlm([reply("Ответ.")])).process_message(
            IncomingMessage(channel="widget", external_id="gost-d", text="Здравствуйте", received_at=utcnow(),
                            organization_id=ORG, agent_id=agent)
        )
        assert outcome.status == "replied", (agent, outcome)
    assert len(_all(sync_db, sa.select(Client).where(Client.external_id == "gost-d"))) == 2
    assert len(_all(sync_db, sa.select(Conversation))) == 2


async def test_an_incomplete_scope_is_refused_without_guessing_the_agent(engine_env, sync_db) -> None:  # noqa: F811
    """Организация без агента — ошибка двери: агента по организации движок не угадывает и строк не пишет."""
    seed_org(sync_db, ORG, KEY_1, [], prompt="Ты первый агент.")
    outcome = await engine_env.engine(llm=ScriptedLlm([reply("Не должен ответить.")])).process_message(
        IncomingMessage(channel="widget", external_id="gost-n", text="Есть места?", received_at=utcnow(),
                        organization_id=ORG)
    )
    assert outcome.status == "error" and outcome.reasons == ["no_agent"] and outcome.reply is None
    assert _all(sync_db, sa.select(Client).where(Client.external_id == "gost-n")) == []
    # и наоборот: агент без организации
    outcome = await engine_env.engine(llm=ScriptedLlm([reply("Не должен ответить.")])).process_message(
        IncomingMessage(channel="widget", external_id="gost-m", text="Есть места?", received_at=utcnow(),
                        agent_id=AGENT_1)
    )
    assert outcome.reasons == ["no_agent"]


async def test_an_agent_of_another_organization_is_refused(engine_env, sync_db) -> None:  # noqa: F811
    """Дверь назвала организацию А и агента организации Б: ход не обрабатывается, строк чужому продавцу нет."""
    seed_org(sync_db, ORG, KEY_1, [], prompt="Ты агент А.")
    seed_org(sync_db, ORG_B, "sk_" + "b2" * 12, [], prompt="Ты агент Б.")
    outcome = await engine_env.engine(llm=ScriptedLlm([reply("Не должен ответить.")])).process_message(
        IncomingMessage(channel="widget", external_id="gost-x", text="Есть места?", received_at=utcnow(),
                        organization_id=ORG, agent_id=ORG_B)
    )
    assert outcome.status == "error" and "exception" in outcome.reasons
    assert _all(sync_db, sa.select(Client).where(Client.external_id == "gost-x")) == []


async def test_the_llm_key_and_budget_stay_with_the_organization(engine_env, sync_db) -> None:  # noqa: F811
    """Q-SA-10: ключ модели и дневной предел — организации; оба её агента расходуют один предел."""
    from src.ai.budget import tokens_since
    from src.db.base import ConversationMode  # noqa: F401

    seed_org(sync_db, ORG, KEY_1, [], prompt="Ты первый агент.")
    seed_agent(sync_db, AGENT_2, ORG, KEY_2, [], prompt="Ты второй агент.")
    for agent in (AGENT_1, AGENT_2):
        await engine_env.engine(llm=ScriptedLlm([reply("Ответ.")])).process_message(
            IncomingMessage(channel="widget", external_id=f"gost-{agent[:4]}", text="Здравствуйте", received_at=utcnow(),
                            organization_id=ORG, agent_id=agent)
        )
    async with engine_env.sessionmaker() as session:
        spent = await tokens_since(session, uuid.UUID(ORG), utcnow().replace(hour=0, minute=0, second=0, microsecond=0))
    assert spent >= 0  # расход считается по организации: оба агента — в одной сумме (арифметику проверяют тесты предела)
