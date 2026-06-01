# Ask My Docs RAG Application — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-grade RAG application where users upload documents, ask questions, and receive streamed answers with inline citations backed by retrieved passages.

**Architecture:** FastAPI backend with hybrid BM25 + pgvector retrieval fused via RRF, cross-encoder reranking, and Groq-powered generation with citation enforcement. React/TypeScript/Vite frontend with a chat interface, upload panel, and retrieval debug view. CI-gated evaluation suite checks retrieval recall, citation faithfulness, and answer correctness on every PR.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy (async), pgvector, rank-bm25, sentence-transformers, Groq API, HuggingFace Inference API, React 18, TypeScript, Vite, TailwindCSS, Docker Compose, GitHub Actions

---

## Phase Order

Each phase is independently testable and produces working software:

1. **Phase 1 — Project scaffold + config** (foundation for all phases)
2. **Phase 2 — Document ingestion pipeline** (upload → parse → chunk → embed → store)
3. **Phase 3 — Hybrid retrieval + reranking** (BM25 + dense + RRF + cross-encoder)
4. **Phase 4 — Generation with citation enforcement** (Groq streaming + SSE)
5. **Phase 5 — Frontend** (React chat UI + upload + debug view)
6. **Phase 6 — Evaluation pipeline + CI** (golden set + metrics + GitHub Actions)

---

## File Map

```
ask-my-docs/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + router registration + lifespan
│   │   ├── config.py            # pydantic-settings Settings class
│   │   ├── database.py          # Async SQLAlchemy engine, session factory, pgvector init
│   │   ├── models.py            # ORM: Document, Chunk tables
│   │   ├── ingestion.py         # parse_file(), chunk_text(), embed_chunks(), ingest_document()
│   │   ├── retrieval.py         # bm25_search(), dense_search(), rrf_fuse(), BM25IndexManager
│   │   ├── reranking.py         # CrossEncoderReranker class, rerank()
│   │   └── generation.py        # build_prompt(), stream_generate(), validate_citations()
│   ├── tests/
│   │   ├── conftest.py          # pytest fixtures: async db session, test settings
│   │   ├── test_ingestion.py    # parse, chunk, embed unit tests
│   │   ├── test_retrieval.py    # BM25, dense, RRF unit tests
│   │   ├── test_reranking.py    # cross-encoder reranker unit tests
│   │   ├── test_generation.py   # prompt builder, citation validator unit tests
│   │   └── test_api.py          # FastAPI integration tests (httpx AsyncClient)
│   ├── evals/
│   │   ├── golden_set.json      # 20 Q&A pairs with expected_source_docs
│   │   ├── run_evals.py         # CLI: loads golden set, hits live API, scores metrics
│   │   └── rubric.md            # LLM-as-judge rubric (faithfulness + correctness)
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── index.ts         # uploadDocument(), streamQuery(), getRetrievalDebug()
│   │   ├── hooks/
│   │   │   ├── useStream.ts     # SSE connection, token accumulation, citation assembly
│   │   │   └── useDocuments.ts  # uploaded document list state
│   │   ├── components/
│   │   │   ├── UploadPanel.tsx  # drag-drop upload, progress, doc list
│   │   │   ├── ChatWindow.tsx   # query input + streamed answer + citation badges
│   │   │   ├── CitationDrawer.tsx # side drawer: passage + source + page
│   │   │   └── DebugView.tsx    # collapsible retrieval debug table
│   │   └── App.tsx              # layout: UploadPanel + ChatWindow + CitationDrawer
│   ├── Dockerfile
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── docker-compose.yml
├── .github/workflows/evals.yml
├── .env.example
└── README.md
```

---

## Phase 1: Project Scaffold + Config

### Task 1: Repo structure + Docker Compose + .env

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `backend/requirements.txt`
- Create: `backend/app/config.py`
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`

- [ ] **Step 1: Create project directories**

```bash
mkdir -p backend/app backend/tests backend/evals frontend/src
```

- [ ] **Step 2: Create `docker-compose.yml`**

```yaml
# docker-compose.yml
version: "3.9"

services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: askdocs
      POSTGRES_PASSWORD: askdocs
      POSTGRES_DB: askdocs
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U askdocs"]
      interval: 5s
      timeout: 5s
      retries: 10

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./backend:/app
      - bm25_data:/app/data

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend

volumes:
  pgdata:
  bm25_data:
```

- [ ] **Step 3: Create `.env.example`**

```env
# LLM
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile

# Embeddings
HF_API_KEY=your_hf_api_key
HF_EMBEDDING_MODEL=BAAI/bge-large-en-v1.5

# Database
DATABASE_URL=postgresql+asyncpg://askdocs:askdocs@postgres:5432/askdocs

# Retrieval
BM25_TOP_N=20
DENSE_TOP_N=20
RRF_K=60
RERANKER_TOP_K=5
CHUNK_SIZE=512
CHUNK_OVERLAP=64
EMBEDDING_BATCH_SIZE=100

# BM25 persistence
BM25_INDEX_PATH=data/bm25_index.pkl
```

- [ ] **Step 4: Create `backend/requirements.txt`**

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
sqlalchemy[asyncio]==2.0.36
asyncpg==0.30.0
pgvector==0.3.5
pydantic-settings==2.5.2
python-multipart==0.0.12
pypdf2==3.0.1
python-docx==1.1.2
langchain-text-splitters==0.3.2
rank-bm25==0.2.2
sentence-transformers==3.2.1
httpx==0.27.2
groq==0.11.0
pytest==8.3.3
pytest-asyncio==0.24.0
anyio==4.6.2
```

- [ ] **Step 5: Create `backend/app/config.py`**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    groq_api_key: str
    groq_model: str = "llama-3.3-70b-versatile"

    hf_api_key: str
    hf_embedding_model: str = "BAAI/bge-large-en-v1.5"

    database_url: str

    bm25_top_n: int = 20
    dense_top_n: int = 20
    rrf_k: int = 60
    reranker_top_k: int = 5
    chunk_size: int = 512
    chunk_overlap: int = 64
    embedding_batch_size: int = 100
    bm25_index_path: str = "data/bm25_index.pkl"


settings = Settings()
```

- [ ] **Step 6: Create `backend/Dockerfile`**

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN mkdir -p data
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

- [ ] **Step 7: Verify config loads**

```bash
cd backend
pip install pydantic-settings python-dotenv
cp ../.env.example .env
# Edit .env with real keys, then:
python -c "from app.config import settings; print(settings.groq_model)"
```

Expected output: `llama-3.3-70b-versatile`

- [ ] **Step 8: Commit**

```bash
git add docker-compose.yml .env.example backend/ frontend/
git commit -m "feat: project scaffold — docker-compose, config, requirements"
```

---

### Task 2: Database models + async engine

**Files:**
- Create: `backend/app/database.py`
- Create: `backend/app/models.py`
- Create: `backend/app/main.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_api.py` (smoke test)

- [ ] **Step 1: Write failing test for DB table creation**

```python
# backend/tests/conftest.py
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.models import Base

TEST_DATABASE_URL = "postgresql+asyncpg://askdocs:askdocs@localhost:5432/askdocs_test"

@pytest_asyncio.fixture(scope="session")
async def engine():
    eng = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await eng.dispose()

@pytest_asyncio.fixture
async def db_session(engine):
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as session:
        yield session
```

```python
# backend/tests/test_api.py
import pytest

@pytest.mark.asyncio
async def test_db_tables_created(db_session):
    from sqlalchemy import text
    result = await db_session.execute(
        text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
    )
    tables = {row[0] for row in result.fetchall()}
    assert "documents" in tables
    assert "chunks" in tables
```

- [ ] **Step 2: Run test — expect FAIL (models not defined yet)**

```bash
cd backend
pytest tests/test_api.py::test_db_tables_created -v
```

Expected: `ModuleNotFoundError: No module named 'app.models'`

- [ ] **Step 3: Create `backend/app/models.py`**

```python
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector
import enum


class DocumentStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    ready = "ready"
    failed = "failed"


class Base(DeclarativeBase):
    pass


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    filetype: Mapped[str] = mapped_column(String(32), nullable=False)
    upload_timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    status: Mapped[DocumentStatus] = mapped_column(
        SAEnum(DocumentStatus), default=DocumentStatus.pending
    )
    chunks: Mapped[list["Chunk"]] = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")


class Chunk(Base):
    __tablename__ = "chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    page_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    char_start: Mapped[int] = mapped_column(Integer, nullable=False)
    char_end: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(1024), nullable=True)
    document: Mapped["Document"] = relationship("Document", back_populates="chunks")
```

- [ ] **Step 4: Create `backend/app/database.py`**

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
from app.config import settings
from app.models import Base

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
```

- [ ] **Step 5: Create `backend/app/main.py`**

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
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
    return {"status": "ok"}
