"""Э4: один продавец на все гостиницы — изоляция организаций (ADR-083, Q-181 (б)).

Гостиница Б не видит ничего из гостиницы А: ни диалогов, ни знаний, ни промпта,
ни виджета. Экземпляр-помощник (BOT_ROLE=support) остаётся без организаций —
его сегодняшнее поведение не меняется, и это тоже проверено здесь.

🔴 До кода Э4 файл красный целиком: организаций нет ни в моделях, ни в дверях.
План: plans/seller-multitenancy-2026-09-25.md.
"""

from __future__ import annotations

import uuid

import pytest
import sqlalchemy as sa

from src.ai.engine import NEUTRAL_REPLY
from src.ai.engine_types import IncomingMessage
from src.db.base import utcnow
from src.db.models import Client, Conversation, Document, Message, Organization
from src.knowledge import retriever
from src.knowledge.ingestor import ingest_document
from tests.dashboard_fakes import (  # noqa: F401 — sync_db идёт фикстурой
    PANEL,
    _all,
    panel,
    seed_org as _seed_org,
    sync_db,
)
from tests.engine_fakes import ScriptedLlm, engine_env, reply  # noqa: F401
from tests.widget_fakes import (
    FakeRunner,
    SITE_ORIGIN,
    seed_visitor,
    widget_app,
)

SERVICE_KEY = "service-key-for-tests-only"
SERVICE = {"X-Service-Key": SERVICE_KEY}

# Организации вымышленные; ключи — формата платформы: sk_ + 24 hex.
ORG_A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa"
ORG_B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb"
KEY_A = "sk_" + "a1" * 12
KEY_B = "sk_" + "b2" * 12
HOST_A = "https://hotel-a.example.test"
HOST_B = "https://hotel-b.example.test"

ORG_BODY_A = {"name": "Гостиница А", "public_key": KEY_A, "active": True, "hosts": [HOST_A]}
ORG_BODY_B = {"name": "Гостиница Б", "public_key": KEY_B, "active": True, "hosts": [HOST_B]}


def org_headers(org: str) -> dict[str, str]:
    return dict(SERVICE) | {"X-Organization": org}


def seed_org(sessions, org_id, key, hosts, *, active=True, prompt=None):
    """Гостиница — общим помощником стендов (dashboard_fakes.seed_org)."""
    _seed_org(sessions, org_id, key, hosts, active=active, prompt=prompt)


def org_of(sessions, org_id: str) -> Organization | None:
    rows = _all(sessions, sa.select(Organization).where(Organization.id == uuid.UUID(org_id)))
    return rows[0] if rows else None


# ─── Служебный маршрут: платформа заводит гостиницу ───


@pytest.fixture
def seller_panel(monkeypatch, fake_redis, sync_db):  # noqa: F811
    with panel(monkeypatch, fake_redis, SELLER_SERVICE_KEY=SERVICE_KEY, BOT_ROLE="seller") as p:
        yield p


def test_the_platform_upserts_an_organization(seller_panel, sync_db) -> None:  # noqa: F811
    response = seller_panel.client.put(
        f"{PANEL}/seller/organizations/{ORG_A}", json=ORG_BODY_A, headers=SERVICE
    )
    assert response.status_code == 200, response.text
    row = org_of(sync_db, ORG_A)
    assert row is not None
    assert row.public_key == KEY_A
    assert row.active is True
    assert list(row.hosts) == [HOST_A]

    # Повторный PUT — правка той же строки: расширение кончилось, active=False.
    response = seller_panel.client.put(
        f"{PANEL}/seller/organizations/{ORG_A}",
        json={**ORG_BODY_A, "active": False},
        headers=SERVICE,
    )
    assert response.status_code == 200, response.text
    row = org_of(sync_db, ORG_A)
    assert row.active is False
    assert len(_all(sync_db, sa.select(Organization))) == 1


def test_the_upsert_needs_the_service_key(seller_panel) -> None:
    response = seller_panel.client.put(f"{PANEL}/seller/organizations/{ORG_A}", json=ORG_BODY_A)
    assert response.status_code == 401


