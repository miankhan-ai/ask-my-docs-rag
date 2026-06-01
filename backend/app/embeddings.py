"""
Embedding backend abstraction.

Two interchangeable backends, selected via ``settings.embedding_backend``:

- ``"api"``   : HuggingFace Inference API (requires ``HF_API_KEY``, network).
- ``"local"`` : on-device ``sentence-transformers`` (no key, no network).

Both produce 1024-dim vectors (matching the ``BAAI/bge-large-en-v1.5`` model and
the pgvector column width), so the choice is transparent to callers. Use
``embed_texts`` for batches and ``embed_one`` for a single string.
"""

from functools import lru_cache
from typing import Any

import httpx

from app.config import settings


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
async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts using the configured backend."""
    if settings.embedding_backend == "local":
        return await _embed_via_local(texts)
    return await _embed_via_api(texts)


async def embed_one(text: str) -> list[float]:
    """Embed a single string using the configured backend."""
    result = await embed_texts([text])
    return result[0]