```

- [ ] **Step 6: Run test — expect PASS**

```bash
cd backend
pytest tests/test_api.py::test_db_tables_created -v
```

Expected: `PASSED`

- [ ] **Step 7: Commit**

```bash
git add backend/app/database.py backend/app/models.py backend/app/main.py backend/tests/
git commit -m "feat: database models + async engine + lifespan init"
```

---

## Phase 2: Document Ingestion Pipeline

### Task 3: File parsing

**Files:**
- Create: `backend/app/ingestion.py` (parse section only)
- Create: `backend/tests/test_ingestion.py`
- Create: `backend/tests/fixtures/sample.pdf` (minimal test fixture)
- Create: `backend/tests/fixtures/sample.docx`
- Create: `backend/tests/fixtures/sample.md`
- Create: `backend/tests/fixtures/sample.txt`

- [ ] **Step 1: Write failing tests for parsers**

```python
# backend/tests/test_ingestion.py
import pytest
from pathlib import Path
from app.ingestion import parse_file

FIXTURES = Path(__file__).parent / "fixtures"

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
```

- [ ] **Step 2: Create test fixtures**

```bash
# Create fixtures directory
mkdir -p backend/tests/fixtures

# sample.txt
echo "Hello from plain text document." > backend/tests/fixtures/sample.txt

# sample.md
echo "# Hello\n\nHello from markdown document." > backend/tests/fixtures/sample.md
```

For `sample.pdf` and `sample.docx`, create them with a short Python script:

```python
# run once: python backend/tests/create_fixtures.py
from pathlib import Path
import docx

# DOCX
doc = docx.Document()
doc.add_paragraph("Hello from docx document.")
doc.save("backend/tests/fixtures/sample.docx")

# PDF — use pypdf2 to create minimal test PDF
# Since creating PDFs from scratch requires reportlab, use fpdf2 instead
# pip install fpdf2
from fpdf import FPDF
pdf = FPDF()
pdf.add_page()
pdf.set_font("Helvetica", size=12)
pdf.cell(200, 10, "Hello from PDF document.")
pdf.output("backend/tests/fixtures/sample.pdf")
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
cd backend
pytest tests/test_ingestion.py -v
```

Expected: `ImportError: cannot import name 'parse_file' from 'app.ingestion'`

- [ ] **Step 4: Implement `parse_file()` in `backend/app/ingestion.py`**

```python
from pathlib import Path
from typing import Any
import PyPDF2
import docx as python_docx


def parse_file(path: Path) -> list[dict[str, Any]]:
    """Parse uploaded file into list of {text, page_number} dicts."""
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return _parse_pdf(path)
    elif suffix in (".docx",):
        return _parse_docx(path)
    elif suffix in (".md", ".txt"):
        return _parse_text(path)
    else:
        raise ValueError(f"Unsupported file type: {suffix}")


def _parse_pdf(path: Path) -> list[dict[str, Any]]:
    pages = []
    with open(path, "rb") as f:
        reader = PyPDF2.PdfReader(f)
        for i, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            pages.append({"text": text, "page_number": i + 1})
    return pages


def _parse_docx(path: Path) -> list[dict[str, Any]]:
    doc = python_docx.Document(str(path))
    text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    return [{"text": text, "page_number": None}]


def _parse_text(path: Path) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8")
    return [{"text": text, "page_number": None}]
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd backend
pytest tests/test_ingestion.py::test_parse_txt tests/test_ingestion.py::test_parse_markdown tests/test_ingestion.py::test_parse_pdf tests/test_ingestion.py::test_parse_docx tests/test_ingestion.py::test_parse_unsupported_raises -v
```

Expected: All `PASSED`

- [ ] **Step 6: Commit**

```bash
git add backend/app/ingestion.py backend/tests/test_ingestion.py backend/tests/fixtures/
git commit -m "feat: file parsers for PDF, DOCX, MD, TXT"
```

---

### Task 4: Chunking

**Files:**
- Modify: `backend/app/ingestion.py` (add `chunk_pages()`)
- Modify: `backend/tests/test_ingestion.py` (add chunking tests)

- [ ] **Step 1: Write failing tests for chunking**

```python
# Add to backend/tests/test_ingestion.py
from app.ingestion import chunk_pages

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
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd backend
pytest tests/test_ingestion.py::test_chunk_pages_basic -v
```

Expected: `ImportError: cannot import name 'chunk_pages'`

- [ ] **Step 3: Implement `chunk_pages()` in `backend/app/ingestion.py`**

Add after `_parse_text`:

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter


def chunk_pages(
    pages: list[dict[str, Any]],
    chunk_size: int = 512,
    chunk_overlap: int = 64,
) -> list[dict[str, Any]]:
    """Split parsed pages into overlapping chunks with char offset metadata."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        add_start_index=True,
    )
    chunks = []
    chunk_index = 0
    for page in pages:
        text = page["text"]
        docs = splitter.create_documents([text])
        for doc in docs:
            start = doc.metadata.get("start_index", 0)
            end = start + len(doc.page_content)
            chunks.append({
                "text": doc.page_content,
                "page_number": page["page_number"],
                "char_start": start,
                "char_end": end,
                "chunk_index": chunk_index,
            })
            chunk_index += 1
    return chunks
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend
pytest tests/test_ingestion.py -k "chunk" -v
```

Expected: All `PASSED`

- [ ] **Step 5: Commit**

```bash
git add backend/app/ingestion.py backend/tests/test_ingestion.py
git commit -m "feat: recursive chunking with char offset metadata"
```

---

### Task 5: Embedding + DB write (ingest_document)

**Files:**
- Modify: `backend/app/ingestion.py` (add `embed_chunks()`, `ingest_document()`)
- Modify: `backend/tests/test_ingestion.py` (embedding + ingest tests)

- [ ] **Step 1: Write failing tests for embedding**

```python
# Add to backend/tests/test_ingestion.py
from unittest.mock import AsyncMock, patch
from app.ingestion import embed_chunks

@pytest.mark.asyncio
async def test_embed_chunks_batches_correctly():
    chunks = [{"text": f"chunk {i}"} for i in range(5)]
    fake_embeddings = [[0.1] * 1024 for _ in range(5)]

    with patch("app.ingestion._call_hf_embedding_api", new_callable=AsyncMock) as mock_api:
        mock_api.return_value = fake_embeddings
        result = await embed_chunks(chunks, batch_size=3)

    assert mock_api.call_count == 2  # 5 chunks, batch_size=3 → 2 calls
    assert len(result) == 5
    assert all(len(e) == 1024 for e in result)
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd backend
pytest tests/test_ingestion.py::test_embed_chunks_batches_correctly -v
```

Expected: `ImportError: cannot import name 'embed_chunks'`

- [ ] **Step 3: Implement `embed_chunks()` and `_call_hf_embedding_api()` in `backend/app/ingestion.py`**

```python
import httpx
from app.config import settings


async def _call_hf_embedding_api(texts: list[str]) -> list[list[float]]:
    """Call HuggingFace Inference API for embeddings."""
    url = f"https://api-inference.huggingface.co/models/{settings.hf_embedding_model}"
    headers = {"Authorization": f"Bearer {settings.hf_api_key}"}
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, headers=headers, json={"inputs": texts, "options": {"wait_for_model": True}})
        response.raise_for_status()
        return response.json()


async def embed_chunks(
    chunks: list[dict[str, Any]],
    batch_size: int | None = None,
) -> list[list[float]]:
    """Embed chunk texts in batches; returns list of 1024-dim vectors."""
    if batch_size is None:
        batch_size = settings.embedding_batch_size
    texts = [c["text"] for c in chunks]
    embeddings: list[list[float]] = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        batch_embeddings = await _call_hf_embedding_api(batch)
        embeddings.extend(batch_embeddings)
    return embeddings
```

- [ ] **Step 4: Write failing test for `ingest_document()`**

```python
# Add to backend/tests/test_ingestion.py
from app.ingestion import ingest_document
from app.models import Document, DocumentStatus

@pytest.mark.asyncio
async def test_ingest_document_creates_chunks(db_session):
    fake_embeddings = [[0.1] * 1024 for _ in range(10)]  # enough for any chunk count

    with patch("app.ingestion._call_hf_embedding_api", new_callable=AsyncMock) as mock_api:
        mock_api.return_value = fake_embeddings
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
```

- [ ] **Step 5: Implement `ingest_document()` in `backend/app/ingestion.py`**

```python
import tempfile
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Document, DocumentStatus, Chunk


async def ingest_document(
    db: AsyncSession,
    filename: str,
    filetype: str,
    file_bytes: bytes,
) -> tuple[int, int]:
    """Parse, chunk, embed, and store a document. Returns (document_id, chunk_count)."""
    doc = Document(filename=filename, filetype=filetype, status=DocumentStatus.processing)
    db.add(doc)
    await db.flush()

    try:
        with tempfile.NamedTemporaryFile(suffix=filetype, delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = Path(tmp.name)

        pages = parse_file(tmp_path)
        tmp_path.unlink(missing_ok=True)

        chunks_meta = chunk_pages(
            pages,
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
        )
        embeddings = await embed_chunks(chunks_meta)

        chunk_objects = [
            Chunk(
                document_id=doc.id,
                text=meta["text"],
                page_number=meta["page_number"],
                char_start=meta["char_start"],
                char_end=meta["char_end"],
                chunk_index=meta["chunk_index"],
                embedding=emb,
            )
            for meta, emb in zip(chunks_meta, embeddings)
        ]
        db.add_all(chunk_objects)
        doc.status = DocumentStatus.ready
        await db.commit()
        return doc.id, len(chunk_objects)

    except Exception:
        doc.status = DocumentStatus.failed
        await db.commit()
        raise
```

