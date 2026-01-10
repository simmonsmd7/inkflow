"""Booking request and related models."""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.user import User


class BookingRequestStatus(str, enum.Enum):
    """Status of a booking request."""

    PENDING = "pending"  # Just submitted, awaiting review
    REVIEWING = "reviewing"  # Artist is reviewing
    QUOTED = "quoted"  # Artist sent a quote
    DEPOSIT_REQUESTED = "deposit_requested"  # Waiting for deposit
    DEPOSIT_PAID = "deposit_paid"  # Deposit received
    CONFIRMED = "confirmed"  # Appointment confirmed
    COMPLETED = "completed"  # Tattoo session completed
    REJECTED = "rejected"  # Request rejected
    CANCELLED = "cancelled"  # Client cancelled


class TattooSize(str, enum.Enum):
    """Approximate size categories for tattoo requests."""

    TINY = "tiny"  # Under 2 inches
    SMALL = "small"  # 2-4 inches
    MEDIUM = "medium"  # 4-6 inches
    LARGE = "large"  # 6-10 inches
    EXTRA_LARGE = "extra_large"  # 10+ inches
    HALF_SLEEVE = "half_sleeve"
    FULL_SLEEVE = "full_sleeve"
    BACK_PIECE = "back_piece"
    FULL_BODY = "full_body"


class BookingRequest(BaseModel, SoftDeleteMixin):
    """Booking request submitted by a client."""

    __tablename__ = "booking_requests"

    # Client info
    client_name: Mapped[str] = mapped_column(String(255), nullable=False)
    client_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    client_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Design details
    design_idea: Mapped[str] = mapped_column(Text, nullable=False)
    placement: Mapped[str] = mapped_column(String(255), nullable=False)
    size: Mapped[TattooSize] = mapped_column(
        Enum(TattooSize, name="tattoo_size"),
        nullable=False,
    )
    is_cover_up: Mapped[bool] = mapped_column(default=False)
    is_first_tattoo: Mapped[bool] = mapped_column(default=False)
    color_preference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    budget_range: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    additional_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Studio and artist assignment
    studio_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    preferred_artist_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    assigned_artist_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Status and workflow
    status: Mapped[BookingRequestStatus] = mapped_column(
        Enum(BookingRequestStatus, name="booking_request_status"),
        default=BookingRequestStatus.PENDING,
        nullable=False,
        index=True,
    )

    # Quote and pricing
    quoted_price: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # In cents
    deposit_amount: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # In cents
    estimated_hours: Mapped[Optional[float]] = mapped_column(nullable=True)
    quote_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    quoted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Deposit tracking
    deposit_payment_token: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, unique=True, index=True
    )
    deposit_requested_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    deposit_request_expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    deposit_paid_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    deposit_stripe_payment_intent_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )

    # Scheduling
    preferred_dates: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    scheduled_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    scheduled_duration_hours: Mapped[Optional[float]] = mapped_column(nullable=True)

    # Internal notes
    internal_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Reminder tracking
    reminder_24h_sent_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reminder_2h_sent_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Cancellation tracking
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancelled_by: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True
    )  # 'client', 'artist', 'studio'
    cancellation_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    deposit_forfeited: Mapped[bool] = mapped_column(default=False)

    # Reschedule tracking
    reschedule_count: Mapped[int] = mapped_column(Integer, default=0)
    original_scheduled_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_rescheduled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_reschedule_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    studio: Mapped["Studio"] = relationship("Studio", back_populates="booking_requests")
    preferred_artist: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[preferred_artist_id],
        back_populates="preferred_booking_requests",
    )
    assigned_artist: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[assigned_artist_id],
        back_populates="assigned_booking_requests",
    )
    reference_images: Mapped[list["BookingReferenceImage"]] = relationship(
        "BookingReferenceImage",
        back_populates="booking_request",
        cascade="all, delete-orphan",
        order_by="BookingReferenceImage.display_order",
    )


class BookingReferenceImage(BaseModel):
    """Reference image uploaded with a booking request."""

    __tablename__ = "booking_reference_images"

    booking_request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("booking_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    original_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationship
    booking_request: Mapped["BookingRequest"] = relationship(
        "BookingRequest", back_populates="reference_images"
    )