def test_the_support_instance_has_no_organizations(monkeypatch, fake_redis, sync_db) -> None:  # noqa: F811
    """У помощника один хозяин — платформа; гостиниц у него не бывает."""
    with panel(monkeypatch, fake_redis, SELLER_SERVICE_KEY=SERVICE_KEY, BOT_ROLE="support") as p:
        response = p.client.put(
            f"{PANEL}/seller/organizations/{ORG_A}", json=ORG_BODY_A, headers=SERVICE
        )
        assert response.status_code == 409


# ─── Виджет: дверь открывает ключ гостиницы, и только с её доменов ───


@pytest.fixture
def runner() -> FakeRunner:
    return FakeRunner()


@pytest.fixture
def seller_widget(monkeypatch, fake_redis, sync_db, runner):  # noqa: F811
    """Продавец с двумя гостиницами. Домен из WIDGET_SITE_HOSTS нарочно
    чужой: у продавца дверь открывают домены гостиницы, а не переменная."""
    with widget_app(monkeypatch, fake_redis, runner=runner, BOT_ROLE="seller") as w:
        seed_org(sync_db, ORG_A, KEY_A, [HOST_A])
        seed_org(sync_db, ORG_B, KEY_B, [HOST_B])
        yield w


def test_the_seller_widget_requires_a_known_key(seller_widget) -> None:
    assert seller_widget.session(origin=HOST_A).status_code == 403, "без ключа"
    assert (
        seller_widget.session(origin=HOST_A, org_key="sk_" + "00" * 12).status_code == 403
    ), "неизвестный ключ"
    assert seller_widget.session(origin=HOST_A, org_key=KEY_A).status_code == 200


def test_the_key_opens_only_from_the_org_hosts(seller_widget) -> None:
    assert seller_widget.session(origin=HOST_B, org_key=KEY_A).status_code == 403, "чужой домен"
    # Домен из переменной окружения продавцу не указ: дверь по доменам гостиницы.
    assert seller_widget.session(origin=SITE_ORIGIN, org_key=KEY_A).status_code == 403


def test_an_inactive_org_is_silent(monkeypatch, fake_redis, sync_db, runner) -> None:  # noqa: F811
    """Q-183: кончился срок расширения — виджет гаснет, а не уговаривает."""
    with widget_app(monkeypatch, fake_redis, runner=runner, BOT_ROLE="seller") as w:
        seed_org(sync_db, ORG_A, KEY_A, [HOST_A], active=False)
        assert w.session(origin=HOST_A, org_key=KEY_A).status_code == 403
        assert w.poll("kto-ugodno", origin=HOST_A, org_key=KEY_A).status_code == 403


def test_the_same_visitor_key_is_two_clients_in_two_orgs(seller_widget, sync_db, runner) -> None:  # noqa: F811
    """Один человек пишет на сайтах двух гостиниц: клиенты и диалоги врозь."""
    key = seller_widget.new_visitor(visitor_key="obshchiy-gost-1", origin=HOST_A, org_key=KEY_A)
    assert key == "obshchiy-gost-1"
    seller_widget.new_visitor(visitor_key="obshchiy-gost-1", origin=HOST_B, org_key=KEY_B)

    clients = _all(sync_db, sa.select(Client).where(Client.external_id == "obshchiy-gost-1"))
    assert len(clients) == 2
    assert {str(c.organization_id) for c in clients} == {ORG_A, ORG_B}

    # Ход уходит в движок с организацией двери, а не с какой-нибудь.
    response = seller_widget.message(key, "Есть места?", origin=HOST_A, org_key=KEY_A)
    assert response.status_code == 200
    assert runner.submitted[-1].organization_id == ORG_A


