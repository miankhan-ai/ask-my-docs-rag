"""
SQLAlchemy ORM models for Ask My Docs.

Tables
------
documents : Tracks uploaded source documents and their processing status.
chunks    : Stores text chunks derived from documents, including optional
            vector embeddings for dense retrieval.
"""

import enum
import json
from datetime import datetime

from sqlalchemy import String, Integer, DateTime, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from app.config import settings


class EmbeddingType(TypeDecorator):
    """Portable embedding column.

    On PostgreSQL it maps to a native ``pgvector`` ``Vector(dim)`` column so the
    ``<=>`` distance operator and ANN indexing work. On any other dialect
    (e.g. SQLite for zero-infra local mode) it falls back to a ``TEXT`` column
    holding the JSON-encoded float list, with cosine similarity computed in
    Python at query time. The Python-side value is always ``list[float] | None``.
    """

    cache_ok = True
    impl = Text

    def __init__(self, dim: int, *args, **kwargs):
        self.dim = dim
        super().__init__(*args, **kwargs)

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from pgvector.sqlalchemy import Vector

            return dialect.type_descriptor(Vector(self.dim))
        return dialect.type_descriptor(Text())

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value  # pgvector handles list[float] natively
        return json.dumps(list(value))

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return list(value)
        return json.loads(value)


class DocumentStatus(str, enum.Enum):
    """Lifecycle states for an ingested document."""

    pending = "pending"
    processing = "processing"
    ready = "ready"
    failed = "failed"


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""

    pass


class Document(Base):
    """Represents an uploaded source document."""

    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    filetype: Mapped[str] = mapped_column(String(32), nullable=False)
    upload_timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    status: Mapped[DocumentStatus] = mapped_column(
        SAEnum(DocumentStatus), default=DocumentStatus.pending
    )
    chunks: Mapped[list["Chunk"]] = relationship(
        "Chunk", back_populates="document", cascade="all, delete-orphan"
    )


class Chunk(Base):
    """A text chunk derived from a Document, with optional dense embedding."""

    __tablename__ = "chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    page_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    char_start: Mapped[int] = mapped_column(Integer, nullable=False)
    char_end: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(
        EmbeddingType(settings.embedding_dim), nullable=True
    )
    document: Mapped["Document"] = relationship("Document", back_populates="chunks")
