# Ask My Docs

A production-grade Retrieval-Augmented Generation (RAG) application. Upload documents, ask questions, and get streamed answers with inline citations backed by the actual retrieved passages.

## Architecture

```
Ingestion:  Upload → Parse (PDF/DOCX/MD/TXT) → Chunk (recursive, overlap) → Embed (HF BGE) → Store (pgvector)

Query:      Question
              ├─ BM25 lexical search ─┐
              │                        ├─ RRF fusion → Cross-encoder reranker → Groq LLM → SSE stream
              └─ pgvector dense search ┘                                              │
                                                                          Citation enforcement
```

- **Hybrid retrieval:** BM25 (`rank-bm25`) and dense vector search (pgvector cosine) run in parallel, fused with Reciprocal Rank Fusion (RRF).
- **Reranking:** A cross-encoder (`cross-encoder/ms-marco-MiniLM-L-6-v2`) re-scores the fused candidates and selects the final top-k.
- **Citation enforcement:** Answers cite passages with inline `[N]` markers. A post-generation validator flags answers whose citations don't map to retrieved chunks (`citation_warning`). If context doesn't support an answer, the model is instructed to say so rather than hallucinate.

### Tech Stack

| Layer | Choice |
|---|---|
| LLM (generation) | Groq API (`llama-3.3-70b-versatile`) |
| Embeddings | HuggingFace Inference API (`BAAI/bge-large-en-v1.5`, 1024-dim) |
| Vector store | Postgres 16 + pgvector |
| Backend | Python 3.12, FastAPI, SQLAlchemy (async) |
| Frontend | React 18, TypeScript, Vite, TailwindCSS |
| Infra | Docker Compose |
| CI | GitHub Actions (eval-gated PRs) |

## Project Structure

```
backend/
  app/
    config.py       # pydantic-settings configuration
    database.py     # async SQLAlchemy engine + pgvector init
    models.py       # Document, Chunk ORM models
    ingestion.py    # parse → chunk → embed → store
    retrieval.py    # BM25 + dense search + RRF fusion
    reranking.py    # cross-encoder reranker
    generation.py   # prompt builder + Groq streaming + citation validator
    main.py         # FastAPI app: /health /upload /query /retrieval-debug
  tests/            # unit + integration tests
  evals/            # golden set, rubric, eval CLI runner
frontend/
  src/
    api/            # typed fetch wrappers (upload, streamQuery, debug)
    hooks/          # useStream (SSE), useDocuments
    components/     # UploadPanel, ChatWindow, CitationDrawer, DebugView
docker-compose.yml
.github/workflows/evals.yml
```

## Quick Start (Docker)

```bash
cp .env.example .env   # fill in GROQ_API_KEY and HF_API_KEY
docker compose up
# Backend:  http://localhost:8000
# Frontend: http://localhost:5173
```

Get free API keys at [console.groq.com](https://console.groq.com) (Groq) and [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) (HuggingFace).

## Running Locally (without Docker)

```bash
# 1. Start Postgres with pgvector
docker run -d --name askdocs-pg \
  -e POSTGRES_USER=askdocs -e POSTGRES_PASSWORD=askdocs -e POSTGRES_DB=askdocs \
  -p 5432:5432 pgvector/pgvector:pg16

# 2. Backend (Python 3.12 recommended)
cd backend
pip install -r requirements.txt
cp ../.env.example .env   # DATABASE_URL already points at localhost
uvicorn app.main:app --reload

# 3. Frontend
cd frontend
npm install && npm run dev
```

> **Note on Python version:** The pinned dependencies target Python 3.12. SQLAlchemy is pinned to `>=2.0.43` for compatibility with newer Python releases (3.13/3.14).

## Running Tests

```bash
cd backend
pytest tests/ -v
```

Most tests run without external services. Four tests require a live Postgres+pgvector instance (table creation, end-to-end ingestion, hybrid retrieval, and the API DB smoke test) — start the Postgres container above first, and create an `askdocs_test` database:

```bash
docker exec askdocs-pg psql -U askdocs -c "CREATE DATABASE askdocs_test;"
pytest tests/ -v   # now all tests run
```

The cross-encoder reranker tests download a ~80 MB model on first run.

## Running Evals

The eval suite runs the golden Q&A set against a **live** backend and scores three metrics with thresholds. Start the backend and ingest the sample fixtures first:

```bash
cd backend
python tests/create_fixtures.py        # generate sample docs
# (start backend, then upload tests/fixtures/* via the /upload endpoint)

python -m evals.run_evals \
  --threshold-recall 0.7 \
  --threshold-faithfulness 0.8 \
  --threshold-correctness 3.5
```

| Metric | Method | Default Threshold |
|---|---|---|
| Retrieval Recall@k | Fraction of expected source docs in top-k citations | 0.7 |
| Citation Faithfulness | Groq LLM-as-judge per citation (0/1) | 0.8 |
| Answer Correctness | Groq LLM-as-judge vs expected answer (1–5) | 3.5 |

The CLI exits with code 1 if any metric falls below its threshold and prints a markdown results table. See `evals/rubric.md` for the judge prompts.

## Configuration

All configuration is via environment variables — see `.env.example`. No keys are hardcoded. The embedding model (`HF_EMBEDDING_MODEL`), LLM (`GROQ_MODEL`), chunking parameters, and retrieval top-k values are all configurable. The vector store is accessed behind the functions in `retrieval.py`, so swapping it out is localized to that module.

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness probe |
| `POST` | `/upload` | Multipart upload; returns `{document_id, chunk_count}` |
| `POST` | `/query` | Streamed SSE answer with citations |
| `GET` | `/retrieval-debug?query=...` | Raw BM25 / dense / RRF / reranked candidates with scores |

### SSE Response Shape

```json
// token events during streaming
{"type": "token", "content": "..."}

// final event
{"type": "done",
 "citations": [{"id": 1, "text": "...", "source": "doc.pdf", "page": 3}],
 "citation_warning": false}
```

## CI

GitHub Actions (`.github/workflows/evals.yml`) runs the eval suite on every PR to `main`. It spins up Postgres+pgvector, starts the backend, ingests the sample fixtures, and runs the eval CLI — failing the build if recall, faithfulness, or correctness drop below their thresholds. Requires `GROQ_API_KEY` and `HF_API_KEY` repository secrets.
