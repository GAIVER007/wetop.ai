"""Подмены для тестов базы знаний: бэкенд эмбеддингов без сети и без модели.

Настоящая модель весит 450 МБ и грузится секунды; в тестах нужна не она,
а предсказуемый вектор, у которого совпадающие слова дают близкий косинус.
"""

from __future__ import annotations

import hashlib
import math
import re

_TOKEN_RE = re.compile(r"\w+")


class HashingBackend:
    """Мешок слов через sha256: детерминированный EmbeddingBackend.

    Каждый токен (включая префиксы query:/passage: — они обычные слова)
    даёт индекс в [0, dim) и знак; вектор нормируется. Запрос из двух слов
    ближе всего к чанку, где есть оба.
    """

    model_name = "fake-hash"
    dim = 384

    def __init__(self) -> None:
        self.calls = 0  # сколько раз звали encode: по нему проверяется кэш
        self.seen: list[str] = []  # какие тексты дошли до «модели»

    def encode(self, texts: list[str]) -> list[list[float]]:
        self.calls += 1
        self.seen.extend(texts)
        return [self._vector(text) for text in texts]

    def _vector(self, text: str) -> list[float]:
        vec = [0.0] * self.dim
        for token in _TOKEN_RE.findall(text.lower()):
            digest = hashlib.sha256(token.encode("utf-8")).digest()
            index = int.from_bytes(digest[:4], "big") % self.dim
            sign = 1.0 if digest[4] % 2 == 0 else -1.0
            vec[index] += sign
        norm = math.sqrt(sum(v * v for v in vec))
        if norm == 0.0:
            return vec
        return [v / norm for v in vec]
