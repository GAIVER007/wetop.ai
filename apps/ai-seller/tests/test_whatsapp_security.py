"""Проверка безопасности WhatsApp и маршрутов гостиницы у продавца (26.09.2026).

Находки проверки того, что влили 26.09 (канал WhatsApp С3, ключ модели С2):

1. Срок расширения вышел (`active=false`) — WhatsApp всё равно отвечал: гасла
   только дверь виджета (Q-183). Теперь 200 для Meta и тишина — ни модели,
   ни ответа, ни клиента в базе.
2. Человек, вошедший в собственную панель продавца, менял любой гостинице
   номер WhatsApp и ключ модели: маршруты `/seller/organizations/{id}/…`
   смотрели только на роль «владелец». У продавца их открывает только
   служебный ключ платформы (ADR-083) — как `request_org` после аудита 26.09.
3. Чужой уже подключённый номер давал 500 (уникальность `phone_number_id`) —
   теперь 409 со словами.
4. Дедуп не различал гостиниц: у WhatsApp внешний id — телефон гостя, и одно
   «Здравствуйте» в две гостиницы за минуту второй не доходило.
5. Тело вебхука читалось без предела — до подписи, то есть кем угодно.

🔴 Все проверки ниже были красными на коде до правки.
"""

from __future__ import annotations

import uuid

import sqlalchemy as sa

from src.db.dedup import is_duplicate
from src.db.models import Agent, Client, Organization
from tests.dashboard_fakes import (  # noqa: F401 — sync_db идёт фикстурой
    PANEL,
    _all,
    panel,
    sync_db,
)
from tests.test_whatsapp import (  # noqa: F401 — фикстуры app и net
    APP_SECRET,
    FERNET,
    KEY,
    ORG,
    ORG_B,
    PHONE_ID,
    SERVICE,
    TOKEN,
    _connect,
    _drain,
    _sign,
    _webhook_body,
    app,
    net,
)

ORG_BODY = {"name": "Гостиница А", "public_key": "sk_" + "ab" * 12, "active": True, "hosts": []}


def _post(app, raw: bytes, org: str = ORG, **extra: str):  # noqa: F811
    headers = {"Content-Type": "application/json", "X-Hub-Signature-256": _sign(raw)} | extra
    return app.client.post(f"/channels/whatsapp/webhook/{org}", content=raw, headers=headers)


def _set_active(sessions, org: str, active: bool) -> None:
    with sessions() as session:
        session.get(Organization, uuid.UUID(org)).active = active
        session.commit()


# ─── 1. Срок расширения вышел — WhatsApp молчит ───


def test_an_expired_extension_silences_whatsapp(app, sync_db, net) -> None:  # noqa: F811
    assert _connect(app).status_code == 200
    _set_active(sync_db, ORG, False)
    response = _post(app, _webhook_body())
    # Meta повторяет доставку на не-200: ответ 200, но хода нет.
    assert response.status_code == 200, response.text
    _drain(app)
    assert net.llm_calls == 0, "модель вызвана после конца срока расширения"
    assert net.graph == [], "гостю ушёл ответ после конца срока расширения"
    assert _all(sync_db, sa.select(Client).where(Client.channel == "whatsapp")) == []


# ─── 2. Маршруты гостиницы у продавца — только служебным ключом ───


HUMAN_ROUTES = [
    ("GET", f"/seller/organizations/{ORG}/whatsapp", None),
    ("PUT", f"/seller/organizations/{ORG}/whatsapp",
     {"phone_number_id": "777000111", "token": TOKEN, "app_secret": APP_SECRET}),
    ("POST", f"/seller/organizations/{ORG}/whatsapp/check",
     {"phone_number_id": "777000111", "token": TOKEN}),
    ("GET", f"/seller/organizations/{ORG}/llm-key", None),
    ("PUT", f"/seller/organizations/{ORG}/llm-key", {"key": "sk-human-abcd1234"}),
    ("POST", f"/seller/organizations/{ORG}/llm-key/check", {"key": "sk-human-abcd1234"}),
    ("PUT", f"/seller/organizations/{ORG}", ORG_BODY),
]


