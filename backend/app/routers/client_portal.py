"""Client portal router for authenticated clients."""

from math import ceil
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import BookingRequest, Studio, User
from app.models.client import Client
from app.schemas.client import (
    ClientBookingArtistInfo,
    ClientBookingDetail,
    ClientBookingsListResponse,
    ClientBookingStudioInfo,
    ClientBookingSummary,
)
from app.services.client_auth import get_current_client

router = APIRouter(prefix="/client/portal", tags=["Client Portal"])


def _build_booking_summary(
    booking: BookingRequest,
    artist: User | None = None,
    studio: Studio | None = None,
) -> ClientBookingSummary:
    """Build a booking summary from a booking request."""
    return ClientBookingSummary(
        id=booking.id,
        design_idea=booking.design_idea[:100] + "..." if len(booking.design_idea) > 100 else booking.design_idea,
        placement=booking.placement,
        size=booking.size.value,
        status=booking.status.value,
        quoted_price=booking.quoted_price,
        deposit_amount=booking.deposit_amount,
        deposit_paid_at=booking.deposit_paid_at,
        scheduled_date=booking.scheduled_date,
        scheduled_duration_hours=booking.scheduled_duration_hours,
        created_at=booking.created_at,
        artist=ClientBookingArtistInfo(
            id=artist.id,
            name=artist.full_name,
        ) if artist else None,
        studio=ClientBookingStudioInfo(
            id=studio.id,
            name=studio.name,
        ) if studio else None,
    )


def _build_booking_detail(
    booking: BookingRequest,
    artist: User | None = None,
    studio: Studio | None = None,
) -> ClientBookingDetail:
    """Build a detailed booking view from a booking request."""
    return ClientBookingDetail(
        id=booking.id,
        design_idea=booking.design_idea,
        placement=booking.placement,
        size=booking.size.value,
        status=booking.status.value,
        quoted_price=booking.quoted_price,
        deposit_amount=booking.deposit_amount,
        deposit_paid_at=booking.deposit_paid_at,
        scheduled_date=booking.scheduled_date,
        scheduled_duration_hours=booking.scheduled_duration_hours,
        created_at=booking.created_at,
        artist=ClientBookingArtistInfo(
            id=artist.id,
            name=artist.full_name,
        ) if artist else None,
        studio=ClientBookingStudioInfo(
            id=studio.id,
            name=studio.name,
        ) if studio else None,
        client_name=booking.client_name,
        client_email=booking.client_email,
        client_phone=booking.client_phone,
        is_cover_up=booking.is_cover_up,
        is_first_tattoo=booking.is_first_tattoo,
        color_preference=booking.color_preference,
        budget_range=booking.budget_range,
        additional_notes=booking.additional_notes,
        preferred_dates=booking.preferred_dates,
        quote_notes=booking.quote_notes,
        quoted_at=booking.quoted_at,
        cancelled_at=booking.cancelled_at,
        cancellation_reason=booking.cancellation_reason,
        deposit_forfeited=booking.deposit_forfeited,
        reschedule_count=booking.reschedule_count,
        updated_at=booking.updated_at,
    )


@router.get("/bookings", response_model=ClientBookingsListResponse)
async def get_my_bookings(
    current_client: Client = Depends(get_current_client),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(10, ge=1, le=50, description="Items per page"),
    status_filter: str | None = Query(None, description="Filter by status"),
) -> ClientBookingsListResponse:
    """
    Get the current client's booking history.

    Returns all bookings associated with the client's email address,
    sorted by creation date (newest first).
    """
    # Build base query - find bookings by client email
    base_query = (
        select(BookingRequest)
        .where(
            BookingRequest.client_email == current_client.email,
            BookingRequest.deleted_at.is_(None),
        )
        .options(
            selectinload(BookingRequest.assigned_artist),
            selectinload(BookingRequest.studio),
        )
    )

    # Apply status filter if provided
    if status_filter:
        base_query = base_query.where(BookingRequest.status == status_filter)

    # Count total matching records
    count_query = select(func.count()).select_from(
        base_query.subquery()
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Calculate pagination
    pages = ceil(total / per_page) if total > 0 else 1
    offset = (page - 1) * per_page

    # Get paginated results
    paginated_query = (
        base_query
        .order_by(BookingRequest.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    result = await db.execute(paginated_query)
    bookings = result.scalars().all()

    # Build response
    booking_summaries = [
        _build_booking_summary(
            booking,
            artist=booking.assigned_artist,
            studio=booking.studio,
        )
        for booking in bookings
    ]

    return ClientBookingsListResponse(
        bookings=booking_summaries,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
    )


@router.get("/bookings/{booking_id}", response_model=ClientBookingDetail)
async def get_my_booking(
    booking_id: UUID,
    current_client: Client = Depends(get_current_client),
    db: AsyncSession = Depends(get_db),
) -> ClientBookingDetail:
    """
    Get details of a specific booking for the current client.

    Only returns the booking if it belongs to the client's email.
    """
    # Find the booking
    query = (
        select(BookingRequest)
        .where(
            BookingRequest.id == booking_id,
            BookingRequest.client_email == current_client.email,
            BookingRequest.deleted_at.is_(None),
        )
        .options(
            selectinload(BookingRequest.assigned_artist),
            selectinload(BookingRequest.studio),
        )
    )
    result = await db.execute(query)
    booking = result.scalar_one_or_none()

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found",
        )

    return _build_booking_detail(
        booking,
        artist=booking.assigned_artist,
        studio=booking.studio,
    )


@router.get("/bookings/stats/summary")
async def get_my_booking_stats(
    current_client: Client = Depends(get_current_client),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Get booking statistics summary for the current client.
    """
    # Count bookings by status
    query = (
        select(
            BookingRequest.status,
            func.count(BookingRequest.id).label("count"),
        )
        .where(
            BookingRequest.client_email == current_client.email,
            BookingRequest.deleted_at.is_(None),
        )
        .group_by(BookingRequest.status)
    )
    result = await db.execute(query)
    status_counts = {row.status.value: row.count for row in result.all()}

    # Calculate totals
    total = sum(status_counts.values())
    completed = status_counts.get("completed", 0)
    upcoming = status_counts.get("confirmed", 0) + status_counts.get("deposit_paid", 0)
    pending = status_counts.get("pending", 0) + status_counts.get("reviewing", 0) + status_counts.get("quoted", 0) + status_counts.get("deposit_requested", 0)
    cancelled = status_counts.get("cancelled", 0) + status_counts.get("rejected", 0)

    # Calculate total spent (from completed bookings)
    spent_query = (
        select(func.sum(BookingRequest.quoted_price))
        .where(
            BookingRequest.client_email == current_client.email,
            BookingRequest.status == "completed",
            BookingRequest.deleted_at.is_(None),
        )
    )
    spent_result = await db.execute(spent_query)
    total_spent = spent_result.scalar() or 0

    return {
        "total_bookings": total,
        "completed": completed,
        "upcoming": upcoming,
        "pending": pending,
        "cancelled": cancelled,
        "total_spent_cents": total_spent,
        "status_breakdown": status_counts,
    }
