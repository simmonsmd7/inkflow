"""Commission rules router for managing artist commission structures."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.commission import (
    CommissionRule,
    CommissionTier,
    CommissionType,
    EarnedCommission,
    PayPeriod,
    PayPeriodStatus,
)
from app.models.studio import Studio
from app.models.user import User, UserRole
from app.models.commission import TipPaymentMethod
from app.schemas.commission import (
    ArtistCommissionInfo,
    ArtistPayoutReportResponse,
    ArtistPayoutSummary,
    ArtistsWithCommissionResponse,
    ArtistTipSummary,
    AssignCommissionRuleInput,
    AssignToPayPeriodInput,
    AssignToPayPeriodResponse,
    ClosePayPeriodInput,
    ClosePayPeriodResponse,
    CommissionCalculationInput,
    CommissionCalculationResult,
    CommissionRuleCreate,
    CommissionRuleResponse,
    CommissionRulesListResponse,
    CommissionRuleSummary,
    CommissionRuleUpdate,
    CommissionTierCreate,
    EarnedCommissionsListResponse,
    EarnedCommissionWithDetails,
    MarkPayPeriodPaidInput,
    MarkPayPeriodPaidResponse,
    PayoutHistoryItem,
    PayoutHistoryResponse,
    PayoutReportSummary,
    PayPeriodCreate,
    PayPeriodResponse,
    PayPeriodSchedule,
    PayPeriodSettingsResponse,
    PayPeriodSettingsUpdate,
    PayPeriodStatus as PayPeriodStatusSchema,
    PayPeriodSummary,
    PayPeriodsListResponse,
    PayPeriodWithCommissions,
    TipReportResponse,
    TipReportSummary,
    TipSettingsResponse,
    TipSettingsUpdate,
)
from app.schemas.user import MessageResponse
from app.services.auth import get_current_user, require_owner

router = APIRouter(prefix="/commissions", tags=["Commissions"])


# ============ Helper Functions ============


async def get_user_studio(db: AsyncSession, user: User) -> Studio:
    """Get the studio for the current user (owned studios for owners)."""
    query = select(Studio).where(
        Studio.owner_id == user.id,
        Studio.deleted_at.is_(None),
    )
    result = await db.execute(query)
    studio = result.scalar_one_or_none()
    if not studio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No studio found for user",
        )
    return studio


async def get_commission_rule(
    db: AsyncSession, rule_id: uuid.UUID, studio_id: uuid.UUID
) -> CommissionRule:
    """Get a commission rule by ID and verify it belongs to the studio."""
    query = (
        select(CommissionRule)
        .options(selectinload(CommissionRule.tiers))
        .where(
            CommissionRule.id == rule_id,
            CommissionRule.studio_id == studio_id,
            CommissionRule.deleted_at.is_(None),
        )
    )
    result = await db.execute(query)
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Commission rule not found",
        )
    return rule


def calculate_commission(
    rule: CommissionRule, service_total: int
) -> tuple[int, str]:
    """
    Calculate commission amount based on rule type.
    Returns (commission_amount, calculation_details).
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
        # For tiered, we need to calculate based on tiers
        # The service_total is the period total that determines which tier applies
        # Then we apply that tier's percentage
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


# ============ Commission Rules CRUD ============