- [ ] **Step 6: Run all ingestion tests — expect PASS**

```bash
cd backend
pytest tests/test_ingestion.py -v
```

Expected: All `PASSED`

- [ ] **Step 7: Commit**

```bash
git add backend/app/ingestion.py backend/tests/test_ingestion.py
git commit -m "feat: embedding via HF API + ingest_document DB write"
```

---

### Task 6: BM25 index manager

**Files:**
- Create: `backend/app/retrieval.py` (BM25IndexManager only)
- Create: `backend/tests/test_retrieval.py`

- [ ] **Step 1: Write failing tests for BM25IndexManager**

```python
# backend/tests/test_retrieval.py
import pytest
from app.retrieval import BM25IndexManager

def test_bm25_search_returns_ranked_results():
    manager = BM25IndexManager()
    manager.build([
        {"id": 1, "text": "the quick brown fox"},
        {"id": 2, "text": "lazy dog sleeping"},
        {"id": 3, "text": "fox running quickly through forest"},
    ])
    results = manager.search("fox", top_n=2)
    assert len(results) == 2
    ids = [r["chunk_id"] for r in results]
    assert 1 in ids or 3 in ids  # fox-related docs ranked higher

def test_bm25_search_includes_score():
    manager = BM25IndexManager()
    manager.build([{"id": 1, "text": "hello world"}, {"id": 2, "text": "foo bar"}])
    results = manager.search("hello", top_n=2)
    assert all("score" in r for r in results)

def test_bm25_save_load_roundtrip(tmp_path):
    manager = BM25IndexManager()
    manager.build([{"id": 1, "text": "hello world"}])
    path = tmp_path / "bm25.pkl"
    manager.save(str(path))

    manager2 = BM25IndexManager()
    manager2.load(str(path))
    results = manager2.search("hello", top_n=1)
    assert results[0]["chunk_id"] == 1

def test_bm25_empty_index_returns_empty():
    manager = BM25IndexManager()
    manager.build([])
    results = manager.search("anything", top_n=5)
    assert results == []
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd backend
pytest tests/test_retrieval.py -v
```

Expected: `ModuleNotFoundError: No module named 'app.retrieval'`

- [ ] **Step 3: Implement `BM25IndexManager` in `backend/app/retrieval.py`**

```python
import pickle
from pathlib import Path
from typing import Any
from rank_bm25 import BM25Okapi


class BM25IndexManager:
    def __init__(self) -> None:
        self._index: BM25Okapi | None = None
        self._chunk_ids: list[int] = []

    def build(self, chunks: list[dict[str, Any]]) -> None:
        """Build BM25 index from list of {id, text} dicts."""
        if not chunks:
            self._index = None
            self._chunk_ids = []
            return
        self._chunk_ids = [c["id"] for c in chunks]
        tokenized = [c["text"].lower().split() for c in chunks]
        self._index = BM25Okapi(tokenized)

    def search(self, query: str, top_n: int) -> list[dict[str, Any]]:
        """Return top_n results as [{chunk_id, score}]."""
        if self._index is None or not self._chunk_ids:
            return []
        tokens = query.lower().split()
        scores = self._index.get_scores(tokens)
        ranked = sorted(
            zip(self._chunk_ids, scores), key=lambda x: x[1], reverse=True
        )[:top_n]
        return [{"chunk_id": cid, "score": float(score)} for cid, score in ranked]

    def save(self, path: str) -> None:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump({"index": self._index, "chunk_ids": self._chunk_ids}, f)

    def load(self, path: str) -> None:
        with open(path, "rb") as f:
            data = pickle.load(f)
        self._index = data["index"]
        self._chunk_ids = data["chunk_ids"]
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend
pytest tests/test_retrieval.py -v
```

Expected: All `PASSED`

- [ ] **Step 5: Commit**

```bash
git add backend/app/retrieval.py backend/tests/test_retrieval.py
git commit -m "feat: BM25IndexManager with build/search/save/load"
```

---

## Phase 3: Hybrid Retrieval + Reranking

### Task 7: Dense vector search + RRF fusion

**Files:**
- Modify: `backend/app/retrieval.py` (add `dense_search()`, `rrf_fuse()`, `hybrid_retrieve()`)
- Modify: `backend/tests/test_retrieval.py`

- [ ] **Step 1: Write failing tests**

```python
# Add to backend/tests/test_retrieval.py
from app.retrieval import rrf_fuse, hybrid_retrieve
from unittest.mock import AsyncMock, patch

def test_rrf_fuse_combines_lists():
    bm25 = [{"chunk_id": 1, "score": 0.9}, {"chunk_id": 2, "score": 0.7}, {"chunk_id": 3, "score": 0.5}]
    dense = [{"chunk_id": 2, "score": 0.95}, {"chunk_id": 3, "score": 0.85}, {"chunk_id": 4, "score": 0.6}]
    fused = rrf_fuse(bm25_results=bm25, dense_results=dense, k=60, top_n=4)
    assert len(fused) == 4
    ids = [r["chunk_id"] for r in fused]
    assert 2 in ids  # chunk_id 2 appears in both — should be ranked high
    assert all("rrf_score" in r for r in fused)

def test_rrf_fuse_handles_empty_lists():
    fused = rrf_fuse(bm25_results=[], dense_results=[], k=60, top_n=5)
    assert fused == []

def test_rrf_fuse_rank_order():
    # chunk 1 is rank 1 in both lists — should have highest RRF score
    bm25 = [{"chunk_id": 1, "score": 1.0}, {"chunk_id": 2, "score": 0.5}]
    dense = [{"chunk_id": 1, "score": 1.0}, {"chunk_id": 3, "score": 0.5}]
    fused = rrf_fuse(bm25_results=bm25, dense_results=dense, k=60, top_n=3)
    assert fused[0]["chunk_id"] == 1
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd backend
pytest tests/test_retrieval.py -k "rrf" -v
```

Expected: `ImportError: cannot import name 'rrf_fuse'`

- [ ] **Step 3: Implement `rrf_fuse()` in `backend/app/retrieval.py`**

Add after `BM25IndexManager`:

```python
def rrf_fuse(
    bm25_results: list[dict[str, Any]],
    dense_results: list[dict[str, Any]],
    k: int = 60,
    top_n: int = 20,
) -> list[dict[str, Any]]:
    """Reciprocal Rank Fusion over BM25 + dense candidate lists."""
    scores: dict[int, float] = {}
    for rank, item in enumerate(bm25_results):
        scores[item["chunk_id"]] = scores.get(item["chunk_id"], 0.0) + 1.0 / (k + rank + 1)
    for rank, item in enumerate(dense_results):
        scores[item["chunk_id"]] = scores.get(item["chunk_id"], 0.0) + 1.0 / (k + rank + 1)
    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_n]
    return [{"chunk_id": cid, "rrf_score": score} for cid, score in ranked]
```

- [ ] **Step 4: Write + implement `dense_search()` and `hybrid_retrieve()`**

Write the failing test first:

```python
# Add to backend/tests/test_retrieval.py
@pytest.mark.asyncio
async def test_hybrid_retrieve_returns_fused_results(db_session):
    from app.retrieval import BM25IndexManager, hybrid_retrieve

    manager = BM25IndexManager()
    manager.build([
        {"id": 1, "text": "the quick brown fox"},
        {"id": 2, "text": "lazy dog sleeping"},
    ])

    with patch("app.retrieval._embed_query", new_callable=AsyncMock) as mock_embed:
        mock_embed.return_value = [0.1] * 1024
        with patch("app.retrieval._dense_search_db", new_callable=AsyncMock) as mock_dense:
            mock_dense.return_value = [{"chunk_id": 1, "score": 0.9}, {"chunk_id": 2, "score": 0.7}]
            results = await hybrid_retrieve(
                query="fox",
                db=db_session,
                bm25_manager=manager,
                bm25_top_n=5,
                dense_top_n=5,
                rrf_k=60,
                top_n=5,
            )
    assert isinstance(results, list)
    assert all("chunk_id" in r for r in results)
```

Run it — expect FAIL:

```bash
cd backend
pytest tests/test_retrieval.py::test_hybrid_retrieve_returns_fused_results -v
```

Now implement:

```python
# Add to backend/app/retrieval.py
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.config import settings


async def _embed_query(query: str) -> list[float]:
    """Embed a single query string via HuggingFace API."""
    url = f"https://api-inference.huggingface.co/models/{settings.hf_embedding_model}"
    headers = {"Authorization": f"Bearer {settings.hf_api_key}"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, headers=headers, json={"inputs": [query], "options": {"wait_for_model": True}})
        resp.raise_for_status()
        return resp.json()[0]


async def _dense_search_db(
    db: AsyncSession,
    query_embedding: list[float],
    top_n: int,
) -> list[dict[str, Any]]:
    """pgvector cosine similarity search."""
    vec_str = "[" + ",".join(str(v) for v in query_embedding) + "]"
    result = await db.execute(
        text(
            f"""
            SELECT id, 1 - (embedding <=> :vec::vector) AS score
            FROM chunks
            ORDER BY embedding <=> :vec::vector
            LIMIT :top_n
            """
        ),
        {"vec": vec_str, "top_n": top_n},
    )
    rows = result.fetchall()
    return [{"chunk_id": row[0], "score": float(row[1])} for row in rows]


async def hybrid_retrieve(
    query: str,
    db: AsyncSession,
    bm25_manager: "BM25IndexManager",
    bm25_top_n: int,
    dense_top_n: int,
    rrf_k: int,
    top_n: int,
) -> list[dict[str, Any]]:
    """Run BM25 + dense search in parallel, fuse with RRF."""
    import asyncio
    query_embedding = await _embed_query(query)
    bm25_results, dense_results = await asyncio.gather(
        asyncio.to_thread(bm25_manager.search, query, bm25_top_n),
        _dense_search_db(db, query_embedding, dense_top_n),
    )
    return rrf_fuse(bm25_results, dense_results, k=rrf_k, top_n=top_n)
```

