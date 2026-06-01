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

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
from app.config import settings
from app.models import Base

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def init_db() -> None:
    """Create the pgvector extension (if absent) and all ORM tables."""
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncSession:
    """FastAPI dependency: yield a scoped async database session."""
    async with AsyncSessionLocal() as session:
        yield session
