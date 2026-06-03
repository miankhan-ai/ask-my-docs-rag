"""
FastAPI application entry-point for Ask My Docs.

Endpoints
---------
GET  /health           : Liveness probe.
POST /upload           : Ingest a document (parse -> chunk -> embed -> store).
GET  /documents        : List ingested documents.
DELETE /documents/{id} : Delete a document and its chunks.
POST /query            : Streamed, citation-grounded answer (SSE).
GET  /retrieval-debug  : Raw BM25 / dense / RRF / reranked candidates for inspection.
GET  /metrics          : Prometheus metrics (scrape target).
GET  /stats            : Compact JSON metrics snapshot for the live dashboard.

Startup
-------
The lifespan handler initialises the database (pgvector + tables), loads the
cross-encoder reranker into memory, and builds/loads the BM25 index.
"""

from contextlib import asynccontextmanager
import json
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from starlette.middleware.sessions import SessionMiddleware

from app.auth.dependencies import get_current_user
from app.auth.router import router as auth_router
from app.conversations.router import router as conversations_router
from app.cache.factory import get_answer_cache
from app.config import settings
from app.database import init_db, get_db, AsyncSessionLocal
from app.ingestion import ingest_document
from app.models import Chunk, Document, User
from app.observability.logging import configure_logging, get_logger
from app.observability.metrics import record_cache_event, stats
from app.observability.middleware import RequestContextMiddleware
from app.observability.timing import TimingSink, stage_timer, stage_timer_sync
from app.retrieval import (
    BM25IndexManager,
    hybrid_retrieve,
    rrf_fuse,
    _embed_query,
    _dense_search_db,
)
from app.reranking import CrossEncoderReranker
from app.generation import stream_generate

configure_logging()
logger = get_logger(__name__)

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
        logger.info("bm25_index_loaded", source="disk")
    else:
        count = await _refresh_bm25_from_db(db)
        if count:
            logger.info("bm25_index_built", source="db", chunks=count)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    async with AsyncSessionLocal() as db:
        await _load_bm25_index(db)
    yield


app = FastAPI(title="Ask My Docs", lifespan=lifespan)

app.add_middleware(SessionMiddleware, secret_key=settings.jwt_secret_key, max_age=300)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(conversations_router)


@app.get("/health")
async def health():
    """Liveness probe — returns 200 when the server is up."""
    return {"status": "ok"}


@app.get("/metrics")
async def metrics():
    """Prometheus exposition endpoint."""
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/stats")
async def stats_snapshot():
    """Compact JSON metrics snapshot consumed by the live dashboard."""
    return stats.snapshot()


@app.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
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
        user_id=user.id,
    )

    async with AsyncSessionLocal() as refresh_db:
        await _refresh_bm25_from_db(refresh_db)

    return {"document_id": doc_id, "chunk_count": chunk_count}


