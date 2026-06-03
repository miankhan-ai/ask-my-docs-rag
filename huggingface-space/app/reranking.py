"""
Second-stage cross-encoder reranker over fused retrieval candidates.

The cross-encoder jointly scores each ``(query, passage)`` pair, producing a
more accurate ordering than the first-stage retrieval scores. The model is
loaded once and kept in memory.
"""

from typing import Any

from sentence_transformers import CrossEncoder


class CrossEncoderReranker:
    """Re-scores ``(query, passage)`` pairs with a cross-encoder model."""

    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2") -> None:
        self._model = CrossEncoder(model_name)

    def rerank(
        self,
        query: str,
        candidates: list[dict[str, Any]],
        top_k: int,
    ) -> list[dict[str, Any]]:
        """Re-score candidates; return the top-K sorted by score descending."""
        if not candidates:
            return []
        pairs = [(query, c["text"]) for c in candidates]
        scores = self._model.predict(pairs)
        scored = [
            {**c, "cross_encoder_score": float(s)}
            for c, s in zip(candidates, scores)
        ]
        scored.sort(key=lambda x: x["cross_encoder_score"], reverse=True)
        return scored[:top_k]