@router.get("", response_model=CommissionRulesListResponse)
async def list_commission_rules(
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    is_active: Optional[bool] = None,
) -> CommissionRulesListResponse:
    """
    List all commission rules for the user's studio.
    Owner only.
    """
    studio = await get_user_studio(db, current_user)

    # Build query
    base_query = select(CommissionRule).where(
        CommissionRule.studio_id == studio.id,
        CommissionRule.deleted_at.is_(None),
    )

    if is_active is not None:
        base_query = base_query.where(CommissionRule.is_active == is_active)

    # Count total
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated results with tiers loaded
    query = (
        base_query.options(
            selectinload(CommissionRule.tiers),
            selectinload(CommissionRule.assigned_artists),
        )
        .order_by(CommissionRule.is_default.desc(), CommissionRule.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    rules = result.scalars().all()

    # Convert to summaries with artist count
    summaries = []
    for rule in rules:
        summary = CommissionRuleSummary(
            id=rule.id,
            name=rule.name,
            description=rule.description,
            commission_type=rule.commission_type,
            percentage=rule.percentage,
            flat_fee_amount=rule.flat_fee_amount,
            is_default=rule.is_default,
            is_active=rule.is_active,
            assigned_artist_count=len(rule.assigned_artists),
            created_at=rule.created_at,
        )
        summaries.append(summary)

    return CommissionRulesListResponse(
        rules=summaries,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=CommissionRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_commission_rule(
    data: CommissionRuleCreate,
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> CommissionRuleResponse:
    """
    Create a new commission rule.
    Owner only.
    """
    studio = await get_user_studio(db, current_user)

    # If this is marked as default, unset any existing default
    if data.is_default:
        update_query = select(CommissionRule).where(
            CommissionRule.studio_id == studio.id,
            CommissionRule.is_default.is_(True),
            CommissionRule.deleted_at.is_(None),
        )
        result = await db.execute(update_query)
        existing_defaults = result.scalars().all()
        for rule in existing_defaults:
            rule.is_default = False

    # Create the rule
    rule = CommissionRule(
        name=data.name,
        description=data.description,
        commission_type=data.commission_type,
        percentage=data.percentage,
        flat_fee_amount=data.flat_fee_amount,
        is_default=data.is_default,
        is_active=data.is_active,
        studio_id=studio.id,
        created_by_id=current_user.id,
    )
    db.add(rule)
    await db.flush()

    # Create tiers if provided (for tiered type)
    if data.tiers:
        for tier_data in data.tiers:
            tier = CommissionTier(
                commission_rule_id=rule.id,
                min_revenue=tier_data.min_revenue,
                max_revenue=tier_data.max_revenue,
                percentage=tier_data.percentage,
            )
            db.add(tier)

    await db.commit()
    await db.refresh(rule)

    # Reload with tiers
    return await get_commission_rule(db, rule.id, studio.id)


@router.get("/{rule_id}", response_model=CommissionRuleResponse)
async def get_commission_rule_by_id(
    rule_id: uuid.UUID,
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> CommissionRuleResponse:
    """
    Get a commission rule by ID.
    Owner only.
    """
    studio = await get_user_studio(db, current_user)
    return await get_commission_rule(db, rule_id, studio.id)


@router.put("/{rule_id}", response_model=CommissionRuleResponse)
async def update_commission_rule(
    rule_id: uuid.UUID,
    data: CommissionRuleUpdate,
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> CommissionRuleResponse:
    """
    Update a commission rule.
    Owner only.
    """
    studio = await get_user_studio(db, current_user)
    rule = await get_commission_rule(db, rule_id, studio.id)

    # If setting as default, unset any existing default
    if data.is_default is True and not rule.is_default:
        update_query = select(CommissionRule).where(
            CommissionRule.studio_id == studio.id,
            CommissionRule.is_default.is_(True),
            CommissionRule.deleted_at.is_(None),
            CommissionRule.id != rule.id,
        )
        result = await db.execute(update_query)
        existing_defaults = result.scalars().all()
        for existing_rule in existing_defaults:
            existing_rule.is_default = False

    # Update fields
    update_data = data.model_dump(exclude_unset=True)

    # Handle tiers separately
    tiers_data = update_data.pop("tiers", None)

    for field, value in update_data.items():
        setattr(rule, field, value)

    # Update tiers if provided
    if tiers_data is not None:
        # Delete existing tiers
        for tier in rule.tiers:
            await db.delete(tier)

        # Create new tiers
        for tier_data in tiers_data:
            tier = CommissionTier(
                commission_rule_id=rule.id,
                min_revenue=tier_data.min_revenue,
                max_revenue=tier_data.max_revenue,
                percentage=tier_data.percentage,
            )
            db.add(tier)

    await db.commit()
    await db.refresh(rule)

    return await get_commission_rule(db, rule.id, studio.id)


@router.delete("/{rule_id}", response_model=MessageResponse)
async def delete_commission_rule(
    rule_id: uuid.UUID,
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """
    Delete a commission rule (soft delete).
    Owner only. Cannot delete if artists are assigned to this rule.
    """
    studio = await get_user_studio(db, current_user)
    rule = await get_commission_rule(db, rule_id, studio.id)

    # Check if any artists are assigned
    if rule.assigned_artists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete rule: {len(rule.assigned_artists)} artist(s) are assigned to it. "
            "Reassign them first.",
        )

    # Soft delete
    from datetime import datetime, timezone

    rule.deleted_at = datetime.now(timezone.utc)
    await db.commit()

    return MessageResponse(message="Commission rule deleted successfully")


# ============ Artist Commission Assignment ============


@router.get("/artists/assignments", response_model=ArtistsWithCommissionResponse)
async def list_artists_with_commission(
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> ArtistsWithCommissionResponse:
    """
    List all artists in the studio with their commission rule assignments.
    Owner only.
    """
    studio = await get_user_studio(db, current_user)

    # Get all artists (and owners) with their commission rules
    query = (
        select(User)
        .options(selectinload(User.commission_rule))
        .where(
            User.role.in_([UserRole.ARTIST, UserRole.OWNER]),
            User.is_active.is_(True),
            User.deleted_at.is_(None),
        )
        .order_by(User.first_name, User.last_name)
    )
    result = await db.execute(query)
    users = result.scalars().all()

    artists = []
    for user in users:
        # Check if user's commission rule belongs to this studio (or is None)
        rule_name = None
        rule_id = None
        if user.commission_rule and user.commission_rule.studio_id == studio.id:
            rule_name = user.commission_rule.name
            rule_id = user.commission_rule_id

        artists.append(
            ArtistCommissionInfo(
                id=user.id,
                first_name=user.first_name,
                last_name=user.last_name,
                email=user.email,
                commission_rule_id=rule_id,
                commission_rule_name=rule_name,
            )
        )

    return ArtistsWithCommissionResponse(
        artists=artists,
        total=len(artists),
    )


@router.put("/artists/{artist_id}/assignment", response_model=ArtistCommissionInfo)
async def assign_commission_rule(
    artist_id: uuid.UUID,
    data: AssignCommissionRuleInput,
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> ArtistCommissionInfo:
    """
    Assign a commission rule to an artist.
    Owner only.
    """
    studio = await get_user_studio(db, current_user)

    # Get the artist
    query = select(User).where(
        User.id == artist_id,
        User.role.in_([UserRole.ARTIST, UserRole.OWNER]),
        User.is_active.is_(True),
        User.deleted_at.is_(None),
    )
    result = await db.execute(query)
    artist = result.scalar_one_or_none()
    if not artist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artist not found",
        )

    # Validate the commission rule if provided
    rule_name = None
    if data.commission_rule_id:
        rule = await get_commission_rule(db, data.commission_rule_id, studio.id)
        if not rule.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot assign inactive commission rule",
            )
        rule_name = rule.name

    # Update the artist
    artist.commission_rule_id = data.commission_rule_id
    await db.commit()
    await db.refresh(artist)

    return ArtistCommissionInfo(
        id=artist.id,
        first_name=artist.first_name,
        last_name=artist.last_name,
        email=artist.email,
        commission_rule_id=artist.commission_rule_id,
        commission_rule_name=rule_name,
    )


# ============ Commission Calculation ============


@router.post("/{rule_id}/calculate", response_model=CommissionCalculationResult)
async def calculate_commission_amount(
    rule_id: uuid.UUID,
    data: CommissionCalculationInput,
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> CommissionCalculationResult:
    """
    Calculate commission for a given service total using a specific rule.
    Useful for previewing commission amounts.
    Owner only.
    """
    studio = await get_user_studio(db, current_user)
    rule = await get_commission_rule(db, rule_id, studio.id)

    commission_amount, details = calculate_commission(rule, data.service_total)
    artist_payout = data.service_total - commission_amount

    return CommissionCalculationResult(
        service_total=data.service_total,
        commission_amount=commission_amount,
        artist_payout=artist_payout,
        rule_name=rule.name,
        commission_type=rule.commission_type,
        calculation_details=details,
    )


@router.post("/artists/{artist_id}/calculate", response_model=CommissionCalculationResult)
async def calculate_artist_commission(
    artist_id: uuid.UUID,
    data: CommissionCalculationInput,
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> CommissionCalculationResult:
    """
    Calculate commission for a given service total using an artist's assigned rule.
    Falls back to studio default if no rule assigned.
    Owner only.
    """
    studio = await get_user_studio(db, current_user)

    # Get the artist with their commission rule
    query = (
        select(User)
        .options(selectinload(User.commission_rule))
        .where(
            User.id == artist_id,
            User.role.in_([UserRole.ARTIST, UserRole.OWNER]),
            User.is_active.is_(True),
            User.deleted_at.is_(None),
        )
    )
    result = await db.execute(query)
    artist = result.scalar_one_or_none()
    if not artist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artist not found",
        )

    # Get the rule to use (artist's rule or studio default)
    rule = None
    if artist.commission_rule and artist.commission_rule.studio_id == studio.id:
        rule = artist.commission_rule
    else:
        # Fall back to studio default
        query = (
            select(CommissionRule)
            .options(selectinload(CommissionRule.tiers))
            .where(
                CommissionRule.studio_id == studio.id,
                CommissionRule.is_default.is_(True),
                CommissionRule.is_active.is_(True),
                CommissionRule.deleted_at.is_(None),
            )
        )
        result = await db.execute(query)
        rule = result.scalar_one_or_none()

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No commission rule assigned to artist and no studio default configured",
        )

    commission_amount, details = calculate_commission(rule, data.service_total)
    artist_payout = data.service_total - commission_amount

    return CommissionCalculationResult(
        service_total=data.service_total,
        commission_amount=commission_amount,
        artist_payout=artist_payout,
        rule_name=rule.name,
        commission_type=rule.commission_type,
        calculation_details=details,
    )


# ============ Earned Commissions (Records) ============


@router.get("/earned", response_model=EarnedCommissionsListResponse)
async def list_earned_commissions(
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    artist_id: Optional[uuid.UUID] = None,
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    unpaid_only: bool = Query(False, description="Only show unpaid commissions"),
) -> EarnedCommissionsListResponse:
    """
    List earned commissions for the studio.
    Owner only. Can filter by artist, date range, and payment status.
    """
    from datetime import datetime as dt
    from app.services.commission_service import get_earned_commissions

    studio = await get_user_studio(db, current_user)

    # Parse dates
    start_dt = None
    end_dt = None
    if start_date:
        start_dt = dt.fromisoformat(start_date + "T00:00:00+00:00")
    if end_date:
        end_dt = dt.fromisoformat(end_date + "T23:59:59+00:00")

    # Get commissions
    commissions, total, summary = await get_earned_commissions(
        db=db,
        studio_id=studio.id,
        artist_id=artist_id,
        start_date=start_dt,
        end_date=end_dt,
        unpaid_only=unpaid_only,
        page=page,
        page_size=page_size,
    )

    # Build response with details
    items = []
    for comm in commissions:
        booking = comm.booking_request
        artist = comm.artist
        items.append(
            EarnedCommissionWithDetails(
                id=comm.id,
                booking_request_id=comm.booking_request_id,
                artist_id=comm.artist_id,
                studio_id=comm.studio_id,
                commission_rule_id=comm.commission_rule_id,
                commission_rule_name=comm.commission_rule_name,
                commission_type=comm.commission_type,
                service_total=comm.service_total,
                studio_commission=comm.studio_commission,
                artist_payout=comm.artist_payout,
                tips_amount=comm.tips_amount,
                calculation_details=comm.calculation_details,
                completed_at=comm.completed_at,
                created_at=comm.created_at,
                pay_period_start=comm.pay_period_start,
                pay_period_end=comm.pay_period_end,
                paid_at=comm.paid_at,
                payout_reference=comm.payout_reference,
                client_name=booking.client_name if booking else "Unknown",
                design_idea=booking.design_idea[:100] if booking else None,
                artist_name=artist.full_name if artist else None,
            )
        )

    return EarnedCommissionsListResponse(
        commissions=items,
        total=total,
        page=page,
        page_size=page_size,
        total_service=summary["total_service"],
        total_studio_commission=summary["total_studio_commission"],
        total_artist_payout=summary["total_artist_payout"],
        total_tips=summary["total_tips"],
    )


@router.get("/earned/me", response_model=EarnedCommissionsListResponse)
async def list_my_earned_commissions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    unpaid_only: bool = Query(False, description="Only show unpaid commissions"),
) -> EarnedCommissionsListResponse:
    """
    List earned commissions for the current artist.
    Artists can only see their own commissions.
    """
    from datetime import datetime as dt
    from app.models.commission import EarnedCommission

    # Must be an artist or owner
    if current_user.role not in [UserRole.ARTIST, UserRole.OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only artists and owners can view earned commissions",
        )

    # Parse dates
    start_dt = None
    end_dt = None
    if start_date:
        start_dt = dt.fromisoformat(start_date + "T00:00:00+00:00")
    if end_date:
        end_dt = dt.fromisoformat(end_date + "T23:59:59+00:00")

    # Build query for this artist's commissions
    query = select(EarnedCommission).where(
        EarnedCommission.artist_id == current_user.id,
    )

    if start_dt:
        query = query.where(EarnedCommission.completed_at >= start_dt)
    if end_dt:
        query = query.where(EarnedCommission.completed_at <= end_dt)
    if unpaid_only:
        query = query.where(EarnedCommission.paid_at.is_(None))

    # Get total count
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

    # Get paginated results
    paginated_query = (
        query
        .options(selectinload(EarnedCommission.booking_request))
        .order_by(EarnedCommission.completed_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    result = await db.execute(paginated_query)
    commissions = list(result.scalars().all())

    # Build response
    items = []
    for comm in commissions:
        booking = comm.booking_request
        items.append(
            EarnedCommissionWithDetails(
                id=comm.id,
                booking_request_id=comm.booking_request_id,
                artist_id=comm.artist_id,
                studio_id=comm.studio_id,
                commission_rule_id=comm.commission_rule_id,
                commission_rule_name=comm.commission_rule_name,
                commission_type=comm.commission_type,
                service_total=comm.service_total,
                studio_commission=comm.studio_commission,
                artist_payout=comm.artist_payout,
                tips_amount=comm.tips_amount,
                calculation_details=comm.calculation_details,
                completed_at=comm.completed_at,
                created_at=comm.created_at,
                pay_period_start=comm.pay_period_start,
                pay_period_end=comm.pay_period_end,
                paid_at=comm.paid_at,
                payout_reference=comm.payout_reference,
                client_name=booking.client_name if booking else "Unknown",
                design_idea=booking.design_idea[:100] if booking else None,
                artist_name=current_user.full_name,
            )
        )

    return EarnedCommissionsListResponse(
        commissions=items,
        total=total,
        page=page,
        page_size=page_size,
        total_service=sums.total_service if sums else 0,
        total_studio_commission=sums.total_studio_commission if sums else 0,
        total_artist_payout=sums.total_artist_payout if sums else 0,
        total_tips=sums.total_tips if sums else 0,
    )


# ============ Pay Period Settings ============


@router.get("/pay-periods/settings", response_model=PayPeriodSettingsResponse)
async def get_pay_period_settings(
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> PayPeriodSettingsResponse:
    """
    Get pay period settings for the studio.
    Owner only.
    """
    studio = await get_user_studio(db, current_user)
    return PayPeriodSettingsResponse(
        pay_period_schedule=studio.pay_period_schedule or PayPeriodSchedule.BIWEEKLY,
        pay_period_start_day=studio.pay_period_start_day or 1,
    )


@router.put("/pay-periods/settings", response_model=PayPeriodSettingsResponse)
async def update_pay_period_settings(
    data: PayPeriodSettingsUpdate,
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> PayPeriodSettingsResponse:
    """
    Update pay period settings for the studio.
    Owner only.
    """
    from app.models.commission import PayPeriodSchedule as PayPeriodScheduleModel

    studio = await get_user_studio(db, current_user)

    # Validate start_day based on schedule type
    if data.pay_period_schedule in [PayPeriodSchedule.WEEKLY, PayPeriodSchedule.BIWEEKLY]:
        if data.pay_period_start_day > 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="For weekly/biweekly schedules, start_day must be 0-6 (Monday-Sunday)",
            )
    else:
        if data.pay_period_start_day < 1 or data.pay_period_start_day > 28:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="For monthly/semimonthly schedules, start_day must be 1-28",
            )

    # Convert schema enum to model enum
    studio.pay_period_schedule = PayPeriodScheduleModel(data.pay_period_schedule.value)
    studio.pay_period_start_day = data.pay_period_start_day
    await db.commit()
    await db.refresh(studio)

    return PayPeriodSettingsResponse(
        pay_period_schedule=data.pay_period_schedule,
        pay_period_start_day=data.pay_period_start_day,
    )


# ============ Pay Periods CRUD ============


async def get_pay_period(
    db: AsyncSession, pay_period_id: uuid.UUID, studio_id: uuid.UUID
) -> PayPeriod:
    """Get a pay period by ID and verify it belongs to the studio."""
    query = select(PayPeriod).where(
        PayPeriod.id == pay_period_id,
        PayPeriod.studio_id == studio_id,
    )
    result = await db.execute(query)
    pay_period = result.scalar_one_or_none()
    if not pay_period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pay period not found",
        )
    return pay_period


async def recalculate_pay_period_totals(db: AsyncSession, pay_period: PayPeriod) -> None:
    """Recalculate denormalized totals for a pay period."""
    query = select(
        func.coalesce(func.sum(EarnedCommission.service_total), 0).label("total_service"),
        func.coalesce(func.sum(EarnedCommission.studio_commission), 0).label("total_studio_commission"),
        func.coalesce(func.sum(EarnedCommission.artist_payout), 0).label("total_artist_payout"),
        func.coalesce(func.sum(EarnedCommission.tips_amount), 0).label("total_tips"),
        func.coalesce(func.sum(EarnedCommission.tip_artist_share), 0).label("total_tip_artist_share"),
        func.coalesce(func.sum(EarnedCommission.tip_studio_share), 0).label("total_tip_studio_share"),
        func.count(EarnedCommission.id).label("count"),
    ).where(EarnedCommission.pay_period_id == pay_period.id)

    result = await db.execute(query)
    totals = result.first()

    pay_period.total_service = totals.total_service if totals else 0
    pay_period.total_studio_commission = totals.total_studio_commission if totals else 0
    pay_period.total_artist_payout = totals.total_artist_payout if totals else 0
    pay_period.total_tips = totals.total_tips if totals else 0
    pay_period.total_tip_artist_share = totals.total_tip_artist_share if totals else 0
    pay_period.total_tip_studio_share = totals.total_tip_studio_share if totals else 0
    pay_period.commission_count = totals.count if totals else 0

    # Calculate card vs cash tips
    tips_by_method_query = select(
        EarnedCommission.tip_payment_method,
        func.coalesce(func.sum(EarnedCommission.tips_amount), 0).label("tips"),
    ).where(
        EarnedCommission.pay_period_id == pay_period.id,
        EarnedCommission.tips_amount > 0,
    ).group_by(EarnedCommission.tip_payment_method)

    tips_result = await db.execute(tips_by_method_query)
    tips_by_method = tips_result.all()

    total_tips_card = 0
    total_tips_cash = 0
    for row in tips_by_method:
        if row.tip_payment_method == TipPaymentMethod.CARD:
            total_tips_card = row.tips
        elif row.tip_payment_method == TipPaymentMethod.CASH:
            total_tips_cash = row.tips
        else:
            # Unknown/null - count as card
            total_tips_card += row.tips

    pay_period.total_tips_card = total_tips_card
    pay_period.total_tips_cash = total_tips_cash


@router.get("/pay-periods", response_model=PayPeriodsListResponse)
async def list_pay_periods(
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[PayPeriodStatusSchema] = Query(None, alias="status"),
) -> PayPeriodsListResponse:
    """
    List all pay periods for the studio.
    Owner only.
    """
    studio = await get_user_studio(db, current_user)

    # Build query
    base_query = select(PayPeriod).where(PayPeriod.studio_id == studio.id)

    if status_filter:
        base_query = base_query.where(PayPeriod.status == PayPeriodStatus(status_filter.value))

    # Count total
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated results
    query = (
        base_query
        .order_by(PayPeriod.start_date.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    pay_periods = result.scalars().all()

    return PayPeriodsListResponse(
        pay_periods=[PayPeriodSummary.model_validate(pp) for pp in pay_periods],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/pay-periods", response_model=PayPeriodResponse, status_code=status.HTTP_201_CREATED)
async def create_pay_period(
    data: PayPeriodCreate,
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> PayPeriodResponse:
    """
    Create a new pay period manually.
    Owner only.
    """
    studio = await get_user_studio(db, current_user)

    # Validate dates
    if data.end_date <= data.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date must be after start date",
        )

    # Check for overlapping pay periods
    overlap_query = select(PayPeriod).where(
        PayPeriod.studio_id == studio.id,
        PayPeriod.start_date < data.end_date,
        PayPeriod.end_date > data.start_date,
    )
    result = await db.execute(overlap_query)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This pay period overlaps with an existing pay period",
        )

    # Create the pay period
    pay_period = PayPeriod(
        studio_id=studio.id,
        start_date=data.start_date,
        end_date=data.end_date,
        status=PayPeriodStatus.OPEN,
    )
    db.add(pay_period)
    await db.commit()
    await db.refresh(pay_period)

    return PayPeriodResponse.model_validate(pay_period)


@router.get("/pay-periods/{pay_period_id}", response_model=PayPeriodWithCommissions)
async def get_pay_period_by_id(
    pay_period_id: uuid.UUID,
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> PayPeriodWithCommissions:
    """
    Get a pay period with its commissions.
    Owner only.
    """
    studio = await get_user_studio(db, current_user)
    pay_period = await get_pay_period(db, pay_period_id, studio.id)

    # Get commissions for this pay period
    query = (
        select(EarnedCommission)
        .options(
            selectinload(EarnedCommission.booking_request),
            selectinload(EarnedCommission.artist),
        )
        .where(EarnedCommission.pay_period_id == pay_period.id)
        .order_by(EarnedCommission.completed_at.desc())
    )
    result = await db.execute(query)
    commissions = result.scalars().all()

    # Build commission details
    commission_details = []
    for comm in commissions:
        booking = comm.booking_request
        artist = comm.artist
        commission_details.append(
            EarnedCommissionWithDetails(
                id=comm.id,
                booking_request_id=comm.booking_request_id,
                artist_id=comm.artist_id,
                studio_id=comm.studio_id,
                commission_rule_id=comm.commission_rule_id,
                commission_rule_name=comm.commission_rule_name,
                commission_type=comm.commission_type,
                service_total=comm.service_total,
                studio_commission=comm.studio_commission,
                artist_payout=comm.artist_payout,
                tips_amount=comm.tips_amount,
                calculation_details=comm.calculation_details,
                completed_at=comm.completed_at,
                created_at=comm.created_at,
                pay_period_start=comm.pay_period_start,
                pay_period_end=comm.pay_period_end,
                paid_at=comm.paid_at,
                payout_reference=comm.payout_reference,
                client_name=booking.client_name if booking else "Unknown",
                design_idea=booking.design_idea[:100] if booking else None,
                artist_name=artist.full_name if artist else None,
            )
        )

    return PayPeriodWithCommissions(
        id=pay_period.id,
        studio_id=pay_period.studio_id,
        start_date=pay_period.start_date,
        end_date=pay_period.end_date,
        status=pay_period.status,
        total_service=pay_period.total_service,
        total_studio_commission=pay_period.total_studio_commission,
        total_artist_payout=pay_period.total_artist_payout,
        total_tips=pay_period.total_tips,
        commission_count=pay_period.commission_count,
        closed_at=pay_period.closed_at,
        paid_at=pay_period.paid_at,
        payout_reference=pay_period.payout_reference,
        payment_notes=pay_period.payment_notes,
        created_at=pay_period.created_at,
        updated_at=pay_period.updated_at,
        commissions=commission_details,
    )


@router.post("/pay-periods/{pay_period_id}/assign", response_model=AssignToPayPeriodResponse)
async def assign_commissions_to_pay_period(
    pay_period_id: uuid.UUID,
    data: AssignToPayPeriodInput,
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> AssignToPayPeriodResponse:
    """
    Assign commissions to a pay period.
    Owner only. Only works for open pay periods.
    """
    studio = await get_user_studio(db, current_user)
    pay_period = await get_pay_period(db, pay_period_id, studio.id)

    if pay_period.status != PayPeriodStatus.OPEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only assign commissions to open pay periods",
        )

    # Get the commissions to assign
    query = select(EarnedCommission).where(
        EarnedCommission.id.in_(data.commission_ids),
        EarnedCommission.studio_id == studio.id,
    )
    result = await db.execute(query)
    commissions = result.scalars().all()

    if len(commissions) != len(data.commission_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Some commission IDs were not found",
        )

    # Check if any are already assigned to a different pay period
    for comm in commissions:
        if comm.pay_period_id and comm.pay_period_id != pay_period_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Commission {comm.id} is already assigned to another pay period",
            )

    # Assign commissions
    assigned_count = 0
    for comm in commissions:
        if comm.pay_period_id != pay_period_id:
            comm.pay_period_id = pay_period_id
            comm.pay_period_start = pay_period.start_date
            comm.pay_period_end = pay_period.end_date
            assigned_count += 1

    # Recalculate totals
    await recalculate_pay_period_totals(db, pay_period)
    await db.commit()
    await db.refresh(pay_period)

    return AssignToPayPeriodResponse(
        message=f"Assigned {assigned_count} commission(s) to pay period",
        assigned_count=assigned_count,
        pay_period=PayPeriodSummary.model_validate(pay_period),
    )


@router.post("/pay-periods/{pay_period_id}/close", response_model=ClosePayPeriodResponse)
async def close_pay_period(
    pay_period_id: uuid.UUID,
    data: ClosePayPeriodInput,
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> ClosePayPeriodResponse:
    """
    Close a pay period (no more commissions can be assigned).
    Owner only.
    """
    studio = await get_user_studio(db, current_user)
    pay_period = await get_pay_period(db, pay_period_id, studio.id)

    if pay_period.status != PayPeriodStatus.OPEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pay period is already closed or paid",
        )

    # Recalculate totals before closing
    await recalculate_pay_period_totals(db, pay_period)

    pay_period.status = PayPeriodStatus.CLOSED
    pay_period.closed_at = datetime.now(timezone.utc)
    if data.notes:
        pay_period.payment_notes = data.notes

    await db.commit()
    await db.refresh(pay_period)

    return ClosePayPeriodResponse(
        message="Pay period closed successfully",
        pay_period=PayPeriodSummary.model_validate(pay_period),
    )


@router.post("/pay-periods/{pay_period_id}/mark-paid", response_model=MarkPayPeriodPaidResponse)
async def mark_pay_period_paid(
    pay_period_id: uuid.UUID,
    data: MarkPayPeriodPaidInput,
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> MarkPayPeriodPaidResponse:
    """
    Mark a pay period as paid.
    Owner only. Pay period must be closed first.
    """
    studio = await get_user_studio(db, current_user)
    pay_period = await get_pay_period(db, pay_period_id, studio.id)

    if pay_period.status == PayPeriodStatus.PAID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pay period is already marked as paid",
        )

    if pay_period.status == PayPeriodStatus.OPEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pay period must be closed before marking as paid",
        )

    now = datetime.now(timezone.utc)
    pay_period.status = PayPeriodStatus.PAID
    pay_period.paid_at = now
    pay_period.payout_reference = data.payout_reference
    if data.payment_notes:
        if pay_period.payment_notes:
            pay_period.payment_notes += f"\n\n{data.payment_notes}"
        else:
            pay_period.payment_notes = data.payment_notes

    # Also mark all commissions in this pay period as paid
    query = select(EarnedCommission).where(
        EarnedCommission.pay_period_id == pay_period.id,
    )
    result = await db.execute(query)
    commissions = result.scalars().all()

    for comm in commissions:
        comm.paid_at = now
        comm.payout_reference = data.payout_reference

    await db.commit()
    await db.refresh(pay_period)

    return MarkPayPeriodPaidResponse(
        message=f"Pay period marked as paid. {len(commissions)} commission(s) updated.",
        pay_period=PayPeriodSummary.model_validate(pay_period),
    )


@router.delete("/pay-periods/{pay_period_id}", response_model=MessageResponse)
async def delete_pay_period(
    pay_period_id: uuid.UUID,
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """
    Delete a pay period.
    Owner only. Can only delete open pay periods with no assigned commissions.
    """
    studio = await get_user_studio(db, current_user)
    pay_period = await get_pay_period(db, pay_period_id, studio.id)

    if pay_period.status != PayPeriodStatus.OPEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only delete open pay periods",
        )

    if pay_period.commission_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete pay period with assigned commissions. Unassign them first.",
        )

    await db.delete(pay_period)
    await db.commit()

    return MessageResponse(message="Pay period deleted successfully")


@router.get("/pay-periods/unassigned", response_model=EarnedCommissionsListResponse)
async def list_unassigned_commissions(
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> EarnedCommissionsListResponse:
    """
    List commissions that are not assigned to any pay period.
    Useful for knowing which commissions need to be added to a pay period.
    Owner only.
    """
    studio = await get_user_studio(db, current_user)

    # Build query for unassigned commissions
    base_query = select(EarnedCommission).where(
        EarnedCommission.studio_id == studio.id,
        EarnedCommission.pay_period_id.is_(None),
    )

    # Count total
    count_query = select(func.count()).select_from(base_query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Get summary totals
    sum_query = select(
        func.coalesce(func.sum(EarnedCommission.service_total), 0).label("total_service"),
        func.coalesce(func.sum(EarnedCommission.studio_commission), 0).label("total_studio_commission"),
        func.coalesce(func.sum(EarnedCommission.artist_payout), 0).label("total_artist_payout"),
        func.coalesce(func.sum(EarnedCommission.tips_amount), 0).label("total_tips"),
    ).where(
        EarnedCommission.studio_id == studio.id,
        EarnedCommission.pay_period_id.is_(None),
    )
    sum_result = await db.execute(sum_query)
    sums = sum_result.first()

    # Get paginated results
    query = (
        base_query
        .options(
            selectinload(EarnedCommission.booking_request),
            selectinload(EarnedCommission.artist),
        )
        .order_by(EarnedCommission.completed_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    commissions = result.scalars().all()

    # Build response
    items = []
    for comm in commissions:
        booking = comm.booking_request
        artist = comm.artist
        items.append(
            EarnedCommissionWithDetails(
                id=comm.id,
                booking_request_id=comm.booking_request_id,
                artist_id=comm.artist_id,
                studio_id=comm.studio_id,
                commission_rule_id=comm.commission_rule_id,
                commission_rule_name=comm.commission_rule_name,
                commission_type=comm.commission_type,
                service_total=comm.service_total,
                studio_commission=comm.studio_commission,
                artist_payout=comm.artist_payout,
                tips_amount=comm.tips_amount,
                calculation_details=comm.calculation_details,
                completed_at=comm.completed_at,
                created_at=comm.created_at,
                pay_period_start=comm.pay_period_start,
                pay_period_end=comm.pay_period_end,
                paid_at=comm.paid_at,
                payout_reference=comm.payout_reference,
                client_name=booking.client_name if booking else "Unknown",
                design_idea=booking.design_idea[:100] if booking else None,
                artist_name=artist.full_name if artist else None,
            )
        )

    return EarnedCommissionsListResponse(
        commissions=items,
        total=total,
        page=page,
        page_size=page_size,
        total_service=sums.total_service if sums else 0,
        total_studio_commission=sums.total_studio_commission if sums else 0,
        total_artist_payout=sums.total_artist_payout if sums else 0,
        total_tips=sums.total_tips if sums else 0,
    )


# ============ Payout Reports ============


@router.get("/reports/payout-history", response_model=PayoutHistoryResponse)
async def get_payout_history(
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
) -> PayoutHistoryResponse:
    """
    Get payout history report showing paid pay periods with artist breakdowns.
    Owner only.
    """
    from datetime import datetime as dt
    from collections import defaultdict

    studio = await get_user_studio(db, current_user)

    # Parse dates
    start_dt = None
    end_dt = None
    if start_date:
        start_dt = dt.fromisoformat(start_date + "T00:00:00+00:00")
    if end_date:
        end_dt = dt.fromisoformat(end_date + "T23:59:59+00:00")

    # Build query for paid pay periods
    base_query = select(PayPeriod).where(
        PayPeriod.studio_id == studio.id,
        PayPeriod.status == PayPeriodStatus.PAID,
    )

    if start_dt:
        base_query = base_query.where(PayPeriod.paid_at >= start_dt)
    if end_dt:
        base_query = base_query.where(PayPeriod.paid_at <= end_dt)

    # Count total
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated pay periods
    query = (
        base_query
        .order_by(PayPeriod.paid_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    pay_periods = list(result.scalars().all())

    # Get commissions for each pay period and calculate artist breakdowns
    history_items = []
    overall_totals = {
        "total_service": 0,
        "total_studio_commission": 0,
        "total_artist_payout": 0,
        "total_tips": 0,
        "total_bookings": 0,
        "artists_paid": set(),
    }

    for pp in pay_periods:
        # Get commissions for this pay period with artist info
        comm_query = (
            select(EarnedCommission)
            .options(selectinload(EarnedCommission.artist))
            .where(EarnedCommission.pay_period_id == pp.id)
        )
        comm_result = await db.execute(comm_query)
        commissions = list(comm_result.scalars().all())

        # Build artist breakdown
        artist_totals: dict = defaultdict(lambda: {
            "total_service": 0,
            "total_studio_commission": 0,
            "total_artist_payout": 0,
            "total_tips": 0,
            "booking_count": 0,
            "artist_name": "",
            "email": "",
        })

        for comm in commissions:
            artist = comm.artist
            if artist:
                artist_id = str(artist.id)
                artist_totals[artist_id]["total_service"] += comm.service_total
                artist_totals[artist_id]["total_studio_commission"] += comm.studio_commission
                artist_totals[artist_id]["total_artist_payout"] += comm.artist_payout
                artist_totals[artist_id]["total_tips"] += comm.tips_amount or 0
                artist_totals[artist_id]["booking_count"] += 1
                artist_totals[artist_id]["artist_name"] = artist.full_name
                artist_totals[artist_id]["email"] = artist.email
                overall_totals["artists_paid"].add(artist_id)

        artist_breakdown = [
            ArtistPayoutSummary(
                artist_id=uuid.UUID(artist_id),
                artist_name=data["artist_name"],
                email=data["email"],
                total_service=data["total_service"],
                total_studio_commission=data["total_studio_commission"],
                total_artist_payout=data["total_artist_payout"],
                total_tips=data["total_tips"],
                booking_count=data["booking_count"],
                pay_period_count=1,
            )
            for artist_id, data in artist_totals.items()
        ]

        history_items.append(
            PayoutHistoryItem(
                id=pp.id,
                start_date=pp.start_date,
                end_date=pp.end_date,
                paid_at=pp.paid_at,
                payout_reference=pp.payout_reference,
                total_service=pp.total_service,
                total_studio_commission=pp.total_studio_commission,
                total_artist_payout=pp.total_artist_payout,
                total_tips=pp.total_tips,
                commission_count=pp.commission_count,
                payment_notes=pp.payment_notes,
                artist_breakdown=artist_breakdown,
            )
        )

        # Update overall totals
        overall_totals["total_service"] += pp.total_service
        overall_totals["total_studio_commission"] += pp.total_studio_commission
        overall_totals["total_artist_payout"] += pp.total_artist_payout
        overall_totals["total_tips"] += pp.total_tips
        overall_totals["total_bookings"] += pp.commission_count

    return PayoutHistoryResponse(
        history=history_items,
        summary=PayoutReportSummary(
            total_service=overall_totals["total_service"],
            total_studio_commission=overall_totals["total_studio_commission"],
            total_artist_payout=overall_totals["total_artist_payout"],
            total_tips=overall_totals["total_tips"],
            total_bookings=overall_totals["total_bookings"],
            total_pay_periods=total,
            artists_paid=len(overall_totals["artists_paid"]),
        ),
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/reports/artist-payouts", response_model=ArtistPayoutReportResponse)
async def get_artist_payouts_report(
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    paid_only: bool = Query(True, description="Only include paid commissions"),
) -> ArtistPayoutReportResponse:
    """
    Get artist payouts report showing totals per artist.
    Owner only.
    """
    from datetime import datetime as dt
    from collections import defaultdict

    studio = await get_user_studio(db, current_user)

    # Parse dates
    start_dt = None
    end_dt = None
    if start_date:
        start_dt = dt.fromisoformat(start_date + "T00:00:00+00:00")
    if end_date:
        end_dt = dt.fromisoformat(end_date + "T23:59:59+00:00")

    # Build query for commissions
    query = (
        select(EarnedCommission)
        .options(selectinload(EarnedCommission.artist))
        .where(EarnedCommission.studio_id == studio.id)
    )

    if paid_only:
        query = query.where(EarnedCommission.paid_at.is_not(None))
    if start_dt:
        query = query.where(EarnedCommission.completed_at >= start_dt)
    if end_dt:
        query = query.where(EarnedCommission.completed_at <= end_dt)

    result = await db.execute(query)
    commissions = list(result.scalars().all())

    # Aggregate by artist
    artist_totals: dict = defaultdict(lambda: {
        "total_service": 0,
        "total_studio_commission": 0,
        "total_artist_payout": 0,
        "total_tips": 0,
        "booking_count": 0,
        "pay_periods": set(),
        "artist_name": "",
        "email": "",
    })

    overall_totals = {
        "total_service": 0,
        "total_studio_commission": 0,
        "total_artist_payout": 0,
        "total_tips": 0,
        "total_bookings": 0,
        "pay_periods": set(),
    }

    for comm in commissions:
        artist = comm.artist
        if artist:
            artist_id = str(artist.id)
            artist_totals[artist_id]["total_service"] += comm.service_total
            artist_totals[artist_id]["total_studio_commission"] += comm.studio_commission
            artist_totals[artist_id]["total_artist_payout"] += comm.artist_payout
            artist_totals[artist_id]["total_tips"] += comm.tips_amount or 0
            artist_totals[artist_id]["booking_count"] += 1
            artist_totals[artist_id]["artist_name"] = artist.full_name
            artist_totals[artist_id]["email"] = artist.email
            if comm.pay_period_id:
                artist_totals[artist_id]["pay_periods"].add(comm.pay_period_id)
                overall_totals["pay_periods"].add(comm.pay_period_id)

        overall_totals["total_service"] += comm.service_total
        overall_totals["total_studio_commission"] += comm.studio_commission
        overall_totals["total_artist_payout"] += comm.artist_payout
        overall_totals["total_tips"] += comm.tips_amount or 0
        overall_totals["total_bookings"] += 1

    # Build artist summaries
    artists = [
        ArtistPayoutSummary(
            artist_id=uuid.UUID(artist_id),
            artist_name=data["artist_name"],
            email=data["email"],
            total_service=data["total_service"],
            total_studio_commission=data["total_studio_commission"],
            total_artist_payout=data["total_artist_payout"],
            total_tips=data["total_tips"],
            booking_count=data["booking_count"],
            pay_period_count=len(data["pay_periods"]),
        )
        for artist_id, data in artist_totals.items()
    ]

    # Sort by total artist payout descending
    artists.sort(key=lambda a: a.total_artist_payout, reverse=True)

    return ArtistPayoutReportResponse(
        artists=artists,
        summary=PayoutReportSummary(
            total_service=overall_totals["total_service"],
            total_studio_commission=overall_totals["total_studio_commission"],
            total_artist_payout=overall_totals["total_artist_payout"],
            total_tips=overall_totals["total_tips"],
            total_bookings=overall_totals["total_bookings"],
            total_pay_periods=len(overall_totals["pay_periods"]),
            artists_paid=len(artists),
        ),
        start_date=start_dt,
        end_date=end_dt,
    )


# ============================================================================
# TIP DISTRIBUTION SETTINGS AND REPORTS
# ============================================================================


@router.get("/tips/settings", response_model=TipSettingsResponse)
async def get_tip_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_owner),
) -> TipSettingsResponse:
    """Get studio tip distribution settings (owner only)."""
    studio = await get_user_studio(db, current_user)
    return TipSettingsResponse(
        tip_artist_percentage=studio.tip_artist_percentage,
    )


@router.put("/tips/settings", response_model=TipSettingsResponse)
async def update_tip_settings(
    data: TipSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_owner),
) -> TipSettingsResponse:
    """Update studio tip distribution settings (owner only)."""
    studio = await get_user_studio(db, current_user)
    studio.tip_artist_percentage = data.tip_artist_percentage
    await db.commit()
    await db.refresh(studio)
    return TipSettingsResponse(
        tip_artist_percentage=studio.tip_artist_percentage,
    )


@router.get("/tips/report", response_model=TipReportResponse)
async def get_tip_report(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_owner),
) -> TipReportResponse:
    """
    Get tip distribution report for the studio.
    Shows breakdown of tips by artist, payment method (card vs cash), and distribution.
    """
    studio = await get_user_studio(db, current_user)

    # Parse dates
    start_dt = None
    end_dt = None
    if start_date:
        start_dt = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc)
    if end_date:
        end_dt = datetime.fromisoformat(end_date).replace(
            hour=23, minute=59, second=59, tzinfo=timezone.utc
        )

    # Build query for commissions with tips
    query = select(EarnedCommission).where(
        EarnedCommission.studio_id == studio.id,
        EarnedCommission.tips_amount > 0,
    )

    if start_dt:
        query = query.where(EarnedCommission.completed_at >= start_dt)
    if end_dt:
        query = query.where(EarnedCommission.completed_at <= end_dt)

    result = await db.execute(
        query.options(selectinload(EarnedCommission.artist))
    )
    commissions = result.scalars().all()

    # Aggregate by artist
    artist_data: dict = {}
    overall_totals = {
        "total_tips": 0,
        "total_tips_card": 0,
        "total_tips_cash": 0,
        "total_artist_share": 0,
        "total_studio_share": 0,
        "total_bookings_with_tips": 0,
    }

    for comm in commissions:
        artist_id = comm.artist_id
        if artist_id not in artist_data:
            artist_name = "Unknown"
            artist_email = ""
            if comm.artist:
                artist_name = f"{comm.artist.first_name} {comm.artist.last_name}"
                artist_email = comm.artist.email
            artist_data[artist_id] = {
                "artist_id": artist_id,
                "artist_name": artist_name,
                "email": artist_email,
                "total_tips": 0,
                "total_tips_card": 0,
                "total_tips_cash": 0,
                "tip_artist_share": 0,
                "tip_studio_share": 0,
                "booking_count": 0,
            }

        # Track tips by payment method
        if comm.tip_payment_method == TipPaymentMethod.CARD:
            artist_data[artist_id]["total_tips_card"] += comm.tips_amount
            overall_totals["total_tips_card"] += comm.tips_amount
        elif comm.tip_payment_method == TipPaymentMethod.CASH:
            artist_data[artist_id]["total_tips_cash"] += comm.tips_amount
            overall_totals["total_tips_cash"] += comm.tips_amount
        else:
            # Unknown/null payment method - count as card (most common)
            artist_data[artist_id]["total_tips_card"] += comm.tips_amount
            overall_totals["total_tips_card"] += comm.tips_amount

        artist_data[artist_id]["total_tips"] += comm.tips_amount
        artist_data[artist_id]["tip_artist_share"] += comm.tip_artist_share
        artist_data[artist_id]["tip_studio_share"] += comm.tip_studio_share
        artist_data[artist_id]["booking_count"] += 1

        overall_totals["total_tips"] += comm.tips_amount
        overall_totals["total_artist_share"] += comm.tip_artist_share
        overall_totals["total_studio_share"] += comm.tip_studio_share
        overall_totals["total_bookings_with_tips"] += 1

    # Build response
    artists = [
        ArtistTipSummary(
            artist_id=data["artist_id"],
            artist_name=data["artist_name"],
            email=data["email"],
            total_tips=data["total_tips"],
            total_tips_card=data["total_tips_card"],
            total_tips_cash=data["total_tips_cash"],
            tip_artist_share=data["tip_artist_share"],
            tip_studio_share=data["tip_studio_share"],
            booking_count=data["booking_count"],
        )
        for data in artist_data.values()
    ]

    # Sort by total tips descending
    artists.sort(key=lambda a: a.total_tips, reverse=True)

    return TipReportResponse(
        artists=artists,
        summary=TipReportSummary(
            total_tips=overall_totals["total_tips"],
            total_tips_card=overall_totals["total_tips_card"],
            total_tips_cash=overall_totals["total_tips_cash"],
            total_artist_share=overall_totals["total_artist_share"],
            total_studio_share=overall_totals["total_studio_share"],
            total_bookings_with_tips=overall_totals["total_bookings_with_tips"],
            artists_with_tips=len(artists),
        ),
        start_date=start_dt,
        end_date=end_dt,
    )