@app.get("/documents")
async def list_documents(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List ingested documents with their chunk counts (for the sidebar)."""
    from sqlalchemy import func

    result = await db.execute(
        select(
            Document.id,
            Document.filename,
            Document.status,
            func.count(Chunk.id),
        )
        .outerjoin(Chunk, Chunk.document_id == Document.id)
        .where(Document.user_id == user.id)
        .group_by(Document.id)
        .order_by(Document.id)
    )
    rows = result.fetchall()
    return [
        {
            "document_id": row[0],
            "filename": row[1],
            "status": row[2].value if hasattr(row[2], "value") else row[2],
            "chunk_count": row[3],
        }
        for row in rows
    ]


@app.delete("/documents/{document_id}")
async def delete_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a document and its chunks, then rebuild the BM25 index."""
    doc = await db.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this document")

    await db.delete(doc)  # cascade="all, delete-orphan" removes its chunks
    await db.commit()

    async with AsyncSessionLocal() as refresh_db:
        await _refresh_bm25_from_db(refresh_db)

    return {"document_id": document_id, "deleted": True}


async def _fetch_chunk_map(
    db: AsyncSession,
    chunk_ids: list[int],
    user_id: str | None = None,
) -> dict[int, dict]:
    """Fetch chunk rows + source filename keyed by chunk id."""
    query = (
        select(Chunk, Document.filename)
        .join(Document, Chunk.document_id == Document.id)
        .where(Chunk.id.in_(chunk_ids))
    )
    if user_id is not None:
        query = query.where(Document.user_id == user_id)
    result = await db.execute(query)
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


def _sse(payload: dict) -> str:
    """Format one dict as an SSE ``data:`` frame."""
    return "data: " + json.dumps(payload) + "\n\n"


async def _replay_cached_answer(cached: dict) -> AsyncIterator[str]:
    """Stream a cached answer as SSE: the full text as one token, then ``done``.

    The cached payload carries its original citations, so a cache hit can never
    produce citations that don't match the answer.
    """
    yield _sse({"type": "token", "content": cached["answer"]})
    done = {
        "type": "done",
        "citations": cached["citations"],
        "citation_warning": cached["citation_warning"],
        "timings": {},
        "prompt_tokens": cached.get("prompt_tokens", 0),
        "completion_tokens": cached.get("completion_tokens", 0),
        "cost_usd": cached.get("cost_usd", 0.0),
        "cached": True,
    }
    yield _sse(done)


@app.post("/query")
async def query_documents(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Retrieve, rerank, and stream a citation-grounded answer (SSE)."""
    question = payload.get("question", "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="question is required")

    timings = TimingSink()
    answer_cache = get_answer_cache()

    # Embed the query once (reused for both the answer cache and dense search).
    async with stage_timer("embed_query", timings):
        query_embedding = await _embed_query(question)

    # Semantic answer cache: return a cached answer for near-identical queries.
    hit = await answer_cache.get_nearest(
        query_embedding, settings.answer_cache_similarity_threshold
    )
    if hit is not None:
        record_cache_event("answer", hit=True)
        cached_payload, _score = hit
        return StreamingResponse(
            _replay_cached_answer(cached_payload), media_type="text/event-stream"
        )
    if settings.answer_cache_enabled:
        record_cache_event("answer", hit=False)

    rrf_results = await hybrid_retrieve(
        query=question,
        db=db,
        bm25_manager=bm25_manager,
        bm25_top_n=settings.bm25_top_n,
        dense_top_n=settings.dense_top_n,
        rrf_k=settings.rrf_k,
        top_n=20,
        query_embedding=query_embedding,
        timings=timings,
    )

    chunk_ids = [r["chunk_id"] for r in rrf_results]
    if not chunk_ids:
        async def empty_stream() -> AsyncIterator[str]:
            yield _sse(
                {
                    "type": "done",
                    "citations": [],
                    "citation_warning": False,
                    "timings": timings.as_dict(),
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "cost_usd": 0.0,
                    "cached": False,
                }
            )

        return StreamingResponse(empty_stream(), media_type="text/event-stream")

    chunk_map = await _fetch_chunk_map(db, chunk_ids, user_id=user.id)
    candidates = [chunk_map[cid] for cid in chunk_ids if cid in chunk_map]

    with stage_timer_sync("rerank", timings):
        reranked = reranker.rerank(
            query=question, candidates=candidates, top_k=settings.reranker_top_k
        )

    async def event_stream() -> AsyncIterator[str]:
        answer_parts: list[str] = []
        last_done: dict | None = None
        async for event in stream_generate(
            question=question, chunks=reranked, timings=timings
        ):
            parsed = json.loads(event)
            if parsed["type"] == "token":
                answer_parts.append(parsed["content"])
            elif parsed["type"] == "done":
                last_done = parsed
            yield f"data: {event}\n\n"

        # Store the completed answer (with its citations) in the semantic cache.
        if settings.answer_cache_enabled and last_done is not None:
            await answer_cache.add_vector(
                query_embedding,
                {
                    "answer": "".join(answer_parts),
                    "citations": last_done["citations"],
                    "citation_warning": last_done["citation_warning"],
                    "prompt_tokens": last_done.get("prompt_tokens", 0),
                    "completion_tokens": last_done.get("completion_tokens", 0),
                    "cost_usd": last_done.get("cost_usd", 0.0),
                },
            )

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/retrieval-debug")
async def retrieval_debug(
    query: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
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
    chunk_map = await _fetch_chunk_map(db, chunk_ids, user_id=user.id) if chunk_ids else {}

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
