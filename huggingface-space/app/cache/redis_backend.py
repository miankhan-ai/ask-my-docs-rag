"""
Optional Redis-backed KV cache (opt-in via ``cache_backend="redis"``).

Only the KV capability is provided here; the semantic answer cache stays
in-process (a production deployment would use Redis Stack vector search, which
is out of scope for this local-first portfolio build). ``redis`` is imported
lazily so the dependency is only required when this backend is selected.
Values are JSON-serialized.
"""

from __future__ import annotations

import json
from typing import Any

from app.config import settings


class RedisCache:
    """KV cache backed by Redis with TTL support."""

    def __init__(self, url: str | None = None) -> None:
        import redis.asyncio as redis  # lazy import

        self._client = redis.from_url(url or settings.redis_url, decode_responses=True)

    async def get(self, key: str) -> Any | None:
        raw = await self._client.get(key)
        return json.loads(raw) if raw is not None else None

    async def set(self, key: str, value: Any, ttl_s: int | None = None) -> None:
        payload = json.dumps(value)
        if ttl_s:
            await self._client.set(key, payload, ex=ttl_s)
        else:
            await self._client.set(key, payload)

    async def delete(self, key: str) -> None:
        await self._client.delete(key)
