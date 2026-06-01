import pytest
from unittest.mock import AsyncMock, patch

from app.retrieval import BM25IndexManager, rrf_fuse, hybrid_retrieve


# --------------------------------------------------------------------------- #
# BM25
# --------------------------------------------------------------------------- #
def test_bm25_search_returns_ranked_results():
    manager = BM25IndexManager()
    manager.build(
        [
            {"id": 1, "text": "the quick brown fox"},
            {"id": 2, "text": "lazy dog sleeping"},
            {"id": 3, "text": "fox running quickly through forest"},
        ]
    )
    results = manager.search("fox", top_n=2)
    assert len(results) == 2
    ids = [r["chunk_id"] for r in results]
    assert 1 in ids or 3 in ids


def test_bm25_search_includes_score():
    manager = BM25IndexManager()
    manager.build([{"id": 1, "text": "hello world"}, {"id": 2, "text": "foo bar"}])
    results = manager.search("hello", top_n=2)
    assert all("score" in r for r in results)


def test_bm25_save_load_roundtrip(tmp_path):
    manager = BM25IndexManager()
    manager.build([{"id": 1, "text": "hello world"}])
    path = tmp_path / "bm25.pkl"
    manager.save(str(path))

    manager2 = BM25IndexManager()
    manager2.load(str(path))
    results = manager2.search("hello", top_n=1)
    assert results[0]["chunk_id"] == 1


def test_bm25_empty_index_returns_empty():
    manager = BM25IndexManager()
    manager.build([])
    results = manager.search("anything", top_n=5)
    assert results == []


# --------------------------------------------------------------------------- #
# RRF fusion
# --------------------------------------------------------------------------- #
def test_rrf_fuse_combines_lists():
    bm25 = [
        {"chunk_id": 1, "score": 0.9},
        {"chunk_id": 2, "score": 0.7},
        {"chunk_id": 3, "score": 0.5},
    ]
    dense = [
        {"chunk_id": 2, "score": 0.95},
        {"chunk_id": 3, "score": 0.85},
        {"chunk_id": 4, "score": 0.6},
    ]
    fused = rrf_fuse(bm25_results=bm25, dense_results=dense, k=60, top_n=4)
    assert len(fused) == 4
    ids = [r["chunk_id"] for r in fused]
    assert 2 in ids
    assert all("rrf_score" in r for r in fused)


def test_rrf_fuse_handles_empty_lists():
    fused = rrf_fuse(bm25_results=[], dense_results=[], k=60, top_n=5)
    assert fused == []


def test_rrf_fuse_rank_order():
    bm25 = [{"chunk_id": 1, "score": 1.0}, {"chunk_id": 2, "score": 0.5}]
    dense = [{"chunk_id": 1, "score": 1.0}, {"chunk_id": 3, "score": 0.5}]
    fused = rrf_fuse(bm25_results=bm25, dense_results=dense, k=60, top_n=3)
    assert fused[0]["chunk_id"] == 1


# --------------------------------------------------------------------------- #
# Hybrid retrieve
# --------------------------------------------------------------------------- #
async def test_hybrid_retrieve_returns_fused_results(db_session):
    manager = BM25IndexManager()
    manager.build(
        [
            {"id": 1, "text": "the quick brown fox"},
            {"id": 2, "text": "lazy dog sleeping"},
        ]
    )

    with patch("app.retrieval._embed_query", new_callable=AsyncMock) as mock_embed:
        mock_embed.return_value = [0.1] * 1024
        with patch("app.retrieval._dense_search_db", new_callable=AsyncMock) as mock_dense:
            mock_dense.return_value = [
                {"chunk_id": 1, "score": 0.9},
                {"chunk_id": 2, "score": 0.7},
            ]
            results = await hybrid_retrieve(
                query="fox",
                db=db_session,
                bm25_manager=manager,
                bm25_top_n=5,
                dense_top_n=5,
                rrf_k=60,
                top_n=5,
            )
    assert isinstance(results, list)
    assert all("chunk_id" in r for r in results)
