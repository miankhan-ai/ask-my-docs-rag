"""
Cache protocols and a no-op implementation.

Two narrow capabilities are modelled separately so each call site depends only
on what it needs:

- ``KVCache``     — key/value with TTL (embedding cache, keyed by text hash).
- ``VectorCache`` — nearest-neighbour lookup (semantic answer cache, keyed by
                    query embedding similarity).

``NullCache`` satisfies both and always misses, so disabled caches keep call
sites branch-free.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class KVCache(Protocol):
    """Key/value cache with optional per-entry TTL."""

    async def get(self, key: str) -> Any | None: ...

    async def set(self, key: str, value: Any, ttl_s: int | None = None) -> None: ...

    async def delete(self, key: str) -> None: ...


@runtime_checkable
class VectorCache(Protocol):
    """Vector-keyed cache supporting approximate nearest-neighbour lookup."""

    async def get_nearest(
        self, vector: list[float], threshold: float
    ) -> tuple[Any, float] | None: ...

    async def add_vector(
        self, vector: list[float], value: Any, ttl_s: int | None = None
    ) -> None: ...


class NullCache:
    """A cache that stores nothing and always misses."""

    async def get(self, key: str) -> Any | None:
        return None

    async def set(self, key: str, value: Any, ttl_s: int | None = None) -> None:
        return None

    async def delete(self, key: str) -> None:
        return None

    async def get_nearest(
        self, vector: list[float], threshold: float
    ) -> tuple[Any, float] | None:
        return None

    async def add_vector(
        self, vector: list[float], value: Any, ttl_s: int | None = None
    ) -> None:
        return None