def test_the_poll_does_not_cross_organizations(seller_widget, sync_db) -> None:  # noqa: F811
    """Ключ гостиницы Б с чужим visitor_key не открывает историю гостиницы А."""
    conversation_id = seed_visitor(
        sync_db, visitor_key="gost-hotelya-a", texts=("Секретный вопрос про бронь",)
    )
    with sync_db() as session:
        conv = session.get(Conversation, conversation_id)
        client = session.get(Client, conv.client_id)
        client.organization_id = client.agent_id = uuid.UUID(ORG_A)  # перенесённый продавец: агент = организации
        conv.organization_id = conv.agent_id = uuid.UUID(ORG_A)
        session.commit()

    mine = seller_widget.poll("gost-hotelya-a", origin=HOST_A, org_key=KEY_A)
    assert mine.status_code == 200
    assert [m["text"] for m in mine.json()["messages"]] == ["Секретный вопрос про бронь"]

    foreign = seller_widget.poll("gost-hotelya-a", origin=HOST_B, org_key=KEY_B)
    assert foreign.status_code == 200
    assert foreign.json()["messages"] == [], "чужая история не отдаётся"


def test_the_support_widget_stays_keyless(monkeypatch, fake_redis, sync_db, runner) -> None:  # noqa: F811
    """Помощник как был: дверь по WIDGET_SITE_HOSTS, ключа в теге нет."""
    with widget_app(monkeypatch, fake_redis, runner=runner) as w:
        response = w.session(origin=SITE_ORIGIN)
        assert response.status_code == 200
        assert runner.submitted == []
        key = response.json()["visitor_key"]
        assert w.message(key, origin=SITE_ORIGIN).status_code == 200
        assert runner.submitted[-1].organization_id is None


# ─── Панель: организация запроса в заголовке X-Organization ───


def seed_dialog(sessions, org_id: str | None, text: str, *, visitor: str) -> uuid.UUID:
    conversation_id = seed_visitor(sessions, visitor_key=visitor, texts=(text,))
    if org_id is not None:
        with sessions() as session:
            conv = session.get(Conversation, conversation_id)
            client = session.get(Client, conv.client_id)
            client.organization_id = client.agent_id = uuid.UUID(org_id)  # агент = организации (§20.4)
            conv.organization_id = conv.agent_id = uuid.UUID(org_id)
            session.commit()
    return conversation_id


def test_the_seller_panel_requires_the_org_header(seller_panel) -> None:
    assert seller_panel.client.get(f"{PANEL}/conversations", headers=SERVICE).status_code == 400
    assert (
        seller_panel.client.get(
            f"{PANEL}/conversations", headers=dict(SERVICE) | {"X-Organization": "ne-uuid"}
        ).status_code
        == 400
    )


def test_conversations_are_scoped_by_the_header(seller_panel, sync_db) -> None:  # noqa: F811
    seed_org(sync_db, ORG_A, KEY_A, [HOST_A])
    seed_org(sync_db, ORG_B, KEY_B, [HOST_B])
    conv_a = seed_dialog(sync_db, ORG_A, "Вопрос гостиницe А", visitor="gost-a")
    seed_dialog(sync_db, ORG_B, "Вопрос гостинице Б", visitor="gost-b")

    mine = seller_panel.client.get(f"{PANEL}/conversations", headers=org_headers(ORG_A))
    assert mine.status_code == 200, mine.text
    assert [item["id"] for item in mine.json()["items"]] == [str(conv_a)]

    # Карточка чужого диалога — 404, как будто его нет.
    foreign = seller_panel.client.get(
        f"{PANEL}/conversations/{conv_a}", headers=org_headers(ORG_B)
    )
    assert foreign.status_code == 404
    card = seller_panel.client.get(f"{PANEL}/conversations/{conv_a}", headers=org_headers(ORG_A))
    assert card.status_code == 200
    assert card.json()["messages"][0]["text"] == "Вопрос гостиницe А"

    # Перехват чужого диалога — тоже 404.
    takeover = seller_panel.client.post(
        f"{PANEL}/conversations/{conv_a}/takeover", headers=org_headers(ORG_B)
    )
    assert takeover.status_code == 404


PROFILE = {
    "object_name": "Гостиница А",
    "bot_name": "Айгерим",
    "address_form": "vy",
    "emoji": "never",
    "reply_length": "short",
    "languages": ["русский"],
    "greeting": "Здравствуйте! Помогу подобрать номер.",
    "included_in_price": "Wi-Fi и уборка.",
    "extra_charges": "",
    "house_rules": "Тишина после 23:00.",
    "prohibitions": [],
    "call_human_when": [],
    "faq": [],
}


