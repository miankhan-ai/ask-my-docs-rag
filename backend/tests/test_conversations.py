"""Tests for conversation service ownership checks."""
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.models import Base, User, Conversation, Message, AuthProvider, MessageRole
from app.conversations.service import (
    create_conversation,
    list_conversations,
    get_conversation,
    rename_conversation,
    delete_conversation,
    add_message,
)


@pytest_asyncio.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def user_a(db):
    u = User(id="user-a", email="a@test.com", auth_provider=AuthProvider.email)
    db.add(u)
    await db.commit()
    return u


@pytest_asyncio.fixture
async def user_b(db):
    u = User(id="user-b", email="b@test.com", auth_provider=AuthProvider.email)
    db.add(u)
    await db.commit()
    return u


@pytest.mark.asyncio
async def test_create_and_list_conversation(db, user_a):
    conv = await create_conversation(db, user_a.id, "My Chat")
    assert conv.title == "My Chat"
    convs = await list_conversations(db, user_a.id)
    assert len(convs) == 1


@pytest.mark.asyncio
async def test_user_b_cannot_access_user_a_conversation(db, user_a, user_b):
    conv = await create_conversation(db, user_a.id, "Private")
    result = await get_conversation(db, conv.id, user_b.id)
    assert result is None


@pytest.mark.asyncio
async def test_rename_conversation(db, user_a):
    conv = await create_conversation(db, user_a.id, "Old Title")
    updated = await rename_conversation(db, conv.id, user_a.id, "New Title")
    assert updated.title == "New Title"


@pytest.mark.asyncio
async def test_delete_conversation(db, user_a):
    conv = await create_conversation(db, user_a.id, "To Delete")
    await delete_conversation(db, conv.id, user_a.id)
    assert await get_conversation(db, conv.id, user_a.id) is None


@pytest.mark.asyncio
async def test_add_message(db, user_a):
    conv = await create_conversation(db, user_a.id, "Chat")
    msg = await add_message(db, conv.id, MessageRole.user, "Hello", None)
    assert msg.content == "Hello"
    full = await get_conversation(db, conv.id, user_a.id)
    assert len(full.messages) == 1
