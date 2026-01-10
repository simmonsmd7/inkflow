"""Aftercare models for post-tattoo care management."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, SoftDeleteMixin


class TattooType(str, enum.Enum):
    """Types of tattoos for aftercare categorization."""

    TRADITIONAL = "traditional"
    FINE_LINE = "fine_line"
    BLACKWORK = "blackwork"
    WATERCOLOR = "watercolor"
    REALISM = "realism"
    NEO_TRADITIONAL = "neo_traditional"
    GEOMETRIC = "geometric"
    TRIBAL = "tribal"
    DOTWORK = "dotwork"
    SCRIPT = "script"
    COVER_UP = "cover_up"
    TOUCH_UP = "touch_up"
    OTHER = "other"


class TattooPlacement(str, enum.Enum):
    """Body placement categories for aftercare."""

    ARM_UPPER = "arm_upper"
    ARM_LOWER = "arm_lower"
    ARM_INNER = "arm_inner"
    HAND = "hand"
    FINGER = "finger"
    LEG_UPPER = "leg_upper"
    LEG_LOWER = "leg_lower"
    FOOT = "foot"
    CHEST = "chest"
    BACK = "back"
    RIBS = "ribs"
    STOMACH = "stomach"
    NECK = "neck"
    FACE = "face"
    HEAD = "head"
    SHOULDER = "shoulder"
    HIP = "hip"
    OTHER = "other"


class AftercareTemplate(BaseModel, SoftDeleteMixin):
    """Template for aftercare instructions by tattoo type and placement."""

    __tablename__ = "aftercare_templates"

    # Studio ownership
    studio_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Template identification
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Categorization (optional - can apply to any if null)
    tattoo_type: Mapped[TattooType | None] = mapped_column(
        Enum(TattooType),
        nullable=True,
    )
    placement: Mapped[TattooPlacement | None] = mapped_column(
        Enum(TattooPlacement),
        nullable=True,
    )

    # Content
    instructions_html: Mapped[str] = mapped_column(Text, nullable=False)
    instructions_plain: Mapped[str] = mapped_column(Text, nullable=False)

    # Additional structured info
    # {
    #   "days_covered": 14,
    #   "key_points": ["Keep clean", "Don't scratch", ...],
    #   "products_recommended": ["Aquaphor", "Unscented lotion", ...],
    #   "products_to_avoid": ["Alcohol-based products", ...],
    #   "warning_signs": ["Excessive redness", "Pus", ...]
    # }
    extra_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Settings
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Usage tracking
    use_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Creator tracking
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    studio = relationship("Studio", back_populates="aftercare_templates")
    created_by = relationship("User", back_populates="created_aftercare_templates")
    sent_records = relationship(
        "AftercareSent",
        back_populates="template",
        cascade="all, delete-orphan",
    )


class AftercareSentStatus(str, enum.Enum):
    """Status of sent aftercare instructions."""

    PENDING = "pending"  # Scheduled to send
    SENT = "sent"  # Successfully sent
    DELIVERED = "delivered"  # Confirmed delivered (email opened/SMS delivered)
    FAILED = "failed"  # Failed to send


class AftercareSent(BaseModel):
    """Record of aftercare instructions sent to a client."""

    __tablename__ = "aftercare_sent"

    # Template used (snapshot)
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("aftercare_templates.id", ondelete="SET NULL"),
        nullable=True,
    )
    template_name: Mapped[str] = mapped_column(String(200), nullable=False)
    instructions_snapshot: Mapped[str] = mapped_column(Text, nullable=False)

    # Studio and booking context
    studio_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    booking_request_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("booking_requests.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    artist_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Client information
    client_name: Mapped[str] = mapped_column(String(200), nullable=False)
    client_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    client_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Tattoo context
    tattoo_type: Mapped[TattooType | None] = mapped_column(
        Enum(TattooType),
        nullable=True,
    )
    placement: Mapped[TattooPlacement | None] = mapped_column(
        Enum(TattooPlacement),
        nullable=True,
    )
    tattoo_description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Appointment context
    appointment_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    # Sending status
    status: Mapped[AftercareSentStatus] = mapped_column(
        Enum(AftercareSentStatus),
        default=AftercareSentStatus.PENDING,
        nullable=False,
    )
    sent_via: Mapped[str] = mapped_column(String(20), default="email", nullable=False)  # email, sms, both
    sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    delivered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Access token for client to view online
    access_token: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
    )

    # Client viewed tracking
    first_viewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    view_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    template = relationship("AftercareTemplate", back_populates="sent_records")
    studio = relationship("Studio", back_populates="aftercare_sent")
    booking_request = relationship("BookingRequest", back_populates="aftercare_sent")
    artist = relationship("User", back_populates="aftercare_sent_by")
    follow_ups = relationship(
        "AftercareFollowUp",
        back_populates="aftercare_sent",
        cascade="all, delete-orphan",
    )
    healing_reports = relationship(
        "HealingIssueReport",
        back_populates="aftercare_sent",
        cascade="all, delete-orphan",
    )


class FollowUpType(str, enum.Enum):
    """Types of follow-up messages."""

    DAY_3 = "day_3"
    WEEK_1 = "week_1"
    WEEK_2 = "week_2"
    WEEK_4 = "week_4"
    CUSTOM = "custom"


class FollowUpStatus(str, enum.Enum):
    """Status of follow-up messages."""

    SCHEDULED = "scheduled"
    SENT = "sent"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    FAILED = "failed"


class AftercareFollowUp(BaseModel):
    """Scheduled follow-up messages after tattoo appointment."""

    __tablename__ = "aftercare_follow_ups"

    aftercare_sent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("aftercare_sent.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Follow-up details
    follow_up_type: Mapped[FollowUpType] = mapped_column(
        Enum(FollowUpType),
        nullable=False,
    )
    scheduled_for: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    # Message content
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    message_html: Mapped[str] = mapped_column(Text, nullable=False)
    message_plain: Mapped[str] = mapped_column(Text, nullable=False)

    # Status tracking
    status: Mapped[FollowUpStatus] = mapped_column(
        Enum(FollowUpStatus),
        default=FollowUpStatus.SCHEDULED,
        nullable=False,
    )
    send_via: Mapped[str] = mapped_column(String(20), default="email", nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    delivered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    aftercare_sent = relationship("AftercareSent", back_populates="follow_ups")


class HealingIssueSeverity(str, enum.Enum):
    """Severity levels for healing issues."""

    MINOR = "minor"  # Expected healing, no concern
    MODERATE = "moderate"  # Worth monitoring
    CONCERNING = "concerning"  # Should contact artist
    URGENT = "urgent"  # Seek medical attention


class HealingIssueStatus(str, enum.Enum):
    """Status of healing issue reports."""

    REPORTED = "reported"
    ACKNOWLEDGED = "acknowledged"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    ESCALATED = "escalated"


class HealingIssueReport(BaseModel):
    """Client-reported healing issues after tattoo."""

    __tablename__ = "healing_issue_reports"

    aftercare_sent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("aftercare_sent.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Studio context
    studio_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Issue details
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[HealingIssueSeverity] = mapped_column(
        Enum(HealingIssueSeverity),
        default=HealingIssueSeverity.MINOR,
        nullable=False,
    )

    # Symptoms (structured)
    # ["redness", "swelling", "itching", "oozing", "scabbing", "color_loss", "infection_signs"]
    symptoms: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)

    # Photo attachments (file paths)
    photo_urls: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)

    # Days since appointment
    days_since_appointment: Mapped[int] = mapped_column(Integer, nullable=False)

    # Status and resolution
    status: Mapped[HealingIssueStatus] = mapped_column(
        Enum(HealingIssueStatus),
        default=HealingIssueStatus.REPORTED,
        nullable=False,
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Staff response
    responded_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    responded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    staff_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Touch-up scheduling
    touch_up_requested: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    touch_up_booking_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("booking_requests.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    aftercare_sent = relationship("AftercareSent", back_populates="healing_reports")
    studio = relationship("Studio", back_populates="healing_reports")
    responded_by = relationship("User", back_populates="responded_healing_reports")
    touch_up_booking = relationship("BookingRequest", back_populates="healing_issue_touch_ups")
