"""Message and Conversation schemas for request/response validation."""

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, EmailStr, Field


class ConversationStatus(str, Enum):
    """Status of a conversation."""

    UNREAD = "unread"
    PENDING = "pending"
    RESOLVED = "resolved"


class MessageChannel(str, Enum):
    """Channel through which message was sent/received."""

    INTERNAL = "internal"
    EMAIL = "email"
    SMS = "sms"


class MessageDirection(str, Enum):
    """Direction of the message."""

    INBOUND = "inbound"
    OUTBOUND = "outbound"


# ============ Message Schemas ============


class MessageCreate(BaseModel):
    """Schema for creating a new message."""

    content: str = Field(..., min_length=1, max_length=10000)
    channel: MessageChannel = MessageChannel.INTERNAL


class MessageResponse(BaseModel):
    """Schema for message response."""

    id: uuid.UUID
    conversation_id: uuid.UUID
    content: str
    channel: MessageChannel
    direction: MessageDirection
    sender_id: uuid.UUID | None
    sender_name: str | None
    external_id: str | None
    is_read: bool
    read_at: datetime | None
    delivered_at: datetime | None
    failed_at: datetime | None
    failure_reason: str | None
    # Email threading fields
    email_message_id: str | None = None
    email_in_reply_to: str | None = None
    email_subject: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============ Conversation Schemas ============


class ConversationCreate(BaseModel):
    """Schema for creating a new conversation."""

    client_name: str = Field(..., min_length=1, max_length=255)
    client_email: EmailStr | None = None
    client_phone: str | None = Field(None, max_length=50)
    subject: str | None = Field(None, max_length=500)
    studio_id: uuid.UUID | None = None
    booking_request_id: uuid.UUID | None = None
    initial_message: str | None = Field(None, min_length=1, max_length=10000)


class ConversationUpdate(BaseModel):
    """Schema for updating a conversation."""

    status: ConversationStatus | None = None
    assigned_to_id: uuid.UUID | None = None
    subject: str | None = Field(None, max_length=500)


class ConversationSummary(BaseModel):
    """Schema for conversation summary (list view)."""

    id: uuid.UUID
    client_name: str
    client_email: str | None
    client_phone: str | None
    status: ConversationStatus
    subject: str | None
    last_message_at: datetime | None
    last_message_preview: str | None
    unread_count: int
    assigned_to_id: uuid.UUID | None
    assigned_to_name: str | None = None
    booking_request_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    """Schema for full conversation with messages."""

    id: uuid.UUID
    client_name: str
    client_email: str | None
    client_phone: str | None
    status: ConversationStatus
    subject: str | None
    last_message_at: datetime | None
    unread_count: int
    assigned_to_id: uuid.UUID | None
    assigned_to_name: str | None = None
    studio_id: uuid.UUID | None
    booking_request_id: uuid.UUID | None
    messages: list[MessageResponse]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConversationsListResponse(BaseModel):
    """Schema for paginated conversations list."""

    conversations: list[ConversationSummary]
    total: int
    skip: int
    limit: int


# ============ Reply Templates ============


class ReplyTemplateCreate(BaseModel):
    """Schema for creating a quick reply template."""

    name: str = Field(..., min_length=1, max_length=100)
    content: str = Field(..., min_length=1, max_length=5000)
    category: str | None = Field(None, max_length=50)


class ReplyTemplateUpdate(BaseModel):
    """Schema for updating a quick reply template."""

    name: str | None = Field(None, min_length=1, max_length=100)
    content: str | None = Field(None, min_length=1, max_length=5000)
    category: str | None = Field(None, max_length=50)


class ReplyTemplateResponse(BaseModel):
    """Schema for reply template response."""

    id: uuid.UUID
    name: str
    content: str
    category: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ Action Responses ============


class MarkReadResponse(BaseModel):
    """Response for marking messages as read."""

    conversation_id: uuid.UUID
    messages_marked_read: int
    success: bool = True


class AssignConversationResponse(BaseModel):
    """Response for assigning a conversation."""

    conversation_id: uuid.UUID
    assigned_to_id: uuid.UUID | None
    assigned_to_name: str | None
    success: bool = True
