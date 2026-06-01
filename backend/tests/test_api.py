import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch

from app.main import app


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


async def test_db_tables_created(db_session):
    from sqlalchemy import text
    result = await db_session.execute(
        text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
    )
    tables = {row[0] for row in result.fetchall()}
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
