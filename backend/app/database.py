"""
Async SQLAlchemy engine and session factory for Ask My Docs.

The module exposes:
- ``engine``             – the shared async engine (created once at import time).
- ``AsyncSessionLocal``  – async session factory bound to that engine.
- ``init_db()``          – coroutine that ensures the pgvector extension exists and
                           creates all tables declared in ``models.Base.metadata``.
- ``get_db()``           – FastAPI dependency that yields a fresh ``AsyncSession``
                           and closes it when the request is done.
"""

from pathlib import Path

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
from app.config import settings
from app.models import Base


def _ensure_sqlite_dir(url: str) -> None:
    """Create the parent directory for a file-backed SQLite database."""
    prefix = "sqlite+aiosqlite:///"
    if url.startswith(prefix):
        db_path = Path(url[len(prefix):])
        if str(db_path) not in (":memory:", ""):
            db_path.parent.mkdir(parents=True, exist_ok=True)


_ensure_sqlite_dir(settings.database_url)
engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def init_db() -> None:
    """Create all ORM tables (and the pgvector extension on PostgreSQL)."""
    async with engine.begin() as conn:
        if engine.dialect.name == "postgresql":
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncSession:
    """FastAPI dependency: yield a scoped async database session."""
    async with AsyncSessionLocal() as session:
        yield session
