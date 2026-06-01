"""
Hybrid retrieval: BM25 lexical search + pgvector dense search fused via RRF.

Components
----------
BM25IndexManager : In-memory BM25 index with build / search / save / load.
rrf_fuse         : Reciprocal Rank Fusion over BM25 + dense candidate lists.
hybrid_retrieve  : Run both searches in parallel and fuse the results.
"""

import asyncio
import pickle
from pathlib import Path
from typing import Any

from rank_bm25 import BM25Okapi
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.embeddings import embed_one


# --------------------------------------------------------------------------- #
# BM25 lexical index
# --------------------------------------------------------------------------- #
class BM25IndexManager:
    """In-memory BM25 index over chunk texts, persistable to disk."""

    def __init__(self) -> None:
        self._index: BM25Okapi | None = None
        self._chunk_ids: list[int] = []

    def build(self, chunks: list[dict[str, Any]]) -> None:
        """Build the index from a list of ``{id, text}`` dicts."""
        if not chunks:
            self._index = None
            self._chunk_ids = []
            return
        self._chunk_ids = [c["id"] for c in chunks]
        tokenized = [c["text"].lower().split() for c in chunks]
        self._index = BM25Okapi(tokenized)

    def search(self, query: str, top_n: int) -> list[dict[str, Any]]:
        """Return the top-N results as ``[{chunk_id, score}]``."""
        if self._index is None or not self._chunk_ids:
            return []
        tokens = query.lower().split()
        scores = self._index.get_scores(tokens)
        ranked = sorted(
            zip(self._chunk_ids, scores), key=lambda x: x[1], reverse=True
        )[:top_n]
        return [{"chunk_id": cid, "score": float(score)} for cid, score in ranked]

    def save(self, path: str) -> None:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump({"index": self._index, "chunk_ids": self._chunk_ids}, f)

    def load(self, path: str) -> None:
        with open(path, "rb") as f:
            data = pickle.load(f)
        self._index = data["index"]
        self._chunk_ids = data["chunk_ids"]


# --------------------------------------------------------------------------- #
# Reciprocal Rank Fusion
# --------------------------------------------------------------------------- #
def rrf_fuse(
    bm25_results: list[dict[str, Any]],
    dense_results: list[dict[str, Any]],
    k: int = 60,
    top_n: int = 20,
) -> list[dict[str, Any]]:
    """Reciprocal Rank Fusion over BM25 + dense candidate lists."""
    scores: dict[int, float] = {}
    for rank, item in enumerate(bm25_results):
        scores[item["chunk_id"]] = scores.get(item["chunk_id"], 0.0) + 1.0 / (k + rank + 1)
    for rank, item in enumerate(dense_results):
        scores[item["chunk_id"]] = scores.get(item["chunk_id"], 0.0) + 1.0 / (k + rank + 1)
    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_n]
    return [{"chunk_id": cid, "rrf_score": score} for cid, score in ranked]


# --------------------------------------------------------------------------- #
# Dense vector search
# --------------------------------------------------------------------------- #
async def _embed_query(query: str) -> list[float]:
    """Embed a single query string using the configured embedding backend."""
    return await embed_one(query)


async def _dense_search_db(
    db: AsyncSession,
    query_embedding: list[float],
    top_n: int,
) -> list[dict[str, Any]]:
    """pgvector cosine-similarity search over ``chunks.embedding``."""
    vec_str = "[" + ",".join(str(v) for v in query_embedding) + "]"
    result = await db.execute(
        text(
            """
            SELECT id, 1 - (embedding <=> :vec::vector) AS score
            FROM chunks
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> :vec::vector
            LIMIT :top_n
            """
        ),
        {"vec": vec_str, "top_n": top_n},
    )
    rows = result.fetchall()
    return [{"chunk_id": row[0], "score": float(row[1])} for row in rows]


async def hybrid_retrieve(
    query: str,
    db: AsyncSession,
    bm25_manager: "BM25IndexManager",
    bm25_top_n: int,
    dense_top_n: int,
    rrf_k: int,
    top_n: int,
) -> list[dict[str, Any]]:
    """Run BM25 + dense search in parallel and fuse with RRF."""
    query_embedding = await _embed_query(query)
    bm25_results, dense_results = await asyncio.gather(
        asyncio.to_thread(bm25_manager.search, query, bm25_top_n),
        _dense_search_db(db, query_embedding, dense_top_n),
    )
    return rrf_fuse(bm25_results, dense_results, k=rrf_k, top_n=top_n)
