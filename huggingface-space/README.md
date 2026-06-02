---
title: Ask My Docs Backend
emoji: 📄
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# Ask My Docs — Backend API

This Hugging Face Space hosts the **FastAPI backend** for
[Ask My Docs](https://github.com/miankhan-ai/ask-my-docs-rag): a production-grade
RAG service with hybrid retrieval, cross-encoder reranking, citation enforcement,
streaming generation, observability, and semantic caching.

The marketing site + frontend live separately (e.g. on
`https://askmydocs.miankhan.me`) and call this Space's API.

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness probe |
| `POST` | `/upload` | Multipart document upload |
| `GET` | `/documents` | List ingested documents |
| `DELETE` | `/documents/{id}` | Delete a document |
| `POST` | `/query` | Streaming SSE answer with citations |
| `GET` | `/retrieval-debug` | Raw retrieval candidates |
| `GET` | `/metrics` | Prometheus metrics |
| `GET` | `/stats` | JSON metrics snapshot |

## Configuration (Space → Settings → Variables and secrets)

Set these so the Space can serve your frontend and talk to Groq:

- **`GROQ_API_KEY`** (secret) — your Groq API key, for generation.
- **`CORS_ALLOW_ORIGINS`** (variable) — your frontend origin(s), comma-separated,
  e.g. `https://askmydocs.miankhan.me`.

Everything else (local embeddings, SQLite, in-process cache) is preconfigured in
the Dockerfile and needs no setup.

> Note: the free Space tier has an ephemeral filesystem — uploaded documents and
> the SQLite DB live under `/tmp` and reset when the Space restarts. For
> persistence, attach Space persistent storage and point `DATABASE_URL_OVERRIDE`
> and `BM25_INDEX_PATH` at `/data`.