- [ ] **Step 5: Run all retrieval tests — expect PASS**

```bash
cd backend
pytest tests/test_retrieval.py -v
```

Expected: All `PASSED`

- [ ] **Step 6: Commit**

```bash
git add backend/app/retrieval.py backend/tests/test_retrieval.py
git commit -m "feat: dense search + RRF fusion + hybrid_retrieve"
```

---

### Task 8: Cross-encoder reranker

**Files:**
- Create: `backend/app/reranking.py`
- Create: `backend/tests/test_reranking.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_reranking.py
import pytest
from app.reranking import CrossEncoderReranker

def test_reranker_returns_top_k():
    reranker = CrossEncoderReranker(model_name="cross-encoder/ms-marco-MiniLM-L-6-v2")
    candidates = [
        {"chunk_id": i, "text": f"some passage about topic {i}"}
        for i in range(10)
    ]
    results = reranker.rerank(query="topic 5", candidates=candidates, top_k=3)
    assert len(results) == 3

def test_reranker_includes_score():
    reranker = CrossEncoderReranker(model_name="cross-encoder/ms-marco-MiniLM-L-6-v2")
    candidates = [
        {"chunk_id": 1, "text": "Paris is the capital of France"},
        {"chunk_id": 2, "text": "The sky is blue"},
    ]
    results = reranker.rerank(query="What is the capital of France?", candidates=candidates, top_k=2)
    assert all("cross_encoder_score" in r for r in results)
    # The France passage should score higher
    assert results[0]["chunk_id"] == 1

def test_reranker_handles_empty():
    reranker = CrossEncoderReranker(model_name="cross-encoder/ms-marco-MiniLM-L-6-v2")
    results = reranker.rerank(query="anything", candidates=[], top_k=5)
    assert results == []
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd backend
pytest tests/test_reranking.py -v
```

Expected: `ModuleNotFoundError: No module named 'app.reranking'`

- [ ] **Step 3: Implement `CrossEncoderReranker` in `backend/app/reranking.py`**

```python
from typing import Any
from sentence_transformers import CrossEncoder


class CrossEncoderReranker:
    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2") -> None:
        self._model = CrossEncoder(model_name)

    def rerank(
        self,
        query: str,
        candidates: list[dict[str, Any]],
        top_k: int,
    ) -> list[dict[str, Any]]:
        """Re-score (query, passage) pairs; return top_k sorted by score desc."""
        if not candidates:
            return []
        pairs = [(query, c["text"]) for c in candidates]
        scores = self._model.predict(pairs)
        scored = [
            {**c, "cross_encoder_score": float(s)}
            for c, s in zip(candidates, scores)
        ]
        scored.sort(key=lambda x: x["cross_encoder_score"], reverse=True)
        return scored[:top_k]
```

- [ ] **Step 4: Run tests — expect PASS**

Note: First run downloads the model (~80 MB). Allow up to 2 minutes.

```bash
cd backend
pytest tests/test_reranking.py -v
```

Expected: All `PASSED`

- [ ] **Step 5: Commit**

```bash
git add backend/app/reranking.py backend/tests/test_reranking.py
git commit -m "feat: cross-encoder reranker with sentence-transformers"
```

---

## Phase 4: Generation with Citation Enforcement

### Task 9: Prompt builder + citation validator

**Files:**
- Create: `backend/app/generation.py`
- Create: `backend/tests/test_generation.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_generation.py
import pytest
from app.generation import build_prompt, validate_citations

def test_build_prompt_injects_chunks_with_markers():
    chunks = [
        {"id": 1, "text": "Paris is the capital of France.", "source": "geo.pdf", "page_number": 1},
        {"id": 2, "text": "France is in Western Europe.", "source": "geo.pdf", "page_number": 2},
    ]
    system, user = build_prompt(question="What is the capital of France?", chunks=chunks)
    assert "[1]" in system
    assert "[2]" in system
    assert "Paris is the capital" in system
    assert "France is in Western Europe" in system
    assert "What is the capital of France?" in user

def test_build_prompt_includes_grounding_instruction():
    chunks = [{"id": 1, "text": "Some text.", "source": "doc.pdf", "page_number": 1}]
    system, _ = build_prompt(question="any question", chunks=chunks)
    assert "I don't have enough information" in system or "don't have enough" in system.lower()

def test_validate_citations_all_valid():
    answer = "Paris is the capital [1]. It is in Europe [2]."
    chunks = [
        {"id": 1, "text": "...", "source": "a.pdf", "page_number": 1},
        {"id": 2, "text": "...", "source": "a.pdf", "page_number": 2},
    ]
    warning = validate_citations(answer=answer, chunks=chunks)
    assert warning is False

def test_validate_citations_out_of_range():
    answer = "Something [3]."
    chunks = [{"id": 1, "text": "...", "source": "a.pdf", "page_number": 1}]
    warning = validate_citations(answer=answer, chunks=chunks)
    assert warning is True

def test_validate_citations_no_citations_in_answer():
    answer = "Here is an answer with no citation markers."
    chunks = [{"id": 1, "text": "...", "source": "a.pdf", "page_number": 1}]
    warning = validate_citations(answer=answer, chunks=chunks)
    assert warning is True

def test_validate_citations_no_chunks_no_warning():
    # If no chunks retrieved, no citations expected
    answer = "I don't have enough information to answer this."
    chunks = []
    warning = validate_citations(answer=answer, chunks=chunks)
    assert warning is False
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd backend
pytest tests/test_generation.py -v
```

Expected: `ModuleNotFoundError: No module named 'app.generation'`

- [ ] **Step 3: Implement `build_prompt()` and `validate_citations()` in `backend/app/generation.py`**

```python
import re
from typing import Any


def build_prompt(
    question: str,
    chunks: list[dict[str, Any]],
) -> tuple[str, str]:
    """Build (system_prompt, user_message) for Groq generation."""
    context_lines = []
    for i, chunk in enumerate(chunks, start=1):
        source = chunk.get("source", "unknown")
        page = chunk.get("page_number")
        page_str = f", page {page}" if page else ""
        context_lines.append(f"[{i}] (source: {source}{page_str})\n{chunk['text']}")

    context_block = "\n\n".join(context_lines)

    system_prompt = f"""You are a document assistant. Answer questions using ONLY the provided context.
Cite inline using [1], [2], etc. corresponding to the context passages numbered below.
If the context does not support an answer, respond with exactly:
"I don't have enough information to answer this from the provided documents."

CONTEXT:
{context_block}"""

    return system_prompt, question


def validate_citations(answer: str, chunks: list[dict[str, Any]]) -> bool:
    """Return True (citation_warning) if citations are invalid or missing.

    Warning cases:
    - Answer contains [N] where N > len(chunks)
    - Answer has no citations but chunks were provided (LLM failed to cite)
    """
    citation_numbers = [int(m) for m in re.findall(r"\[(\d+)\]", answer)]

    if chunks and not citation_numbers:
        return True

    if not chunks:
        return False

    for n in citation_numbers:
        if n < 1 or n > len(chunks):
            return True

    return False
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend
pytest tests/test_generation.py -v
```

Expected: All `PASSED`

- [ ] **Step 5: Commit**

```bash
git add backend/app/generation.py backend/tests/test_generation.py
git commit -m "feat: prompt builder + citation validator"
```

---

### Task 10: Groq streaming generation

**Files:**
- Modify: `backend/app/generation.py` (add `stream_generate()`)
- Modify: `backend/tests/test_generation.py`

- [ ] **Step 1: Write failing test for streaming**

```python
# Add to backend/tests/test_generation.py
from unittest.mock import AsyncMock, MagicMock, patch
import json

@pytest.mark.asyncio
async def test_stream_generate_yields_tokens_then_done():
    from app.generation import stream_generate

    chunks = [{"id": 1, "text": "Paris is the capital.", "source": "geo.pdf", "page_number": 1}]

    mock_chunk_1 = MagicMock()
    mock_chunk_1.choices = [MagicMock()]
    mock_chunk_1.choices[0].delta.content = "Paris"
    mock_chunk_2 = MagicMock()
    mock_chunk_2.choices = [MagicMock()]
    mock_chunk_2.choices[0].delta.content = " is the capital [1]."
    mock_chunk_done = MagicMock()
    mock_chunk_done.choices = [MagicMock()]
    mock_chunk_done.choices[0].delta.content = None

    async def mock_stream():
        for c in [mock_chunk_1, mock_chunk_2, mock_chunk_done]:
            yield c

    with patch("app.generation._groq_stream", return_value=mock_stream()):
        events = []
        async for event in stream_generate(question="Capital of France?", chunks=chunks):
            events.append(json.loads(event))

    token_events = [e for e in events if e["type"] == "token"]
    done_events = [e for e in events if e["type"] == "done"]
    assert len(token_events) >= 1
    assert len(done_events) == 1
    assert done_events[0]["citation_warning"] is False
    assert len(done_events[0]["citations"]) == 1
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd backend
pytest tests/test_generation.py::test_stream_generate_yields_tokens_then_done -v
```

