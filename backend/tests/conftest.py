import os

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.models import Base

# Default to an in-memory SQLite engine so the full suite runs with zero infra.
# Set TEST_DATABASE_URL to a Postgres+pgvector URL in CI to exercise the
# production path (the pgvector extension is created only for that dialect).
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "sqlite+aiosqlite:///:memory:"
)


@pytest_asyncio.fixture
async def engine():
    # Function-scoped so it shares the function-scoped asyncio event loop
    # (pytest-asyncio default). Each test gets a fresh, isolated schema.
    from sqlalchemy import text as sa_text
    from sqlalchemy.pool import StaticPool

    engine_kwargs = {"echo": False}
    if TEST_DATABASE_URL.startswith("sqlite") and ":memory:" in TEST_DATABASE_URL:
        # StaticPool keeps one in-memory connection alive for the whole test so
        # the schema created here is visible to every session in that test.
        engine_kwargs.update(
            connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
    eng = create_async_engine(TEST_DATABASE_URL, **engine_kwargs)
    async with eng.begin() as conn:
        if eng.dialect.name == "postgresql":
            await conn.execute(sa_text("CREATE EXTENSION IF NOT EXISTS vector"))
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
