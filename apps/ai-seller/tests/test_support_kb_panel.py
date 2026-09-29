"""S3: маршруты базы знаний в панели бота — только служебный ключ платформы (не человек в панели, не продавец).

🔴 Публикует главный администратор: платформа проверяет его право и подставляет `approved_by` из сессии стойки.
Панель бота своими логинами публиковать не даёт: даже владелец панели получает 403.
"""

from __future__ import annotations

import uuid

import pytest
import sqlalchemy as sa

from src.db.models import Conversation, SupportKnowledge
from tests.dashboard_fakes import PANEL, panel, seed_conversation, sync_db  # noqa: F401

KEY = "service-key-for-tests-only"
SERVICE = {"X-Service-Key": KEY}
ROOT = f"{PANEL}/support-knowledge"
BODY = {
    "title": "Стирка", "category": "HOW_TO", "visibility": "PUBLIC_SUPPORT",
    "content": "Стирка: одна загрузка машины стоит пятьсот тенге, порошок и сушка включены в цену.", "by": "admin-1",
}


@pytest.fixture
def board(monkeypatch, fake_redis, fake_embedder, sync_db):  # noqa: F811
    with panel(monkeypatch, fake_redis, SELLER_SERVICE_KEY=KEY, BOT_ROLE="support") as p:
        yield p


def created(board) -> dict:
    response = board.client.post(ROOT, headers=SERVICE, json=BODY)
    assert response.status_code == 200, response.text
    return response.json()


def test_create_list_read_publish_flow(board) -> None:
    item = created(board)
    assert item["status"] == "DRAFT" and item["version"] == 1
    listing = board.client.get(ROOT, headers=SERVICE).json()
    assert [row["title"] for row in listing["items"]] == ["Стирка"]
    assert "content" not in listing["items"][0], "в списке только выдержка"
    full = board.client.get(f"{ROOT}/{item['id']}", headers=SERVICE).json()
    assert full["content"].startswith("Стирка") and [v["version"] for v in full["versions"]] == [1]
    done = board.client.post(f"{ROOT}/{item['id']}/publish", headers=SERVICE, json={"approved_by": "admin-1"})
    assert done.status_code == 200 and done.json()["status"] == "ACTIVE" and done.json()["approved_by"] == "admin-1"


def test_publish_without_approver_is_refused_and_nothing_changes(board, sync_db) -> None:  # noqa: F811
    item = created(board)
    for body in ({}, {"approved_by": ""}, {"approved_by": "   "}):
        assert board.client.post(f"{ROOT}/{item['id']}/publish", headers=SERVICE, json=body).status_code in (400, 422)
    with sync_db() as session:
        assert session.execute(sa.select(SupportKnowledge.status)).scalar_one() == "DRAFT"


def test_editing_active_goes_back_to_draft(board) -> None:
    item = created(board)
    board.client.post(f"{ROOT}/{item['id']}/publish", headers=SERVICE, json={"approved_by": "admin-1"})
    edited = board.client.put(f"{ROOT}/{item['id']}", headers=SERVICE, json={"content": "Новый текст про стирку и сушку.", "by": "admin-1"})
    assert edited.status_code == 200
    assert edited.json()["status"] == "DRAFT" and edited.json()["version"] == 2


def test_status_route_cannot_activate(board) -> None:
    item = created(board)
    assert board.client.post(f"{ROOT}/{item['id']}/status", headers=SERVICE, json={"status": "ACTIVE", "by": "a"}).status_code == 400
    ok = board.client.post(f"{ROOT}/{item['id']}/status", headers=SERVICE, json={"status": "ARCHIVED", "by": "a"})
    assert ok.status_code == 200 and ok.json()["status"] == "ARCHIVED"


def test_bad_values_are_400_not_500(board) -> None:
    assert board.client.post(ROOT, headers=SERVICE, json={**BODY, "category": "NOPE"}).status_code == 400
    assert board.client.post(ROOT, headers=SERVICE, json={**BODY, "visibility": "ALL"}).status_code == 400
    assert board.client.get(f"{ROOT}/{uuid.uuid4()}", headers=SERVICE).status_code == 404
    assert board.client.get(f"{ROOT}/не-uuid", headers=SERVICE).status_code in (400, 404, 422)


def test_a_panel_login_even_the_owner_cannot_use_the_routes(board) -> None:
    for method, path in (("GET", ROOT), ("POST", ROOT)):
        response = board.client.request(method, path, headers=board.headers("owner"), json=BODY)
        assert response.status_code == 403, f"{method} {path}: {response.status_code}"


def test_no_key_and_wrong_key_are_refused(board) -> None:
    assert board.client.get(ROOT).status_code == 401
    assert board.client.get(ROOT, headers={"X-Service-Key": "wrong"}).status_code == 401


def test_the_seller_instance_has_no_such_routes(monkeypatch, fake_redis, fake_embedder, sync_db) -> None:  # noqa: F811
    with panel(monkeypatch, fake_redis, SELLER_SERVICE_KEY=KEY, BOT_ROLE="seller") as p:
        assert p.client.get(ROOT, headers=SERVICE).status_code == 403
        assert p.client.post(ROOT, headers=SERVICE, json=BODY).status_code == 403


def test_sources_of_a_conversation_and_draft_from_a_closed_one(board, sync_db) -> None:  # noqa: F811
    cid = seed_conversation(sync_db)
    empty = board.client.get(f"{PANEL}/conversations/{cid}/knowledge", headers=SERVICE)
    assert empty.status_code == 200 and empty.json() == {"items": []}
    # пока обращение открыто, черновик из него не создаётся
    assert board.client.post(f"{PANEL}/conversations/{cid}/knowledge-draft", headers=SERVICE, json={"by": "admin-1"}).status_code == 409
    assert board.client.post(f"{PANEL}/conversations/{cid}/close", headers=SERVICE).status_code == 200
    draft = board.client.post(f"{PANEL}/conversations/{cid}/knowledge-draft", headers=SERVICE, json={"by": "admin-1"})
    assert draft.status_code == 200
    assert draft.json()["status"] == "DRAFT" and draft.json()["source"] == f"conversation:{cid}"
    with sync_db() as session:
        assert session.execute(sa.select(SupportKnowledge.approved_by)).scalar_one() is None
        assert session.execute(sa.select(Conversation.is_active)).scalar_one() is False
