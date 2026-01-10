"""Commission rules and tracking models."""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.studio import Studio
    from app.models.user import User


class CommissionType(str, enum.Enum):
    """Type of commission calculation."""

    PERCENTAGE = "percentage"  # Percentage of service total
    FLAT_FEE = "flat_fee"  # Fixed amount per appointment
    TIERED = "tiered"  # Tiered percentages based on revenue


class PayPeriodSchedule(str, enum.Enum):
    """Pay period schedule types."""

    WEEKLY = "weekly"  # Every week
    BIWEEKLY = "biweekly"  # Every two weeks
    SEMIMONTHLY = "semimonthly"  # Twice per month (1st and 15th)
    MONTHLY = "monthly"  # Once per month


class PayPeriodStatus(str, enum.Enum):
    """Status of a pay period."""

    OPEN = "open"  # Accepting new commissions
    CLOSED = "closed"  # Closed, pending payment
    PAID = "paid"  # Marked as paid


class CommissionRule(BaseModel, SoftDeleteMixin):
    """Commission rule for calculating artist payouts."""

    __tablename__ = "commission_rules"

    # Basic info
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Commission type
    commission_type: Mapped[CommissionType] = mapped_column(
        Enum(CommissionType, name="commission_type"),
        nullable=False,
        default=CommissionType.PERCENTAGE,
    )

    # For percentage type: the percentage (e.g., 50.0 for 50%)
    percentage: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # For flat_fee type: the amount in cents
    flat_fee_amount: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Is this the default rule for the studio?
    is_default: Mapped[bool] = mapped_column(default=False)

    # Is this rule active?
    is_active: Mapped[bool] = mapped_column(default=True, index=True)

    # Studio relationship
    studio_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Created by
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    studio: Mapped["Studio"] = relationship(
        "Studio", back_populates="commission_rules"
    )
    created_by: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[created_by_id]
    )
    tiers: Mapped[list["CommissionTier"]] = relationship(
        "CommissionTier",
        back_populates="commission_rule",
        cascade="all, delete-orphan",
        order_by="CommissionTier.min_revenue",
    )
    # Users assigned this rule
    assigned_artists: Mapped[list["User"]] = relationship(
        "User",
        back_populates="commission_rule",
        foreign_keys="User.commission_rule_id",
    )


class CommissionTier(BaseModel):
    """Tier for tiered commission rules."""

    __tablename__ = "commission_tiers"

    commission_rule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("commission_rules.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Revenue range for this tier (in cents)
    # min_revenue is inclusive, max_revenue is exclusive (NULL = unlimited)
    min_revenue: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_revenue: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # The percentage for this tier
    percentage: Mapped[float] = mapped_column(Float, nullable=False)

    # Relationship
    commission_rule: Mapped["CommissionRule"] = relationship(
        "CommissionRule", back_populates="tiers"
    )


class EarnedCommission(BaseModel):
    """Earned commission record from a completed booking."""

    __tablename__ = "earned_commissions"

    # Link to the booking
    booking_request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("booking_requests.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # One commission per booking
        index=True,
    )

    # The artist who earned the commission
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # The studio
    studio_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # The commission rule used (snapshot, may be deleted later)
    commission_rule_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("commission_rules.id", ondelete="SET NULL"),
        nullable=True,
    )
    commission_rule_name: Mapped[str] = mapped_column(String(100), nullable=False)
    commission_type: Mapped[CommissionType] = mapped_column(
        Enum(CommissionType, name="commission_type", create_type=False),
        nullable=False,
    )

    # Amounts (all in cents)
    service_total: Mapped[int] = mapped_column(Integer, nullable=False)  # Total service cost
    studio_commission: Mapped[int] = mapped_column(Integer, nullable=False)  # Studio's share
    artist_payout: Mapped[int] = mapped_column(Integer, nullable=False)  # Artist's share
    tips_amount: Mapped[int] = mapped_column(Integer, default=0)  # Tips (100% to artist)

    # Calculation details for audit
    calculation_details: Mapped[str] = mapped_column(Text, nullable=False)

    # Completion date (when the booking was completed)
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Pay period tracking
    pay_period_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pay_periods.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # Legacy fields kept for backwards compatibility
    pay_period_start: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    pay_period_end: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    paid_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    payout_reference: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )  # External reference (check #, transfer ID, etc.)

    # Relationships
    booking_request: Mapped["BookingRequest"] = relationship(
        "BookingRequest", back_populates="earned_commission"
    )
    artist: Mapped[Optional["User"]] = relationship(
        "User", back_populates="earned_commissions"
    )
    studio: Mapped["Studio"] = relationship(
        "Studio", back_populates="earned_commissions"
    )
    commission_rule: Mapped[Optional["CommissionRule"]] = relationship(
        "CommissionRule", foreign_keys=[commission_rule_id]
    )
    pay_period: Mapped[Optional["PayPeriod"]] = relationship(
        "PayPeriod", back_populates="commissions"
    )


class PayPeriod(BaseModel):
    """Pay period for grouping and paying out commissions."""

    __tablename__ = "pay_periods"

    # Studio relationship
    studio_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Period dates
    start_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    end_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )

    # Status
    status: Mapped[PayPeriodStatus] = mapped_column(
        Enum(PayPeriodStatus, name="pay_period_status"),
        nullable=False,
        default=PayPeriodStatus.OPEN,
        index=True,
    )

    # Calculated totals (denormalized for quick access)
    total_service: Mapped[int] = mapped_column(Integer, default=0)  # Total service revenue in cents
    total_studio_commission: Mapped[int] = mapped_column(Integer, default=0)  # Studio commission in cents
    total_artist_payout: Mapped[int] = mapped_column(Integer, default=0)  # Artist payouts in cents
    total_tips: Mapped[int] = mapped_column(Integer, default=0)  # Tips in cents
    commission_count: Mapped[int] = mapped_column(Integer, default=0)  # Number of commissions

    # Payment tracking
    closed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    paid_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    payout_reference: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )  # External reference (check #, transfer ID, etc.)
    payment_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    studio: Mapped["Studio"] = relationship("Studio", back_populates="pay_periods")
    commissions: Mapped[list["EarnedCommission"]] = relationship(
        "EarnedCommission",
        back_populates="pay_period",
        foreign_keys="EarnedCommission.pay_period_id",
    )


# Import at end to avoid circular imports
if TYPE_CHECKING:
    from app.models.booking import BookingRequest