Expected: `ImportError: cannot import name 'stream_generate'`

- [ ] **Step 3: Implement `stream_generate()` in `backend/app/generation.py`**

```python
import json
from typing import AsyncIterator, Any
from groq import AsyncGroq
from app.config import settings


async def _groq_stream(system_prompt: str, user_message: str):
    """Thin wrapper around Groq streaming so tests can mock it."""
    client = AsyncGroq(api_key=settings.groq_api_key)
    async with client.chat.completions.stream(
        model=settings.groq_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
    ) as stream:
        async for chunk in stream:
            yield chunk


async def stream_generate(
    question: str,
    chunks: list[dict[str, Any]],
) -> AsyncIterator[str]:
    """Stream SSE-formatted JSON events: token events + final done event."""
    system_prompt, user_message = build_prompt(question=question, chunks=chunks)
    full_answer = []

    async for chunk in _groq_stream(system_prompt, user_message):
        content = chunk.choices[0].delta.content
        if content is None:
            break
        full_answer.append(content)
        yield json.dumps({"type": "token", "content": content})

    answer = "".join(full_answer)
    citation_warning = validate_citations(answer=answer, chunks=chunks)

    citations = [
        {
            "id": i + 1,
            "text": c["text"],
            "source": c.get("source", "unknown"),
            "page": c.get("page_number"),
        }
        for i, c in enumerate(chunks)
    ]
    yield json.dumps({
        "type": "done",
        "citations": citations,
        "citation_warning": citation_warning,
    })
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend
pytest tests/test_generation.py -v
```

Expected: All `PASSED`

- [ ] **Step 5: Commit**

```bash
git add backend/app/generation.py backend/tests/test_generation.py
git commit -m "feat: Groq streaming generation with SSE events"
```

---

## Phase 5: API Endpoints

### Task 11: Upload + query + debug endpoints

**Files:**
- Modify: `backend/app/main.py` (add all routers, startup BM25 load)
- Modify: `backend/tests/test_api.py`

- [ ] **Step 1: Write failing integration tests**

```python
# backend/tests/test_api.py (replace/extend)
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from unittest.mock import AsyncMock, patch

@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

@pytest.mark.asyncio
async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

@pytest.mark.asyncio
async def test_upload_endpoint_accepts_file(client, tmp_path):
    test_file = tmp_path / "test.txt"
    test_file.write_text("This is a test document about Paris.")

    with patch("app.main.ingest_document", new_callable=AsyncMock) as mock_ingest:
        mock_ingest.return_value = (42, 3)
        with patch("app.main.bm25_manager") as mock_bm25:
            mock_bm25.build = AsyncMock()
            response = await client.post(
                "/upload",
                files={"file": ("test.txt", test_file.read_bytes(), "text/plain")},
            )
    assert response.status_code == 200
    data = response.json()
    assert data["document_id"] == 42
    assert data["chunk_count"] == 3

@pytest.mark.asyncio
async def test_retrieval_debug_endpoint(client):
    with patch("app.main.bm25_manager") as mock_bm25:
        mock_bm25.search.return_value = [{"chunk_id": 1, "score": 0.9}]
        with patch("app.retrieval._embed_query", new_callable=AsyncMock) as mock_embed:
            mock_embed.return_value = [0.0] * 1024
            with patch("app.retrieval._dense_search_db", new_callable=AsyncMock) as mock_dense:
                mock_dense.return_value = [{"chunk_id": 1, "score": 0.95}]
                response = await client.get("/retrieval-debug?query=test")
    assert response.status_code == 200
    data = response.json()
    assert "bm25_candidates" in data
    assert "dense_candidates" in data
    assert "rrf_fused" in data
    assert "reranked" in data
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd backend
pytest tests/test_api.py::test_health tests/test_api.py::test_upload_endpoint_accepts_file -v
```

Expected: `assert 404 == 200` (routes not registered yet)

- [ ] **Step 3: Expand `backend/app/main.py`**

```python
from contextlib import asynccontextmanager
import asyncio
import logging
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.database import init_db, get_db
from app.ingestion import ingest_document
from app.models import Chunk, Document
from app.retrieval import BM25IndexManager, hybrid_retrieve, rrf_fuse, _embed_query, _dense_search_db
from app.reranking import CrossEncoderReranker
from app.generation import stream_generate

logger = logging.getLogger(__name__)

bm25_manager = BM25IndexManager()
reranker = CrossEncoderReranker()


async def _load_bm25_index(db: AsyncSession) -> None:
    index_path = settings.bm25_index_path
    if Path(index_path).exists():
        bm25_manager.load(index_path)
        logger.info("BM25 index loaded from disk")
    else:
        result = await db.execute(select(Chunk.id, Chunk.text))
        rows = result.fetchall()
        if rows:
            bm25_manager.build([{"id": r[0], "text": r[1]} for r in rows])
            bm25_manager.save(index_path)
            logger.info("BM25 index built from DB (%d chunks)", len(rows))


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    from app.database import AsyncSessionLocal
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
    return {"status": "ok"}


@app.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
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

    # Refresh BM25 index
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as refresh_db:
        result = await refresh_db.execute(select(Chunk.id, Chunk.text))
        rows = result.fetchall()
        bm25_manager.build([{"id": r[0], "text": r[1]} for r in rows])
        bm25_manager.save(settings.bm25_index_path)

    return {"document_id": doc_id, "chunk_count": chunk_count}


@app.post("/query")
async def query_documents(
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
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
            import json
            yield json.dumps({"type": "done", "citations": [], "citation_warning": False})
        return StreamingResponse(empty_stream(), media_type="text/event-stream")

    result = await db.execute(
        select(Chunk, Document.filename)
        .join(Document, Chunk.document_id == Document.id)
        .where(Chunk.id.in_(chunk_ids))
    )
    rows = result.fetchall()
    chunk_map = {row[0].id: {"id": row[0].id, "text": row[0].text, "source": row[1], "page_number": row[0].page_number} for row in rows}

    candidates = [
        {**chunk_map[cid], "text": chunk_map[cid]["text"]}
        for cid in chunk_ids
        if cid in chunk_map
    ]

    reranked = reranker.rerank(query=question, candidates=candidates, top_k=settings.reranker_top_k)

    async def event_stream() -> AsyncIterator[str]:
        async for event in stream_generate(question=question, chunks=reranked):
            yield f"data: {event}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/retrieval-debug")
async def retrieval_debug(
    query: str,
    db: AsyncSession = Depends(get_db),
):
    query_embedding = await _embed_query(query)

    bm25_candidates = bm25_manager.search(query, top_n=settings.bm25_top_n)
    dense_candidates = await _dense_search_db(db, query_embedding, top_n=settings.dense_top_n)

    rrf_fused = rrf_fuse(
        bm25_results=bm25_candidates,
        dense_results=dense_candidates,
        k=settings.rrf_k,
        top_n=20,
    )

    chunk_ids = [r["chunk_id"] for r in rrf_fused]
    result = await db.execute(
        select(Chunk, Document.filename)
        .join(Document, Chunk.document_id == Document.id)
        .where(Chunk.id.in_(chunk_ids))
    )
    rows = result.fetchall()
    chunk_map = {row[0].id: {"text": row[0].text, "source": row[1], "page_number": row[0].page_number} for row in rows}

    candidates_with_text = [
        {**chunk_map.get(r["chunk_id"], {}), "chunk_id": r["chunk_id"], "rrf_score": r["rrf_score"]}
        for r in rrf_fused
        if r["chunk_id"] in chunk_map
    ]
    reranked = reranker.rerank(
        query=query,
        candidates=[{**c, "text": c.get("text", "")} for c in candidates_with_text],
        top_k=settings.reranker_top_k,
    )

    return {
        "bm25_candidates": bm25_candidates,
        "dense_candidates": dense_candidates,
        "rrf_fused": rrf_fused,
        "reranked": reranked,
    }
```

- [ ] **Step 4: Run API tests — expect PASS**

```bash
cd backend
pytest tests/test_api.py -v
```

Expected: All `PASSED`

- [ ] **Step 5: Smoke test with running server**

```bash
cd backend
uvicorn app.main:app --reload
# In another terminal:
curl http://localhost:8000/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 6: Commit**

```bash
git add backend/app/main.py backend/tests/test_api.py
git commit -m "feat: upload, query (streaming), and retrieval-debug endpoints"
```

---

## Phase 6: Frontend

### Task 12: Vite + Tailwind scaffold + API layer

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/api/index.ts`

- [ ] **Step 1: Scaffold Vite + React + TypeScript + Tailwind**

