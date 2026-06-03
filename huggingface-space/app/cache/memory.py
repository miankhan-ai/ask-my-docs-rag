"""
In-process LRU + TTL cache (zero-infra default).

``InProcessCache`` provides both the KV and vector capabilities. A
``threading.Lock`` guards all state because the embedding cache is reached from
``asyncio.to_thread`` worker threads, so concurrent access is real, not
theoretical. The vector side keeps L2-normalized vectors and does a brute-force
cosine scan over at most ``max_size`` entries — fine for local / small-corpus
use; production would swap in a vector store via the same interface.
"""

from __future__ import annotations

import math
import time
from collections import OrderedDict
from threading import Lock
from typing import Any


def _normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in vector))
    if norm == 0.0:
        return list(vector)
    return [v / norm for v in vector]


def _dot(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


class InProcessCache:
    """Thread-safe LRU+TTL key/value and vector cache."""

    def __init__(self, max_size: int = 10000, default_ttl_s: int | None = None) -> None:
        self._max_size = max_size
        self._default_ttl_s = default_ttl_s
        self._lock = Lock()
        # key -> (value, expires_at | None)
        self._store: "OrderedDict[str, tuple[Any, float | None]]" = OrderedDict()
        # list of (normalized_vector, value, expires_at | None)
        self._vectors: list[tuple[list[float], Any, float | None]] = []

    # -- internal ----------------------------------------------------------- #
    @staticmethod
    def _expired(expires_at: float | None) -> bool:
        return expires_at is not None and time.monotonic() >= expires_at

    def _deadline(self, ttl_s: int | None) -> float | None:
        # None => use the cache default; a default of None/0 means no expiry.
        # An explicit ttl_s (including 0) is honoured: 0 expires immediately.
        ttl = ttl_s if ttl_s is not None else self._default_ttl_s
        if ttl is None or (ttl_s is None and ttl == 0):
            return None
        return time.monotonic() + ttl

    # -- KV ----------------------------------------------------------------- #
    async def get(self, key: str) -> Any | None:
        with self._lock:
            item = self._store.get(key)
            if item is None:
                return None
            value, expires_at = item
            if self._expired(expires_at):
                del self._store[key]
                return None
            self._store.move_to_end(key)  # LRU touch
            return value

    async def set(self, key: str, value: Any, ttl_s: int | None = None) -> None:
        with self._lock:
            self._store[key] = (value, self._deadline(ttl_s))
            self._store.move_to_end(key)
            while len(self._store) > self._max_size:
                self._store.popitem(last=False)  # evict LRU

    async def delete(self, key: str) -> None:
        with self._lock:
            self._store.pop(key, None)

    # -- Vector ------------------------------------------------------------- #
    async def add_vector(
        self, vector: list[float], value: Any, ttl_s: int | None = None
    ) -> None:
        norm = _normalize(vector)
        with self._lock:
            self._vectors.append((norm, value, self._deadline(ttl_s)))
            if len(self._vectors) > self._max_size:
                self._vectors.pop(0)

    async def get_nearest(
        self, vector: list[float], threshold: float
    ) -> tuple[Any, float] | None:
        query = _normalize(vector)
        with self._lock:
            # Drop expired entries lazily on read.
            self._vectors = [v for v in self._vectors if not self._expired(v[2])]
            best_value: Any = None
            best_score = -1.0
            for norm_vec, value, _ in self._vectors:
                score = _dot(query, norm_vec)  # cosine (both normalized)
                if score > best_score:
                    best_score, best_value = score, value
            if best_value is not None and best_score >= threshold:
                return best_value, best_score
            return None
