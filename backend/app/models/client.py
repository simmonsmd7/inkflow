"""Client model for client portal users."""

import secrets
import uuid
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.booking import BookingRequest
    from app.models.consent import ConsentFormSubmission
    from app.models.studio import Studio


class Client(BaseModel, SoftDeleteMixin):
    """Client user for the client portal - separate from staff Users."""

    __tablename__ = "clients"

    # Basic info
    email: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True, index=True
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Authentication
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Email verification
    verification_token: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, unique=True
    )
    verification_token_expires: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Password reset
    password_reset_token: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, unique=True
    )
    password_reset_expires: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Activity tracking
    last_login_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Optional studio association (clients can be linked to a primary studio)
    primary_studio_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studios.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Additional profile info
    date_of_birth: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    emergency_contact_name: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    emergency_contact_phone: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True
    )
    medical_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    primary_studio: Mapped[Optional["Studio"]] = relationship(
        "Studio",
        back_populates="clients",
    )

    def generate_verification_token(self) -> str:
        """Generate a new email verification token."""
        self.verification_token = secrets.token_urlsafe(32)
        self.verification_token_expires = datetime.utcnow() + timedelta(hours=24)
        return self.verification_token

    def verify_email(self) -> None:
        """Mark the client's email as verified."""
        self.is_verified = True
        self.verification_token = None
        self.verification_token_expires = None

    def generate_password_reset_token(self) -> str:
        """Generate a password reset token."""
        self.password_reset_token = secrets.token_urlsafe(32)
        self.password_reset_expires = datetime.utcnow() + timedelta(hours=1)
        return self.password_reset_token

    def clear_password_reset_token(self) -> None:
        """Clear the password reset token after use."""
        self.password_reset_token = None
        self.password_reset_expires = None

    @property
    def full_name(self) -> str:
        """Return the client's full name."""
        return f"{self.first_name} {self.last_name}"
