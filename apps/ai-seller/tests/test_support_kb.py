"""S3: управляемая база знаний WETOP Support (plans/ai-agents-s3-knowledge-2026-09-29.md).

Свойства, которые доказываются: отвечает только ACTIVE; публикует только тот, у кого есть approved_by (главный
администратор — подставляет платформа); правка активной записи уводит её в DRAFT; PLATFORM_ADMIN_ONLY до модели не
доходит, INTERNAL идёт с пометкой; слабое совпадение — «не знаю»; метаданные знания возвращаются с текстом, а клиенту
идентификаторы не показываются; использование пишется по диалогу; агент создать или опубликовать запись не может.
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass

import pytest
import sqlalchemy as sa

from src.ai.support_tools import UNKNOWN, build_registry
from src.db.models import (
    SupportKnowledge,
    SupportKnowledgeChunk,
    SupportKnowledgeUsage,
    SupportKnowledgeVersion,
)
from src.knowledge import support_kb as kb

LAUNDRY = "Стирка: одна загрузка машины стоит пятьсот тенге, порошок и сушка включены в цену."
READONLY = "Режим только чтение: пробный период закончился, данные видны, менять их нельзя до оплаты."
SECRET = "Внутренний порядок восстановления базы после сбоя описан в закрытом регламенте платформы."
ADMIN = "admin-user-ref"


async def make(session, embedder, *, title="Стирка", content=LAUNDRY, visibility="PUBLIC_SUPPORT",
               category="HOW_TO", publish=True):
    entry = await kb.create_entry(
        session, title=title, category=category, visibility=visibility, content=content, by=ADMIN
    )
    if publish:
        entry = await kb.publish(session, embedder, entry.id, approved_by=ADMIN)
    await session.commit()
    return entry


async def find(session, embedder, query, **kw):
    kw.setdefault("top_k", 3)
    kw.setdefault("high", 0.9)
    kw.setdefault("medium", 0.1)
    return await kb.search(session, embedder, query, **kw)


# ── состояния ────────────────────────────────────────────────────────────────


async def test_only_active_entries_answer(db_session, fake_embedder) -> None:
    draft = await make(db_session, fake_embedder, publish=False)
    assert draft.status == "DRAFT" and draft.approved_by is None
    assert await find(db_session, fake_embedder, "стирка загрузка") == []

    published = await kb.publish(db_session, fake_embedder, draft.id, approved_by=ADMIN)
    await db_session.commit()
    assert published.status == "ACTIVE" and published.approved_by == ADMIN and published.approved_at is not None
    hits = await find(db_session, fake_embedder, "стирка загрузка")
    assert [h.title for h in hits] == ["Стирка"]

    for status in ("OUTDATED", "ARCHIVED"):
        await kb.set_status(db_session, draft.id, status, by=ADMIN)
        await db_session.commit()
        assert await find(db_session, fake_embedder, "стирка загрузка") == []
        chunks = (await db_session.execute(sa.select(sa.func.count()).select_from(SupportKnowledgeChunk))).scalar_one()
        assert chunks == 0, "у неактивной записи индекса нет"
        await kb.set_status(db_session, draft.id, "DRAFT", by=ADMIN)
        await kb.publish(db_session, fake_embedder, draft.id, approved_by=ADMIN)
        await db_session.commit()


async def test_publishing_needs_an_approver_and_a_draft(db_session, fake_embedder) -> None:
    entry = await make(db_session, fake_embedder, publish=False)
    for bad in ("", "  ", None):
        with pytest.raises(kb.KbError):
            await kb.publish(db_session, fake_embedder, entry.id, approved_by=bad)
    assert (await db_session.get(SupportKnowledge, entry.id)).status == "DRAFT"
    with pytest.raises(kb.KbError):  # ACTIVE ставится только публикацией
        await kb.set_status(db_session, entry.id, "ACTIVE", by=ADMIN)


async def test_editing_an_active_entry_makes_it_a_draft_with_a_new_version(db_session, fake_embedder) -> None:
    entry = await make(db_session, fake_embedder)
    assert entry.version == 1
    edited = await kb.update_entry(db_session, fake_embedder, entry.id, by=ADMIN, content=LAUNDRY + " Сушка бесплатна.")
    await db_session.commit()
    assert edited.status == "DRAFT" and edited.version == 2 and edited.approved_by is None
    assert await find(db_session, fake_embedder, "стирка загрузка") == [], "неутверждённый текст не отвечает"
    versions = (await db_session.execute(
        sa.select(SupportKnowledgeVersion.version).where(SupportKnowledgeVersion.knowledge_id == entry.id)
        .order_by(SupportKnowledgeVersion.version)
    )).scalars().all()
    assert versions == [1, 2]


async def test_republishing_does_not_duplicate_chunks(db_session, fake_embedder) -> None:
    entry = await make(db_session, fake_embedder)
    await kb.update_entry(db_session, fake_embedder, entry.id, by=ADMIN, title="Стирка v2")
    await kb.publish(db_session, fake_embedder, entry.id, approved_by=ADMIN)
    await db_session.commit()
    count = (await db_session.execute(sa.select(sa.func.count()).select_from(SupportKnowledgeChunk))).scalar_one()
    assert count == 1


async def test_field_limits_and_vocabularies(db_session, fake_embedder) -> None:
    with pytest.raises(kb.KbError):
        await kb.create_entry(db_session, title="x", category="NOPE", visibility="PUBLIC_SUPPORT", content="текст", by=ADMIN)
    with pytest.raises(kb.KbError):
        await kb.create_entry(db_session, title="x", category="HOW_TO", visibility="EVERYONE", content="текст", by=ADMIN)
    with pytest.raises(kb.KbError):
        await kb.create_entry(db_session, title="", category="HOW_TO", visibility="PUBLIC_SUPPORT", content="текст", by=ADMIN)
    with pytest.raises(kb.KbError):
        await kb.create_entry(db_session, title="x", category="HOW_TO", visibility="PUBLIC_SUPPORT", content="я" * 20_001, by=ADMIN)


# ── видимость и уверенность ─────────────────────────────────────────────────


async def test_platform_admin_only_never_reaches_a_client_answer(db_session, fake_embedder) -> None:
    await make(db_session, fake_embedder, title="Восстановление", content=SECRET, visibility="PLATFORM_ADMIN_ONLY", category="RUNBOOK")
    assert await find(db_session, fake_embedder, "восстановление базы после сбоя") == []
    admin_hits = await find(db_session, fake_embedder, "восстановление базы после сбоя", audience="platform_admin")
    assert [h.visibility for h in admin_hits] == ["PLATFORM_ADMIN_ONLY"]


async def test_hits_carry_metadata_with_the_text(db_session, fake_embedder) -> None:
    entry = await make(db_session, fake_embedder, visibility="INTERNAL_SUPPORT")
    (hit,) = await find(db_session, fake_embedder, "стирка загрузка")
    assert hit.knowledge_id == entry.id and hit.version == 1 and hit.visibility == "INTERNAL_SUPPORT"
    assert hit.category == "HOW_TO" and "пятьсот" in hit.content and -1.0 <= hit.score <= 1.0
    assert hit.confidence in ("HIGH", "MEDIUM", "LOW") and hit.source == "manual"


async def test_confidence_levels_follow_the_thresholds(db_session, fake_embedder) -> None:
    await make(db_session, fake_embedder)
    (strong,) = await find(db_session, fake_embedder, "стирка загрузка", high=0.1, medium=0.05)
    assert strong.confidence == "HIGH"
    (mid,) = await find(db_session, fake_embedder, "стирка загрузка", high=0.99, medium=0.05)
    assert mid.confidence == "MEDIUM"
    weak = await find(db_session, fake_embedder, "стирка загрузка", high=0.99, medium=0.98)
    assert [h.confidence for h in weak] == ["LOW"]


# ── инструмент модели ───────────────────────────────────────────────────────


@dataclass
class Runtime:
    session_factory: object
    embedder: object


def tool_for(db_session, fake_embedder, *, conversation="c-1", high=0.1, medium=0.05):
    class Settings:
        support_kb_high = high
        support_kb_medium = medium
        kb_top_k = 3

    class Maker:
        def __call__(self):
            outer = self

            class Ctx:
                async def __aenter__(self_inner):
                    return db_session

                async def __aexit__(self_inner, *a):
                    return False

            return Ctx()

    registry = build_registry(
        lambda: None,
        settings_getter=lambda: Settings(),
        visitor_getter=lambda: None,
        knowledge_getter=lambda: Runtime(Maker(), fake_embedder),
        conversation_getter=lambda: conversation,
    )
    return registry


async def call(registry, query: str) -> str:
    return await registry._run("search_knowledge", json.dumps({"query": query}))


async def test_tool_is_registered_without_scope_arguments(db_session, fake_embedder) -> None:
    spec = tool_for(db_session, fake_embedder).get("search_knowledge")
    assert spec is not None
    text = json.dumps(spec.parameters).lower()
    assert "query" in text
    for banned in ("organization", "user", "tenant", "audience", "visibility", "status"):
        assert banned not in text


async def test_tool_shows_public_and_marks_internal_but_hides_admin_only(db_session, fake_embedder) -> None:
    await make(db_session, fake_embedder, title="Стирка", visibility="PUBLIC_SUPPORT")
    await make(db_session, fake_embedder, title="Сушка", content="Сушка одежды: барабан сушилки работает сорок минут за сто тенге.", visibility="INTERNAL_SUPPORT")
    await make(db_session, fake_embedder, title="Закрытое", content="Стирка загрузка закрытый регламент платформы сбой база.", visibility="PLATFORM_ADMIN_ONLY", category="RUNBOOK")
    registry = tool_for(db_session, fake_embedder)
    text = await call(registry, "стирка загрузка сушка")
    assert "Стирка" in text and "Сушка" in text
    assert "Закрытое" not in text and "регламент" not in text
    assert "не цитируй" in text  # у внутреннего есть пометка
    public_part = text.split("Сушка")[0]
    assert "не цитируй" not in public_part


async def test_tool_text_has_no_identifiers_and_does_not_leak_ids(db_session, fake_embedder) -> None:
    entry = await make(db_session, fake_embedder)
    text = await call(tool_for(db_session, fake_embedder), "стирка загрузка")
    assert str(entry.id) not in text and "knowledgeId" not in text
    assert "версия 1" in text and "уверенность" in text.lower()


async def test_low_confidence_is_an_honest_unknown(db_session, fake_embedder) -> None:
    await make(db_session, fake_embedder)
    registry = tool_for(db_session, fake_embedder, high=0.99, medium=0.98)
    assert await call(registry, "стирка загрузка") == UNKNOWN
    assert await call(registry, "совсем другое про космос") == UNKNOWN


async def test_usage_is_logged_per_conversation_for_the_operator(db_session, fake_embedder) -> None:
    entry = await make(db_session, fake_embedder)
    await call(tool_for(db_session, fake_embedder, conversation=str(uuid.uuid4())), "стирка загрузка")
    rows = (await db_session.execute(sa.select(SupportKnowledgeUsage))).scalars().all()
    assert len(rows) == 1
    assert rows[0].knowledge_id == entry.id and rows[0].version == 1 and rows[0].visibility == "PUBLIC_SUPPORT"


async def test_unknown_result_writes_no_usage(db_session, fake_embedder) -> None:
    await make(db_session, fake_embedder)
    await call(tool_for(db_session, fake_embedder, high=0.99, medium=0.98), "стирка загрузка")
    assert (await db_session.execute(sa.select(sa.func.count()).select_from(SupportKnowledgeUsage))).scalar_one() == 0


def test_the_agent_has_no_way_to_write_knowledge() -> None:
    registry = build_registry(lambda: None, settings_getter=lambda: object(), visitor_getter=lambda: None)
    names = registry.names
    for name in names:
        assert not any(word in name for word in ("create", "publish", "update", "save", "approve", "delete")), name
    assert "search_knowledge" in names


async def test_closing_a_conversation_creates_no_knowledge(db_session, fake_embedder) -> None:
    from src.db.models import Conversation

    assert hasattr(Conversation, "is_active")
    before = (await db_session.execute(sa.select(sa.func.count()).select_from(SupportKnowledge))).scalar_one()
    assert before == 0  # закрытие обращения ничего сюда не пишет: команды нет ни в боте, ни в закрытии


# ── лента для оператора ─────────────────────────────────────────────────────


async def test_operator_can_see_sources_of_a_conversation(db_session, fake_embedder) -> None:
    conv = str(uuid.uuid4())
    entry = await make(db_session, fake_embedder)
    await call(tool_for(db_session, fake_embedder, conversation=conv), "стирка загрузка")
    await db_session.commit()
    sources = await kb.conversation_sources(db_session, conv)
    assert [(s["title"], s["version"], s["visibility"]) for s in sources] == [("Стирка", 1, "PUBLIC_SUPPORT")]
    assert str(entry.id) == sources[0]["knowledge_id"]


async def test_draft_from_a_closed_conversation_is_only_a_draft(db_session, fake_embedder) -> None:
    entry = await kb.draft_from_conversation(db_session, conversation_id=str(uuid.uuid4()), by=ADMIN)
    await db_session.commit()
    assert entry.status == "DRAFT" and entry.source.startswith("conversation:") and entry.approved_by is None
    assert "Симптом" in entry.content and "Что делать" in entry.content
    assert "бронь" not in entry.title.lower() and "бронь" not in entry.content.lower(), "текст обращения не копируется"
    assert await find(db_session, fake_embedder, "Симптом причина что делать") == []
