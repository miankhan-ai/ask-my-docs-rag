**Build a production-grade "Ask My Docs" RAG application — full-stack, end-to-end.**

I want a fully functional product with frontend, backend, retrieval pipeline, citation enforcement, and a CI-gated evaluation suite. Build it incrementally, explaining architectural decisions as you go, and verify each layer works before moving to the next.

**Core requirements**

1. **Document ingestion pipeline**
   - Support PDF, DOCX, Markdown, and plain text upload.
   - Chunk documents with a configurable strategy (semantic/recursive chunking with overlap); store chunk metadata (source doc, page/section, char offsets) for precise citations.
   - Generate and persist embeddings; make the embedding model swappable via config.

2. **Hybrid retrieval**
   - BM25/keyword search (e.g. via a lexical index) and dense vector search running in parallel.
   - Fuse results with Reciprocal Rank Fusion (or a configurable weighting scheme).
   - Add a **cross-encoder reranker** as a second stage over the fused candidate set; make top-k for each stage configurable.

3. **Generation with citation enforcement**
   - Answers must cite the specific chunks/sources used, with inline citation markers mapping to retrieved passages.
   - Enforce grounding: if retrieved context doesn't support an answer, the system must say so rather than hallucinate. Reject or flag answers whose citations don't map to actual retrieved chunks.
   - Stream responses to the frontend.

4. **Backend**
   - Python (FastAPI) with clear separation: ingestion, retrieval, reranking, generation, and eval modules.
   - Vector store: pick a sensible default (e.g. pgvector or Qdrant) and justify it; keep it swappable behind an interface.
   - Expose REST endpoints for upload, query (streaming), and retrieval inspection (return the raw retrieved + reranked chunks for debugging).
   - Config-driven (env vars + a settings file); no hardcoded keys.

5. **Frontend**
   - Clean chat interface: document upload, query input, streamed answers with clickable citations that reveal the source passage.
   - A "retrieval debug" view showing what was retrieved, fused, and reranked, with scores.
   - Use React/TypeScript with a modern, polished UI.

6. **Evaluation pipeline (CI-gated)**
   - A golden eval set (question → expected answer/sources) stored in the repo.
   - Metrics: retrieval recall@k, citation faithfulness/groundedness, and answer correctness (LLM-as-judge with a documented rubric).
   - A CLI/script that runs evals and outputs pass/fail against thresholds.
   - A GitHub Actions workflow that runs the eval suite on PRs and **fails the build** if metrics drop below configured thresholds.

**Engineering expectations**
- Production project structure, typed code, docstrings, and a thorough README (architecture diagram, setup, running locally, running evals).
- `docker-compose` for one-command local startup (app + vector store).
- Unit/integration tests alongside the eval suite.
- Sensible logging and error handling throughout.

**How to proceed**
- Start by proposing the architecture and tech-stack choices and waiting for my confirmation before scaffolding.
- Then build in this order: ingestion → retrieval → reranking → generation/citations → API → frontend → eval pipeline → CI. Show me each piece works before continuing.
- Ask me about anything ambiguous (embedding/LLM provider, vector store preference, hosting target) rather than assuming.