"""Шаг 2: эмбеддинги. Кэш не пускает повторный текст в модель; ключ учитывает префикс."""

import hashlib

from src.knowledge.embedder import (
    PASSAGE_PREFIX,
    QUERY_PREFIX,
    Embedder,
    cache_key,
)
from tests.kb_fakes import HashingBackend


async def test_second_call_on_same_passage_hits_cache(fake_embedder: Embedder, fake_backend) -> None:
    first = await fake_embedder.embed_passages(["a"])
    second = await fake_embedder.embed_passages(["a"])
    assert fake_backend.calls == 1
    assert first == second


async def test_query_prefix_is_a_different_key(fake_embedder: Embedder, fake_backend) -> None:
    await fake_embedder.embed_passages(["a"])
    await fake_embedder.embed_query("a")
    # Тот же текст, другой префикс — другой вектор, значит и другой ключ.
    assert fake_backend.calls == 2


def test_cache_key_depends_on_model_prefix_and_text() -> None:
    base = cache_key("fake-hash", QUERY_PREFIX, "a")
    assert base != cache_key("other-model", QUERY_PREFIX, "a")
    assert base != cache_key("fake-hash", PASSAGE_PREFIX, "a")
    assert base != cache_key("fake-hash", QUERY_PREFIX, "b")


def test_cache_key_format() -> None:
    digest = hashlib.sha256("a".encode("utf-8")).hexdigest()
    assert cache_key("fake-hash", QUERY_PREFIX, "a") == f"emb:fake-hash:q:{digest}"
    assert cache_key("fake-hash", PASSAGE_PREFIX, "a") == f"emb:fake-hash:p:{digest}"


async def test_vector_dimension_is_384(fake_embedder: Embedder) -> None:
    vec = await fake_embedder.embed_query("заезд")
    assert len(vec) == 384
    vecs = await fake_embedder.embed_passages(["заезд", "стирка"])
    assert all(len(v) == 384 for v in vecs)


async def test_two_texts_are_one_encode_call(fake_embedder: Embedder, fake_backend) -> None:
    vecs = await fake_embedder.embed_passages(["первый текст", "второй текст"])
    assert fake_backend.calls == 1
    assert len(vecs) == 2
    assert vecs[0] != vecs[1]


async def test_only_misses_go_to_backend_and_order_is_kept(
    fake_embedder: Embedder, fake_backend
) -> None:
    [vec_a] = await fake_embedder.embed_passages(["a"])
    vecs = await fake_embedder.embed_passages(["b", "a", "c"])
    assert fake_backend.calls == 2
    assert vecs[1] == vec_a
    # «a» ушёл в модель ровно один раз — второй раз взят из кэша.
    assert fake_backend.seen.count(PASSAGE_PREFIX + "a") == 1
    assert PASSAGE_PREFIX + "b" in fake_backend.seen
    assert PASSAGE_PREFIX + "c" in fake_backend.seen


async def test_prefix_is_added_before_encode(fake_embedder: Embedder, fake_backend) -> None:
    await fake_embedder.embed_query("вопрос")
    await fake_embedder.embed_passages(["ответ"])
    assert QUERY_PREFIX + "вопрос" in fake_backend.seen
    assert PASSAGE_PREFIX + "ответ" in fake_backend.seen


async def test_warmup_calls_encode(fake_embedder: Embedder, fake_backend) -> None:
    await fake_embedder.warmup()
    assert fake_backend.calls == 1


async def test_cached_vector_survives_roundtrip(fake_redis) -> None:
    # Отдельный Embedder на том же Redis: значение читается из кэша, не из памяти объекта.
    backend_a, backend_b = HashingBackend(), HashingBackend()
    first = Embedder(backend_a, fake_redis, cache_ttl_seconds=60)
    second = Embedder(backend_b, fake_redis, cache_ttl_seconds=60)
    vec = await first.embed_query("заезд")
    same = await second.embed_query("заезд")
    assert backend_b.calls == 0
    assert same == vec
