"""Pydantic schemas for commission rules."""

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class CommissionType(str, Enum):
    """Type of commission calculation."""

    PERCENTAGE = "percentage"
    FLAT_FEE = "flat_fee"
    TIERED = "tiered"


class PayPeriodSchedule(str, Enum):
    """Pay period schedule types."""

    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    SEMIMONTHLY = "semimonthly"
    MONTHLY = "monthly"


class PayPeriodStatus(str, Enum):
    """Status of a pay period."""

    OPEN = "open"
    CLOSED = "closed"
    PAID = "paid"


class TipPaymentMethod(str, Enum):
    """How tips were paid (for tax reporting)."""

    CARD = "card"
    CASH = "cash"


# ============ Commission Tier Schemas ============


class CommissionTierBase(BaseModel):
    """Base schema for commission tier."""

    min_revenue: int = Field(ge=0, description="Minimum revenue in cents (inclusive)")
    max_revenue: Optional[int] = Field(
        None, ge=0, description="Maximum revenue in cents (exclusive, null = unlimited)"
    )
    percentage: float = Field(ge=0, le=100, description="Commission percentage for this tier")


class CommissionTierCreate(CommissionTierBase):
    """Schema for creating a commission tier."""

    pass


class CommissionTierUpdate(BaseModel):
    """Schema for updating a commission tier."""

    min_revenue: Optional[int] = Field(None, ge=0)
    max_revenue: Optional[int] = Field(None, ge=0)
    percentage: Optional[float] = Field(None, ge=0, le=100)


class CommissionTierResponse(CommissionTierBase):
    """Schema for commission tier response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime


# ============ Commission Rule Schemas ============


class CommissionRuleBase(BaseModel):
    """Base schema for commission rule."""

    name: str = Field(min_length=1, max_length=100, description="Name of the commission rule")
    description: Optional[str] = Field(None, description="Description of the rule")
    commission_type: CommissionType = Field(
        default=CommissionType.PERCENTAGE, description="Type of commission calculation"
    )
    percentage: Optional[float] = Field(
        None,
        ge=0,
        le=100,
        description="Commission percentage (for percentage type)",
    )
    flat_fee_amount: Optional[int] = Field(
        None,
        ge=0,
        description="Flat fee amount in cents (for flat_fee type)",
    )
    is_default: bool = Field(default=False, description="Is this the default rule for the studio?")
    is_active: bool = Field(default=True, description="Is this rule active?")


class CommissionRuleCreate(CommissionRuleBase):
    """Schema for creating a commission rule."""

    tiers: Optional[list[CommissionTierCreate]] = Field(
        None, description="Tiers for tiered commission (required for tiered type)"
    )

    @model_validator(mode="after")
    def validate_commission_type_fields(self) -> "CommissionRuleCreate":
        """Validate that required fields are present based on commission type."""
        if self.commission_type == CommissionType.PERCENTAGE:
            if self.percentage is None:
                raise ValueError("percentage is required for percentage commission type")
        elif self.commission_type == CommissionType.FLAT_FEE:
            if self.flat_fee_amount is None:
                raise ValueError("flat_fee_amount is required for flat_fee commission type")
        elif self.commission_type == CommissionType.TIERED:
            if not self.tiers or len(self.tiers) == 0:
                raise ValueError("tiers are required for tiered commission type")
            # Validate tiers are properly ordered and non-overlapping
            sorted_tiers = sorted(self.tiers, key=lambda t: t.min_revenue)
            for i, tier in enumerate(sorted_tiers):
                if i > 0:
                    prev_tier = sorted_tiers[i - 1]
                    if prev_tier.max_revenue is None:
                        raise ValueError(
                            "Only the last tier can have unlimited max_revenue"
                        )
                    if tier.min_revenue != prev_tier.max_revenue:
                        raise ValueError(
                            f"Tier gap detected: tier {i} min_revenue ({tier.min_revenue}) "
                            f"!= tier {i-1} max_revenue ({prev_tier.max_revenue})"
                        )
        return self


class CommissionRuleUpdate(BaseModel):
    """Schema for updating a commission rule."""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    commission_type: Optional[CommissionType] = None
    percentage: Optional[float] = Field(None, ge=0, le=100)
    flat_fee_amount: Optional[int] = Field(None, ge=0)
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None
    tiers: Optional[list[CommissionTierCreate]] = None


class CommissionRuleSummary(BaseModel):
    """Summary schema for commission rule (for lists)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: Optional[str]
    commission_type: CommissionType
    percentage: Optional[float]
    flat_fee_amount: Optional[int]
    is_default: bool
    is_active: bool
    assigned_artist_count: int = Field(default=0, description="Number of artists using this rule")
    created_at: datetime


