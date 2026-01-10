"""User model for authentication and authorization."""

import enum
import secrets
from datetime import datetime, timedelta
import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.artist import ArtistProfile
    from app.models.availability import ArtistAvailability, ArtistTimeOff
    from app.models.booking import BookingRequest
    from app.models.commission import CommissionRule, EarnedCommission
    from app.models.consent import ConsentAuditLog, ConsentFormSubmission, ConsentFormTemplate
    from app.models.message import Conversation, Message
    from app.models.studio import Studio


class UserRole(str, enum.Enum):
    """User role enumeration."""

    OWNER = "owner"
    ARTIST = "artist"
    RECEPTIONIST = "receptionist"


class User(BaseModel, SoftDeleteMixin):
    """User model for authentication."""

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    # Profile
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Role and permissions
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole),
        default=UserRole.ARTIST,
        nullable=False
    )

    # Account status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Email verification
    verification_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    verification_token_expires: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Password reset
    password_reset_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_reset_expires: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Login tracking
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Commission rule assignment (for artists)
    commission_rule_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("commission_rules.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Relationships
    owned_studios: Mapped[list["Studio"]] = relationship(
        "Studio", back_populates="owner", lazy="selectin"
    )
    artist_profile: Mapped["ArtistProfile | None"] = relationship(
        "ArtistProfile", back_populates="user", uselist=False, lazy="selectin"
    )
    availability_slots: Mapped[list["ArtistAvailability"]] = relationship(
        "ArtistAvailability", back_populates="user", lazy="selectin", cascade="all, delete-orphan"
    )
    time_off_periods: Mapped[list["ArtistTimeOff"]] = relationship(
        "ArtistTimeOff", back_populates="user", lazy="selectin", cascade="all, delete-orphan"
    )
    preferred_booking_requests: Mapped[list["BookingRequest"]] = relationship(
        "BookingRequest",
        foreign_keys="BookingRequest.preferred_artist_id",
        back_populates="preferred_artist",
        lazy="selectin",
    )
    assigned_booking_requests: Mapped[list["BookingRequest"]] = relationship(
        "BookingRequest",
        foreign_keys="BookingRequest.assigned_artist_id",
        back_populates="assigned_artist",
        lazy="selectin",
    )
    assigned_conversations: Mapped[list["Conversation"]] = relationship(
        "Conversation",
        back_populates="assigned_to",
        foreign_keys="Conversation.assigned_to_id",
        lazy="selectin",
    )
    sent_messages: Mapped[list["Message"]] = relationship(
        "Message",
        back_populates="sender",
        foreign_keys="Message.sender_id",
        lazy="selectin",
    )
    commission_rule: Mapped[Optional["CommissionRule"]] = relationship(
        "CommissionRule",
        back_populates="assigned_artists",
        foreign_keys=[commission_rule_id],
        lazy="selectin",
    )
    earned_commissions: Mapped[list["EarnedCommission"]] = relationship(
        "EarnedCommission",
        back_populates="artist",
        foreign_keys="EarnedCommission.artist_id",
        lazy="selectin",
    )
    created_consent_templates: Mapped[list["ConsentFormTemplate"]] = relationship(
        "ConsentFormTemplate",
        back_populates="created_by",
        foreign_keys="ConsentFormTemplate.created_by_id",
        lazy="selectin",
    )
    verified_photo_ids: Mapped[list["ConsentFormSubmission"]] = relationship(
        "ConsentFormSubmission",
        back_populates="photo_id_verified_by",
        foreign_keys="ConsentFormSubmission.photo_id_verified_by_id",
        lazy="selectin",
    )
    voided_consent_forms: Mapped[list["ConsentFormSubmission"]] = relationship(
        "ConsentFormSubmission",
        back_populates="voided_by",
        foreign_keys="ConsentFormSubmission.voided_by_id",
        lazy="selectin",
    )
    age_verified_consent_forms: Mapped[list["ConsentFormSubmission"]] = relationship(
        "ConsentFormSubmission",
        back_populates="age_verified_by",
        foreign_keys="ConsentFormSubmission.age_verified_by_id",
        lazy="selectin",
    )
    consent_audit_logs: Mapped[list["ConsentAuditLog"]] = relationship(
        "ConsentAuditLog",
        back_populates="performed_by",
        foreign_keys="ConsentAuditLog.performed_by_id",
        lazy="selectin",
    )

    @property
    def full_name(self) -> str:
        """Get user's full name."""
        return f"{self.first_name} {self.last_name}"

    def generate_verification_token(self) -> str:
        """Generate a new email verification token."""
        self.verification_token = secrets.token_urlsafe(32)
        self.verification_token_expires = datetime.utcnow() + timedelta(hours=24)
        return self.verification_token

    def generate_password_reset_token(self) -> str:
        """Generate a new password reset token."""
        self.password_reset_token = secrets.token_urlsafe(32)
        self.password_reset_expires = datetime.utcnow() + timedelta(hours=1)
        return self.password_reset_token

    def verify_email(self) -> None:
        """Mark email as verified."""
        self.is_verified = True
        self.verified_at = datetime.utcnow()
        self.verification_token = None
        self.verification_token_expires = None

    def clear_password_reset(self) -> None:
        """Clear password reset token."""
        self.password_reset_token = None
        self.password_reset_expires = None