def test_the_profile_lands_in_the_org_row(seller_panel, sync_db) -> None:  # noqa: F811
    seed_org(sync_db, ORG_A, KEY_A, [HOST_A])
    seed_org(sync_db, ORG_B, KEY_B, [HOST_B])

    without = seller_panel.client.put(f"{PANEL}/seller/profile", json=PROFILE, headers=SERVICE)
    assert without.status_code == 400, "у продавца профиль без организации некуда класть"

    response = seller_panel.client.put(
        f"{PANEL}/seller/profile", json=PROFILE, headers=org_headers(ORG_A)
    )
    assert response.status_code == 200, response.text
    prompt_a = org_of(sync_db, ORG_A).system_prompt
    assert prompt_a and "Гостиница А" in prompt_a and "Тишина после 23:00" in prompt_a
    # Ядро правил продавца в промпте организации так же неубираемо.
    assert "Не выдумывай" in prompt_a
    assert org_of(sync_db, ORG_B).system_prompt is None, "профиль А не задел Б"


def test_knowledge_is_scoped_by_the_header(seller_panel, fake_embedder, sync_db) -> None:  # noqa: F811
    seed_org(sync_db, ORG_A, KEY_A, [HOST_A])
    seed_org(sync_db, ORG_B, KEY_B, [HOST_B])
    upload = seller_panel.client.post(
        f"{PANEL}/knowledge",
        files={"file": ("pravila-a.md", "Завтрак с 8 до 10.".encode(), "text/markdown")},
        headers=org_headers(ORG_A),
    )
    assert upload.status_code == 200, upload.text

    mine = seller_panel.client.get(f"{PANEL}/knowledge", headers=org_headers(ORG_A))
    assert [d["source"] for d in mine.json()["items"]] == ["pravila-a.md"]
    foreign = seller_panel.client.get(f"{PANEL}/knowledge", headers=org_headers(ORG_B))
    assert foreign.json()["items"] == [], "знания гостиницы А не видны из Б"


FACTS = {
    "object_name": "Гостиница А",
    "check_in": "14:00",
    "check_out": "12:00",
    "currency": "KZT",
    "categories": [{"name": "Стандарт", "kind": "room", "capacity": 2, "price_minor": 1_500_000}],
}


def test_facts_are_kept_per_organization(seller_panel, fake_embedder, sync_db) -> None:  # noqa: F811
    seed_org(sync_db, ORG_A, KEY_A, [HOST_A])
    seed_org(sync_db, ORG_B, KEY_B, [HOST_B])
    for org, name in ((ORG_A, "Гостиница А"), (ORG_B, "Гостиница Б")):
        response = seller_panel.client.put(
            f"{PANEL}/seller/facts", json={**FACTS, "object_name": name}, headers=org_headers(org)
        )
        assert response.status_code == 200, response.text

    docs = _all(sync_db, sa.select(Document).where(Document.source == "platform:facts.md"))
    assert {str(d.organization_id) for d in docs} == {ORG_A, ORG_B}

    # Замена фактов А не трогает факты Б.
    response = seller_panel.client.put(
        f"{PANEL}/seller/facts",
        json={**FACTS, "check_in": "15:00"},
        headers=org_headers(ORG_A),
    )
    assert response.status_code == 200 and response.json()["status"] == "replaced"
    left = _all(sync_db, sa.select(Document).where(Document.source == "platform:facts.md"))
    assert {str(d.organization_id) for d in left} == {ORG_A, ORG_B}


def test_the_sandbox_needs_the_org_for_the_seller(seller_panel) -> None:
    response = seller_panel.client.post(
        "/internal/sandbox",
        json={"external_id": "sandbox-1", "text": "Привет"},
        headers={"X-Internal-Key": "test-key"},
    )
    assert response.status_code == 400, "у продавца песочница без организации не знает, чей промпт брать"


# ─── Движок: промпт и знания — организации входящего ───


