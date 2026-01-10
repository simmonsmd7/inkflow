"""Analytics and dashboard router."""

from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import (
    BookingRequest,
    BookingRequestStatus,
    Conversation,
    ConversationStatus,
    EarnedCommission,
    Studio,
    User,
)
from app.models.consent import ConsentFormSubmission
from app.schemas.analytics import (
    ArtistPerformanceSummary,
    BookingAnalyticsResponse,
    BookingMetrics,
    BookingStatusBreakdown,
    ClientRetentionMetrics,
    DashboardResponse,
    DashboardStats,
    NoShowMetrics,
    OccupancyMetrics,
    PopularTimeSlot,
    RecentActivity,
    RevenueChartData,
    RevenueChartResponse,
    RevenueMetrics,
    TimeSlotAnalyticsResponse,
    UpcomingAppointment,
)
from app.services.auth import get_current_user, require_role

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def get_date_range(
    range_type: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> tuple[datetime, datetime]:
    """Get start and end datetime for a range type."""
    today = date.today()
    now = datetime.now()

    if range_type == "today":
        start = datetime.combine(today, datetime.min.time())
        end = datetime.combine(today, datetime.max.time())
    elif range_type == "week":
        start_of_week = today - timedelta(days=today.weekday())
        start = datetime.combine(start_of_week, datetime.min.time())
        end = now
    elif range_type == "month":
        start_of_month = today.replace(day=1)
        start = datetime.combine(start_of_month, datetime.min.time())
        end = now
    elif range_type == "quarter":
        quarter_month = ((today.month - 1) // 3) * 3 + 1
        start_of_quarter = today.replace(month=quarter_month, day=1)
        start = datetime.combine(start_of_quarter, datetime.min.time())
        end = now
    elif range_type == "year":
        start_of_year = today.replace(month=1, day=1)
        start = datetime.combine(start_of_year, datetime.min.time())
        end = now
    elif range_type == "custom" and start_date and end_date:
        start = datetime.combine(start_date, datetime.min.time())
        end = datetime.combine(end_date, datetime.max.time())
    else:
        # Default to this month
        start_of_month = today.replace(day=1)
        start = datetime.combine(start_of_month, datetime.min.time())
        end = now

    return start, end


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get main dashboard data."""
    # Get the user's studio
    studio_result = await db.execute(
        select(Studio).where(Studio.owner_id == current_user.id)
    )
    studio = studio_result.scalar_one_or_none()
    studio_id = studio.id if studio else None

    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today, datetime.max.time())

    week_start = today - timedelta(days=today.weekday())
    week_start_dt = datetime.combine(week_start, datetime.min.time())

    month_start = today.replace(day=1)
    month_start_dt = datetime.combine(month_start, datetime.min.time())

    # Build base query filters
    base_filter = []
    if studio_id:
        base_filter.append(BookingRequest.studio_id == studio_id)

    # --- Dashboard Stats ---
    # Appointments today
    appointments_today_result = await db.execute(
        select(func.count(BookingRequest.id)).where(
            and_(
                BookingRequest.scheduled_date >= today_start,
                BookingRequest.scheduled_date <= today_end,
                BookingRequest.status == BookingRequestStatus.CONFIRMED,
                *base_filter,
            )
        )
    )
    appointments_today = appointments_today_result.scalar() or 0

    # Revenue today (from completed bookings)
    revenue_today_result = await db.execute(
        select(func.coalesce(func.sum(EarnedCommission.service_total), 0)).where(
            and_(
                EarnedCommission.completed_at >= today_start,
                EarnedCommission.completed_at <= today_end,
                EarnedCommission.studio_id == studio_id if studio_id else True,
            )
        )
    )
    revenue_today = revenue_today_result.scalar() or 0

    # New requests today
    new_requests_result = await db.execute(
        select(func.count(BookingRequest.id)).where(
            and_(
                BookingRequest.created_at >= today_start,
                BookingRequest.created_at <= today_end,
                *base_filter,
            )
        )
    )
    new_requests_today = new_requests_result.scalar() or 0

    # Unread messages
    unread_messages_result = await db.execute(
        select(func.count(Conversation.id)).where(
            and_(
                Conversation.status == ConversationStatus.UNREAD,
                Conversation.studio_id == studio_id if studio_id else True,
            )
        )
    )
    unread_messages = unread_messages_result.scalar() or 0

    # This week appointments
    appointments_week_result = await db.execute(
        select(func.count(BookingRequest.id)).where(
            and_(
                BookingRequest.scheduled_date >= week_start_dt,
                BookingRequest.status == BookingRequestStatus.CONFIRMED,
                *base_filter,
            )
        )
    )
    appointments_this_week = appointments_week_result.scalar() or 0

    # Revenue this week
    revenue_week_result = await db.execute(
        select(func.coalesce(func.sum(EarnedCommission.service_total), 0)).where(
            and_(
                EarnedCommission.completed_at >= week_start_dt,
                EarnedCommission.studio_id == studio_id if studio_id else True,
            )
        )
    )
    revenue_this_week = revenue_week_result.scalar() or 0

    # Pending requests
    pending_requests_result = await db.execute(
        select(func.count(BookingRequest.id)).where(
            and_(
                BookingRequest.status.in_([
                    BookingRequestStatus.PENDING,
                    BookingRequestStatus.REVIEWING,
                ]),
                *base_filter,
            )
        )
    )
    pending_requests = pending_requests_result.scalar() or 0

    # Pending deposits
    pending_deposits_result = await db.execute(
        select(func.count(BookingRequest.id)).where(
            and_(
                BookingRequest.status == BookingRequestStatus.DEPOSIT_REQUESTED,
                *base_filter,
            )
        )
    )
    pending_deposits = pending_deposits_result.scalar() or 0

    # Pending consent forms (bookings without consent)
    pending_consent_result = await db.execute(
        select(func.count(BookingRequest.id)).where(
            and_(
                BookingRequest.status == BookingRequestStatus.CONFIRMED,
                BookingRequest.consent_submission_id.is_(None),
                *base_filter,
            )
        )
    )
    pending_consent = pending_consent_result.scalar() or 0

    stats = DashboardStats(
        appointments_today=appointments_today,
        revenue_today=revenue_today,
        new_requests_today=new_requests_today,
        unread_messages=unread_messages,
        appointments_this_week=appointments_this_week,
        revenue_this_week=revenue_this_week,
        pending_requests=pending_requests,
        pending_deposits=pending_deposits,
        pending_consent_forms=pending_consent,
    )

    # --- Revenue Metrics (this month) ---
    revenue_result = await db.execute(
        select(
            func.coalesce(func.sum(EarnedCommission.service_total), 0),
            func.coalesce(func.sum(EarnedCommission.tips_amount), 0),
            func.count(EarnedCommission.id),
        ).where(
            and_(
                EarnedCommission.completed_at >= month_start_dt,
                EarnedCommission.studio_id == studio_id if studio_id else True,
            )
        )
    )
    rev_row = revenue_result.one()
    total_revenue = rev_row[0] or 0
    total_tips = rev_row[1] or 0
    completed_count = rev_row[2] or 0

    # Deposits collected
    deposits_result = await db.execute(
        select(func.coalesce(func.sum(BookingRequest.deposit_amount), 0)).where(
            and_(
                BookingRequest.deposit_paid_at >= month_start_dt,
                *base_filter,
            )
        )
    )
    total_deposits = deposits_result.scalar() or 0

    avg_booking = total_revenue // completed_count if completed_count > 0 else 0

    revenue = RevenueMetrics(
        total_revenue=total_revenue,
        total_deposits=total_deposits,
        total_tips=total_tips,
        booking_count=completed_count,
        average_booking_value=avg_booking,
        revenue_change_percent=None,
    )

    # --- Booking Metrics ---
    # Total requests this month
    total_requests_result = await db.execute(
        select(func.count(BookingRequest.id)).where(
            and_(
                BookingRequest.created_at >= month_start_dt,
                *base_filter,
            )
        )
    )
    total_requests = total_requests_result.scalar() or 0

    # Pending
    pending_count_result = await db.execute(
        select(func.count(BookingRequest.id)).where(
            and_(
                BookingRequest.status.in_([
                    BookingRequestStatus.PENDING,
                    BookingRequestStatus.REVIEWING,
                ]),
                *base_filter,
            )
        )
    )
    pending_count = pending_count_result.scalar() or 0

    # Confirmed
    confirmed_result = await db.execute(
        select(func.count(BookingRequest.id)).where(
            and_(
                BookingRequest.status == BookingRequestStatus.CONFIRMED,
                BookingRequest.scheduled_date >= datetime.now(),
                *base_filter,
            )
        )
    )
    confirmed_count = confirmed_result.scalar() or 0

    # Completed this month
    completed_result = await db.execute(
        select(func.count(BookingRequest.id)).where(
            and_(
                BookingRequest.status == BookingRequestStatus.COMPLETED,
                BookingRequest.updated_at >= month_start_dt,
                *base_filter,
            )
        )
    )
    completed_bookings = completed_result.scalar() or 0

    # Cancelled this month
    cancelled_result = await db.execute(
        select(func.count(BookingRequest.id)).where(
            and_(
                BookingRequest.status == BookingRequestStatus.CANCELLED,
                BookingRequest.cancelled_at >= month_start_dt,
                *base_filter,
            )
        )
    )
    cancelled_count = cancelled_result.scalar() or 0

    # No shows this month
    no_show_result = await db.execute(
        select(func.count(BookingRequest.id)).where(
            and_(
                BookingRequest.status == BookingRequestStatus.NO_SHOW,
                BookingRequest.no_show_at >= month_start_dt,
                *base_filter,
            )
        )
    )
    no_show_count = no_show_result.scalar() or 0

    conversion = (completed_bookings + confirmed_count) / total_requests * 100 if total_requests > 0 else 0

    bookings = BookingMetrics(
        total_requests=total_requests,
        pending_requests=pending_count,
        confirmed_bookings=confirmed_count,
        completed_bookings=completed_bookings,
        cancelled_bookings=cancelled_count,
        no_shows=no_show_count,
        conversion_rate=round(conversion, 1),
    )

    # --- Occupancy Metrics ---
    # Calculate based on confirmed bookings with duration
    booked_hours_result = await db.execute(
        select(func.coalesce(func.sum(BookingRequest.scheduled_duration_hours), 0)).where(
            and_(
                BookingRequest.status.in_([
                    BookingRequestStatus.CONFIRMED,
                    BookingRequestStatus.COMPLETED,
                ]),
                BookingRequest.scheduled_date >= month_start_dt,
                *base_filter,
            )
        )
    )
    booked_hours = float(booked_hours_result.scalar() or 0)

    # Estimate available hours (8 hours/day * artists * business days)
    artist_count_result = await db.execute(
        select(func.count(User.id)).where(
            and_(
                User.role == "artist",
                User.is_active == True,
                User.is_deleted == False,
            )
        )
    )
    artist_count = artist_count_result.scalar() or 1

    days_in_month = (date.today() - month_start).days + 1
    business_days = int(days_in_month * 5 / 7)  # Approximate
    total_available = artist_count * 8 * business_days

    occupancy_rate = (booked_hours / total_available * 100) if total_available > 0 else 0

    booking_count_for_avg = completed_bookings + confirmed_count
    avg_duration = booked_hours / booking_count_for_avg if booking_count_for_avg > 0 else 0

    occupancy = OccupancyMetrics(
        total_available_hours=float(total_available),
        booked_hours=booked_hours,
        occupancy_rate=round(occupancy_rate, 1),
        average_booking_duration=round(avg_duration, 1),
    )

    # --- Upcoming Appointments ---
    upcoming_result = await db.execute(
        select(BookingRequest)
        .where(
            and_(
                BookingRequest.status == BookingRequestStatus.CONFIRMED,
                BookingRequest.scheduled_date >= datetime.now(),
                *base_filter,
            )
        )
        .order_by(BookingRequest.scheduled_date.asc())
        .limit(10)
    )
    upcoming_bookings = upcoming_result.scalars().all()

    upcoming_appointments = []
    for booking in upcoming_bookings:
        # Get artist name
        artist_name = "Unassigned"
        if booking.assigned_artist_id:
            artist_result = await db.execute(
                select(User).where(User.id == booking.assigned_artist_id)
            )
            artist = artist_result.scalar_one_or_none()
            if artist:
                artist_name = f"{artist.first_name} {artist.last_name}"

        upcoming_appointments.append(
            UpcomingAppointment(
                id=str(booking.id),
                client_name=booking.client_name,
                client_email=booking.client_email,
                artist_name=artist_name,
                scheduled_date=booking.scheduled_date,
                duration_hours=booking.scheduled_duration_hours or 2.0,
                design_summary=booking.design_idea[:100] if booking.design_idea else "",
                status=booking.status.value,
            )
        )

    # --- Recent Activity ---
    recent_activity = []

    # Recent booking requests
    recent_requests_result = await db.execute(
        select(BookingRequest)
        .where(*base_filter)
        .order_by(BookingRequest.created_at.desc())
        .limit(5)
    )
    for req in recent_requests_result.scalars().all():
        if req.status == BookingRequestStatus.PENDING:
            activity_type = "booking_request"
            title = "New booking request"
        elif req.status == BookingRequestStatus.CONFIRMED:
            activity_type = "booking_confirmed"
            title = "Booking confirmed"
        elif req.status == BookingRequestStatus.COMPLETED:
            activity_type = "booking_completed"
            title = "Booking completed"
        elif req.status == BookingRequestStatus.CANCELLED:
            activity_type = "cancellation"
            title = "Booking cancelled"
        elif req.status == BookingRequestStatus.NO_SHOW:
            activity_type = "no_show"
            title = "Client no-show"
        else:
            continue

        recent_activity.append(
            RecentActivity(
                id=str(req.id),
                type=activity_type,
                title=title,
                description=f"{req.client_name} - {req.design_idea[:50] if req.design_idea else 'N/A'}",
                timestamp=req.updated_at or req.created_at,
                actor_name=req.client_name,
            )
        )

    # Sort by timestamp
    recent_activity.sort(key=lambda x: x.timestamp, reverse=True)
    recent_activity = recent_activity[:10]

    # --- Top Artists ---
    top_artists = []
    if studio_id:
        artist_stats_result = await db.execute(
            select(
                EarnedCommission.artist_id,
                func.count(EarnedCommission.id).label("completed"),
                func.coalesce(func.sum(EarnedCommission.service_total), 0).label("revenue"),
                func.coalesce(func.sum(EarnedCommission.tips_amount), 0).label("tips"),
            )
            .where(
                and_(
                    EarnedCommission.studio_id == studio_id,
                    EarnedCommission.completed_at >= month_start_dt,
                )
            )
            .group_by(EarnedCommission.artist_id)
            .order_by(func.sum(EarnedCommission.service_total).desc())
            .limit(5)
        )

        for row in artist_stats_result.all():
            artist_result = await db.execute(
                select(User).where(User.id == row.artist_id)
            )
            artist = artist_result.scalar_one_or_none()
            if artist:
                # Get no-show count
                no_show_count_result = await db.execute(
                    select(func.count(BookingRequest.id)).where(
                        and_(
                            BookingRequest.assigned_artist_id == artist.id,
                            BookingRequest.status == BookingRequestStatus.NO_SHOW,
                            BookingRequest.no_show_at >= month_start_dt,
                        )
                    )
                )
                artist_no_shows = no_show_count_result.scalar() or 0

                top_artists.append(
                    ArtistPerformanceSummary(
                        artist_id=str(artist.id),
                        artist_name=f"{artist.first_name} {artist.last_name}",
                        completed_bookings=row.completed,
                        total_revenue=row.revenue,
                        total_tips=row.tips,
                        no_show_count=artist_no_shows,
                    )
                )

    return DashboardResponse(
        stats=stats,
        revenue=revenue,
        bookings=bookings,
        occupancy=occupancy,
        upcoming_appointments=upcoming_appointments,
        recent_activity=recent_activity,
        top_artists=top_artists,
    )


@router.get("/revenue/chart", response_model=RevenueChartResponse)
async def get_revenue_chart(
    range_type: str = Query("month", description="Time range: today, week, month, quarter, year, custom"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get revenue chart data over time."""
    start_dt, end_dt = get_date_range(range_type, start_date, end_date)

    # Get user's studio
    studio_result = await db.execute(
        select(Studio).where(Studio.owner_id == current_user.id)
    )
    studio = studio_result.scalar_one_or_none()
    studio_id = studio.id if studio else None

    # Get daily revenue data
    result = await db.execute(
        select(
            func.date(EarnedCommission.completed_at).label("date"),
            func.coalesce(func.sum(EarnedCommission.service_total), 0).label("revenue"),
            func.count(EarnedCommission.id).label("bookings"),
            func.coalesce(func.sum(EarnedCommission.tips_amount), 0).label("tips"),
        )
        .where(
            and_(
                EarnedCommission.completed_at >= start_dt,
                EarnedCommission.completed_at <= end_dt,
                EarnedCommission.studio_id == studio_id if studio_id else True,
            )
        )
        .group_by(func.date(EarnedCommission.completed_at))
        .order_by(func.date(EarnedCommission.completed_at))
    )

    data = []
    total_revenue = 0
    total_bookings = 0
    total_tips = 0

    for row in result.all():
        data.append(
            RevenueChartData(
                date=row.date,
                revenue=row.revenue,
                bookings=row.bookings,
                tips=row.tips,
            )
        )
        total_revenue += row.revenue
        total_bookings += row.bookings
        total_tips += row.tips

    return RevenueChartResponse(
        data=data,
        total_revenue=total_revenue,
        total_bookings=total_bookings,
        total_tips=total_tips,
    )


@router.get("/bookings/breakdown", response_model=BookingAnalyticsResponse)
async def get_booking_breakdown(
    range_type: str = Query("month"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get detailed booking analytics."""
    start_dt, end_dt = get_date_range(range_type, start_date, end_date)

    # Get user's studio
    studio_result = await db.execute(
        select(Studio).where(Studio.owner_id == current_user.id)
    )
    studio = studio_result.scalar_one_or_none()
    studio_id = studio.id if studio else None

    base_filter = [
        BookingRequest.created_at >= start_dt,
        BookingRequest.created_at <= end_dt,
    ]
    if studio_id:
        base_filter.append(BookingRequest.studio_id == studio_id)

    # Status breakdown
    status_result = await db.execute(
        select(
            BookingRequest.status,
            func.count(BookingRequest.id).label("count"),
        )
        .where(and_(*base_filter))
        .group_by(BookingRequest.status)
    )
    status_data = status_result.all()
    total = sum(row.count for row in status_data)
    status_breakdown = [
        BookingStatusBreakdown(
            status=row.status.value,
            count=row.count,
            percentage=round(row.count / total * 100, 1) if total > 0 else 0,
        )
        for row in status_data
    ]

    # By size
    size_result = await db.execute(
        select(
            BookingRequest.size,
            func.count(BookingRequest.id).label("count"),
        )
        .where(and_(*base_filter))
        .group_by(BookingRequest.size)
    )
    by_size = {row.size.value if row.size else "unknown": row.count for row in size_result.all()}

    # By placement
    placement_result = await db.execute(
        select(
            BookingRequest.placement,
            func.count(BookingRequest.id).label("count"),
        )
        .where(and_(*base_filter))
        .group_by(BookingRequest.placement)
    )
    by_placement = {row.placement or "unknown": row.count for row in placement_result.all()}

    # By artist
    artist_result = await db.execute(
        select(
            BookingRequest.assigned_artist_id,
            func.count(BookingRequest.id).label("count"),
        )
        .where(and_(*base_filter, BookingRequest.assigned_artist_id.isnot(None)))
        .group_by(BookingRequest.assigned_artist_id)
    )
    by_artist = {}
    for row in artist_result.all():
        artist_q = await db.execute(select(User).where(User.id == row.assigned_artist_id))
        artist = artist_q.scalar_one_or_none()
        if artist:
            by_artist[f"{artist.first_name} {artist.last_name}"] = row.count

    # Peak hours (from scheduled bookings)
    hour_result = await db.execute(
        select(
            func.extract("hour", BookingRequest.scheduled_date).label("hour"),
            func.count(BookingRequest.id).label("count"),
        )
        .where(
            and_(
                *base_filter,
                BookingRequest.scheduled_date.isnot(None),
            )
        )
        .group_by(func.extract("hour", BookingRequest.scheduled_date))
    )
    peak_hours = {int(row.hour): row.count for row in hour_result.all() if row.hour is not None}

    # Peak days
    day_result = await db.execute(
        select(
            func.extract("dow", BookingRequest.scheduled_date).label("day"),
            func.count(BookingRequest.id).label("count"),
        )
        .where(
            and_(
                *base_filter,
                BookingRequest.scheduled_date.isnot(None),
            )
        )
        .group_by(func.extract("dow", BookingRequest.scheduled_date))
    )
    peak_days = {int(row.day): row.count for row in day_result.all() if row.day is not None}

    return BookingAnalyticsResponse(
        status_breakdown=status_breakdown,
        by_size=by_size,
        by_placement=by_placement,
        by_artist=by_artist,
        peak_hours=peak_hours,
        peak_days=peak_days,
    )


@router.get("/no-shows", response_model=NoShowMetrics)
async def get_no_show_metrics(
    range_type: str = Query("month"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get no-show tracking metrics."""
    start_dt, end_dt = get_date_range(range_type, start_date, end_date)

    studio_result = await db.execute(
        select(Studio).where(Studio.owner_id == current_user.id)
    )
    studio = studio_result.scalar_one_or_none()
    studio_id = studio.id if studio else None

    base_filter = [
        BookingRequest.created_at >= start_dt,
        BookingRequest.created_at <= end_dt,
    ]
    if studio_id:
        base_filter.append(BookingRequest.studio_id == studio_id)

    # Total no-shows
    no_shows_result = await db.execute(
        select(func.count(BookingRequest.id)).where(
            and_(
                *base_filter,
                BookingRequest.status == BookingRequestStatus.NO_SHOW,
            )
        )
    )
    total_no_shows = no_shows_result.scalar() or 0

    # Total confirmed (for rate calculation)
    total_confirmed_result = await db.execute(
        select(func.count(BookingRequest.id)).where(
            and_(
                *base_filter,
                BookingRequest.status.in_([
                    BookingRequestStatus.CONFIRMED,
                    BookingRequestStatus.COMPLETED,
                    BookingRequestStatus.NO_SHOW,
                ]),
            )
        )
    )
    total_confirmed = total_confirmed_result.scalar() or 0
    no_show_rate = (total_no_shows / total_confirmed * 100) if total_confirmed > 0 else 0

    # Deposits forfeited
    forfeited_result = await db.execute(
        select(func.coalesce(func.sum(BookingRequest.deposit_amount), 0)).where(
            and_(
                *base_filter,
                BookingRequest.status == BookingRequestStatus.NO_SHOW,
                BookingRequest.deposit_forfeited == True,
            )
        )
    )
    deposits_forfeited = forfeited_result.scalar() or 0

    # Repeat no-show clients
    repeat_result = await db.execute(
        select(func.count(func.distinct(BookingRequest.client_email))).where(
            and_(
                BookingRequest.status == BookingRequestStatus.NO_SHOW,
                BookingRequest.studio_id == studio_id if studio_id else True,
            )
        ).having(func.count(BookingRequest.id) > 1)
    )
    repeat_no_shows = repeat_result.scalar() or 0

    return NoShowMetrics(
        total_no_shows=total_no_shows,
        no_show_rate=round(no_show_rate, 1),
        deposits_forfeited=deposits_forfeited,
        repeat_no_show_clients=repeat_no_shows,
    )


@router.get("/retention", response_model=ClientRetentionMetrics)
async def get_client_retention(
    range_type: str = Query("month"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get client retention metrics."""
    start_dt, end_dt = get_date_range(range_type, start_date, end_date)

    studio_result = await db.execute(
        select(Studio).where(Studio.owner_id == current_user.id)
    )
    studio = studio_result.scalar_one_or_none()
    studio_id = studio.id if studio else None

    base_filter = []
    if studio_id:
        base_filter.append(BookingRequest.studio_id == studio_id)

    # Total unique clients (all time)
    total_clients_result = await db.execute(
        select(func.count(func.distinct(BookingRequest.client_email))).where(
            and_(*base_filter) if base_filter else True
        )
    )
    total_clients = total_clients_result.scalar() or 0

    # Returning clients (more than 1 booking)
    returning_result = await db.execute(
        select(func.count(BookingRequest.client_email))
        .where(and_(*base_filter) if base_filter else True)
        .group_by(BookingRequest.client_email)
        .having(func.count(BookingRequest.id) > 1)
    )
    returning_clients = len(returning_result.all())

    retention_rate = (returning_clients / total_clients * 100) if total_clients > 0 else 0

    # Average bookings per client
    total_bookings_result = await db.execute(
        select(func.count(BookingRequest.id)).where(
            and_(*base_filter) if base_filter else True
        )
    )
    total_bookings = total_bookings_result.scalar() or 0
    avg_bookings = total_bookings / total_clients if total_clients > 0 else 0

    # Clients this period
    clients_period_result = await db.execute(
        select(func.count(func.distinct(BookingRequest.client_email))).where(
            and_(
                BookingRequest.created_at >= start_dt,
                BookingRequest.created_at <= end_dt,
                *base_filter,
            )
        )
    )
    clients_this_period = clients_period_result.scalar() or 0

    # New clients this period (first booking in this period)
    # This is a simplified version - ideally would check if their first-ever booking was in this period
    new_clients_result = await db.execute(
        select(func.count(func.distinct(BookingRequest.client_email))).where(
            and_(
                BookingRequest.created_at >= start_dt,
                BookingRequest.created_at <= end_dt,
                *base_filter,
            )
        )
    )
    new_clients = new_clients_result.scalar() or 0

    return ClientRetentionMetrics(
        total_clients=total_clients,
        returning_clients=returning_clients,
        retention_rate=round(retention_rate, 1),
        average_bookings_per_client=round(avg_bookings, 2),
        clients_this_period=clients_this_period,
        new_clients_this_period=new_clients,
    )


@router.get("/time-slots", response_model=TimeSlotAnalyticsResponse)
async def get_time_slot_analytics(
    range_type: str = Query("month"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get popular time slot analysis."""
    start_dt, end_dt = get_date_range(range_type, start_date, end_date)

    studio_result = await db.execute(
        select(Studio).where(Studio.owner_id == current_user.id)
    )
    studio = studio_result.scalar_one_or_none()
    studio_id = studio.id if studio else None

    base_filter = [
        BookingRequest.scheduled_date >= start_dt,
        BookingRequest.scheduled_date <= end_dt,
        BookingRequest.scheduled_date.isnot(None),
    ]
    if studio_id:
        base_filter.append(BookingRequest.studio_id == studio_id)

    # Get day/hour combinations
    result = await db.execute(
        select(
            func.extract("dow", BookingRequest.scheduled_date).label("day"),
            func.extract("hour", BookingRequest.scheduled_date).label("hour"),
            func.count(BookingRequest.id).label("count"),
        )
        .where(and_(*base_filter))
        .group_by(
            func.extract("dow", BookingRequest.scheduled_date),
            func.extract("hour", BookingRequest.scheduled_date),
        )
        .order_by(func.count(BookingRequest.id).desc())
    )

    slots = result.all()
    total_bookings = sum(row.count for row in slots)

    popular_slots = []
    for row in slots[:20]:  # Top 20 slots
        if row.day is not None and row.hour is not None:
            popular_slots.append(
                PopularTimeSlot(
                    day_of_week=int(row.day),
                    hour=int(row.hour),
                    booking_count=row.count,
                    percentage_of_total=round(row.count / total_bookings * 100, 1) if total_bookings > 0 else 0,
                )
            )

    # Find busiest/quietest
    day_names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

    day_totals: dict[int, int] = {}
    hour_totals: dict[int, int] = {}
    for row in slots:
        if row.day is not None:
            day_totals[int(row.day)] = day_totals.get(int(row.day), 0) + row.count
        if row.hour is not None:
            hour_totals[int(row.hour)] = hour_totals.get(int(row.hour), 0) + row.count

    busiest_day = day_names[max(day_totals, key=day_totals.get)] if day_totals else "N/A"
    quietest_day = day_names[min(day_totals, key=day_totals.get)] if day_totals else "N/A"
    busiest_hour = max(hour_totals, key=hour_totals.get) if hour_totals else 12
    quietest_hour = min(hour_totals, key=hour_totals.get) if hour_totals else 9

    return TimeSlotAnalyticsResponse(
        popular_slots=popular_slots,
        busiest_day=busiest_day,
        busiest_hour=busiest_hour,
        quietest_day=quietest_day,
        quietest_hour=quietest_hour,
    )
