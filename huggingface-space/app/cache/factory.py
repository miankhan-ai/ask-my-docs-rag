"""
Cache factory: builds the embedding and answer caches from config.

Singletons are created lazily and chosen by ``settings.cache_backend`` and the
per-cache enable flags. When a cache is disabled a ``NullCache`` is returned so
call sites never branch on enablement.
"""

from __future__ import annotations

from app.config import settings
from app.cache.base import NullCache
from app.cache.memory import InProcessCache

_embedding_cache = None
_answer_cache = None


def _make_kv_cache(ttl_s: int, max_size: int):
    """Build a KV cache for the configured backend."""
    if settings.cache_backend == "redis":
        from app.cache.redis_backend import RedisCache

        return RedisCache()
    return InProcessCache(max_size=max_size, default_ttl_s=ttl_s)


def get_embedding_cache():
    """Return the embedding KV cache singleton (or NullCache if disabled)."""
    global _embedding_cache
    if _embedding_cache is None:
        if settings.embedding_cache_enabled:
            _embedding_cache = _make_kv_cache(
                settings.embedding_cache_ttl_s, settings.embedding_cache_max_size
            )
        else:
            _embedding_cache = NullCache()
    return _embedding_cache


def get_answer_cache():
    """Return the semantic answer (vector) cache singleton (or NullCache).

    Always in-process: it needs nearest-neighbour search, which the Redis KV
    backend does not provide here.
    """
    global _answer_cache
    if _answer_cache is None:
        if settings.answer_cache_enabled:
            _answer_cache = InProcessCache(
                max_size=settings.answer_cache_max_size,
                default_ttl_s=settings.answer_cache_ttl_s,
            )
        else:
            _answer_cache = NullCache()
    return _answer_cache


def reset_caches() -> None:
    """Drop cached singletons (used by tests and benchmark cold/warm runs)."""
    global _embedding_cache, _answer_cache
    _embedding_cache = None
    _answer_cache = None
