from datetime import datetime

from pydantic import BaseModel, Field, field_validator
from typing import Literal

MAX_MESSAGE_LENGTH = 2000

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class ChatRequest(BaseModel):
    message: str = Field(
        min_length=1,
        max_length=MAX_MESSAGE_LENGTH,
    )
    conversation_id: int | None = None
    # Keep in step with the option list in Chat.jsx: the schema rejects anything
    # the frontend offers on its own. gemini-2.5-flash was removed because the
    # API now returns 404 "no longer available to new users" for it.
    model: Literal[
        "gemini-3.6-flash",
    ] = "gemini-3.6-flash"

    response_length: Literal["short", "medium", "long"] = "medium"
    @field_validator("message")
    @classmethod
    def reject_blank_message(cls, value: str) -> str:
        cleaned = value.strip()

        if not cleaned:
            raise ValueError("Message cannot be blank.")

        return cleaned

MAX_TITLE_LENGTH = 80


class ChatConversationsOut(BaseModel):
    """One row in the sidebar list -- deliberately without summary or messages."""
    id: int
    title: str | None = None
    updated_at: datetime | None = None
    pinned: bool = False

    class Config:
        from_attributes = True 

class ConversationSettings(BaseModel):
    """One menu action from the conversation rail.

    ``conversation_id`` is required on purpose: when it defaulted to ``None``,
    ``load_conversation`` created a fresh conversation and the endpoint then
    archived or deleted that new row. ``title`` is only read by ``rename``.
    """

    conversation_id: int
    action: Literal["rename", "pin", "archive", "delete"]
    title: str | None = Field(default=None, max_length=MAX_TITLE_LENGTH)

    @field_validator("title")
    @classmethod
    def reject_blank_title(cls, value: str | None) -> str | None:
        if value is None:
            return None

        cleaned = value.strip()

        if not cleaned:
            raise ValueError("Title cannot be blank.")

        return cleaned
