"""
FastAPI application entry-point for Ask My Docs.

Endpoints
---------
GET  /health           : Liveness probe.
POST /upload           : Ingest a document (parse -> chunk -> embed -> store).
POST /query            : Streamed, citation-grounded answer (SSE).
GET  /retrieval-debug  : Raw BM25 / dense / RRF / reranked candidates for inspection.

Startup
-------
The lifespan handler initialises the database (pgvector + tables), loads the
cross-encoder reranker into memory, and builds/loads the BM25 index.
"""

from contextlib import asynccontextmanager
import json
import logging
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import init_db, get_db, AsyncSessionLocal
from app.ingestion import ingest_document
from app.models import Chunk, Document
from app.retrieval import (
    BM25IndexManager,
    hybrid_retrieve,
    rrf_fuse,
    _embed_query,
    _dense_search_db,
)
from app.reranking import CrossEncoderReranker
from app.generation import stream_generate

logger = logging.getLogger(__name__)

bm25_manager = BM25IndexManager()
reranker = CrossEncoderReranker()


async def _refresh_bm25_from_db(db: AsyncSession) -> int:
    """Rebuild the BM25 index from all chunk texts and persist it. Returns count."""
    result = await db.execute(select(Chunk.id, Chunk.text))
    rows = result.fetchall()
    bm25_manager.build([{"id": r[0], "text": r[1]} for r in rows])
    bm25_manager.save(settings.bm25_index_path)
    return len(rows)


async def _load_bm25_index(db: AsyncSession) -> None:
    """Load the BM25 index from disk if present, else build from the DB."""
    index_path = settings.bm25_index_path
    if Path(index_path).exists():
        bm25_manager.load(index_path)
        logger.info("BM25 index loaded from disk")
    else:
        count = await _refresh_bm25_from_db(db)
        if count:
            logger.info("BM25 index built from DB (%d chunks)", count)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    async with AsyncSessionLocal() as db:
        await _load_bm25_index(db)
    yield


app = FastAPI(title="Ask My Docs", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    """Liveness probe — returns 200 when the server is up."""
    return {"status": "ok"}


@app.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Ingest an uploaded document and refresh the BM25 index."""
    allowed = {".pdf", ".docx", ".md", ".txt"}
    suffix = Path(file.filename).suffix.lower()
    if suffix not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {suffix}")

    file_bytes = await file.read()
    doc_id, chunk_count = await ingest_document(
        db=db,
        filename=file.filename,
        filetype=suffix,
        file_bytes=file_bytes,
    )

    async with AsyncSessionLocal() as refresh_db:
        await _refresh_bm25_from_db(refresh_db)

    return {"document_id": doc_id, "chunk_count": chunk_count}


async def _fetch_chunk_map(db: AsyncSession, chunk_ids: list[int]) -> dict[int, dict]:
    """Fetch chunk rows + source filename keyed by chunk id."""
    result = await db.execute(
        select(Chunk, Document.filename)
        .join(Document, Chunk.document_id == Document.id)
        .where(Chunk.id.in_(chunk_ids))
    )
    rows = result.fetchall()
    return {
        row[0].id: {
            "id": row[0].id,
            "text": row[0].text,
            "source": row[1],
            "page_number": row[0].page_number,
        }
        for row in rows
    }


@app.post("/query")
async def query_documents(
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve, rerank, and stream a citation-grounded answer (SSE)."""
    question = payload.get("question", "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="question is required")

    rrf_results = await hybrid_retrieve(
        query=question,
        db=db,
        bm25_manager=bm25_manager,
        bm25_top_n=settings.bm25_top_n,
        dense_top_n=settings.dense_top_n,
        rrf_k=settings.rrf_k,
        top_n=20,
    )

    chunk_ids = [r["chunk_id"] for r in rrf_results]
    if not chunk_ids:
        async def empty_stream() -> AsyncIterator[str]:
            yield "data: " + json.dumps(
                {"type": "done", "citations": [], "citation_warning": False}
            ) + "\n\n"

        return StreamingResponse(empty_stream(), media_type="text/event-stream")

    chunk_map = await _fetch_chunk_map(db, chunk_ids)
    candidates = [chunk_map[cid] for cid in chunk_ids if cid in chunk_map]

    reranked = reranker.rerank(
        query=question, candidates=candidates, top_k=settings.reranker_top_k
    )

    async def event_stream() -> AsyncIterator[str]:
        async for event in stream_generate(question=question, chunks=reranked):
            yield f"data: {event}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/retrieval-debug")
async def retrieval_debug(
    query: str,
    db: AsyncSession = Depends(get_db),
):
    """Return raw BM25, dense, RRF-fused, and reranked candidates with scores."""
    query_embedding = await _embed_query(query)

    bm25_candidates = bm25_manager.search(query, top_n=settings.bm25_top_n)
    dense_candidates = await _dense_search_db(db, query_embedding, top_n=settings.dense_top_n)

    fused = rrf_fuse(
        bm25_results=bm25_candidates,
        dense_results=dense_candidates,
        k=settings.rrf_k,
        top_n=20,
    )

    chunk_ids = [r["chunk_id"] for r in fused]
    chunk_map = await _fetch_chunk_map(db, chunk_ids) if chunk_ids else {}

    candidates_with_text = [
        {
            "chunk_id": r["chunk_id"],
            "rrf_score": r["rrf_score"],
            "text": chunk_map[r["chunk_id"]]["text"],
            "source": chunk_map[r["chunk_id"]]["source"],
            "page_number": chunk_map[r["chunk_id"]]["page_number"],
        }
        for r in fused
        if r["chunk_id"] in chunk_map
    ]
    reranked = reranker.rerank(
        query=query,
        candidates=candidates_with_text,
        top_k=settings.reranker_top_k,
    )

    return {
        "bm25_candidates": bm25_candidates,
        "dense_candidates": dense_candidates,
        "rrf_fused": fused,
        "reranked": reranked,
    }