class CommissionRuleResponse(CommissionRuleBase):
    """Full schema for commission rule response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    studio_id: UUID
    created_by_id: Optional[UUID]
    created_at: datetime
    updated_at: Optional[datetime]
    tiers: list[CommissionTierResponse] = []


class CommissionRulesListResponse(BaseModel):
    """Response schema for listing commission rules."""

    rules: list[CommissionRuleSummary]
    total: int
    page: int
    page_size: int


# ============ Artist Commission Assignment ============


class AssignCommissionRuleInput(BaseModel):
    """Input for assigning a commission rule to an artist."""

    commission_rule_id: Optional[UUID] = Field(
        None, description="Commission rule ID (null to remove assignment)"
    )


class ArtistCommissionInfo(BaseModel):
    """Artist info with commission rule assignment."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    first_name: str
    last_name: str
    email: str
    commission_rule_id: Optional[UUID]
    commission_rule_name: Optional[str] = None


class ArtistsWithCommissionResponse(BaseModel):
    """Response for listing artists with their commission rules."""

    artists: list[ArtistCommissionInfo]
    total: int


# ============ Commission Calculation ============


class CommissionCalculationInput(BaseModel):
    """Input for calculating commission on an amount."""

    service_total: int = Field(ge=0, description="Total service amount in cents")


class CommissionCalculationResult(BaseModel):
    """Result of commission calculation."""

    service_total: int = Field(description="Total service amount in cents")
    commission_amount: int = Field(description="Commission amount in cents")
    artist_payout: int = Field(description="Artist payout amount in cents")
    rule_name: str = Field(description="Name of the commission rule used")
    commission_type: CommissionType
    calculation_details: str = Field(description="Human-readable calculation breakdown")


# ============ Earned Commission (Records) ============


class EarnedCommissionBase(BaseModel):
    """Base schema for earned commission record."""

    service_total: int = Field(ge=0, description="Total service amount in cents")
    studio_commission: int = Field(ge=0, description="Studio's commission in cents")
    artist_payout: int = Field(ge=0, description="Artist's payout in cents")
    tips_amount: int = Field(default=0, ge=0, description="Total tips amount in cents")
    tip_payment_method: Optional[TipPaymentMethod] = Field(None, description="How tips were paid")
    tip_artist_share: int = Field(default=0, ge=0, description="Artist's share of tips in cents")
    tip_studio_share: int = Field(default=0, ge=0, description="Studio's share of tips in cents")
    calculation_details: str = Field(description="Human-readable calculation breakdown")


