"""Tests for the caching layer."""

import asyncio
from concurrent.futures import ThreadPoolExecutor

import pytest

from app.cache.base import NullCache
from app.cache.memory import InProcessCache


# --------------------------------------------------------------------------- #
# KV: get / set / TTL / LRU
# --------------------------------------------------------------------------- #
async def test_kv_set_get():
    cache = InProcessCache(max_size=10)
    await cache.set("k", [1.0, 2.0])
    assert await cache.get("k") == [1.0, 2.0]


async def test_kv_miss_returns_none():
    cache = InProcessCache()
    assert await cache.get("absent") is None


async def test_kv_ttl_expiry():
    cache = InProcessCache()
    await cache.set("k", "v", ttl_s=0)  # already expired
    assert await cache.get("k") is None


async def test_kv_lru_eviction():
    cache = InProcessCache(max_size=2)
    await cache.set("a", 1)
    await cache.set("b", 2)
    await cache.get("a")  # touch a -> b is now LRU
    await cache.set("c", 3)  # evicts b
    assert await cache.get("b") is None
    assert await cache.get("a") == 1
    assert await cache.get("c") == 3


async def test_kv_delete():
    cache = InProcessCache()
    await cache.set("k", "v")
    await cache.delete("k")
    assert await cache.get("k") is None


# --------------------------------------------------------------------------- #
# Vector: nearest-neighbour
# --------------------------------------------------------------------------- #
async def test_vector_hit_above_threshold():
    cache = InProcessCache()
    await cache.add_vector([1.0, 0.0, 0.0], {"answer": "A"})
    hit = await cache.get_nearest([0.99, 0.01, 0.0], threshold=0.9)
    assert hit is not None
    value, score = hit
    assert value == {"answer": "A"}
    assert score >= 0.9


async def test_vector_miss_below_threshold():
    cache = InProcessCache()
    await cache.add_vector([1.0, 0.0, 0.0], {"answer": "A"})
    assert await cache.get_nearest([0.0, 1.0, 0.0], threshold=0.9) is None


async def test_vector_expiry():
    cache = InProcessCache()
    await cache.add_vector([1.0, 0.0], {"answer": "A"}, ttl_s=0)
    assert await cache.get_nearest([1.0, 0.0], threshold=0.5) is None


# --------------------------------------------------------------------------- #
# NullCache always misses
# --------------------------------------------------------------------------- #
async def test_null_cache_misses():
    cache = NullCache()
    await cache.set("k", "v")
    assert await cache.get("k") is None
    await cache.add_vector([1.0], "v")
    assert await cache.get_nearest([1.0], threshold=0.0) is None


# --------------------------------------------------------------------------- #
# Thread-safety smoke (cache is reached from asyncio.to_thread workers)
# --------------------------------------------------------------------------- #
def test_thread_safe_concurrent_writes():
    cache = InProcessCache(max_size=1000)

    def writer(n: int) -> None:
        asyncio.run(cache.set(f"k{n}", n))

    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(writer, range(200)))

    # No exception => lock held correctly; spot-check a few values.
    assert asyncio.run(cache.get("k0")) == 0
    assert asyncio.run(cache.get("k199")) == 199


# --------------------------------------------------------------------------- #
# Embedding cache integration: backend called once for repeated text
# --------------------------------------------------------------------------- #
async def test_embedding_cache_serves_repeat(monkeypatch):
    import app.embeddings as emb
    from app.cache.factory import reset_caches
    import app.cache.factory as factory

    reset_caches()
    monkeypatch.setattr(emb.settings, "embedding_cache_enabled", True)
    monkeypatch.setattr(factory.settings, "embedding_cache_enabled", True)
    monkeypatch.setattr(factory.settings, "cache_backend", "memory")

    calls = {"n": 0}

    async def fake_uncached(texts):
        calls["n"] += 1
        return [[0.1, 0.2, 0.3] for _ in texts]

    monkeypatch.setattr(emb, "_embed_uncached", fake_uncached)

    first = await emb.embed_texts(["hello world"])
    second = await emb.embed_texts(["hello world"])  # served from cache

    assert first == second == [[0.1, 0.2, 0.3]]
    assert calls["n"] == 1  # backend invoked only on the miss
    reset_caches()
