"""BUG-WA-1 (Q-SA-7): реплика оператора в диалоге WhatsApp доходит до гостя.

🔴 Раньше панель отправляла любую реплику виджетным отправителем: для WhatsApp это запись
в историю и отметка в Redis, а в Graph API ничего не уходило. Оператор видел сообщение
отправленным, гость его не получал.

Здесь проверяется путь целиком: диалог WhatsApp → реплика оператора → Graph API токеном
ЕГО гостиницы → запись в историю только после успешной отправки. Виджетная очередь не
трогается, отказ Graph не превращается в «отправлено».
"""

from __future__ import annotations

import json
import uuid

import httpx
import pytest
import sqlalchemy as sa

from src import dependencies
from src.channels.widget_store import new_flag_key
from src.db.base import ConversationMode, MessageRole
from src.db.models import Client, Conversation, Message
from tests.dashboard_fakes import (  # noqa: F401 — фикстуры берутся из пространства имён
    PANEL,
    _all,
    seed_conversation,
    sync_db,
)
from tests.test_whatsapp import (  # noqa: F401 — фикстуры и общие значения канала
    GUEST,
    ORG,
    ORG_B,
    PHONE_ID,
    SERVICE,
    TOKEN,
    FakeNet,
    _connect,
    app,
    net,
)

REPLY = "Это Иван, оператор. Номер на завтра есть, сейчас пришлю условия."


def _headers(org: str = ORG) -> dict[str, str]:
    return {**SERVICE, "X-Organization": org}


def _dialog(sync_db, org: str = ORG, external_id: str = GUEST) -> uuid.UUID:  # noqa: F811
    """Диалог WhatsApp организации: сидер общий для каналов, организацию проставляем сами."""
    conversation_id = seed_conversation(
        sync_db,
        channel="whatsapp",
        external_id=external_id,
        mode=ConversationMode.OWNER_TAKEOVER,
    )
    with sync_db() as session:
        conv = session.get(Conversation, conversation_id)
        client = session.get(Client, conv.client_id)
        conv.organization_id = client.organization_id = uuid.UUID(org)
        # перенесённый продавец: агент = организации (§20.4)
        conv.agent_id = client.agent_id = uuid.UUID(org)
        session.commit()
    return conversation_id


def _operator_messages(sync_db, conversation_id) -> list[Message]:  # noqa: F811
    return _all(
        sync_db,
        sa.select(Message).where(
            Message.conversation_id == conversation_id, Message.role == MessageRole.OPERATOR
        ),
    )


def _reply(app, conversation_id, org: str = ORG):  # noqa: F811
    return app.client.post(
        f"{PANEL}/conversations/{conversation_id}/reply",
        json={"text": REPLY},
        headers=_headers(org),
    )


def test_operator_reply_goes_to_graph_with_the_hotel_token(app, sync_db, net) -> None:  # noqa: F811
    _connect(app)
    conversation_id = _dialog(sync_db)

    response = _reply(app, conversation_id)

    assert response.status_code == 200, response.text
    assert len(net.graph) == 1, "реплика оператора не ушла в Graph API"
    out = net.graph[0]
    assert out.url.path.endswith(f"/{PHONE_ID}/messages")
    assert out.headers["authorization"] == f"Bearer {TOKEN}"
    sent = json.loads(out.content)
    assert sent["to"] == GUEST and sent["messaging_product"] == "whatsapp"
    assert sent["text"]["body"] == REPLY
    stored = _operator_messages(sync_db, conversation_id)
    assert [m.content for m in stored] == [REPLY]
    assert stored[0].sent_by_us is True


def test_operator_reply_does_not_touch_the_widget_queue(app, sync_db, net, fake_redis) -> None:  # noqa: F811
    _connect(app)
    conversation_id = _dialog(sync_db)

    assert _reply(app, conversation_id).status_code == 200

    async def flag():
        return await dependencies.get_redis().get(new_flag_key(GUEST))

    assert app.client.portal.call(flag) is None, "реплика WhatsApp ушла в очередь виджета"


def test_graph_refusal_is_not_written_down_as_sent(app, sync_db, net, monkeypatch) -> None:  # noqa: F811
    """Вне окна 24 часов Graph отвечает 400: панель говорит «не отправлено», истории нет."""
    _connect(app)
    conversation_id = _dialog(sync_db)

    def refuse(request: httpx.Request) -> httpx.Response:
        if "graph.test" in str(request.url):
            net.graph.append(request)
            return httpx.Response(400, json={"error": {"code": 131047}})
        raise AssertionError(f"неожиданный адрес наружу: {request.url}")

    monkeypatch.setattr(
        dependencies._resources,
        "http_client",
        httpx.AsyncClient(transport=httpx.MockTransport(refuse)),
    )

    response = _reply(app, conversation_id)

    assert response.status_code == 502
    assert len(net.graph) == 1
    assert _operator_messages(sync_db, conversation_id) == []


def test_reply_without_a_connection_is_refused_and_not_written(app, sync_db, net) -> None:  # noqa: F811
    """WhatsApp у гостиницы отключён: сообщение уйти не может, и «отправленным» оно не становится."""
    conversation_id = _dialog(sync_db)

    response = _reply(app, conversation_id)

    assert response.status_code == 502
    assert net.graph == []
    assert _operator_messages(sync_db, conversation_id) == []


def test_reply_uses_the_connection_of_the_dialog_organization(app, sync_db, net) -> None:  # noqa: F811
    """Две гостиницы, у обеих WhatsApp: реплика идёт с номера той, чей диалог."""
    _connect(app, org=ORG, phone_id=PHONE_ID)
    _connect(app, org=ORG_B, phone_id="777000222")
    conversation_id = _dialog(sync_db, org=ORG_B)

    assert _reply(app, conversation_id, org=ORG_B).status_code == 200

    assert len(net.graph) == 1
    assert net.graph[0].url.path.endswith("/777000222/messages")


def test_foreign_organization_cannot_answer_the_dialog(app, sync_db, net) -> None:  # noqa: F811
    _connect(app)
    conversation_id = _dialog(sync_db, org=ORG)

    response = _reply(app, conversation_id, org=ORG_B)

    assert response.status_code == 404
    assert net.graph == []


@pytest.mark.parametrize("channel", ["widget"])
def test_widget_dialog_still_goes_through_the_widget_sender(channel) -> None:
    """Виджет не сломан: для него по-прежнему запись в историю и отметка опроса."""
    from src.channels.widget_runner import WidgetSender
    from src.config import get_settings
    from src.dashboard.panel_conversations import build_reply_sender

    sender = build_reply_sender(get_settings(), channel=channel, agent=uuid.UUID(ORG))
    assert isinstance(sender, WidgetSender)
