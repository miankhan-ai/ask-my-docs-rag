import pytest

from app.reranking import CrossEncoderReranker

MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"


def test_reranker_returns_top_k():
    reranker = CrossEncoderReranker(model_name=MODEL)
    candidates = [
        {"chunk_id": i, "text": f"some passage about topic {i}"} for i in range(10)
    ]
    results = reranker.rerank(query="topic 5", candidates=candidates, top_k=3)
    assert len(results) == 3


def test_reranker_includes_score():
    reranker = CrossEncoderReranker(model_name=MODEL)
    candidates = [
        {"chunk_id": 1, "text": "Paris is the capital of France"},
        {"chunk_id": 2, "text": "The sky is blue"},
    ]
    results = reranker.rerank(
        query="What is the capital of France?", candidates=candidates, top_k=2
    )
    assert all("cross_encoder_score" in r for r in results)
    assert results[0]["chunk_id"] == 1


def test_reranker_handles_empty():
    reranker = CrossEncoderReranker(model_name=MODEL)
    results = reranker.rerank(query="anything", candidates=[], top_k=5)
    assert results == []
