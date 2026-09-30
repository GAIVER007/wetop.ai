"""S6: действия SAFE / CONFIRM / HUMAN_ONLY и матрица возможностей WETOP Support.

SAFE выполняется сразу, CONFIRM — только после confirm_action тем же диалогом и не позже 15 минут, HUMAN_ONLY не
выполняется никогда — диалог уходит человеку. Аргументов «кто/где» у инструментов нет; всё пишется в журнал действий
бота. Люди, организации и диалоги вымышленные.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field

import pytest
import sqlalchemy as sa

from src.ai.support_actions import PENDING_TTL_SECONDS, pending_key, user_ref
from src.ai.support_actions_matrix import MATRIX, ActionClass
from src.ai.support_tools import NOT_SIGNED, UNKNOWN, build_registry
from src.ai.tools import TOOL_BAD_ARGS
from src.db.base import ConversationMode
from src.db.models import Conversation, SupportAction
from src.integrations.providers import Providers, ProviderUnavailable
from tests.dashboard_fakes import seed_conversation, sync_db  # noqa: F401
from tests.support_fakes import ORG_ID, USER_ID, anon_visitor, call_tool, signed_visitor, support_settings

ACTION_TOOLS = ("list_capabilities", "propose_action", "confirm_action", "cancel_action", "request_human")

EXPECTED_MATRIX = {
    "channel_pull": ActionClass.SAFE,
    "channel_sync": ActionClass.CONFIRM,
    "refund": ActionClass.HUMAN_ONLY,
    "subscription": ActionClass.HUMAN_ONLY,
    "organization_disable": ActionClass.HUMAN_ONLY,
    "owner_rights": ActionClass.HUMAN_ONLY,
    "data_delete": ActionClass.HUMAN_ONLY,
    "reservations_bulk": ActionClass.HUMAN_ONLY,
    "other_human": ActionClass.HUMAN_ONLY,
}


@dataclass
class FakeActions:
    fail: bool = False
    calls: list[tuple[str, dict]] = field(default_factory=list)
    pull_result: dict = field(default_factory=lambda: {"processed": 3, "received": 3, "failed": 0, "callbackUrl": "https://x"})
    sync_result: dict = field(default_factory=lambda: {"queued": 180, "days": 90, "apiKey": "sk-secret"})

    async def channel_pull(self, *, user_id: str, org_id: str, idempotency_key: str) -> dict:
        self.calls.append(("channel_pull", {"user_id": user_id, "org_id": org_id, "idempotency_key": idempotency_key}))
        if self.fail:
            raise ProviderUnavailable("api_error_429")
        return dict(self.pull_result)

    async def channel_sync(self, *, user_id: str, org_id: str, idempotency_key: str, days: int) -> dict:
        self.calls.append(("channel_sync", {"user_id": user_id, "org_id": org_id, "idempotency_key": idempotency_key, "days": days}))
        if self.fail:
            raise ProviderUnavailable("api_error_409")
        return dict(self.sync_result)


@dataclass
class Runtime:
    session_factory: object
    redis: object
    settings: object


def providers(actions=None) -> Providers:
    return Providers(orders=None, customers=None, availability=None, leads=None, mode="fake", actions=actions)


@pytest.fixture
def conv_id(sync_db):  # noqa: F811
    return str(seed_conversation(sync_db))


@pytest.fixture
def make_registry(db_session, fake_redis):
    from src.dependencies import get_sessionmaker

    settings = support_settings()

    def build(actions=None, visitor=signed_visitor(), conversation: str | None = None, incoming: str | None = None):
        runtime = Runtime(get_sessionmaker(), fake_redis, settings)
        state = {"incoming": incoming}
        registry_ = build_registry(
            lambda: providers(actions), settings_getter=lambda: settings, visitor_getter=lambda: visitor,
            conversation_getter=lambda: conversation, actions_getter=lambda: runtime,
            incoming_getter=lambda: state["incoming"],
        )
        registry_.say = lambda text: state.__setitem__("incoming", text)  # что человек написал в этот ход
        return registry_

    return build


async def rows(session, conversation: str) -> list[SupportAction]:
    return list((await session.execute(
        sa.select(SupportAction).where(SupportAction.conversation_id == conversation).order_by(SupportAction.created_at)
    )).scalars().all())


# ─── Матрица и реестр ───


def test_matrix_matches_the_plan() -> None:
    assert {name: spec.action_class for name, spec in MATRIX.items()} == EXPECTED_MATRIX
    for spec in MATRIX.values():
        assert spec.title and spec.description
        if spec.action_class is ActionClass.HUMAN_ONLY:
            assert spec.permission is None and spec.route is None
        else:
            assert spec.permission == "channels" and spec.route


def test_action_tools_have_no_scope_arguments(make_registry) -> None:
    specs = {s["function"]["name"]: s["function"]["parameters"] for s in make_registry().specs_for_openai()}
    for name in ACTION_TOOLS:
        assert name in specs
        keys = set(specs[name].get("properties", {}))
        for banned in ("organization", "user", "tenant", "business", "location", "scope"):
            assert not any(banned in key.lower() for key in keys), (name, keys)
    assert set(specs["propose_action"]["properties"]) == {"action"}
    assert set(specs["request_human"]["properties"]) == {"kind", "summary"}
    assert specs["confirm_action"]["properties"] == {} and specs["cancel_action"]["properties"] == {}


@pytest.mark.asyncio
async def test_model_cannot_pass_foreign_organization(make_registry, conv_id) -> None:
    actions = FakeActions()
    reg = make_registry(actions, conversation=conv_id)
    assert await call_tool(reg, "propose_action", action="channel_pull", organization_id="other") == TOOL_BAD_ARGS
    assert await call_tool(reg, "confirm_action", org_id="other") == TOOL_BAD_ARGS
    assert actions.calls == []


@pytest.mark.asyncio
@pytest.mark.parametrize("tool,args", [
    ("propose_action", {"action": "channel_pull"}), ("confirm_action", {}), ("cancel_action", {}),
    ("request_human", {"kind": "refund", "summary": "просит возврат"}),
])
async def test_anonymous_is_refused(make_registry, conv_id, tool, args) -> None:
    actions = FakeActions()
    assert await call_tool(make_registry(actions, visitor=anon_visitor(), conversation=conv_id), tool, **args) == NOT_SIGNED
    assert actions.calls == []


@pytest.mark.asyncio
async def test_list_capabilities_speaks_the_matrix(make_registry) -> None:
    text = await call_tool(make_registry(), "list_capabilities")
    for expected in ("сам", "после подтверждения", "только человек", "channel_pull", "channel_sync", "refund"):
        assert expected in text


# ─── SAFE ───


@pytest.mark.asyncio
async def test_safe_action_runs_at_once_and_is_journaled(make_registry, db_session, conv_id) -> None:
    actions = FakeActions()
    text = await call_tool(make_registry(actions, conversation=conv_id), "propose_action", action="channel_pull")
    assert "Готово" in text and "3" in text
    assert "https://x" not in text and "callbackUrl" not in text
    assert len(actions.calls) == 1 and actions.calls[0][0] == "channel_pull"
    call = actions.calls[0][1]
    assert call["user_id"] == USER_ID and call["org_id"] == ORG_ID and call["idempotency_key"]
    journal = await rows(db_session, conv_id)
    assert [r.status for r in journal] == ["DONE"]
    assert journal[0].action == "channel_pull" and journal[0].action_class == "SAFE"
    assert journal[0].user_ref == user_ref(USER_ID) and USER_ID not in journal[0].user_ref
    assert str(journal[0].id) == call["idempotency_key"]


@pytest.mark.asyncio
async def test_provider_failure_is_journaled_and_unknown(make_registry, db_session, conv_id) -> None:
    reg = make_registry(FakeActions(fail=True), conversation=conv_id)
    assert await call_tool(reg, "propose_action", action="channel_pull") == UNKNOWN
    assert [r.status for r in await rows(db_session, conv_id)] == ["FAILED"]
    assert await call_tool(make_registry(None, conversation=conv_id), "propose_action", action="channel_pull") == UNKNOWN


# ─── CONFIRM ───


@pytest.mark.asyncio
async def test_confirm_action_needs_a_yes_first(make_registry, db_session, fake_redis, conv_id) -> None:
    actions = FakeActions()
    reg = make_registry(actions, conversation=conv_id)
    text = await call_tool(reg, "propose_action", action="channel_sync")
    assert "подтвержд" in text.lower() and "90" in text
    assert actions.calls == []
    assert await fake_redis.ttl(pending_key(conv_id)) > PENDING_TTL_SECONDS - 60
    reg.say("да")
    done = await call_tool(reg, "confirm_action")
    assert "Готово" in done and "180" in done and "sk-secret" not in done
    assert actions.calls[0][0] == "channel_sync" and actions.calls[0][1]["days"] == 90
    journal = await rows(db_session, conv_id)
    assert [r.status for r in journal] == ["DONE"] and journal[0].action_class == "CONFIRM"
    assert "нечего подтверждать" in await call_tool(reg, "confirm_action")
    assert len(actions.calls) == 1


@pytest.mark.asyncio
async def test_stale_proposal_expires(make_registry, db_session, fake_redis, conv_id) -> None:
    actions = FakeActions()
    reg = make_registry(actions, conversation=conv_id)
    await call_tool(reg, "propose_action", action="channel_sync")
    raw = json.loads(await fake_redis.get(pending_key(conv_id)))
    raw["proposed_at"] = raw["proposed_at"] - PENDING_TTL_SECONDS - 1
    await fake_redis.set(pending_key(conv_id), json.dumps(raw))
    reg.say("да")
    assert "устарело" in await call_tool(reg, "confirm_action")
    assert actions.calls == []
    assert [r.status for r in await rows(db_session, conv_id)] == ["EXPIRED"]


@pytest.mark.asyncio
async def test_second_proposal_replaces_the_first_and_cancel_cancels(make_registry, db_session, conv_id) -> None:
    actions = FakeActions()
    reg = make_registry(actions, conversation=conv_id)
    await call_tool(reg, "propose_action", action="channel_sync")
    await call_tool(reg, "propose_action", action="channel_sync")
    assert [r.status for r in await rows(db_session, conv_id)] == ["CANCELLED", "PROPOSED"]
    assert "отменено" in (await call_tool(reg, "cancel_action")).lower()
    assert [r.status for r in await rows(db_session, conv_id)] == ["CANCELLED", "CANCELLED"]
    assert "нечего" in await call_tool(reg, "cancel_action")
    assert actions.calls == []


# ─── HUMAN_ONLY ───


@pytest.mark.asyncio
async def test_human_only_is_never_executed(make_registry, db_session, conv_id) -> None:
    actions = FakeActions()
    text = await call_tool(make_registry(actions, conversation=conv_id), "propose_action", action="refund")
    assert "только человек" in text and "request_human" in text
    assert actions.calls == []
    assert [r.status for r in await rows(db_session, conv_id)] == ["REFUSED"]


@pytest.mark.asyncio
async def test_request_human_marks_the_conversation_and_masks_the_summary(make_registry, db_session, conv_id) -> None:
    reg = make_registry(FakeActions(), conversation=conv_id)
    text = await call_tool(reg, "request_human", kind="refund", summary="Гость Иван просит возврат, телефон +7 777 123 45 67, почта ivan@example.com")
    assert "передал человеку" in text.lower()
    conv = await db_session.get(Conversation, __import__("uuid").UUID(conv_id))
    await db_session.refresh(conv)
    assert conv.mode == ConversationMode.NEEDS_HUMAN
    journal = await rows(db_session, conv_id)
    assert journal[0].status == "ESCALATED" and journal[0].action == "refund"
    assert "1234567" not in (journal[0].result or "") and "ivan@example.com" not in (journal[0].result or "")
    assert "не знаю такого вида" in await call_tool(reg, "request_human", kind="channel_pull", summary="x")


@pytest.mark.asyncio
async def test_unknown_action_names_the_matrix(make_registry, conv_id) -> None:
    text = await call_tool(make_registry(FakeActions(), conversation=conv_id), "propose_action", action="drop_database")
    assert "нет такого действия" in text and "channel_pull" in text


# ─── Панель ───


@pytest.mark.asyncio
async def test_journal_is_listed_for_the_operator(make_registry, db_session, conv_id) -> None:
    from src.ai.support_actions_journal import list_for_conversation

    reg = make_registry(FakeActions(), conversation=conv_id)
    await call_tool(reg, "propose_action", action="channel_pull")
    listing = await list_for_conversation(db_session, conv_id)
    assert len(listing) == 1
    assert listing[0]["action"] == "channel_pull" and listing[0]["status"] == "DONE" and listing[0]["class"] == "SAFE"
    assert set(listing[0]) >= {"id", "action", "class", "status", "result", "createdAt", "executedAt"}


# ─── Q-S6-2: согласие проверяет сервер, не модель ───


@pytest.mark.asyncio
async def test_confirm_without_an_explicit_yes_from_the_human_does_nothing(make_registry, db_session, fake_redis, conv_id) -> None:
    """Модель зовёт confirm_action, а человек «да» не писал: действие не выполняется, предложение остаётся ждать."""
    actions = FakeActions()
    reg = make_registry(actions, conversation=conv_id)
    await call_tool(reg, "propose_action", action="channel_sync")
    for said in (None, "", "нет", "а что это даст?", "да нет, не надо", "давай потом", "ДА или нет?"):
        reg.say(said)
        text = await call_tool(reg, "confirm_action")
        assert "подтвержд" in text.lower() and "Готово" not in text, said
    assert actions.calls == []
    assert await fake_redis.get(pending_key(conv_id)) is not None, "предложение не потрачено"
    assert [r.status for r in await rows(db_session, conv_id)] == ["PROPOSED"]


@pytest.mark.asyncio
@pytest.mark.parametrize("said", ["да", "Да.", "ДА!", "подтверждаю", "Выполняй", "да, запусти", "да, подтверждаю", "запускай", "да, выполняй"])
async def test_explicit_yes_phrases_are_recognised_deterministically(make_registry, conv_id, said) -> None:
    actions = FakeActions()
    reg = make_registry(actions, conversation=conv_id)
    await call_tool(reg, "propose_action", action="channel_sync")
    reg.say(said)
    assert "Готово" in await call_tool(reg, "confirm_action")
    assert len(actions.calls) == 1


@pytest.mark.asyncio
async def test_another_person_cannot_confirm_someone_elses_proposal(make_registry, fake_redis, conv_id) -> None:
    actions = FakeActions()
    await call_tool(make_registry(actions, conversation=conv_id), "propose_action", action="channel_sync")
    other = make_registry(actions, visitor=signed_visitor(user_id="77"), conversation=conv_id, incoming="да")
    text = await call_tool(other, "confirm_action")
    assert "Готово" not in text and actions.calls == []
    assert await fake_redis.get(pending_key(conv_id)) is not None


@pytest.mark.asyncio
async def test_a_yes_in_another_conversation_does_not_confirm(make_registry, sync_db, conv_id) -> None:  # noqa: F811
    actions = FakeActions()
    await call_tool(make_registry(actions, conversation=conv_id), "propose_action", action="channel_sync")
    other_conv = str(seed_conversation(sync_db, external_id="1002"))
    assert "нечего подтверждать" in await call_tool(make_registry(actions, conversation=other_conv, incoming="да"), "confirm_action")
    assert actions.calls == []
