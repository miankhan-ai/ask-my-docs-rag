import json
from pathlib import Path

from evals.run_evals import retrieval_recall_at_k


def test_golden_set_schema():
    path = Path(__file__).parent.parent / "evals" / "golden_set.json"
    data = json.loads(path.read_text())
    assert isinstance(data, list)
    assert len(data) >= 5
    for item in data:
        assert "id" in item
        assert "question" in item
        assert "expected_answer" in item
        assert "expected_source_docs" in item


def test_retrieval_recall_full_hit():
    assert retrieval_recall_at_k(["a.pdf", "b.pdf"], ["a.pdf"]) == 1.0


def test_retrieval_recall_partial():
    assert retrieval_recall_at_k(["a.pdf"], ["a.pdf", "b.pdf"]) == 0.5


def test_retrieval_recall_no_expected_is_perfect():
    assert retrieval_recall_at_k([], []) == 1.0
