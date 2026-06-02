import json
import pytest
from unittest.mock import MagicMock, patch

from app.generation import build_prompt, validate_citations, stream_generate


# --------------------------------------------------------------------------- #
# Prompt builder
# --------------------------------------------------------------------------- #
def test_build_prompt_injects_chunks_with_markers():
    chunks = [
        {"id": 1, "text": "Paris is the capital of France.", "source": "geo.pdf", "page_number": 1},
        {"id": 2, "text": "France is in Western Europe.", "source": "geo.pdf", "page_number": 2},
    ]
    system, user = build_prompt(question="What is the capital of France?", chunks=chunks)
    assert "[1]" in system
    assert "[2]" in system
    assert "Paris is the capital" in system
    assert "France is in Western Europe" in system
    assert "What is the capital of France?" in user


def test_build_prompt_includes_grounding_instruction():
    chunks = [{"id": 1, "text": "Some text.", "source": "doc.pdf", "page_number": 1}]
    system, _ = build_prompt(question="any question", chunks=chunks)
    assert "don't have enough" in system.lower()


# --------------------------------------------------------------------------- #
# Citation validator
# --------------------------------------------------------------------------- #
def test_validate_citations_all_valid():
    answer = "Paris is the capital [1]. It is in Europe [2]."
    chunks = [
        {"id": 1, "text": "...", "source": "a.pdf", "page_number": 1},
        {"id": 2, "text": "...", "source": "a.pdf", "page_number": 2},
    ]
    assert validate_citations(answer=answer, chunks=chunks) is False


def test_validate_citations_out_of_range():
    answer = "Something [3]."
    chunks = [{"id": 1, "text": "...", "source": "a.pdf", "page_number": 1}]
    assert validate_citations(answer=answer, chunks=chunks) is True


def test_validate_citations_no_citations_in_answer():
    answer = "Here is an answer with no citation markers."
    chunks = [{"id": 1, "text": "...", "source": "a.pdf", "page_number": 1}]
    assert validate_citations(answer=answer, chunks=chunks) is True


def test_validate_citations_no_chunks_no_warning():
    answer = "I don't have enough information to answer this."
    chunks = []
    assert validate_citations(answer=answer, chunks=chunks) is False


# --------------------------------------------------------------------------- #
# Streaming generation
# --------------------------------------------------------------------------- #
async def test_stream_generate_yields_tokens_then_done():
    chunks = [{"id": 1, "text": "Paris is the capital.", "source": "geo.pdf", "page_number": 1}]

    mock_chunk_1 = MagicMock()
    mock_chunk_1.choices = [MagicMock()]
    mock_chunk_1.choices[0].delta.content = "Paris"
    mock_chunk_2 = MagicMock()
    mock_chunk_2.choices = [MagicMock()]
    mock_chunk_2.choices[0].delta.content = " is the capital [1]."
    mock_chunk_done = MagicMock()
    mock_chunk_done.choices = [MagicMock()]
    mock_chunk_done.choices[0].delta.content = None

    async def mock_stream(*args, **kwargs):
        for c in [mock_chunk_1, mock_chunk_2, mock_chunk_done]:
            yield c

    with patch("app.generation._groq_stream", mock_stream):
        events = []
        async for event in stream_generate(question="Capital of France?", chunks=chunks):
            events.append(json.loads(event))

    token_events = [e for e in events if e["type"] == "token"]
    done_events = [e for e in events if e["type"] == "done"]
    assert len(token_events) >= 1
    assert len(done_events) == 1
    assert done_events[0]["citation_warning"] is False
    assert len(done_events[0]["citations"]) == 1
    # Observability fields are present (additive, even without provider usage).
    assert "timings" in done_events[0]
    assert "cost_usd" in done_events[0]
    assert done_events[0]["cached"] is False


async def test_stream_generate_reports_token_usage_and_cost():
    from app.observability.timing import TimingSink

    chunks = [{"id": 1, "text": "Paris is the capital.", "source": "geo.pdf", "page_number": 1}]

    tok = MagicMock()
    tok.choices = [MagicMock()]
    tok.choices[0].delta.content = "Paris [1]."
    tok.usage = None

    usage_chunk = MagicMock()
    usage_chunk.choices = []
    usage_chunk.usage = MagicMock(prompt_tokens=120, completion_tokens=8)

    async def mock_stream(*args, **kwargs):
        for c in [tok, usage_chunk]:
            yield c

    sink = TimingSink()
    with patch("app.generation._groq_stream", mock_stream):
        events = []
        async for event in stream_generate(
            question="Capital?", chunks=chunks, timings=sink
        ):
            events.append(json.loads(event))

    done = next(e for e in events if e["type"] == "done")
    assert done["prompt_tokens"] == 120
    assert done["completion_tokens"] == 8
    assert done["cost_usd"] > 0
    # llm timings recorded into the sink
    assert "llm_total" in done["timings"]
