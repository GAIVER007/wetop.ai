"""Эмбеддинги: multilingual-e5-small с префиксами query:/passage:, кэш в Redis, прогрев.

sentence_transformers импортируется лениво, внутри метода: сам импорт тянет
torch и стоит секунды, а тестам модель не нужна вовсе.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from typing import Protocol

from src import dependencies
from src.config import get_settings

logger = logging.getLogger(__name__)

# Префиксы e5: у одного текста с разными префиксами разные векторы.
QUERY_PREFIX = "query: "
PASSAGE_PREFIX = "passage: "
_PREFIX_KIND = {QUERY_PREFIX: "q", PASSAGE_PREFIX: "p"}


class EmbeddingBackend(Protocol):
    """Синхронный счётчик векторов на CPU. Векторы нормированы, длина dim."""

    model_name: str
    dim: int

    def encode(self, texts: list[str]) -> list[list[float]]: ...


class SentenceTransformersBackend:
    """Модель sentence-transformers. Грузится при первом encode() или явном load()."""

    def __init__(self, model_name: str) -> None:
        self.model_name = model_name
        self.dim: int | None = None  # известна только после загрузки
        self._model = None

    def load(self) -> None:
        if self._model is not None:
            return
        # Импорт здесь, не на уровне модуля: см. docstring модуля.
        from sentence_transformers import SentenceTransformer

        self._model = SentenceTransformer(self.model_name)
        self.dim = self._model.get_sentence_embedding_dimension()

    def encode(self, texts: list[str]) -> list[list[float]]:
        self.load()
        vectors = self._model.encode(texts, normalize_embeddings=True, convert_to_numpy=True)
        return [[float(x) for x in vector] for vector in vectors]


def cache_key(model_name: str, prefix: str, text: str) -> str:
    """emb:{модель}:{q|p}:{sha256 текста}.

    🔴 Три части. Только хеш текста — тихая порча: запрос получил бы вектор
    пассажа. Сменили модель — ключи меняются сами, старые протухнут по TTL.
    """
    kind = _PREFIX_KIND[prefix]
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return f"emb:{model_name}:{kind}:{digest}"


class Embedder:
    """Считает векторы через backend, промахи кэша — одним вызовом в отдельном потоке."""

    def __init__(self, backend: EmbeddingBackend, redis, *, cache_ttl_seconds: int) -> None:
        self.backend = backend
        self._redis = redis
        self._ttl = cache_ttl_seconds

    async def embed_query(self, text: str) -> list[float]:
        return (await self._embed([text], QUERY_PREFIX))[0]

    async def embed_passages(self, texts: list[str]) -> list[list[float]]:
        return await self._embed(texts, PASSAGE_PREFIX)

    async def warmup(self) -> None:
        """Один encode мимо кэша, чтобы модель загрузилась на старте, а не на первом клиенте."""
        await asyncio.to_thread(self.backend.encode, [PASSAGE_PREFIX + "прогрев модели"])

    async def _embed(self, texts: list[str], prefix: str) -> list[list[float]]:
        if not texts:
            return []
        # Ключ — от текста БЕЗ префикса, но с его видом; префикс уходит только в модель.
        keys = [cache_key(self.backend.model_name, prefix, t) for t in texts]
        result: list[list[float] | None] = await self._read_cache(keys)

        # Одинаковые тексты в одном вызове считаем один раз.
        misses: dict[str, str] = {}
        for key, text, cached in zip(keys, texts, result):
            if cached is None and key not in misses:
                misses[key] = text
        if misses:
            vectors = await asyncio.to_thread(
                self.backend.encode, [prefix + t for t in misses.values()]
            )
            computed = dict(zip(misses.keys(), vectors))
            await self._write_cache(computed)
            result = [r if r is not None else computed[k] for r, k in zip(result, keys)]
        return result  # type: ignore[return-value]

    async def _read_cache(self, keys: list[str]) -> list[list[float] | None]:
        # Кэш — ускорение, не источник правды: его сбой не должен ронять поиск.
        try:
            raw = await self._redis.mget(keys)
        except Exception:
            logger.warning("Кэш эмбеддингов недоступен на чтение, считаем заново", exc_info=True)
            return [None] * len(keys)
        return [json.loads(item) if item else None for item in raw]

    async def _write_cache(self, computed: dict[str, list[float]]) -> None:
        try:
            pipe = self._redis.pipeline()
            for key, vector in computed.items():
                pipe.set(key, json.dumps(vector), ex=self._ttl)
            await pipe.execute()
        except Exception:
            logger.warning("Кэш эмбеддингов недоступен на запись", exc_info=True)


# ─── Синглтон ───


class _Holder:
    embedder: Embedder | None = None


_holder = _Holder()


def get_embedder() -> Embedder:
    """Один Embedder на процесс: модель весит сотни мегабайт."""
    if _holder.embedder is None:
        settings = get_settings()
        _holder.embedder = Embedder(
            SentenceTransformersBackend(settings.kb_embed_model),
            # Через модуль, а не импорт имени: тесты подменяют dependencies.get_redis.
            dependencies.get_redis(),
            cache_ttl_seconds=settings.kb_embed_cache_ttl_seconds,
        )
    return _holder.embedder


def set_embedder(embedder: Embedder | None) -> None:
    """Для тестов: подменить на Embedder с поддельным backend."""
    _holder.embedder = embedder


def reset_embedder() -> None:
    """Для тестов: следующий get_embedder() соберёт заново."""
    _holder.embedder = None
