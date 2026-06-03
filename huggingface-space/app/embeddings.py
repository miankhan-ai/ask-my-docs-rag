"""
Embedding backend abstraction.

Two interchangeable backends, selected via ``settings.embedding_backend``:

- ``"api"``   : HuggingFace Inference API (requires ``HF_API_KEY``, network).
- ``"local"`` : on-device ``sentence-transformers`` (no key, no network).

Both produce 1024-dim vectors (matching the ``BAAI/bge-large-en-v1.5`` model and
the pgvector column width), so the choice is transparent to callers. Use
``embed_texts`` for batches and ``embed_one`` for a single string.
"""

import hashlib
from functools import lru_cache
from typing import Any

import httpx

from app.cache.factory import get_embedding_cache
from app.config import settings
from app.observability.metrics import record_cache_event


# --------------------------------------------------------------------------- #
# HuggingFace Inference API backend
# --------------------------------------------------------------------------- #
async def _embed_via_api(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts via the HuggingFace Inference API."""
    url = f"https://api-inference.huggingface.co/models/{settings.hf_embedding_model}"
    headers = {"Authorization": f"Bearer {settings.hf_api_key}"}
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            url,
            headers=headers,
            json={"inputs": texts, "options": {"wait_for_model": True}},
        )
        response.raise_for_status()
        return response.json()


# --------------------------------------------------------------------------- #
# Local sentence-transformers backend
# --------------------------------------------------------------------------- #
@lru_cache
def _get_local_model() -> Any:
    """Load and cache the local sentence-transformers model (lazy import)."""
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(settings.local_embedding_model)


def _embed_via_local_sync(texts: list[str]) -> list[list[float]]:
    """Synchronous local embedding (run in a thread by the async wrapper)."""
    model = _get_local_model()
    vectors = model.encode(texts, normalize_embeddings=True)
    return [v.tolist() for v in vectors]


async def _embed_via_local(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts on-device, off the event loop."""
    import asyncio

    return await asyncio.to_thread(_embed_via_local_sync, texts)


# --------------------------------------------------------------------------- #
# Public dispatch
# --------------------------------------------------------------------------- #
def _embedding_cache_key(text: str) -> str:
    """Cache key for one text under the active model (model in key avoids
    collisions when the embedding model is swapped)."""
    model = (
        settings.local_embedding_model
        if settings.embedding_backend == "local"
        else settings.hf_embedding_model
    )
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return f"emb:{model}:{digest}"


async def _embed_uncached(texts: list[str]) -> list[list[float]]:
    """Embed without touching the cache (raw backend dispatch)."""
    if settings.embedding_backend == "local":
        return await _embed_via_local(texts)
    return await _embed_via_api(texts)


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts, serving hits from the embedding cache.

    Only cache misses are sent to the backend; results are written back and the
    output preserves input order. Hit/miss counters feed the metrics + dashboard.
    """
    cache = get_embedding_cache()
    keys = [_embedding_cache_key(t) for t in texts]
    results: list[list[float] | None] = [None] * len(texts)

    miss_indices: list[int] = []
    for i, key in enumerate(keys):
        cached = await cache.get(key)
        if cached is not None:
            results[i] = cached
            record_cache_event("embedding", hit=True)
        else:
            record_cache_event("embedding", hit=False)
            miss_indices.append(i)

    if miss_indices:
        miss_texts = [texts[i] for i in miss_indices]
        computed = await _embed_uncached(miss_texts)
        for idx, vec in zip(miss_indices, computed):
            results[idx] = vec
            await cache.set(keys[idx], vec)

    return [r for r in results if r is not None]


async def embed_one(text: str) -> list[float]:
    """Embed a single string using the configured backend."""
    result = await embed_texts([text])
    return result[0]
