"""Message and Conversation models for unified inbox."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class ConversationStatus(str, enum.Enum):
    """Status of a conversation."""

    UNREAD = "unread"
    PENDING = "pending"
    RESOLVED = "resolved"


class MessageChannel(str, enum.Enum):
    """Channel through which message was sent/received."""

    INTERNAL = "internal"  # Internal message within the system
    EMAIL = "email"
    SMS = "sms"


class MessageDirection(str, enum.Enum):
    """Direction of the message."""

    INBOUND = "inbound"  # From client to studio
    OUTBOUND = "outbound"  # From studio to client


class Conversation(BaseModel):
    """A conversation thread with a client."""

    __tablename__ = "conversations"

    # Client info (for external clients not in the system)
    client_name: Mapped[str] = mapped_column(String(255), nullable=False)
    client_email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    client_phone: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)

    # Link to studio
    studio_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studios.id"),
        nullable=True,
        index=True,
    )

    # Link to booking request (optional)
    booking_request_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("booking_requests.id"),
        nullable=True,
        index=True,
    )

    # Assigned artist (staff member handling this conversation)
    assigned_to_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    # Conversation status and metadata
    status: Mapped[ConversationStatus] = mapped_column(
        Enum(ConversationStatus),
        default=ConversationStatus.UNREAD,
        nullable=False,
    )
    subject: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Tracking
    last_message_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    last_message_preview: Mapped[str | None] = mapped_column(String(200), nullable=True)
    unread_count: Mapped[int] = mapped_column(default=0, nullable=False)

    # Relationships
    studio = relationship("Studio", back_populates="conversations")
    booking_request = relationship("BookingRequest", back_populates="conversation")
    assigned_to = relationship("User", back_populates="assigned_conversations")
    messages = relationship(
        "Message",
        back_populates="conversation",
        order_by="Message.created_at",
        cascade="all, delete-orphan",
    )


class Message(BaseModel):
    """A single message in a conversation."""

    __tablename__ = "messages"

    # Parent conversation
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id"),
        nullable=False,
        index=True,
    )

    # Message content
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Channel and direction
    channel: Mapped[MessageChannel] = mapped_column(
        Enum(MessageChannel),
        default=MessageChannel.INTERNAL,
        nullable=False,
    )
    direction: Mapped[MessageDirection] = mapped_column(
        Enum(MessageDirection),
        nullable=False,
    )

    # Sender info (if from staff member)
    sender_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )
    sender_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # For external messages
    external_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )  # e.g., SendGrid message ID, Twilio SID

    # Read tracking
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    read_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )

    # Delivery tracking for external messages
    delivered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    failed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    failure_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_messages")
    read_by = relationship("User", foreign_keys=[read_by_id])