```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 2: Configure Tailwind (`frontend/tailwind.config.js`)**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

Add to `frontend/src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 3: Configure Vite proxy (`frontend/vite.config.ts`)**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/upload': 'http://localhost:8000',
      '/query': 'http://localhost:8000',
      '/retrieval-debug': 'http://localhost:8000',
    },
  },
})
```

- [ ] **Step 4: Create `frontend/src/api/index.ts`**

```ts
export interface UploadResult {
  document_id: number
  chunk_count: number
}

export interface Citation {
  id: number
  text: string
  source: string
  page: number | null
}

export interface TokenEvent {
  type: 'token'
  content: string
}

export interface DoneEvent {
  type: 'done'
  citations: Citation[]
  citation_warning: boolean
}

export type StreamEvent = TokenEvent | DoneEvent

export interface RetrievalDebugResult {
  bm25_candidates: Array<{ chunk_id: number; score: number }>
  dense_candidates: Array<{ chunk_id: number; score: number }>
  rrf_fused: Array<{ chunk_id: number; rrf_score: number }>
  reranked: Array<{ chunk_id: number; cross_encoder_score: number; text: string; source: string; page_number: number | null }>
}

export async function uploadDocument(file: File): Promise<UploadResult> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/upload', { method: 'POST', body: form })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function* streamQuery(question: string): AsyncGenerator<StreamEvent> {
  const res = await fetch('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })
  if (!res.ok) throw new Error(await res.text())
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        yield JSON.parse(line.slice(6)) as StreamEvent
      }
    }
  }
}

