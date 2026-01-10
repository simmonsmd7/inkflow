"""Commission calculation service for automatic commission tracking."""

import uuid
from datetime import datetime, timezone
from typing import Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.booking import BookingRequest, BookingRequestStatus
from app.models.commission import (
    CommissionRule,
    CommissionTier,
    CommissionType,
    EarnedCommission,
    TipPaymentMethod,
)
from app.models.studio import Studio
from app.models.user import User, UserRole


def calculate_commission_from_rule(
    rule: CommissionRule, service_total: int
) -> Tuple[int, str]:
    """
    Calculate commission amount based on rule type.
    Returns (studio_commission_amount, calculation_details).
    """
    if rule.commission_type == CommissionType.PERCENTAGE:
        percentage = rule.percentage or 0
        commission = int(service_total * (percentage / 100))
        details = f"{percentage}% of ${service_total / 100:.2f} = ${commission / 100:.2f}"
        return commission, details

    elif rule.commission_type == CommissionType.FLAT_FEE:
        commission = rule.flat_fee_amount or 0
        details = f"Flat fee of ${commission / 100:.2f}"
        return commission, details

    elif rule.commission_type == CommissionType.TIERED:
        # For tiered, calculate based on which tier the service_total falls into
        sorted_tiers = sorted(rule.tiers, key=lambda t: t.min_revenue)
        applicable_tier = None

        for tier in sorted_tiers:
            if tier.max_revenue is None:
                # This is the unlimited tier
                if service_total >= tier.min_revenue:
                    applicable_tier = tier
            else:
                if tier.min_revenue <= service_total < tier.max_revenue:
                    applicable_tier = tier
                    break

        if applicable_tier:
            percentage = applicable_tier.percentage
            commission = int(service_total * (percentage / 100))
            tier_range = (
                f"${applicable_tier.min_revenue / 100:.2f}+"
                if applicable_tier.max_revenue is None
                else f"${applicable_tier.min_revenue / 100:.2f}-${applicable_tier.max_revenue / 100:.2f}"
            )
            details = (
                f"Tiered: {percentage}% (tier: {tier_range}) "
                f"of ${service_total / 100:.2f} = ${commission / 100:.2f}"
            )
            return commission, details
        else:
            # No applicable tier found, use 0%
            return 0, "No applicable tier found"

    return 0, "Unknown commission type"