async def test_the_engine_answers_with_the_org_prompt(engine_env, sync_db) -> None:  # noqa: F811
    seed_org(sync_db, ORG_A, KEY_A, [HOST_A], prompt="Ты продавец гостиницы «А». Отвечай коротко.")
    llm = ScriptedLlm([reply("Здравствуйте! Есть места.")])
    engine = engine_env.engine(llm=llm, prompt_text="Файловый промпт, его быть не должно.")
    outcome = await engine.process_message(
        IncomingMessage(
            channel="widget",
            external_id="gost-a-1",
            text="Есть места на завтра?",
            received_at=utcnow(),
            organization_id=ORG_A,
            agent_id=ORG_A,
        )
    )
    assert outcome.status == "replied", outcome
    system = llm.last_messages[0]["content"]
    assert "Ты продавец гостиницы «А»" in system
    assert "Файловый промпт" not in system

    clients = _all(sync_db, sa.select(Client).where(Client.external_id == "gost-a-1"))
    assert [str(c.organization_id) for c in clients] == [ORG_A]


async def test_an_unknown_agent_fails_closed(engine_env, sync_db) -> None:  # noqa: F811
    """Агента нет в базе — бот не отвечает по чужому файлу и не пишет строк чужому продавцу: сбой хода, нейтральная фраза."""
    sender_engine = engine_env.engine(prompt_text="Файловый промпт помощника.")
    outcome = await sender_engine.process_message(
        IncomingMessage(
            channel="widget",
            external_id="gost-x",
            text="Есть места?",
            received_at=utcnow(),
            organization_id=ORG_B,
            agent_id=ORG_B,
        )
    )
    assert outcome.status == "error"
    assert "exception" in outcome.reasons
    assert _all(sync_db, sa.select(Client).where(Client.external_id == "gost-x")) == []


async def test_search_is_scoped_by_the_agent(engine_env, sync_db) -> None:  # noqa: F811
    """Поиск по знаниям не выносит факты одного агента в ответы другого (гостиница — тот же случай: агент = организации)."""
    seed_org(sync_db, ORG_A, KEY_A, [HOST_A])
    seed_org(sync_db, ORG_B, KEY_B, [HOST_B])
    sessionmaker = engine_env.sessionmaker
    kwargs = dict(max_bytes=1024 * 1024, chunk_chars=400, overlap=40, min_chars=10)
    async with sessionmaker() as session:
        await ingest_document(
            session,
            engine_env.embedder,
            source="zavtrak-a.md",
            data="Завтрак включён в цену проживания.".encode(),
            organization_id=uuid.UUID(ORG_A),
            agent_id=uuid.UUID(ORG_A),
            **kwargs,
        )
        await ingest_document(
            session,
            engine_env.embedder,
            source="zavtrak-b.md",
            data="Завтрак подаётся только за отдельную плату.".encode(),
            organization_id=uuid.UUID(ORG_B),
            agent_id=uuid.UUID(ORG_B),
            **kwargs,
        )
        mine = await retriever.search(
            session,
            engine_env.embedder,
            "завтрак включён в цену",
            top_k=5,
            agent_id=uuid.UUID(ORG_A),
        )
        assert mine, "свои знания находятся"
        assert all("отдельную плату" not in c.content for c in mine)
        foreign = await retriever.search(
            session,
            engine_env.embedder,
            "завтрак включён в цену",
            top_k=5,
            agent_id=uuid.UUID(ORG_B),
        )
        assert all("включён в цену" not in c.content for c in foreign)


async def test_the_same_facts_file_may_live_in_both_agents(engine_env, sync_db) -> None:  # noqa: F811
    """Одинаковое содержимое у двух агентов — две записи: хеш уникален в пределах агента, а не организации и не базы."""
    seed_org(sync_db, ORG_A, KEY_A, [HOST_A])
    seed_org(sync_db, ORG_B, KEY_B, [HOST_B])
    sessionmaker = engine_env.sessionmaker
    kwargs = dict(max_bytes=1024 * 1024, chunk_chars=400, overlap=40, min_chars=10)
    async with sessionmaker() as session:
        for org in (ORG_A, ORG_B):
            result = await ingest_document(
                session,
                engine_env.embedder,
                source="obshchie-pravila.md",
                data="Заезд с 14:00, выезд до 12:00.".encode(),
                organization_id=uuid.UUID(org),
                agent_id=uuid.UUID(org),
                **kwargs,
            )
            assert result.created is True, f"у {org} своя копия"