export async function getRetrievalDebug(query: string): Promise<RetrievalDebugResult> {
  const res = await fetch(`/retrieval-debug?query=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd frontend
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "feat: Vite + Tailwind scaffold + typed API layer"
```

---

### Task 13: Hooks — useStream + useDocuments

**Files:**
- Create: `frontend/src/hooks/useStream.ts`
- Create: `frontend/src/hooks/useDocuments.ts`

- [ ] **Step 1: Create `frontend/src/hooks/useStream.ts`**

```ts
import { useState, useCallback, useRef } from 'react'
import { streamQuery, Citation } from '../api'

export interface StreamState {
  tokens: string
  citations: Citation[]
  citationWarning: boolean
  isStreaming: boolean
  error: string | null
}

export function useStream() {
  const [state, setState] = useState<StreamState>({
    tokens: '',
    citations: [],
    citationWarning: false,
    isStreaming: false,
    error: null,
  })
  const abortRef = useRef(false)

  const ask = useCallback(async (question: string) => {
    abortRef.current = false
    setState({ tokens: '', citations: [], citationWarning: false, isStreaming: true, error: null })

    try {
      for await (const event of streamQuery(question)) {
        if (abortRef.current) break
        if (event.type === 'token') {
          setState(prev => ({ ...prev, tokens: prev.tokens + event.content }))
        } else if (event.type === 'done') {
          setState(prev => ({
            ...prev,
            citations: event.citations,
            citationWarning: event.citation_warning,
            isStreaming: false,
          }))
        }
      }
    } catch (err) {
      setState(prev => ({ ...prev, isStreaming: false, error: String(err) }))
    }
  }, [])

  const reset = useCallback(() => {
    abortRef.current = true
    setState({ tokens: '', citations: [], citationWarning: false, isStreaming: false, error: null })
  }, [])

  return { ...state, ask, reset }
}
```

- [ ] **Step 2: Create `frontend/src/hooks/useDocuments.ts`**

```ts
import { useState, useCallback } from 'react'
import { uploadDocument, UploadResult } from '../api'

export interface UploadedDocument {
  id: number
  filename: string
  chunkCount: number
}

export function useDocuments() {
  const [documents, setDocuments] = useState<UploadedDocument[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const upload = useCallback(async (file: File) => {
    setUploading(true)
    setUploadError(null)
    try {
      const result: UploadResult = await uploadDocument(file)
      setDocuments(prev => [...prev, {
        id: result.document_id,
        filename: file.name,
        chunkCount: result.chunk_count,
      }])
    } catch (err) {
      setUploadError(String(err))
    } finally {
      setUploading(false)
    }
  }, [])

  return { documents, uploading, uploadError, upload }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/
git commit -m "feat: useStream + useDocuments hooks"
```

---

### Task 14: UI Components

**Files:**
- Create: `frontend/src/components/UploadPanel.tsx`
- Create: `frontend/src/components/ChatWindow.tsx`
- Create: `frontend/src/components/CitationDrawer.tsx`
- Create: `frontend/src/components/DebugView.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create `frontend/src/components/UploadPanel.tsx`**

```tsx
import React, { useRef, DragEvent } from 'react'
import { useDocuments } from '../hooks/useDocuments'

export function UploadPanel() {
  const { documents, uploading, uploadError, upload } = useDocuments()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(upload)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="p-4 border-r border-gray-200 w-72 flex flex-col gap-4">
      <h2 className="font-semibold text-lg">Documents</h2>
      <div
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
      >
        <p className="text-sm text-gray-500">Drop files here or click to upload</p>
        <p className="text-xs text-gray-400 mt-1">PDF, DOCX, MD, TXT</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.md,.txt"
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {uploading && <p className="text-sm text-blue-500 animate-pulse">Uploading…</p>}
      {uploadError && <p className="text-sm text-red-500">{uploadError}</p>}

      <ul className="flex flex-col gap-2 overflow-y-auto">
        {documents.map(doc => (
          <li key={doc.id} className="bg-gray-50 rounded p-2 text-sm">
            <p className="font-medium truncate">{doc.filename}</p>
            <p className="text-xs text-gray-400">{doc.chunkCount} chunks</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Create `frontend/src/components/CitationDrawer.tsx`**

```tsx
import React from 'react'
import { Citation } from '../api'

interface Props {
  citation: Citation | null
  onClose: () => void
}

export function CitationDrawer({ citation, onClose }: Props) {
  if (!citation) return null

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Citation [{citation.id}]</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
      </div>
      <div className="p-4 flex flex-col gap-3 overflow-y-auto">
        <p className="text-xs text-gray-500">
          <span className="font-medium">Source:</span> {citation.source}
          {citation.page != null && ` · Page ${citation.page}`}
        </p>
        <blockquote className="border-l-4 border-blue-300 pl-4 text-sm text-gray-700 italic leading-relaxed">
          {citation.text}
        </blockquote>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `frontend/src/components/DebugView.tsx`**

```tsx
import React, { useState } from 'react'
import { getRetrievalDebug, RetrievalDebugResult } from '../api'

interface Props {
  query: string
}

export function DebugView({ query }: Props) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<RetrievalDebugResult | null>(null)
  const [loading, setLoading] = useState(false)

  const toggle = async () => {
    if (!open && !data) {
      setLoading(true)
      try {
        const result = await getRetrievalDebug(query)
        setData(result)
      } finally {
        setLoading(false)
      }
    }
    setOpen(prev => !prev)
  }

  return (
    <div className="mt-2">
      <button
        onClick={toggle}
        className="text-xs text-gray-400 hover:text-gray-600 underline"
      >
        {open ? 'Hide' : 'Show'} retrieval debug
      </button>

      {loading && <p className="text-xs text-gray-400 mt-1">Loading…</p>}

      {open && data && (
        <div className="mt-3 text-xs font-mono overflow-x-auto">
          <Section title="BM25 Candidates" rows={data.bm25_candidates} scoreKey="score" />
          <Section title="Dense Candidates" rows={data.dense_candidates} scoreKey="score" />
          <Section title="RRF Fused" rows={data.rrf_fused} scoreKey="rrf_score" />
          <Section title={`Reranked (top ${data.reranked.length})`} rows={data.reranked} scoreKey="cross_encoder_score" showText />
        </div>
      )}
    </div>
  )
}

function Section({ title, rows, scoreKey, showText }: {
  title: string
  rows: any[]
  scoreKey: string
  showText?: boolean
}) {
  return (
    <div className="mb-3">
      <p className="font-semibold text-gray-600 mb-1">{title}</p>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1 text-left">chunk_id</th>
            <th className="border px-2 py-1 text-left">{scoreKey}</th>
            {showText && <th className="border px-2 py-1 text-left">text</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="border px-2 py-1">{r.chunk_id}</td>
              <td className="border px-2 py-1">{typeof r[scoreKey] === 'number' ? r[scoreKey].toFixed(4) : r[scoreKey]}</td>
              {showText && <td className="border px-2 py-1 max-w-xs truncate">{r.text}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Create `frontend/src/components/ChatWindow.tsx`**

```tsx
import React, { useState, useRef, useEffect } from 'react'
import { useStream } from '../hooks/useStream'
import { Citation } from '../api'
import { CitationDrawer } from './CitationDrawer'
import { DebugView } from './DebugView'

function renderWithCitations(
  text: string,
  onCitationClick: (n: number) => void
): React.ReactNode[] {
  const parts = text.split(/(\[\d+\])/g)
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/)
    if (match) {
      const n = parseInt(match[1])
      return (
        <sup
          key={i}
          className="cursor-pointer text-blue-500 hover:text-blue-700 font-semibold mx-0.5 text-xs"
          onClick={() => onCitationClick(n)}
        >
          [{n}]
        </sup>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export function ChatWindow() {
  const { tokens, citations, citationWarning, isStreaming, error, ask } = useStream()
  const [input, setInput] = useState('')
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null)
  const [lastQuery, setLastQuery] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [tokens])

  const submit = async () => {
    const q = input.trim()
    if (!q || isStreaming) return
    setLastQuery(q)
    setInput('')
    setActiveCitation(null)
    await ask(q)
  }

  const handleCitationClick = (n: number) => {
    const citation = citations.find(c => c.id === n)
    if (citation) setActiveCitation(citation)
  }

  return (
    <div className="flex-1 flex flex-col h-full relative">
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        {tokens && (
          <div className="bg-white rounded-lg shadow p-4 leading-relaxed text-gray-800">
            {renderWithCitations(tokens, handleCitationClick)}
            {isStreaming && <span className="animate-pulse text-gray-400"> ▋</span>}
          </div>
        )}
        {citationWarning && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-700">
            Warning: some citations could not be verified against retrieved passages.
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-600">
            {error}
          </div>
        )}
        {tokens && !isStreaming && lastQuery && (
          <DebugView query={lastQuery} />
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-gray-200 flex gap-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Ask a question about your documents…"
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          disabled={isStreaming}
        />
        <button
          onClick={submit}
          disabled={isStreaming || !input.trim()}
          className="bg-blue-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isStreaming ? 'Thinking…' : 'Ask'}
        </button>
      </div>

      <CitationDrawer
        citation={activeCitation}
        onClose={() => setActiveCitation(null)}
      />
    </div>
  )
}
```

- [ ] **Step 5: Update `frontend/src/App.tsx`**

```tsx
import React from 'react'
import { UploadPanel } from './components/UploadPanel'
import { ChatWindow } from './components/ChatWindow'

export default function App() {
  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
      <UploadPanel />
      <ChatWindow />
    </div>
  )
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd frontend
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 7: Run dev server and test manually**

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`. Verify:
- Upload panel accepts a `.txt` file drag-and-drop
- Query input submits on Enter and shows streaming text
- Citation `[1]` badge opens the drawer
- "Show retrieval debug" toggles the debug table
- Warning banner appears when `citation_warning: true`

- [ ] **Step 8: Commit**

```bash
git add frontend/src/
git commit -m "feat: full chat UI with upload, streaming, citations, debug view"
```

---

### Task 15: Frontend Dockerfile

**Files:**
- Create: `frontend/Dockerfile`

- [ ] **Step 1: Create `frontend/Dockerfile`**

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
```

- [ ] **Step 2: Build and verify**

```bash
docker build -t ask-my-docs-frontend ./frontend
```

Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add frontend/Dockerfile
git commit -m "feat: frontend Dockerfile"
```

---

## Phase 7: Evaluation Pipeline + CI

### Task 16: Golden eval set + rubric

**Files:**
- Create: `backend/evals/golden_set.json`
- Create: `backend/evals/rubric.md`

- [ ] **Step 1: Create `backend/evals/golden_set.json`**

This golden set assumes you have ingested the sample documents from `backend/tests/fixtures/`. The questions are designed so retrieving the right chunk gives the answer.

```json
[
  {
    "id": "q01",
    "question": "What is described in the plain text document?",
    "expected_answer": "A plain text document containing a greeting or introductory text.",
    "expected_source_docs": ["sample.txt"]
  },
  {
    "id": "q02",
    "question": "What does the DOCX document say?",
    "expected_answer": "It contains a greeting message.",
    "expected_source_docs": ["sample.docx"]
  },
  {
    "id": "q03",
    "question": "What is the title of the markdown document?",
    "expected_answer": "Hello",
    "expected_source_docs": ["sample.md"]
  },
  {
    "id": "q04",
    "question": "What types of documents are supported for upload?",
    "expected_answer": "PDF, DOCX, Markdown, and plain text files are supported.",
    "expected_source_docs": []
  },
  {
    "id": "q05",
    "question": "What greeting appears in the PDF document?",
    "expected_answer": "A greeting from the PDF document.",
    "expected_source_docs": ["sample.pdf"]
  }
]
```

Note: Expand this to ~20 questions once you have real documents ingested. These 5 cover the fixture set.

- [ ] **Step 2: Create `backend/evals/rubric.md`**

```markdown
# LLM-as-Judge Rubric

## Citation Faithfulness (per citation, scored 0 or 1)

**Prompt template:**
```
You are evaluating whether an answer's citation is faithful to its source passage.

Source passage: {passage}
Answer sentence containing citation: {sentence}

Is the claim in the sentence supported by the source passage?
Respond with only "1" (supported) or "0" (not supported).
```

Score = mean of all per-citation scores. Threshold: 0.8.

## Answer Correctness (whole answer, scored 1–5)

**Prompt template:**
```
You are evaluating an AI answer against a reference answer.

Question: {question}
Reference answer: {expected_answer}
AI answer: {actual_answer}

Rate the AI answer from 1 to 5:
5 = Complete, correct, no hallucination
4 = Mostly correct, minor omissions
3 = Partially correct, some errors
2 = Major errors or significant missing info
1 = Wrong or hallucinated

Respond with only the integer score.
```

Threshold: 3.5 average across all questions.
```

- [ ] **Step 3: Commit**

```bash
git add backend/evals/
git commit -m "feat: golden eval set + LLM-as-judge rubric"
```

---

### Task 17: Eval CLI runner

**Files:**
- Create: `backend/evals/run_evals.py`

- [ ] **Step 1: Write failing test for eval CLI**

```python
# backend/tests/test_evals.py
import pytest
import json
from pathlib import Path

def test_golden_set_schema():
    path = Path(__file__).parent.parent / "evals" / "golden_set.json"
    data = json.loads(path.read_text())
    assert isinstance(data, list)
    assert len(data) >= 5
    for item in data:
        assert "id" in item
        assert "question" in item
        assert "expected_answer" in item
        assert "expected_source_docs" in item
```

- [ ] **Step 2: Run — expect PASS (validates schema)**

```bash
cd backend
pytest tests/test_evals.py -v
```

Expected: `PASSED`

- [ ] **Step 3: Create `backend/evals/run_evals.py`**

```python
"""Eval CLI: runs golden set against live API, scores metrics, exits 1 on threshold breach."""
import argparse
import asyncio
import json
import re
import sys
from pathlib import Path

import httpx
from groq import AsyncGroq

GOLDEN_SET_PATH = Path(__file__).parent / "golden_set.json"


async def run_query(client: httpx.AsyncClient, question: str) -> tuple[str, list[dict]]:
    """Stream query from API; return (full_answer, citations)."""
    async with client.stream(
        "POST", "http://localhost:8000/query",
        json={"question": question},
        timeout=120.0,
    ) as resp:
        resp.raise_for_status()
        answer_tokens = []
        citations = []
        async for line in resp.aiter_lines():
            if line.startswith("data: "):
                event = json.loads(line[6:])
                if event["type"] == "token":
                    answer_tokens.append(event["content"])
                elif event["type"] == "done":
                    citations = event["citations"]
        return "".join(answer_tokens), citations


def retrieval_recall_at_k(retrieved_sources: list[str], expected_sources: list[str]) -> float:
    """Fraction of expected sources found in retrieved sources."""
    if not expected_sources:
        return 1.0
    retrieved_set = set(s.lower() for s in retrieved_sources)
    hits = sum(1 for s in expected_sources if s.lower() in retrieved_set)
    return hits / len(expected_sources)


async def score_faithfulness(
    groq_client: AsyncGroq,
    model: str,
    answer: str,
    citations: list[dict],
) -> float:
    """Score each citation 0/1 for faithfulness; return mean."""
    if not citations:
        return 1.0
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", answer) if s.strip()]
    scores = []
    for citation in citations:
        relevant_sentences = [s for s in sentences if f"[{citation['id']}]" in s]
        if not relevant_sentences:
            continue
        sentence = " ".join(relevant_sentences)
        prompt = (
            f"Source passage: {citation['text']}\n"
            f"Answer sentence containing citation: {sentence}\n\n"
            "Is the claim in the sentence supported by the source passage? "
            "Respond with only '1' (supported) or '0' (not supported)."
        )
        resp = await groq_client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=5,
        )
        score_text = resp.choices[0].message.content.strip()
        scores.append(1.0 if score_text == "1" else 0.0)
    return sum(scores) / len(scores) if scores else 1.0


async def score_correctness(
    groq_client: AsyncGroq,
    model: str,
    question: str,
    expected_answer: str,
    actual_answer: str,
) -> float:
    """Score answer correctness 1–5."""
    prompt = (
        f"Question: {question}\n"
        f"Reference answer: {expected_answer}\n"
        f"AI answer: {actual_answer}\n\n"
        "Rate the AI answer from 1 to 5:\n"
        "5 = Complete, correct, no hallucination\n"
        "4 = Mostly correct, minor omissions\n"
        "3 = Partially correct, some errors\n"
        "2 = Major errors or significant missing info\n"
        "1 = Wrong or hallucinated\n\n"
        "Respond with only the integer score."
    )
    resp = await groq_client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=5,
    )
    try:
        return float(resp.choices[0].message.content.strip())
    except ValueError:
        return 1.0


async def main(
    threshold_recall: float,
    threshold_faithfulness: float,
    threshold_correctness: float,
    groq_api_key: str,
    groq_model: str,
) -> bool:
    golden_set = json.loads(GOLDEN_SET_PATH.read_text())
    groq_client = AsyncGroq(api_key=groq_api_key)

    recall_scores, faithfulness_scores, correctness_scores = [], [], []

    async with httpx.AsyncClient() as http_client:
        for item in golden_set:
            print(f"  Evaluating: {item['id']} — {item['question'][:60]}…")
            answer, citations = await run_query(http_client, item["question"])
            retrieved_sources = [c["source"] for c in citations]

            recall = retrieval_recall_at_k(retrieved_sources, item["expected_source_docs"])
            faithfulness = await score_faithfulness(groq_client, groq_model, answer, citations)
            correctness = await score_correctness(
                groq_client, groq_model,
                item["question"], item["expected_answer"], answer,
            )
            recall_scores.append(recall)
            faithfulness_scores.append(faithfulness)
            correctness_scores.append(correctness)
            print(f"    recall={recall:.2f}  faithfulness={faithfulness:.2f}  correctness={correctness:.1f}")

    avg_recall = sum(recall_scores) / len(recall_scores)
    avg_faithfulness = sum(faithfulness_scores) / len(faithfulness_scores)
    avg_correctness = sum(correctness_scores) / len(correctness_scores)

    print("\n| Metric | Score | Threshold | Pass |")
    print("|---|---|---|---|")
    print(f"| Recall@k | {avg_recall:.3f} | {threshold_recall} | {'✓' if avg_recall >= threshold_recall else '✗'} |")
    print(f"| Faithfulness | {avg_faithfulness:.3f} | {threshold_faithfulness} | {'✓' if avg_faithfulness >= threshold_faithfulness else '✗'} |")
    print(f"| Correctness | {avg_correctness:.3f} | {threshold_correctness} | {'✓' if avg_correctness >= threshold_correctness else '✗'} |")

    passed = (
        avg_recall >= threshold_recall
        and avg_faithfulness >= threshold_faithfulness
        and avg_correctness >= threshold_correctness
    )
    return passed


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Ask My Docs evals")
    parser.add_argument("--threshold-recall", type=float, default=0.7)
    parser.add_argument("--threshold-faithfulness", type=float, default=0.8)
    parser.add_argument("--threshold-correctness", type=float, default=3.5)
    parser.add_argument("--groq-api-key", default=None)
    parser.add_argument("--groq-model", default="llama-3.3-70b-versatile")
    args = parser.parse_args()

    import os
    api_key = args.groq_api_key or os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        print("ERROR: GROQ_API_KEY required")
        sys.exit(1)

    passed = asyncio.run(main(
        args.threshold_recall,
        args.threshold_faithfulness,
        args.threshold_correctness,
        api_key,
        args.groq_model,
    ))
    sys.exit(0 if passed else 1)
```

- [ ] **Step 4: Verify script syntax**

```bash
cd backend
python -m py_compile evals/run_evals.py && echo "OK"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/evals/run_evals.py backend/tests/test_evals.py
git commit -m "feat: eval CLI runner with recall, faithfulness, correctness metrics"
```

---

### Task 18: GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/evals.yml`

- [ ] **Step 1: Create `.github/workflows/evals.yml`**

```yaml
name: Eval Suite

on:
  pull_request:
    branches: [main]

jobs:
  evals:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: askdocs
          POSTGRES_PASSWORD: askdocs
          POSTGRES_DB: askdocs
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip

      - name: Install dependencies
        run: pip install -r backend/requirements.txt
        working-directory: backend

      - name: Start backend
        working-directory: backend
        env:
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
          GROQ_MODEL: llama-3.3-70b-versatile
          HF_API_KEY: ${{ secrets.HF_API_KEY }}
          HF_EMBEDDING_MODEL: BAAI/bge-large-en-v1.5
          DATABASE_URL: postgresql+asyncpg://askdocs:askdocs@localhost:5432/askdocs
          BM25_INDEX_PATH: data/bm25_index.pkl
        run: |
          mkdir -p data
          uvicorn app.main:app --host 0.0.0.0 --port 8000 &
          sleep 10
          curl --retry 5 --retry-delay 3 http://localhost:8000/health

      - name: Ingest test documents
        working-directory: backend
        env:
          BASE_URL: http://localhost:8000
        run: |
          for f in tests/fixtures/sample.txt tests/fixtures/sample.md tests/fixtures/sample.pdf tests/fixtures/sample.docx; do
            curl -s -X POST http://localhost:8000/upload -F "file=@$f"
          done
          sleep 5

      - name: Run eval suite
        working-directory: backend
        env:
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
        run: |
          python -m evals.run_evals \
            --threshold-recall 0.7 \
            --threshold-faithfulness 0.8 \
            --threshold-correctness 3.5
```

- [ ] **Step 2: Validate YAML syntax**

```bash
python -c "import yaml; yaml.safe_load(open('.github/workflows/evals.yml'))" && echo "OK"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add .github/
git commit -m "feat: GitHub Actions CI workflow — eval-gated PRs"
```

---

## Phase 8: Unit Tests + README

### Task 19: Complete unit test coverage

**Files:**
- Modify: `backend/tests/test_generation.py` (ensure all edge cases covered — already done in Task 9-10)
- Review all test files for gaps

- [ ] **Step 1: Run full test suite**

```bash
cd backend
pytest tests/ -v --tb=short
```

Expected: All tests pass. If any fail, fix before continuing.

- [ ] **Step 2: Check coverage gaps**

```bash
cd backend
pip install pytest-cov
pytest tests/ --cov=app --cov-report=term-missing
```

Expected: >70% coverage across all modules.

- [ ] **Step 3: Commit if any fixes were made**

```bash
git add backend/tests/
git commit -m "test: fill coverage gaps in unit test suite"
```

---

### Task 20: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# Ask My Docs

A production-grade RAG application. Upload documents, ask questions, get streamed answers with inline citations.

## Architecture

```
Upload → Parse → Chunk → Embed (HuggingFace BGE)
                              ↓
Query → BM25 ‖ pgvector dense search → RRF Fusion → Cross-encoder reranker → Groq LLM → SSE stream
```

- **Backend:** Python 3.12 · FastAPI · SQLAlchemy async · pgvector · rank-bm25 · sentence-transformers · Groq API
- **Frontend:** React 18 · TypeScript · Vite · TailwindCSS
- **Infra:** Docker Compose · GitHub Actions eval CI

## Quick Start

```bash
cp .env.example .env   # fill in GROQ_API_KEY and HF_API_KEY
docker compose up
# Backend: http://localhost:8000
# Frontend: http://localhost:5173
```

## Running Locally (without Docker)

```bash
# Start Postgres
docker run -e POSTGRES_USER=askdocs -e POSTGRES_PASSWORD=askdocs -e POSTGRES_DB=askdocs -p 5432:5432 pgvector/pgvector:pg16

# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install && npm run dev
```

## Running Tests

```bash
cd backend
pytest tests/ -v
```

## Running Evals

```bash
cd backend
python -m evals.run_evals --threshold-recall 0.7 --threshold-faithfulness 0.8 --threshold-correctness 3.5
```

## Configuration

All config via env vars — see `.env.example`.

## CI

GitHub Actions runs the eval suite on every PR. Build fails if recall, faithfulness, or correctness drop below thresholds. Requires `GROQ_API_KEY` and `HF_API_KEY` secrets.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with architecture, setup, eval instructions"
```

---

## Self-Review Against Spec

**Spec coverage check:**

| Spec Requirement | Task(s) |
|---|---|
| PDF/DOCX/MD/TXT parsing | Task 3 |
| Recursive chunking with overlap + chunk metadata | Task 4 |
| HuggingFace embeddings, swappable via env var | Task 5 |
| BM25 index, persisted to disk | Tasks 6, 11 |
| pgvector dense search | Task 7 |
| RRF fusion | Task 7 |
| Cross-encoder reranker | Task 8 |
| Groq streaming generation | Task 10 |
| Citation enforcement + `citation_warning` | Tasks 9, 10 |
| `POST /upload` | Task 11 |
| `POST /query` (streaming SSE) | Task 11 |
| `GET /retrieval-debug` | Task 11 |
| React frontend with chat + upload + debug | Tasks 12–15 |
| Clickable citations → side drawer | Task 14 |
| `citation_warning` banner | Task 14 |
| SSE `token` + `done` events | Task 10 |
| Golden eval set | Task 16 |
| Recall@k + faithfulness + correctness metrics | Task 17 |
| CLI eval runner with exit code | Task 17 |
| GitHub Actions CI | Task 18 |
| Docker Compose | Task 1 |
| pydantic-settings config | Task 1 |
| README with architecture + setup | Task 20 |
| Unit/integration tests | Tasks 2–11, 16 |

All spec requirements covered.

**Placeholder scan:** None found — all steps contain actual code.

**Type consistency:** `BM25IndexManager.search()` → `[{chunk_id, score}]` used consistently in Task 7 `rrf_fuse()`. `CrossEncoderReranker.rerank()` → `[{...original_keys, cross_encoder_score}]` used consistently in Task 11 routes. `stream_generate()` yields `str` (JSON) consumed by SSE wrapper in Task 11. `Citation` interface in `frontend/src/api/index.ts` matches `done` event shape from Task 10.