def test_a_human_panel_token_cannot_touch_a_hotel_on_the_seller(app, sync_db, net) -> None:  # noqa: F811
    owner = app.headers()
    opened = []
    for method, path, body in HUMAN_ROUTES:
        response = app.client.request(method, f"{PANEL}{path}", json=body, headers=owner)
        if response.status_code != 403:
            opened.append(f"{method} {path}: {response.status_code}")
    assert opened == [], "токен человека открыл маршруты гостиницы:\n" + "\n".join(opened)
    # Ничего не поменялось и наружу никто не ходил.
    assert net.graph == []
    assert app.client.get(f"{PANEL}/seller/organizations/{ORG}/whatsapp", headers=SERVICE).json()["set"] is False


def test_the_service_key_still_opens_the_hotel_routes(app) -> None:  # noqa: F811
    assert _connect(app).status_code == 200
    assert app.client.get(f"{PANEL}/seller/organizations/{ORG}/llm-key", headers=SERVICE).status_code == 200


def test_the_support_instance_answers_humans_as_before(monkeypatch, fake_redis, sync_db) -> None:  # noqa: F811
    """У помощника гостиниц нет: человеку — прежние 409, а не новый отказ."""
    with panel(monkeypatch, fake_redis, SELLER_SERVICE_KEY=KEY, BOT_ROLE="support", LLM_KEYS_SECRET=FERNET) as p:
        response = p.client.get(f"{PANEL}/seller/organizations/{ORG}/whatsapp", headers=p.headers())
        assert response.status_code == 409


# ─── 3. Чужой номер — 409, а не 500 ───


def test_another_hotels_number_is_refused_with_409(app) -> None:  # noqa: F811
    assert _connect(app).status_code == 200
    response = _connect(app, org=ORG_B)
    assert response.status_code == 409, response.text
    assert "другой гостинице" in response.json()["detail"]


# ─── 4. Дедуп — в пределах гостиницы ───


async def test_dedup_key_separates_organizations(fake_redis) -> None:
    kw = dict(channel="whatsapp", external_id="77021112233", text="Здравствуйте", ttl_seconds=60)
    assert await is_duplicate(fake_redis, agent_id=ORG, **kw) is False
    assert await is_duplicate(fake_redis, agent_id=ORG_B, **kw) is False
    assert await is_duplicate(fake_redis, agent_id=ORG, **kw) is True


def test_the_same_greeting_to_two_hotels_is_answered_by_both(app, sync_db, net) -> None:  # noqa: F811
    with sync_db() as session:
        session.execute(
            sa.update(Agent)
            .where(Agent.name == "Гостиница Б")
            .values(system_prompt="Ты продавец второй гостиницы-стенда.")
        )
        session.commit()
    assert _connect(app).status_code == 200
    assert _connect(app, org=ORG_B, phone_id="555000222").status_code == 200
    assert _post(app, _webhook_body("Здравствуйте")).status_code == 200
    _drain(app)
    assert _post(app, _webhook_body("Здравствуйте", phone_id="555000222"), org=ORG_B).status_code == 200
    _drain(app)
    assert net.llm_calls == 2, "вторая гостиница не получила реплику: дедуп общий на всех"
    assert len(net.graph) == 2


# ─── 5. Предел тела вебхука ───


def test_an_oversized_webhook_is_refused_before_reading(app, net) -> None:  # noqa: F811
    _connect(app)
    raw = _webhook_body("x" * (300 * 1024))
    response = _post(app, raw)
    assert response.status_code == 413, response.text
    _drain(app)
    assert net.llm_calls == 0


def test_an_oversized_chunked_webhook_is_cut_off(app, net) -> None:  # noqa: F811
    """Без Content-Length (chunked) тело читается кусками и обрывается на пределе."""
    _connect(app)
    raw = _webhook_body("x" * (300 * 1024))

    def chunks():
        for i in range(0, len(raw), 16 * 1024):
            yield raw[i : i + 16 * 1024]

    response = app.client.post(
        f"/channels/whatsapp/webhook/{ORG}",
        content=chunks(),
        headers={"Content-Type": "application/json", "X-Hub-Signature-256": _sign(raw)},
    )
    assert response.status_code == 413, response.text
    _drain(app)
    assert net.llm_calls == 0


def test_a_normal_webhook_still_fits(app, net) -> None:  # noqa: F811
    _connect(app)
    assert _post(app, _webhook_body("Есть места на выходные?")).status_code == 200
    _drain(app)
    assert net.llm_calls == 1
