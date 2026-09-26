"""Шаг 2: поиск. Короткий запрос из двух слов находит нужный кусок; слияние — точка расширения."""

import uuid

from src.knowledge.ingestor import ingest_document
from src.knowledge.retriever import RetrievedChunk, fuse, search

# Три непохожих абзаца по одному предложению, каждое короче chunk_chars=150
# и длиннее min_chars=80: при перекрытии 0 каждый абзац — свой чанк.
PARAGRAPHS = (
    "Заезд гостей начинается после четырнадцати часов дня, выезд из номера до двенадцати часов.",
    "Стирка: одна загрузка машины стоит пятьсот тенге, порошок и сушка уже включены в цену.",
    "Женская общая комната рассчитана на шесть кроватей, у каждой своя лампа и розетка рядом.",
)
RULES_MD = "\n\n".join(PARAGRAPHS) + "\n"


async def _load_rules(session, embedder) -> None:
    result = await ingest_document(
        session,
        embedder,
        source="rules.md",
        data=RULES_MD.encode("utf-8"),
        max_bytes=10 * 1024 * 1024,
        chunk_chars=150,
        overlap=0,
        min_chars=80,
    )
    assert result.chunks_added == 3, "каждый абзац должен стать своим чанком"


async def test_two_word_query_finds_laundry_chunk(db_session, fake_embedder) -> None:
    await _load_rules(db_session, fake_embedder)
    found = await search(db_session, fake_embedder, "стирка загрузка", top_k=1)
    assert len(found) == 1
    hit = found[0]
    assert isinstance(hit, RetrievedChunk)
    assert "стирка" in hit.content.lower()
    assert "пятьсот" in hit.content.lower()
    assert isinstance(hit.chunk_id, uuid.UUID)
    assert isinstance(hit.document_id, uuid.UUID)
    assert -1.0 <= hit.score <= 1.0


async def test_top_k_two_returns_scores_in_descending_order(db_session, fake_embedder) -> None:
    await _load_rules(db_session, fake_embedder)
    found = await search(db_session, fake_embedder, "стирка загрузка", top_k=2)
    assert len(found) == 2
    assert found[0].score >= found[1].score
    assert "стирка" in found[0].content.lower()
    assert all(-1.0 <= f.score <= 1.0 for f in found)


async def test_top_k_limits_results(db_session, fake_embedder) -> None:
    await _load_rules(db_session, fake_embedder)
    found = await search(db_session, fake_embedder, "комната кровати", top_k=10)
    assert len(found) == 3
    assert "комната" in found[0].content.lower()


async def test_empty_base_gives_nothing(db_session, fake_embedder) -> None:
    assert await search(db_session, fake_embedder, "стирка", top_k=5) == []


async def test_empty_query_gives_nothing(db_session, fake_embedder) -> None:
    await _load_rules(db_session, fake_embedder)
    assert await search(db_session, fake_embedder, "", top_k=5) == []
    assert await search(db_session, fake_embedder, "   ", top_k=5) == []


def test_fuse_puts_item_first_in_both_rankings_first() -> None:
    a, b, c = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    fused = fuse([[a, b, c], [a, c, b]], k=60)
    assert fused[0] == a
    assert set(fused) == {a, b, c}
    assert len(fused) == 3


def test_fuse_with_single_ranking_keeps_order() -> None:
    a, b, c = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    assert fuse([[c, a, b]], k=60) == [c, a, b]


def test_fuse_of_nothing_is_empty() -> None:
    assert fuse([], k=60) == []


# ─── Ревью: на Postgres расстояние читается как число, а не как вектор ───


def test_postgres_distance_expression_is_float() -> None:
    from sqlalchemy.dialects import postgresql

    from src.knowledge import retriever

    dialect = postgresql.dialect()
    distance = retriever._cosine_distance([0.0] * 384)
    assert "<=>" in str(distance.compile(dialect=dialect))
    impl = distance.type.dialect_impl(dialect)
    # 701 — OID типа float8 в Postgres: так `<=>` отдаёт расстояние.
    # У VectorType обработчик разбирал бы число как строку «[…]» и падал.
    processor = impl.result_processor(dialect, 701)
    value = processor(0.25) if processor is not None else 0.25
    assert value == 0.25