class EarnedCommissionResponse(EarnedCommissionBase):
    """Response schema for an earned commission record."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    booking_request_id: UUID
    artist_id: Optional[UUID]
    studio_id: UUID
    commission_rule_id: Optional[UUID]
    commission_rule_name: str
    commission_type: CommissionType
    completed_at: datetime
    created_at: datetime

    # Pay period info (may be null if not yet assigned)
    pay_period_start: Optional[datetime] = None
    pay_period_end: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    payout_reference: Optional[str] = None


class EarnedCommissionWithDetails(EarnedCommissionResponse):
    """Earned commission with booking and artist details."""

    # Booking info
    client_name: str
    design_idea: Optional[str] = None

    # Artist info (if available)
    artist_name: Optional[str] = None


class EarnedCommissionsListResponse(BaseModel):
    """Response for listing earned commissions."""

    commissions: list[EarnedCommissionWithDetails]
    total: int
    page: int
    page_size: int
    # Summary totals
    total_service: int = Field(description="Sum of all service totals in cents")
    total_studio_commission: int = Field(description="Sum of all studio commissions in cents")
    total_artist_payout: int = Field(description="Sum of all artist payouts in cents")
    total_tips: int = Field(description="Sum of all tips in cents")


class CompleteBookingWithCommissionInput(BaseModel):
    """Input for completing a booking and calculating commission."""

    tips_amount: int = Field(default=0, ge=0, description="Tips amount in cents")
    tip_payment_method: Optional[TipPaymentMethod] = Field(
        None, description="How tips were paid (card or cash)"
    )
    final_price: Optional[int] = Field(
        None,
        ge=0,
        description="Final price in cents (overrides quoted price if provided)",
    )
    completion_notes: Optional[str] = Field(
        None, description="Notes about the completed session"
    )


class CompleteBookingWithCommissionResponse(BaseModel):
    """Response when completing a booking with commission calculated."""

    message: str
    booking_id: UUID
    status: str
    commission: EarnedCommissionResponse


# ============ Pay Period Schemas ============


class PayPeriodSettingsBase(BaseModel):
    """Base schema for studio pay period settings."""

    pay_period_schedule: PayPeriodSchedule = Field(
        default=PayPeriodSchedule.BIWEEKLY,
        description="Pay period schedule type",
    )
    pay_period_start_day: int = Field(
        default=1,
        ge=0,
        le=28,
        description="Start day (0-6 for weekly/biweekly, 1-28 for monthly/semimonthly)",
    )


class PayPeriodSettingsUpdate(PayPeriodSettingsBase):
    """Schema for updating studio pay period settings."""

    pass


class PayPeriodSettingsResponse(PayPeriodSettingsBase):
    """Response schema for studio pay period settings."""

    pass


class PayPeriodBase(BaseModel):
    """Base schema for pay period."""

    start_date: datetime = Field(description="Start date of the pay period")
    end_date: datetime = Field(description="End date of the pay period")


class PayPeriodCreate(PayPeriodBase):
    """Schema for creating a pay period manually."""

    pass


class PayPeriodSummary(BaseModel):
    """Summary schema for pay period (for lists)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    start_date: datetime
    end_date: datetime
    status: PayPeriodStatus
    total_service: int = Field(description="Total service revenue in cents")
    total_studio_commission: int = Field(description="Studio commission in cents")
    total_artist_payout: int = Field(description="Artist payouts in cents")
    total_tips: int = Field(description="Tips in cents")
    total_tips_card: int = Field(default=0, description="Card tips in cents")
    total_tips_cash: int = Field(default=0, description="Cash tips in cents")
    total_tip_artist_share: int = Field(default=0, description="Artist share of tips in cents")
    total_tip_studio_share: int = Field(default=0, description="Studio share of tips in cents")
    commission_count: int = Field(description="Number of commissions")
    closed_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    payout_reference: Optional[str] = None
    created_at: datetime


class PayPeriodResponse(PayPeriodSummary):
    """Full response schema for pay period."""

    studio_id: UUID
    payment_notes: Optional[str] = None
    updated_at: Optional[datetime] = None


class PayPeriodWithCommissions(PayPeriodResponse):
    """Pay period with its commissions."""

    commissions: list[EarnedCommissionWithDetails] = []


class PayPeriodsListResponse(BaseModel):
    """Response for listing pay periods."""

    pay_periods: list[PayPeriodSummary]
    total: int
    page: int
    page_size: int


class ClosePayPeriodInput(BaseModel):
    """Input for closing a pay period."""

    notes: Optional[str] = Field(None, description="Notes about closing the period")


class ClosePayPeriodResponse(BaseModel):
    """Response for closing a pay period."""

    message: str
    pay_period: PayPeriodSummary


class MarkPayPeriodPaidInput(BaseModel):
    """Input for marking a pay period as paid."""

    payout_reference: Optional[str] = Field(
        None, max_length=255, description="External reference (check #, transfer ID, etc.)"
    )
    payment_notes: Optional[str] = Field(None, description="Notes about the payment")


class MarkPayPeriodPaidResponse(BaseModel):
    """Response for marking a pay period as paid."""

    message: str
    pay_period: PayPeriodSummary


