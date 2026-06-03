"""Business logic for conversation and message CRUD."""
import json
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Conversation, Message, MessageRole


async def create_conversation(db: AsyncSession, user_id: str, title: str = "New Conversation") -> Conversation:
    conv = Conversation(user_id=user_id, title=title)
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv


async def list_conversations(db: AsyncSession, user_id: str) -> list[Conversation]:
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == user_id)
        .order_by(Conversation.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_conversation(db: AsyncSession, conversation_id: str, user_id: str) -> Conversation | None:
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.id == conversation_id, Conversation.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def rename_conversation(db: AsyncSession, conversation_id: str, user_id: str, title: str) -> Conversation | None:
    conv = await db.get(Conversation, conversation_id)
    if conv is None or conv.user_id != user_id:
        return None
    conv.title = title
    await db.commit()
    await db.refresh(conv)
    return conv


async def delete_conversation(db: AsyncSession, conversation_id: str, user_id: str) -> bool:
    conv = await db.get(Conversation, conversation_id)
    if conv is None or conv.user_id != user_id:
        return False
    await db.delete(conv)
    await db.commit()
    return True


async def add_message(
    db: AsyncSession,
    conversation_id: str,
    role: MessageRole,
    content: str,
    citations: list | None,
) -> Message:
    msg = Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
        citations=json.dumps(citations) if citations else None,
    )
    db.add(msg)
    conv = await db.get(Conversation, conversation_id)
    if conv:
        conv.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(msg)
    return msg
