"""Studio model for tattoo studio profile and settings."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, SoftDeleteMixin
from app.models.commission import PayPeriodSchedule

if TYPE_CHECKING:
    from app.models.booking import BookingRequest
    from app.models.commission import CommissionRule, EarnedCommission, PayPeriod
    from app.models.consent import ConsentFormSubmission, ConsentFormTemplate
    from app.models.message import Conversation
    from app.models.user import User


class Studio(BaseModel, SoftDeleteMixin):
    """Studio model for studio profile and configuration."""

    __tablename__ = "studios"

    # Basic info
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Branding
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Contact info
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Address
    address_line1: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address_line2: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    country: Mapped[str] = mapped_column(String(2), default="US", nullable=False)

    # Business hours (stored as JSON)
    # Format: {"monday": {"open": "09:00", "close": "18:00", "closed": false}, ...}
    business_hours: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Timezone for display
    timezone: Mapped[str] = mapped_column(String(50), default="America/New_York", nullable=False)

    # Pay period settings
    pay_period_schedule: Mapped[PayPeriodSchedule | None] = mapped_column(
        Enum(PayPeriodSchedule, name="pay_period_schedule"),
        nullable=True,
        default=PayPeriodSchedule.BIWEEKLY,
    )
    # For weekly/biweekly: 0=Monday, 1=Tuesday, ..., 6=Sunday
    # For monthly/semimonthly: 1-28 (day of month)
    pay_period_start_day: Mapped[int] = mapped_column(Integer, default=1)

    # Tip distribution settings
    # Percentage of tips that goes to the artist (0-100, default 100 = artist keeps all tips)
    tip_artist_percentage: Mapped[int] = mapped_column(Integer, default=100)

    # Owner reference (the user who created/owns the studio)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )

    # Relationships
    owner: Mapped["User"] = relationship("User", back_populates="owned_studios")
    booking_requests: Mapped[list["BookingRequest"]] = relationship(
        "BookingRequest",
        back_populates="studio",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    conversations: Mapped[list["Conversation"]] = relationship(
        "Conversation",
        back_populates="studio",
        lazy="selectin",
    )
    commission_rules: Mapped[list["CommissionRule"]] = relationship(
        "CommissionRule",
        back_populates="studio",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    earned_commissions: Mapped[list["EarnedCommission"]] = relationship(
        "EarnedCommission",
        back_populates="studio",
        lazy="selectin",
    )
    pay_periods: Mapped[list["PayPeriod"]] = relationship(
        "PayPeriod",
        back_populates="studio",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    consent_templates: Mapped[list["ConsentFormTemplate"]] = relationship(
        "ConsentFormTemplate",
        back_populates="studio",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    consent_submissions: Mapped[list["ConsentFormSubmission"]] = relationship(
        "ConsentFormSubmission",
        back_populates="studio",
        lazy="selectin",
    )

    @property
    def full_address(self) -> str | None:
        """Get formatted full address."""
        parts = []
        if self.address_line1:
            parts.append(self.address_line1)
        if self.address_line2:
            parts.append(self.address_line2)
        if self.city or self.state or self.postal_code:
            city_state_zip = []
            if self.city:
                city_state_zip.append(self.city)
            if self.state:
                city_state_zip.append(self.state)
            if self.postal_code:
                city_state_zip.append(self.postal_code)
            parts.append(", ".join(city_state_zip))
        if self.country and self.country != "US":
            parts.append(self.country)
        return "\n".join(parts) if parts else None