class AssignToPayPeriodInput(BaseModel):
    """Input for assigning commissions to a pay period."""

    commission_ids: list[UUID] = Field(
        min_length=1, description="List of commission IDs to assign"
    )


class AssignToPayPeriodResponse(BaseModel):
    """Response for assigning commissions to a pay period."""

    message: str
    assigned_count: int
    pay_period: PayPeriodSummary


# ============ Payout Reports Schemas ============


class ArtistPayoutSummary(BaseModel):
    """Summary of payouts for a single artist."""

    artist_id: UUID
    artist_name: str
    email: str
    total_service: int = Field(description="Total service revenue in cents")
    total_studio_commission: int = Field(description="Studio commission in cents")
    total_artist_payout: int = Field(description="Artist payouts in cents")
    total_tips: int = Field(description="Tips in cents")
    booking_count: int = Field(description="Number of completed bookings")
    pay_period_count: int = Field(description="Number of pay periods included")


class PayoutReportSummary(BaseModel):
    """Overall summary for a payout report."""

    total_service: int = Field(description="Total service revenue in cents")
    total_studio_commission: int = Field(description="Studio commission in cents")
    total_artist_payout: int = Field(description="Total artist payouts in cents")
    total_tips: int = Field(description="Tips in cents")
    total_bookings: int = Field(description="Number of completed bookings")
    total_pay_periods: int = Field(description="Number of pay periods included")
    artists_paid: int = Field(description="Number of artists with payouts")


class PayoutHistoryItem(BaseModel):
    """A single payout history entry."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    start_date: datetime
    end_date: datetime
    paid_at: Optional[datetime]
    payout_reference: Optional[str]
    total_service: int
    total_studio_commission: int
    total_artist_payout: int
    total_tips: int
    commission_count: int
    payment_notes: Optional[str]
    # Artist breakdown for this pay period
    artist_breakdown: list[ArtistPayoutSummary] = []


class PayoutHistoryResponse(BaseModel):
    """Response for payout history report."""

    history: list[PayoutHistoryItem]
    summary: PayoutReportSummary
    total: int
    page: int
    page_size: int


class ArtistPayoutReportResponse(BaseModel):
    """Response for artist payouts report (all artists breakdown)."""

    artists: list[ArtistPayoutSummary]
    summary: PayoutReportSummary
    start_date: Optional[datetime]
    end_date: Optional[datetime]


# ============ Tip Distribution Schemas ============


class TipSettingsBase(BaseModel):
    """Base schema for studio tip settings."""

    tip_artist_percentage: int = Field(
        default=100,
        ge=0,
        le=100,
        description="Percentage of tips that goes to the artist (0-100)",
    )


class TipSettingsUpdate(TipSettingsBase):
    """Schema for updating studio tip settings."""

    pass


class TipSettingsResponse(TipSettingsBase):
    """Response schema for studio tip settings."""

    pass


class ArtistTipSummary(BaseModel):
    """Summary of tips for a single artist."""

    artist_id: UUID
    artist_name: str
    email: str
    total_tips: int = Field(description="Total tips in cents")
    total_tips_card: int = Field(description="Card tips in cents")
    total_tips_cash: int = Field(description="Cash tips in cents")
    tip_artist_share: int = Field(description="Artist share of tips in cents")
    tip_studio_share: int = Field(description="Studio share of tips in cents")
    booking_count: int = Field(description="Number of bookings with tips")


class TipReportSummary(BaseModel):
    """Overall summary for a tip report."""

    total_tips: int = Field(description="Total tips in cents")
    total_tips_card: int = Field(description="Card tips in cents")
    total_tips_cash: int = Field(description="Cash tips in cents")
    total_artist_share: int = Field(description="Total artist share of tips in cents")
    total_studio_share: int = Field(description="Total studio share of tips in cents")
    total_bookings_with_tips: int = Field(description="Number of bookings with tips")
    artists_with_tips: int = Field(description="Number of artists with tips")


class TipReportResponse(BaseModel):
    """Response for tip distribution report."""

    artists: list[ArtistTipSummary]
    summary: TipReportSummary
    start_date: Optional[datetime]
    end_date: Optional[datetime]
