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
