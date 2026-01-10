"""User model for authentication and authorization."""

import enum
import secrets
from datetime import datetime, timedelta
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.artist import ArtistProfile
    from app.models.availability import ArtistAvailability, ArtistTimeOff
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
