"""CRUD endpoints for conversations and messages."""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.conversations.schemas import (
    AddMessageRequest,
    ConversationOut,
    ConversationWithMessages,
    CreateConversationRequest,
    MessageOut,
    RenameConversationRequest,
)
from app.conversations.service import (
    add_message,
    create_conversation,
    delete_conversation,
    get_conversation,
    list_conversations,
    rename_conversation,
)
from app.database import get_db
from app.models import MessageRole, User

router = APIRouter(prefix="/conversations", tags=["conversations"])


def _conv_out(conv) -> ConversationOut:
    return ConversationOut(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at.isoformat(),
        updated_at=conv.updated_at.isoformat(),
    )


def _msg_out(msg) -> MessageOut:
    return MessageOut(
        id=msg.id,
        role=msg.role.value if hasattr(msg.role, "value") else msg.role,
        content=msg.content,
        citations=json.loads(msg.citations) if msg.citations else None,
        created_at=msg.created_at.isoformat(),
    )


@router.get("", response_model=list[ConversationOut])
async def list_convs(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    convs = await list_conversations(db, user.id)
    return [_conv_out(c) for c in convs]


@router.post("", response_model=ConversationOut, status_code=201)
async def create_conv(
    body: CreateConversationRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conv = await create_conversation(db, user.id, body.title)
    return _conv_out(conv)


@router.get("/{conversation_id}", response_model=ConversationWithMessages)
async def get_conv(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conv = await get_conversation(db, conversation_id, user.id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return ConversationWithMessages(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at.isoformat(),
        updated_at=conv.updated_at.isoformat(),
        messages=[_msg_out(m) for m in conv.messages],
    )


@router.patch("/{conversation_id}", response_model=ConversationOut)
async def rename_conv(
    conversation_id: str,
    body: RenameConversationRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conv = await rename_conversation(db, conversation_id, user.id, body.title)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return _conv_out(conv)


@router.delete("/{conversation_id}", status_code=204)
async def delete_conv(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ok = await delete_conversation(db, conversation_id, user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Conversation not found")


@router.post("/{conversation_id}/messages", response_model=MessageOut, status_code=201)
async def post_message(
    conversation_id: str,
    body: AddMessageRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conv = await get_conversation(db, conversation_id, user.id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    try:
        role = MessageRole(body.role)
    except ValueError:
        raise HTTPException(status_code=400, detail="role must be 'user' or 'assistant'")
    msg = await add_message(db, conversation_id, role, body.content, body.citations)
    return _msg_out(msg)
