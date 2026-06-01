# Ask My Docs — RAG Application Design Spec
**Date:** 2026-06-01  
**Status:** Approved

---

## Overview

A production-grade "Ask My Docs" RAG (Retrieval-Augmented Generation) application. Users upload documents, ask questions, and receive streamed answers with inline citations backed by the actual retrieved passages. Built as a portfolio project with a CI-gated evaluation suite.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| LLM (generation) | Groq API (`llama-3.3-70b-versatile`) | Free tier, fast inference |
| Embeddings | HuggingFace Inference API (`BAAI/bge-large-en-v1.5`, 1024 dims) | Free, best quality among free options |
| Vector store | Postgres 16 + pgvector | Single service, SQL familiarity, swappable behind interface |
| Backend | Python 3.12, FastAPI, SQLAlchemy (async) | Typed, async, production-ready |
| Frontend | React 18, TypeScript, Vite, TailwindCSS | Modern, portfolio-quality |
| Infra | Docker Compose | One-command local startup |
| CI | GitHub Actions | Eval-gated PR checks |

---

## Project Structure

```
ask-my-docs/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, router registration
│   │   ├── config.py            # Settings via pydantic-settings + .env
│   │   ├── ingestion.py         # Upload, chunking, embedding, DB write
│   │   ├── retrieval.py         # BM25 + pgvector dense search + RRF fusion
│   │   ├── reranking.py         # Cross-encoder reranker (sentence-transformers)
│   │   ├── generation.py        # Groq streaming + citation enforcement
│   │   ├── models.py            # SQLAlchemy ORM models (documents, chunks)
│   │   └── database.py          # Async SQLAlchemy engine + pgvector setup
│   ├── tests/
│   ├── evals/
│   │   ├── golden_set.json      # Questions → expected answers/sources
│   │   ├── run_evals.py         # CLI: recall@k, faithfulness, correctness
│   │   └── rubric.md            # LLM-as-judge rubric
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/          # ChatWindow, UploadPanel, CitationCard, DebugView
│   │   ├── hooks/               # useStream, useDocuments
│   │   ├── api/                 # Typed fetch wrappers
│   │   └── App.tsx
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── .github/workflows/evals.yml
└── README.md
```

---

## Section 1: Document Ingestion Pipeline

**Flow:** `Upload → Parse → Chunk → Embed → Store`

### Parsing
- PDF: `pypdf2`
- DOCX: `python-docx`
- Markdown / plain text: native Python
- Each parser returns `(text, page_or_section, source_doc_id)` tuples

### Chunking
- `langchain_text_splitters.RecursiveCharacterTextSplitter`
- Default `chunk_size`: 512 tokens, `chunk_overlap`: 64 tokens — both configurable via settings
- Each chunk stores: `text`, `source_document_id`, `page_number`, `char_start`, `char_end`, `chunk_index`

### Embedding
- Model: `BAAI/bge-large-en-v1.5` via HuggingFace Inference API (1024 dims)
- Batch size: 100 chunks per API call (configurable)
- Embedding model name is an env var (`HF_EMBEDDING_MODEL`) — swappable without code changes

### Database Schema
```sql
-- documents table
id, filename, filetype, upload_timestamp, status

-- chunks table
id, document_id, text, page_number, char_start, char_end, chunk_index, embedding vector(1024)
```

### BM25 Index
- Built in-memory via `rank-bm25` over all chunk texts at startup
- Serialized to disk (`bm25_index.pkl`) so restarts don't re-index from scratch
- Refreshed after each upload

### API Endpoint
- `POST /upload` — multipart form, returns `{document_id, chunk_count}`
- Ingestion runs as an async background task

---

## Section 2: Hybrid Retrieval + Reranking

**Flow:** `Query → [BM25 ‖ Dense vector search] → RRF Fusion → Cross-encoder reranker → Top-k chunks`

### BM25 (Lexical Search)
- `rank-bm25` in-memory index over all chunk texts
- Returns top-N candidates (default N=20, configurable)

### Dense Vector Search
- pgvector cosine similarity on `chunks.embedding`
- Query embedded with same HuggingFace model
- Returns top-N candidates (default N=20, configurable)

### RRF Fusion
- Formula: `score = Σ 1/(k + rank_i)`, k=60 (configurable)
- Rank-based — robust to score scale differences between BM25 and cosine similarity
- Produces unified ranked list of top-20 candidates

### Cross-Encoder Reranker
- Model: `cross-encoder/ms-marco-MiniLM-L-6-v2` via `sentence-transformers`
- Runs over RRF top-20, re-scores each `(query, chunk_text)` pair
- Returns final top-k (default 5, configurable)
- Model loaded once at startup, kept in memory

