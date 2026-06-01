import pytest
from pathlib import Path
from unittest.mock import patch

from app.ingestion import parse_file, chunk_pages, embed_chunks, ingest_document
from app.models import Document, DocumentStatus

FIXTURES = Path(__file__).parent / "fixtures"


# --------------------------------------------------------------------------- #
# Parsing
# --------------------------------------------------------------------------- #
def test_parse_txt():
    pages = parse_file(FIXTURES / "sample.txt")
    assert len(pages) >= 1
    assert isinstance(pages[0], dict)
    assert "text" in pages[0] and "page_number" in pages[0]
    assert "hello" in pages[0]["text"].lower()


def test_parse_markdown():
    pages = parse_file(FIXTURES / "sample.md")
    assert len(pages) >= 1
    assert "hello" in pages[0]["text"].lower()


def test_parse_pdf():
    pages = parse_file(FIXTURES / "sample.pdf")
    assert len(pages) >= 1
    assert pages[0]["page_number"] == 1


def test_parse_docx():
    pages = parse_file(FIXTURES / "sample.docx")
    assert len(pages) >= 1
    assert "hello" in pages[0]["text"].lower()


def test_parse_unsupported_raises():
    with pytest.raises(ValueError, match="Unsupported"):
        parse_file(Path("file.xyz"))


# --------------------------------------------------------------------------- #
# Chunking
# --------------------------------------------------------------------------- #
def test_chunk_pages_basic():
    pages = [{"text": "word " * 200, "page_number": 1}]
    chunks = chunk_pages(pages, chunk_size=100, chunk_overlap=10)
    assert len(chunks) > 1
    for c in chunks:
        assert "text" in c
        assert "page_number" in c
        assert "char_start" in c
        assert "char_end" in c
        assert "chunk_index" in c


def test_chunk_pages_preserves_page_number():
    pages = [
        {"text": "a " * 100, "page_number": 1},
        {"text": "b " * 100, "page_number": 2},
    ]
    chunks = chunk_pages(pages, chunk_size=50, chunk_overlap=5)
    page_numbers = {c["page_number"] for c in chunks}
    assert 1 in page_numbers


def test_chunk_pages_char_offsets_correct():
    pages = [{"text": "hello world foo bar baz", "page_number": 1}]
    chunks = chunk_pages(pages, chunk_size=10, chunk_overlap=2)
    for c in chunks:
        assert c["text"] == pages[0]["text"][c["char_start"]:c["char_end"]]


# --------------------------------------------------------------------------- #
# Embedding
# --------------------------------------------------------------------------- #
async def test_embed_chunks_batches_correctly():
    chunks = [{"text": f"chunk {i}"} for i in range(5)]

    # The mock returns one embedding per text it receives, so batched calls
    # accumulate to exactly len(chunks) embeddings.
    async def fake_embed(texts):
        return [[0.1] * 1024 for _ in texts]

    with patch("app.ingestion.embed_texts", side_effect=fake_embed) as mock_embed:
        result = await embed_chunks(chunks, batch_size=3)

    assert mock_embed.call_count == 2  # 5 chunks, batch_size=3 -> 2 calls
    assert len(result) == 5
    assert all(len(e) == 1024 for e in result)


# --------------------------------------------------------------------------- #
# End-to-end ingestion
# --------------------------------------------------------------------------- #
async def test_ingest_document_creates_chunks(db_session):
    async def fake_embed(texts):
        return [[0.1] * 1024 for _ in texts]

    with patch("app.ingestion.embed_texts", side_effect=fake_embed):
        doc_id, chunk_count = await ingest_document(
            db=db_session,
            filename="sample.txt",
            filetype=".txt",
            file_bytes=(FIXTURES / "sample.txt").read_bytes(),
        )

    assert doc_id is not None
    assert chunk_count > 0

    doc = await db_session.get(Document, doc_id)
    assert doc is not None
    assert doc.status == DocumentStatus.ready
