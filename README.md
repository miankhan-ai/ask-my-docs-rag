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
| `GET` | `/documents` | List ingested documents with chunk counts |
| `DELETE` | `/documents/{id}` | Delete a document and its chunks |
| `POST` | `/query` | Streamed SSE answer with citations |
| `GET` | `/retrieval-debug?query=...` | Raw BM25 / dense / RRF / reranked candidates with scores |
| `GET` | `/metrics` | Prometheus metrics (scrape target) |
| `GET` | `/stats` | Compact JSON metrics snapshot for the live dashboard |

### SSE Response Shape

```json
// token events during streaming
{"type": "token", "content": "..."}

// final event — carries citations plus per-query observability data
{"type": "done",
 "citations": [{"id": 1, "text": "...", "source": "doc.pdf", "page": 3}],
 "citation_warning": false,
 "timings": {"embed_query": 12.1, "bm25_search": 3.4, "dense_search": 8.0,
             "rrf_fuse": 0.1, "rerank": 41.2, "llm_ttft": 380.5, "llm_total": 2100.7},
 "prompt_tokens": 412, "completion_tokens": 76, "cost_usd": 0.000167,
 "cached": false}
```

## Observability & Performance

The app is instrumented end-to-end so you can see *where* time and money go, and a
caching layer turns that visibility into a measurable win.

### What's instrumented

- **Structured JSON logging** (`structlog`) with a per-request correlation ID
  (`X-Request-ID`, generated if absent) bound via `contextvars` so every log line in a
  request carries it. Wired once in `app/observability/middleware.py` — business logic
  stays clean.
- **Per-stage latency** for every pipeline stage (`embed_query`, `bm25_search`,
  `dense_search`, `rrf_fuse`, `rerank`, `llm_ttft`, `llm_total`) via a single
  `stage_timer` context manager (`app/observability/timing.py`).
- **Prometheus metrics** at `GET /metrics`: request counts, in-flight gauge, per-stage
  latency histograms, LLM TTFT/total, token counters, cost counter, and cache hit/miss.
- **Token & cost accounting**: prompt/completion tokens and an estimated USD cost (from a
  configurable price table) are computed per query and surfaced in the `done` SSE event.
- **Live in-app dashboard**: the **Dashboard** tab polls `GET /stats` every ~1.5s and
  renders four live panel groups — per-stage + p50/p95 latency, tokens & cost, cache hit
  ratio, and throughput/errors (recharts). No Grafana required; runs fully locally.
- **Per-answer breakdown**: the chat **retrieval-debug** panel also shows a latency-bar +
  token/cost breakdown for that specific answer, and a ⚡ badge when it was cache-served.

### Caching

Two config-driven caches (`app/cache/`), zero-infra by default (in-process LRU+TTL),
with an optional Redis backend for the embedding cache:

- **Embedding cache** (on by default) — keyed by `sha256(text)`+model; skips recomputing
  embeddings for repeated text (queries *and* document chunks).
- **Semantic answer cache** (off by default) — if a new query is within a cosine
  `answer_cache_similarity_threshold` (default 0.95) of a previously answered query, the
  cached answer is replayed **with its original citations** (grounding can't drift). Off by
  default so eval gating stays deterministic.

Enable both locally:

```bash
EMBEDDING_CACHE_ENABLED=true ANSWER_CACHE_ENABLED=true \
  uvicorn app.main:app --port 8000
```

### Benchmark & load test

`benchmarks/run_benchmark.py` drives the live `/query` API and reports p50/p95/p99
latency, throughput, cost/query, and cache hit rate, with a cache OFF-vs-ON comparison
table:

```bash
# caches OFF
python -m benchmarks.run_benchmark --phase off --out off.json
# restart with caches enabled, then:
python -m benchmarks.run_benchmark --phase on  --out on.json
python -m benchmarks.run_benchmark --compare off.json on.json
```

Representative result (single repeated query, warm answer cache):

| Metric | Value |
|---|---|
| p50 latency (cached) | ~5 ms |
| p95 latency (1 cold miss) | ~2.7 s |
| cache hit rate | 80% |

i.e. a cached query returns in **~5 ms vs ~2.7 s** for a full pipeline run — a ~500× speedup,
with cost/query dropping to $0 on hits.

A `locust` load test (`benchmarks/locustfile.py`, isolated in
`benchmarks/requirements-bench.txt`) is also provided:

```bash
pip install -r benchmarks/requirements-bench.txt
locust -f benchmarks/locustfile.py --host http://localhost:8000 \
       --headless --users 20 --spawn-rate 5 --run-time 2m
```

> **Note:** the installed `groq==0.11.0` SDK doesn't accept `stream_options`, so exact
> provider token usage isn't returned; the app falls back to a word-count heuristic for
> token/cost. Upgrading `groq` to ≥1.x enables exact usage — the code already requests it
> and falls back gracefully.

## CI

GitHub Actions (`.github/workflows/evals.yml`) runs the eval suite on every PR to `main`. It spins up Postgres+pgvector, starts the backend, ingests the sample fixtures, and runs the eval CLI — failing the build if recall, faithfulness, or correctness drop below their thresholds. Requires `GROQ_API_KEY` and `HF_API_KEY` repository secrets.
