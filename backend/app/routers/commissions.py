"""Commission rules router for managing artist commission structures."""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.commission import CommissionRule, CommissionTier, CommissionType
from app.models.studio import Studio
from app.models.user import User, UserRole
from app.schemas.commission import (
    ArtistCommissionInfo,
    ArtistsWithCommissionResponse,
    AssignCommissionRuleInput,
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
