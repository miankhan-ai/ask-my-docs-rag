import json

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from unittest.mock import AsyncMock, patch

from app.main import app


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


async def test_db_tables_created(db_session):
    from sqlalchemy import inspect

    def _table_names(sync_conn):
        return set(inspect(sync_conn).get_table_names())

    conn = await db_session.connection()
    tables = await conn.run_sync(_table_names)
    assert "documents" in tables
    assert "chunks" in tables


async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_upload_endpoint_accepts_file(client, tmp_path):
    test_file = tmp_path / "test.txt"
    test_file.write_text("This is a test document about Paris.")

    with patch("app.main.ingest_document", new_callable=AsyncMock) as mock_ingest:
        mock_ingest.return_value = (42, 3)
        with patch("app.main._refresh_bm25_from_db", new_callable=AsyncMock) as mock_refresh:
            mock_refresh.return_value = 3
            response = await client.post(
                "/upload",
                files={"file": ("test.txt", test_file.read_bytes(), "text/plain")},
            )
    assert response.status_code == 200
    data = response.json()
    assert data["document_id"] == 42
    assert data["chunk_count"] == 3


async def test_upload_rejects_unsupported_type(client, tmp_path):
    test_file = tmp_path / "test.xyz"
    test_file.write_text("nope")
    response = await client.post(
        "/upload",
        files={"file": ("test.xyz", test_file.read_bytes(), "application/octet-stream")},
    )
    assert response.status_code == 400


async def test_list_and_delete_documents(client, db_session):
    """List reflects seeded docs; delete removes the doc and its chunks."""
    from app.database import get_db
    from app.models import Document, DocumentStatus, Chunk

    # Route the endpoints' get_db dependency at the in-memory test session.
    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db

    # Seed one document with two chunks.
    doc = Document(filename="seed.txt", filetype=".txt", status=DocumentStatus.ready)
    db_session.add(doc)
    await db_session.flush()
    db_session.add_all(
        [
            Chunk(
                document_id=doc.id,
                text=f"chunk {i}",
                page_number=None,
                char_start=0,
                char_end=7,
                chunk_index=i,
                embedding=None,
            )
            for i in range(2)
        ]
    )
    await db_session.commit()

    try:
        # List
        resp = await client.get("/documents")
        assert resp.status_code == 200
        docs = resp.json()
        assert any(d["document_id"] == doc.id and d["chunk_count"] == 2 for d in docs)

        # Delete (patch the BM25 rebuild so it doesn't touch a real index/session)
        with patch("app.main._refresh_bm25_from_db", new_callable=AsyncMock) as mock_refresh:
            mock_refresh.return_value = 0
            resp = await client.delete(f"/documents/{doc.id}")
        assert resp.status_code == 200
        assert resp.json() == {"document_id": doc.id, "deleted": True}

        # Gone, and chunks cascaded away.
        assert await db_session.get(Document, doc.id) is None
        remaining = await db_session.execute(
            select(Chunk).where(Chunk.document_id == doc.id)
        )
        assert remaining.first() is None

        # Deleting again -> 404
        resp = await client.delete(f"/documents/{doc.id}")
        assert resp.status_code == 404
    finally:
        app.dependency_overrides.clear()


async def test_answer_cache_hit_returns_cached_citations(client):
    """A seeded semantic-cache hit replays the cached answer + citations."""
    import app.main as main_mod
    from app.cache.memory import InProcessCache

    cached_citations = [
        {"id": 1, "text": "Paris is the capital.", "source": "geo.pdf", "page": 1}
    ]
    seeded = InProcessCache()
    await seeded.add_vector(
        [1.0, 0.0, 0.0],
        {
            "answer": "Paris is the capital [1].",
            "citations": cached_citations,
            "citation_warning": False,
            "prompt_tokens": 100,
            "completion_tokens": 5,
            "cost_usd": 0.0001,
        },
    )

    with patch("app.main.get_answer_cache", return_value=seeded):
        with patch(
            "app.main._embed_query", new_callable=AsyncMock
        ) as mock_embed:
            mock_embed.return_value = [1.0, 0.0, 0.0]
            with patch.object(main_mod.settings, "answer_cache_similarity_threshold", 0.9):
                resp = await client.post("/query", json={"question": "capital of France?"})
                body = resp.text

    assert resp.status_code == 200
    events = [
        json.loads(line[6:])
        for line in body.splitlines()
        if line.startswith("data: ")
    ]
    done = next(e for e in events if e["type"] == "done")
    assert done["cached"] is True
    assert done["citations"] == cached_citations


async def test_retrieval_debug_endpoint(client):
    with patch("app.main.bm25_manager") as mock_bm25:
        mock_bm25.search.return_value = [{"chunk_id": 1, "score": 0.9}]
        with patch("app.main._embed_query", new_callable=AsyncMock) as mock_embed:
            mock_embed.return_value = [0.0] * 1024
            with patch("app.main._dense_search_db", new_callable=AsyncMock) as mock_dense:
                mock_dense.return_value = [{"chunk_id": 1, "score": 0.95}]
                with patch("app.main._fetch_chunk_map", new_callable=AsyncMock) as mock_fetch:
                    mock_fetch.return_value = {
                        1: {"id": 1, "text": "Paris", "source": "a.pdf", "page_number": 1}
                    }
                    with patch("app.main.reranker") as mock_reranker:
                        mock_reranker.rerank.return_value = [
                            {"chunk_id": 1, "cross_encoder_score": 0.8, "text": "Paris"}
                        ]
                        response = await client.get("/retrieval-debug?query=test")
    assert response.status_code == 200
    data = response.json()
    assert "bm25_candidates" in data
    assert "dense_candidates" in data
    assert "rrf_fused" in data
    assert "reranked" in data
