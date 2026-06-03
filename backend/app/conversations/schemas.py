"""Pydantic schemas for conversation and message endpoints."""
from pydantic import BaseModel
from typing import Any


class ConversationOut(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    citations: Any | None
    created_at: str

    model_config = {"from_attributes": True}


class ConversationWithMessages(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    messages: list[MessageOut]

    model_config = {"from_attributes": True}


class CreateConversationRequest(BaseModel):
    title: str = "New Conversation"


class RenameConversationRequest(BaseModel):
    title: str


class AddMessageRequest(BaseModel):
    role: str
    content: str
    citations: Any | None = None