### API Endpoints
- `POST /query` — main query endpoint (streaming)
- `GET /retrieval-debug?query=...` — returns BM25 candidates, dense candidates, RRF list, reranked list with all scores at each stage

---

## Section 3: Generation with Citation Enforcement

**Flow:** `Reranked chunks → Build prompt → Groq streaming → Validate citations → Stream to client`

### Prompt Construction
- Each chunk injected into system prompt with explicit marker: `[1]`, `[2]`, etc.
- Instruction: cite inline using markers; if context doesn't support the answer, respond with "I don't have enough information to answer this from the provided documents"

### Streaming
- Groq `llama-3.3-70b-versatile` with streaming enabled (configurable via `GROQ_MODEL` env var)
- FastAPI `StreamingResponse` with `text/event-stream` (SSE)

### Citation Enforcement
- Post-generation validator (runs on buffered full response in parallel with streaming):
  - Every `[N]` in the response maps to an actual retrieved chunk
  - No out-of-range citation numbers
  - If no citations present where expected, sets `citation_warning: true`

### SSE Response Shape
```json
// During streaming
{"type": "token", "content": "..."}

// Final event
{
  "type": "done",
  "citations": [{"id": 1, "text": "...", "source": "doc.pdf", "page": 3}],
  "citation_warning": false
}
```

---

## Section 4: Frontend

**Stack:** React 18, TypeScript, Vite, TailwindCSS

### Three Views (single page)

**Upload Panel**
- Drag-and-drop or file picker (PDF, DOCX, MD, TXT)
- Upload progress indicator, chunk count on completion
- List of previously uploaded documents

**Chat Interface**
- Query input at bottom, streamed answer renders token-by-token
- Inline citation markers `[1]`, `[2]` rendered as clickable superscript badges
- Clicking badge opens side drawer: source passage, document name, page number
- `citation_warning: true` → subtle warning banner below answer

**Retrieval Debug View**
- Collapsible panel below each answer
- Table showing: BM25 candidates (scores), dense candidates (scores), RRF-fused list (scores), reranked final list (cross-encoder scores)
- Toggled via "Show retrieval debug" button

### API Layer (`src/api/`)
- `uploadDocument()` — multipart POST
- `streamQuery()` — fetch with ReadableStream / SSE
- `getRetrievalDebug()` — GET with query param

### State Management
- Local React state + `useStream` hook (manages SSE connection, token accumulation, citation assembly)
- `useDocuments` hook (manages uploaded document list)
- No Redux/Zustand — scope doesn't justify it

---

## Section 5: Evaluation Pipeline + CI

### Golden Eval Set
- `backend/evals/golden_set.json` — ~20 hand-crafted Q&A pairs
- Schema: `{question, expected_answer, expected_source_docs[]}`

### Metrics
| Metric | Method | Default Threshold |
|---|---|---|
| Retrieval Recall@k | Fraction of expected source docs in top-k | 0.7 |
| Citation Faithfulness | Groq LLM-as-judge per citation (0/1) | 0.8 |
| Answer Correctness | Groq LLM-as-judge vs expected answer (1-5 rubric) | 3.5 |

### CLI Runner
```bash
python -m evals.run_evals \
  --threshold-recall 0.7 \
  --threshold-faithfulness 0.8 \
  --threshold-correctness 3.5
```
Exits with code 1 if any metric falls below threshold. Prints markdown table of results.

### GitHub Actions (`evals.yml`)
- Triggers on every PR
- Secrets required: `GROQ_API_KEY`, `HF_API_KEY`
- Steps: spin up Postgres+pgvector via docker compose → ingest test docs → run eval CLI → fail build on threshold breach

---

## Configuration (env vars)

```env
# LLM
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile

# Embeddings
HF_API_KEY=...
HF_EMBEDDING_MODEL=BAAI/bge-large-en-v1.5

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/askdocs

# Retrieval
BM25_TOP_N=20
DENSE_TOP_N=20
RRF_K=60
RERANKER_TOP_K=5
CHUNK_SIZE=512
CHUNK_OVERLAP=64
EMBEDDING_BATCH_SIZE=100
```

---

## Deployment

- Local: `docker compose up` — starts backend + Postgres (pgvector)
- Frontend: `npm run dev` (or `docker compose` includes frontend service)
- No cloud deployment in scope for v1

---

## Out of Scope (v1)

- Cloud deployment (Vercel/Railway deferred)
- Authentication / multi-user
- Async ingestion queue (background task is sufficient for v1)
- Document deletion / re-ingestion