async def get_artist_commission_rule(
    db: AsyncSession,
    artist: User,
    studio_id: uuid.UUID,
) -> Optional[CommissionRule]:
    """
    Get the commission rule for an artist.
    Falls back to studio default if no rule is assigned.
    """
    # First, check if artist has a specific rule assigned
    if artist.commission_rule_id:
        query = (
            select(CommissionRule)
            .options(selectinload(CommissionRule.tiers))
            .where(
                CommissionRule.id == artist.commission_rule_id,
                CommissionRule.is_active.is_(True),
                CommissionRule.deleted_at.is_(None),
            )
        )
        result = await db.execute(query)
        rule = result.scalar_one_or_none()
        if rule:
            return rule

    # Fall back to studio default
    query = (
        select(CommissionRule)
        .options(selectinload(CommissionRule.tiers))
        .where(
            CommissionRule.studio_id == studio_id,
            CommissionRule.is_default.is_(True),
            CommissionRule.is_active.is_(True),
            CommissionRule.deleted_at.is_(None),
        )
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def calculate_and_record_commission(
    db: AsyncSession,
    booking: BookingRequest,
    tips_amount: int = 0,
    tip_payment_method: Optional[TipPaymentMethod] = None,
    final_price: Optional[int] = None,
) -> Optional[EarnedCommission]:
    """
    Calculate and record commission for a completed booking.

    Args:
        db: Database session
        booking: The booking request being completed
        tips_amount: Tips amount in cents
        tip_payment_method: How tips were paid (card or cash)
        final_price: Final service price in cents (overrides quoted_price if provided)

    Returns:
        EarnedCommission record or None if no commission rule found
    """
    # Check if commission already recorded
    existing_query = select(EarnedCommission).where(
        EarnedCommission.booking_request_id == booking.id
    )
    result = await db.execute(existing_query)
    if result.scalar_one_or_none():
        # Commission already recorded
        return None

    # Get the assigned artist
    artist = booking.assigned_artist
    if not artist:
        # No artist assigned, can't calculate commission
        return None

    # Determine the service total
    service_total = final_price if final_price is not None else booking.quoted_price
    if not service_total or service_total <= 0:
        # No valid price, can't calculate commission
        return None

    # Get the commission rule for this artist
    rule = await get_artist_commission_rule(db, artist, booking.studio_id)
    if not rule:
        # No commission rule found, can't calculate
        return None

    # Get studio for tip distribution settings
    studio_query = select(Studio).where(Studio.id == booking.studio_id)
    studio_result = await db.execute(studio_query)
    studio = studio_result.scalar_one_or_none()

    # Calculate tip distribution
    tip_artist_percentage = studio.tip_artist_percentage if studio else 100
    tip_artist_share = int(tips_amount * (tip_artist_percentage / 100))
    tip_studio_share = tips_amount - tip_artist_share

    # Calculate the commission
    studio_commission, calculation_details = calculate_commission_from_rule(
        rule, service_total
    )

    # Add tip distribution to calculation details if tips exist
    if tips_amount > 0:
        calculation_details += f" | Tips: ${tips_amount / 100:.2f} ({tip_artist_percentage}% to artist = ${tip_artist_share / 100:.2f})"

    # Artist payout is service total minus studio commission
    artist_payout = service_total - studio_commission

    # Create the earned commission record
    earned_commission = EarnedCommission(
        booking_request_id=booking.id,
        artist_id=artist.id,
        studio_id=booking.studio_id,
        commission_rule_id=rule.id,
        commission_rule_name=rule.name,
        commission_type=rule.commission_type,
        service_total=service_total,
        studio_commission=studio_commission,
        artist_payout=artist_payout,
        tips_amount=tips_amount,
        tip_payment_method=tip_payment_method,
        tip_artist_share=tip_artist_share,
        tip_studio_share=tip_studio_share,
        calculation_details=calculation_details,
        completed_at=datetime.now(timezone.utc),
    )

    db.add(earned_commission)
    await db.flush()
    await db.refresh(earned_commission)

    return earned_commission


async def get_earned_commissions(
    db: AsyncSession,
    studio_id: uuid.UUID,
    artist_id: Optional[uuid.UUID] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    unpaid_only: bool = False,
    page: int = 1,
    page_size: int = 20,
) -> Tuple[list[EarnedCommission], int, dict]:
    """
    Get earned commissions with optional filters.

    Returns:
        Tuple of (commissions list, total count, summary totals dict)
    """
    # Base query
    query = select(EarnedCommission).where(
        EarnedCommission.studio_id == studio_id,
    )

    # Apply filters
    if artist_id:
        query = query.where(EarnedCommission.artist_id == artist_id)

    if start_date:
        query = query.where(EarnedCommission.completed_at >= start_date)

    if end_date:
        query = query.where(EarnedCommission.completed_at <= end_date)

    if unpaid_only:
        query = query.where(EarnedCommission.paid_at.is_(None))

    # Get total count
    from sqlalchemy import func
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Get summary totals
    sum_query = select(
        func.coalesce(func.sum(EarnedCommission.service_total), 0).label("total_service"),
        func.coalesce(func.sum(EarnedCommission.studio_commission), 0).label("total_studio_commission"),
        func.coalesce(func.sum(EarnedCommission.artist_payout), 0).label("total_artist_payout"),
        func.coalesce(func.sum(EarnedCommission.tips_amount), 0).label("total_tips"),
    ).select_from(query.subquery())
    sum_result = await db.execute(sum_query)
    sums = sum_result.first()

    summary = {
        "total_service": sums.total_service if sums else 0,
        "total_studio_commission": sums.total_studio_commission if sums else 0,
        "total_artist_payout": sums.total_artist_payout if sums else 0,
        "total_tips": sums.total_tips if sums else 0,
    }

    # Get paginated results with relationships loaded
    paginated_query = (
        query
        .options(
            selectinload(EarnedCommission.booking_request),
            selectinload(EarnedCommission.artist),
        )
        .order_by(EarnedCommission.completed_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    result = await db.execute(paginated_query)
    commissions = list(result.scalars().all())

    return commissions, total, summary
