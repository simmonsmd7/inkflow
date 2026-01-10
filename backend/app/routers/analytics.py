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
    ArtistBookingStats,
    ArtistDetailedPerformance,
    ArtistPerformanceListItem,
    ArtistPerformanceListResponse,
    ArtistPerformanceSummary,
    ArtistRevenueBreakdown,
    ArtistSpecialtyStats,
    ArtistTimeStats,
    BookingAnalyticsResponse,
    BookingMetrics,
    BookingStatusBreakdown,
    ClientAcquisitionByMonth,
    ClientByArtist,
    ClientLifetimeValue,
    ClientRetentionMetrics,
    ClientRetentionReportResponse,
    ClientSegment,
    CustomRevenueReportResponse,
    DailyRevenueReportResponse,
    DashboardResponse,
    DashboardStats,
    MonthlyPerformance,
    MonthlyRevenueReportResponse,
    NoShowByArtist,
    NoShowByDayOfWeek,
    NoShowByTimeSlot,
    NoShowClient,
    NoShowMetrics,
    NoShowReportResponse,
    NoShowTrend,
    OccupancyMetrics,
    PopularTimeSlot,
    RecentActivity,
    RevenueByArtist,
    RevenueByCategory,
    RevenueByDay,
    RevenueByMonth,
    RevenueByWeek,
    RevenueChartData,
    RevenueChartResponse,
    RevenueMetrics,
    RevenueSummary,
    TimeSlotAnalyticsResponse,
    TopClient,
    UpcomingAppointment,
    WeeklyRevenueReportResponse,
)
from app.models.artist import ArtistProfile
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
    # Use a subquery to find bookings that have no consent submission
    consent_exists_subquery = select(ConsentFormSubmission.id).where(
        ConsentFormSubmission.booking_request_id == BookingRequest.id
    ).exists()
    pending_consent_result = await db.execute(
        select(func.count(BookingRequest.id)).where(
            and_(
                BookingRequest.status == BookingRequestStatus.CONFIRMED,
                ~consent_exists_subquery,
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

    conversion = min((completed_bookings + confirmed_count) / total_requests * 100, 100) if total_requests > 0 else 0

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


@router.get("/artists", response_model=ArtistPerformanceListResponse)
async def get_artist_performance_list(
    range_type: str = Query("month", description="Time range: today, week, month, quarter, year, custom"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get performance metrics for all artists."""
    start_dt, end_dt = get_date_range(range_type, start_date, end_date)

    # Get user's studio
    studio_result = await db.execute(
        select(Studio).where(Studio.owner_id == current_user.id)
    )
    studio = studio_result.scalar_one_or_none()
    studio_id = studio.id if studio else None

    # Get all active artists
    artists_result = await db.execute(
        select(User).where(
            and_(
                User.role == "artist",
                User.is_active == True,
                User.is_deleted == False,
            )
        )
    )
    artists = artists_result.scalars().all()

    # Calculate period label
    if range_type == "today":
        period_label = "Today"
    elif range_type == "week":
        period_label = "This Week"
    elif range_type == "month":
        period_label = "This Month"
    elif range_type == "quarter":
        period_label = "This Quarter"
    elif range_type == "year":
        period_label = "This Year"
    else:
        period_label = f"{start_date} - {end_date}"

    artist_items = []
    for artist in artists:
        # Get profile image
        profile_result = await db.execute(
            select(ArtistProfile).where(ArtistProfile.user_id == artist.id)
        )
        profile = profile_result.scalar_one_or_none()
        profile_image = profile.profile_image_url if profile else None

        # Revenue and commission data
        commission_result = await db.execute(
            select(
                func.coalesce(func.sum(EarnedCommission.service_total), 0).label("revenue"),
                func.coalesce(func.sum(EarnedCommission.tips_amount), 0).label("tips"),
                func.coalesce(func.sum(EarnedCommission.commission_amount), 0).label("commission"),
                func.count(EarnedCommission.id).label("completed"),
            ).where(
                and_(
                    EarnedCommission.artist_id == artist.id,
                    EarnedCommission.completed_at >= start_dt,
                    EarnedCommission.completed_at <= end_dt,
                    EarnedCommission.studio_id == studio_id if studio_id else True,
                )
            )
        )
        commission_row = commission_result.one()

        # No-show count
        no_show_result = await db.execute(
            select(func.count(BookingRequest.id)).where(
                and_(
                    BookingRequest.assigned_artist_id == artist.id,
                    BookingRequest.status == BookingRequestStatus.NO_SHOW,
                    BookingRequest.no_show_at >= start_dt,
                    BookingRequest.no_show_at <= end_dt,
                )
            )
        )
        no_shows = no_show_result.scalar() or 0

        # Calculate completion rate
        confirmed_result = await db.execute(
            select(func.count(BookingRequest.id)).where(
                and_(
                    BookingRequest.assigned_artist_id == artist.id,
                    BookingRequest.status.in_([
                        BookingRequestStatus.CONFIRMED,
                        BookingRequestStatus.COMPLETED,
                        BookingRequestStatus.NO_SHOW,
                    ]),
                    BookingRequest.created_at >= start_dt,
                    BookingRequest.created_at <= end_dt,
                )
            )
        )
        total_confirmed = confirmed_result.scalar() or 0
        completion_rate = ((commission_row.completed / total_confirmed) * 100) if total_confirmed > 0 else 0

        # Calculate utilization rate
        booked_hours_result = await db.execute(
            select(func.coalesce(func.sum(BookingRequest.scheduled_duration_hours), 0)).where(
                and_(
                    BookingRequest.assigned_artist_id == artist.id,
                    BookingRequest.status.in_([
                        BookingRequestStatus.CONFIRMED,
                        BookingRequestStatus.COMPLETED,
                    ]),
                    BookingRequest.scheduled_date >= start_dt,
                    BookingRequest.scheduled_date <= end_dt,
                )
            )
        )
        booked_hours = float(booked_hours_result.scalar() or 0)

        # Calculate available hours (8 hours/day, 5 days/week estimate)
        days_in_period = (end_dt.date() - start_dt.date()).days + 1
        business_days = int(days_in_period * 5 / 7)
        available_hours = business_days * 8
        utilization_rate = (booked_hours / available_hours * 100) if available_hours > 0 else 0

        artist_items.append(
            ArtistPerformanceListItem(
                artist_id=str(artist.id),
                artist_name=f"{artist.first_name} {artist.last_name}",
                profile_image=profile_image,
                completed_bookings=commission_row.completed,
                total_revenue=commission_row.revenue,
                total_tips=commission_row.tips,
                commission_earned=commission_row.commission,
                no_show_count=no_shows,
                completion_rate=round(completion_rate, 1),
                utilization_rate=round(utilization_rate, 1),
            )
        )

    # Sort by revenue descending
    artist_items.sort(key=lambda x: x.total_revenue, reverse=True)

    return ArtistPerformanceListResponse(
        artists=artist_items,
        total_artists=len(artist_items),
        period_label=period_label,
    )


@router.get("/artists/{artist_id}", response_model=ArtistDetailedPerformance)
async def get_artist_detailed_performance(
    artist_id: str,
    range_type: str = Query("month", description="Time range: today, week, month, quarter, year, custom"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get detailed performance metrics for a specific artist."""
    from uuid import UUID

    start_dt, end_dt = get_date_range(range_type, start_date, end_date)

    # Get user's studio
    studio_result = await db.execute(
        select(Studio).where(Studio.owner_id == current_user.id)
    )
    studio = studio_result.scalar_one_or_none()
    studio_id = studio.id if studio else None

    # Get artist
    artist_result = await db.execute(
        select(User).where(User.id == UUID(artist_id))
    )
    artist = artist_result.scalar_one_or_none()
    if not artist:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Artist not found")

    # Get artist profile
    profile_result = await db.execute(
        select(ArtistProfile).where(ArtistProfile.user_id == artist.id)
    )
    profile = profile_result.scalar_one_or_none()

    # === REVENUE BREAKDOWN ===
    revenue_result = await db.execute(
        select(
            func.coalesce(func.sum(EarnedCommission.service_total), 0).label("revenue"),
            func.coalesce(func.sum(EarnedCommission.tips_amount), 0).label("tips"),
            func.coalesce(func.sum(EarnedCommission.commission_amount), 0).label("commission"),
            func.count(EarnedCommission.id).label("completed"),
        ).where(
            and_(
                EarnedCommission.artist_id == artist.id,
                EarnedCommission.completed_at >= start_dt,
                EarnedCommission.completed_at <= end_dt,
                EarnedCommission.studio_id == studio_id if studio_id else True,
            )
        )
    )
    rev_row = revenue_result.one()
    avg_per_booking = (rev_row.revenue // rev_row.completed) if rev_row.completed > 0 else 0

    revenue = ArtistRevenueBreakdown(
        service_revenue=rev_row.revenue,
        tips=rev_row.tips,
        commission_earned=rev_row.commission,
        average_per_booking=avg_per_booking,
    )

    # === BOOKING STATS ===
    # Total requests assigned
    total_requests_result = await db.execute(
        select(func.count(BookingRequest.id)).where(
            and_(
                BookingRequest.assigned_artist_id == artist.id,
                BookingRequest.created_at >= start_dt,
                BookingRequest.created_at <= end_dt,
            )
        )
    )
    total_requests = total_requests_result.scalar() or 0

    # Confirmed (upcoming)
    confirmed_result = await db.execute(
        select(func.count(BookingRequest.id)).where(
            and_(
                BookingRequest.assigned_artist_id == artist.id,
                BookingRequest.status == BookingRequestStatus.CONFIRMED,
                BookingRequest.scheduled_date >= datetime.now(),
            )
        )
    )
    confirmed = confirmed_result.scalar() or 0

    # Cancelled
    cancelled_result = await db.execute(
        select(func.count(BookingRequest.id)).where(
            and_(
                BookingRequest.assigned_artist_id == artist.id,
                BookingRequest.status == BookingRequestStatus.CANCELLED,
                BookingRequest.cancelled_at >= start_dt,
                BookingRequest.cancelled_at <= end_dt,
            )
        )
    )
    cancelled = cancelled_result.scalar() or 0

    # No-shows
    no_show_result = await db.execute(
        select(func.count(BookingRequest.id)).where(
            and_(
                BookingRequest.assigned_artist_id == artist.id,
                BookingRequest.status == BookingRequestStatus.NO_SHOW,
                BookingRequest.no_show_at >= start_dt,
                BookingRequest.no_show_at <= end_dt,
            )
        )
    )
    no_shows = no_show_result.scalar() or 0

    # Completion rate
    total_for_rate = rev_row.completed + no_shows
    completion_rate = (rev_row.completed / total_for_rate * 100) if total_for_rate > 0 else 0

    bookings = ArtistBookingStats(
        total_requests=total_requests,
        completed=rev_row.completed,
        confirmed=confirmed,
        cancelled=cancelled,
        no_shows=no_shows,
        completion_rate=round(completion_rate, 1),
    )

    # === SPECIALTY STATS ===
    # Placement breakdown
    placement_result = await db.execute(
        select(
            BookingRequest.placement,
            func.count(BookingRequest.id).label("count"),
        ).where(
            and_(
                BookingRequest.assigned_artist_id == artist.id,
                BookingRequest.status == BookingRequestStatus.COMPLETED,
                BookingRequest.placement.isnot(None),
            )
        ).group_by(BookingRequest.placement)
        .order_by(func.count(BookingRequest.id).desc())
    )
    placement_data = placement_result.all()
    placement_breakdown = {row.placement: row.count for row in placement_data}
    top_placements = [row.placement for row in placement_data[:3]]

    # Size breakdown
    size_result = await db.execute(
        select(
            BookingRequest.size,
            func.count(BookingRequest.id).label("count"),
        ).where(
            and_(
                BookingRequest.assigned_artist_id == artist.id,
                BookingRequest.status == BookingRequestStatus.COMPLETED,
                BookingRequest.size.isnot(None),
            )
        ).group_by(BookingRequest.size)
    )
    size_breakdown = {row.size.value if row.size else "unknown": row.count for row in size_result.all()}

    specialties_stats = ArtistSpecialtyStats(
        placement_breakdown=placement_breakdown,
        size_breakdown=size_breakdown,
        top_placements=top_placements,
    )

    # === TIME STATS ===
    # Total hours booked
    hours_result = await db.execute(
        select(func.coalesce(func.sum(BookingRequest.scheduled_duration_hours), 0)).where(
            and_(
                BookingRequest.assigned_artist_id == artist.id,
                BookingRequest.status.in_([
                    BookingRequestStatus.CONFIRMED,
                    BookingRequestStatus.COMPLETED,
                ]),
                BookingRequest.scheduled_date >= start_dt,
                BookingRequest.scheduled_date <= end_dt,
            )
        )
    )
    total_hours = float(hours_result.scalar() or 0)
    avg_duration = total_hours / rev_row.completed if rev_row.completed > 0 else 0

    # Busiest day/hour
    day_hour_result = await db.execute(
        select(
            func.extract("dow", BookingRequest.scheduled_date).label("day"),
            func.extract("hour", BookingRequest.scheduled_date).label("hour"),
            func.count(BookingRequest.id).label("count"),
        ).where(
            and_(
                BookingRequest.assigned_artist_id == artist.id,
                BookingRequest.scheduled_date.isnot(None),
                BookingRequest.status.in_([
                    BookingRequestStatus.CONFIRMED,
                    BookingRequestStatus.COMPLETED,
                ]),
            )
        ).group_by(
            func.extract("dow", BookingRequest.scheduled_date),
            func.extract("hour", BookingRequest.scheduled_date),
        )
    )
    day_hour_data = day_hour_result.all()

    day_names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    day_totals: dict[int, int] = {}
    hour_totals: dict[int, int] = {}
    for row in day_hour_data:
        if row.day is not None:
            day_totals[int(row.day)] = day_totals.get(int(row.day), 0) + row.count
        if row.hour is not None:
            hour_totals[int(row.hour)] = hour_totals.get(int(row.hour), 0) + row.count

    busiest_day = day_names[max(day_totals, key=day_totals.get)] if day_totals else "N/A"
    busiest_hour = max(hour_totals, key=hour_totals.get) if hour_totals else 12

    # Utilization rate
    days_in_period = (end_dt.date() - start_dt.date()).days + 1
    business_days = int(days_in_period * 5 / 7)
    available_hours = business_days * 8
    utilization_rate = (total_hours / available_hours * 100) if available_hours > 0 else 0

    time_stats = ArtistTimeStats(
        total_hours_booked=round(total_hours, 1),
        average_duration=round(avg_duration, 1),
        busiest_day=busiest_day,
        busiest_hour=busiest_hour,
        utilization_rate=round(utilization_rate, 1),
    )

    # === MONTHLY PERFORMANCE ===
    monthly_result = await db.execute(
        select(
            func.to_char(EarnedCommission.completed_at, 'YYYY-MM').label("month"),
            func.coalesce(func.sum(EarnedCommission.service_total), 0).label("revenue"),
            func.count(EarnedCommission.id).label("bookings"),
            func.coalesce(func.sum(EarnedCommission.tips_amount), 0).label("tips"),
        ).where(
            and_(
                EarnedCommission.artist_id == artist.id,
                EarnedCommission.studio_id == studio_id if studio_id else True,
            )
        ).group_by(func.to_char(EarnedCommission.completed_at, 'YYYY-MM'))
        .order_by(func.to_char(EarnedCommission.completed_at, 'YYYY-MM').desc())
        .limit(12)
    )
    monthly_performance = [
        MonthlyPerformance(
            month=row.month,
            revenue=row.revenue,
            bookings=row.bookings,
            tips=row.tips,
        )
        for row in monthly_result.all()
    ]
    monthly_performance.reverse()  # Show oldest first

    # === CLIENT METRICS ===
    # Total unique clients
    total_clients_result = await db.execute(
        select(func.count(func.distinct(BookingRequest.client_email))).where(
            and_(
                BookingRequest.assigned_artist_id == artist.id,
                BookingRequest.status == BookingRequestStatus.COMPLETED,
            )
        )
    )
    total_clients = total_clients_result.scalar() or 0

    # Returning clients
    returning_result = await db.execute(
        select(func.count(BookingRequest.client_email))
        .where(
            and_(
                BookingRequest.assigned_artist_id == artist.id,
                BookingRequest.status == BookingRequestStatus.COMPLETED,
            )
        )
        .group_by(BookingRequest.client_email)
        .having(func.count(BookingRequest.id) > 1)
    )
    returning_clients = len(returning_result.all())
    retention_rate = (returning_clients / total_clients * 100) if total_clients > 0 else 0

    return ArtistDetailedPerformance(
        artist_id=str(artist.id),
        artist_name=f"{artist.first_name} {artist.last_name}",
        artist_email=artist.email,
        profile_image=profile.profile_image_url if profile else None,
        specialties=profile.specialties if profile and profile.specialties else [],
        bio=profile.bio if profile else None,
        revenue=revenue,
        bookings=bookings,
        specialties_stats=specialties_stats,
        time_stats=time_stats,
        monthly_performance=monthly_performance,
        total_clients=total_clients,
        returning_clients=returning_clients,
        client_retention_rate=round(retention_rate, 1),
    )


# ========== Revenue Report Endpoints ==========


async def _get_studio_for_user(db: AsyncSession, user: User):
    """Helper to get studio for current user."""
    studio_result = await db.execute(
        select(Studio).where(Studio.owner_id == user.id)
    )
    return studio_result.scalar_one_or_none()


async def _get_revenue_by_artist(
    db: AsyncSession, start_dt: datetime, end_dt: datetime, studio_id
) -> list[RevenueByArtist]:
    """Get revenue breakdown by artist."""
    result = await db.execute(
        select(
            EarnedCommission.artist_id,
            func.coalesce(func.sum(EarnedCommission.service_total), 0).label("revenue"),
            func.coalesce(func.sum(EarnedCommission.tips_amount), 0).label("tips"),
            func.count(EarnedCommission.id).label("bookings"),
        )
        .where(
            and_(
                EarnedCommission.completed_at >= start_dt,
                EarnedCommission.completed_at <= end_dt,
                EarnedCommission.studio_id == studio_id if studio_id else True,
            )
        )
        .group_by(EarnedCommission.artist_id)
        .order_by(func.sum(EarnedCommission.service_total).desc())
    )
    rows = result.all()

    # Get total for percentage calculation
    total_revenue = sum(row.revenue for row in rows)

    artist_data = []
    for row in rows:
        # Get artist name
        artist_result = await db.execute(
            select(User).where(User.id == row.artist_id)
        )
        artist = artist_result.scalar_one_or_none()
        if artist:
            artist_data.append(
                RevenueByArtist(
                    artist_id=str(row.artist_id),
                    artist_name=f"{artist.first_name} {artist.last_name}",
                    revenue=row.revenue,
                    tips=row.tips,
                    bookings=row.bookings,
                    percentage=round((row.revenue / total_revenue * 100) if total_revenue > 0 else 0, 1),
                )
            )

    return artist_data


async def _get_revenue_by_category(
    db: AsyncSession,
    start_dt: datetime,
    end_dt: datetime,
    studio_id,
    category_type: str,
) -> list[RevenueByCategory]:
    """Get revenue breakdown by category (size or placement)."""
    if category_type == "size":
        group_col = BookingRequest.size
    else:
        group_col = BookingRequest.placement

    result = await db.execute(
        select(
            group_col.label("category"),
            func.coalesce(func.sum(BookingRequest.quoted_price), 0).label("revenue"),
            func.count(BookingRequest.id).label("count"),
        )
        .where(
            and_(
                BookingRequest.status == BookingRequestStatus.COMPLETED,
                BookingRequest.updated_at >= start_dt,
                BookingRequest.updated_at <= end_dt,
                BookingRequest.studio_id == studio_id if studio_id else True,
                group_col.isnot(None),
            )
        )
        .group_by(group_col)
        .order_by(func.sum(BookingRequest.quoted_price).desc())
    )
    rows = result.all()

    total_revenue = sum(row.revenue for row in rows)

    return [
        RevenueByCategory(
            category=row.category.value if hasattr(row.category, 'value') else str(row.category),
            revenue=row.revenue,
            count=row.count,
            percentage=round((row.revenue / total_revenue * 100) if total_revenue > 0 else 0, 1),
        )
        for row in rows
    ]


@router.get("/reports/daily", response_model=DailyRevenueReportResponse)
async def get_daily_revenue_report(
    start_date: date = Query(description="Start date for the report"),
    end_date: date = Query(description="End date for the report"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["owner"])),
):
    """Get daily revenue report for a date range."""
    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    studio = await _get_studio_for_user(db, current_user)
    studio_id = studio.id if studio else None

    # Get daily revenue data
    result = await db.execute(
        select(
            func.date(EarnedCommission.completed_at).label("date"),
            func.coalesce(func.sum(EarnedCommission.service_total), 0).label("revenue"),
            func.coalesce(func.sum(EarnedCommission.tips_amount), 0).label("tips"),
            func.count(EarnedCommission.id).label("bookings"),
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
    rows = result.all()

    # Get deposits data
    deposit_result = await db.execute(
        select(
            func.date(BookingRequest.deposit_paid_at).label("date"),
            func.coalesce(func.sum(BookingRequest.deposit_amount), 0).label("deposits"),
        )
        .where(
            and_(
                BookingRequest.deposit_paid_at >= start_dt,
                BookingRequest.deposit_paid_at <= end_dt,
                BookingRequest.studio_id == studio_id if studio_id else True,
            )
        )
        .group_by(func.date(BookingRequest.deposit_paid_at))
    )
    deposit_data = {row.date: row.deposits for row in deposit_result.all()}

    # Build daily data
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    daily_data = []
    total_revenue = 0
    total_tips = 0
    total_deposits = 0
    total_bookings = 0
    highest_day = None
    highest_revenue = 0
    lowest_day = None
    lowest_revenue = float('inf')

    for row in rows:
        deposits = deposit_data.get(row.date, 0)
        avg_booking = row.revenue // row.bookings if row.bookings > 0 else 0

        daily_data.append(
            RevenueByDay(
                date=row.date,
                day_name=day_names[row.date.weekday()],
                revenue=row.revenue,
                tips=row.tips,
                deposits=deposits,
                bookings=row.bookings,
                average_booking=avg_booking,
            )
        )

        total_revenue += row.revenue
        total_tips += row.tips
        total_deposits += deposits
        total_bookings += row.bookings

        if row.revenue > highest_revenue:
            highest_revenue = row.revenue
            highest_day = row.date
        if row.revenue < lowest_revenue:
            lowest_revenue = row.revenue
            lowest_day = row.date

    # Summary
    summary = RevenueSummary(
        total_revenue=total_revenue,
        total_tips=total_tips,
        total_deposits=total_deposits,
        total_bookings=total_bookings,
        average_booking_value=total_revenue // total_bookings if total_bookings > 0 else 0,
        highest_day=highest_day,
        highest_day_revenue=highest_revenue,
        lowest_day=lowest_day,
        lowest_day_revenue=lowest_revenue if lowest_revenue != float('inf') else 0,
    )

    # Get breakdowns
    by_artist = await _get_revenue_by_artist(db, start_dt, end_dt, studio_id)
    by_size = await _get_revenue_by_category(db, start_dt, end_dt, studio_id, "size")
    by_placement = await _get_revenue_by_category(db, start_dt, end_dt, studio_id, "placement")

    return DailyRevenueReportResponse(
        period_start=start_date,
        period_end=end_date,
        summary=summary,
        daily_data=daily_data,
        by_artist=by_artist,
        by_size=by_size,
        by_placement=by_placement,
    )


@router.get("/reports/weekly", response_model=WeeklyRevenueReportResponse)
async def get_weekly_revenue_report(
    start_date: date = Query(description="Start date for the report"),
    end_date: date = Query(description="End date for the report"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["owner"])),
):
    """Get weekly revenue report for a date range."""
    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    studio = await _get_studio_for_user(db, current_user)
    studio_id = studio.id if studio else None

    # Get weekly revenue data using ISO week
    result = await db.execute(
        select(
            func.date_trunc('week', EarnedCommission.completed_at).label("week_start"),
            func.coalesce(func.sum(EarnedCommission.service_total), 0).label("revenue"),
            func.coalesce(func.sum(EarnedCommission.tips_amount), 0).label("tips"),
            func.count(EarnedCommission.id).label("bookings"),
        )
        .where(
            and_(
                EarnedCommission.completed_at >= start_dt,
                EarnedCommission.completed_at <= end_dt,
                EarnedCommission.studio_id == studio_id if studio_id else True,
            )
        )
        .group_by(func.date_trunc('week', EarnedCommission.completed_at))
        .order_by(func.date_trunc('week', EarnedCommission.completed_at))
    )
    rows = result.all()

    # Get deposits by week
    deposit_result = await db.execute(
        select(
            func.date_trunc('week', BookingRequest.deposit_paid_at).label("week_start"),
            func.coalesce(func.sum(BookingRequest.deposit_amount), 0).label("deposits"),
        )
        .where(
            and_(
                BookingRequest.deposit_paid_at >= start_dt,
                BookingRequest.deposit_paid_at <= end_dt,
                BookingRequest.studio_id == studio_id if studio_id else True,
            )
        )
        .group_by(func.date_trunc('week', BookingRequest.deposit_paid_at))
    )
    deposit_data = {row.week_start.date(): row.deposits for row in deposit_result.all()}

    # Build weekly data
    weekly_data = []
    total_revenue = 0
    total_tips = 0
    total_deposits = 0
    total_bookings = 0
    highest_day = None
    highest_revenue = 0
    lowest_day = None
    lowest_revenue = float('inf')
    prev_revenue = None

    for row in rows:
        week_start = row.week_start.date()
        week_end = week_start + timedelta(days=6)
        deposits = deposit_data.get(week_start, 0)
        avg_booking = row.revenue // row.bookings if row.bookings > 0 else 0

        # Calculate change from previous week
        change = None
        if prev_revenue is not None and prev_revenue > 0:
            change = round(((row.revenue - prev_revenue) / prev_revenue) * 100, 1)

        week_number = week_start.isocalendar()[1]

        weekly_data.append(
            RevenueByWeek(
                week_start=week_start,
                week_end=week_end,
                week_number=week_number,
                revenue=row.revenue,
                tips=row.tips,
                deposits=deposits,
                bookings=row.bookings,
                average_booking=avg_booking,
                change_from_previous=change,
            )
        )

        total_revenue += row.revenue
        total_tips += row.tips
        total_deposits += deposits
        total_bookings += row.bookings

        if row.revenue > highest_revenue:
            highest_revenue = row.revenue
            highest_day = week_start
        if row.revenue < lowest_revenue:
            lowest_revenue = row.revenue
            lowest_day = week_start

        prev_revenue = row.revenue

    # Summary
    summary = RevenueSummary(
        total_revenue=total_revenue,
        total_tips=total_tips,
        total_deposits=total_deposits,
        total_bookings=total_bookings,
        average_booking_value=total_revenue // total_bookings if total_bookings > 0 else 0,
        highest_day=highest_day,
        highest_day_revenue=highest_revenue,
        lowest_day=lowest_day,
        lowest_day_revenue=lowest_revenue if lowest_revenue != float('inf') else 0,
    )

    # Get breakdowns
    by_artist = await _get_revenue_by_artist(db, start_dt, end_dt, studio_id)

    return WeeklyRevenueReportResponse(
        period_start=start_date,
        period_end=end_date,
        summary=summary,
        weekly_data=weekly_data,
        by_artist=by_artist,
    )


@router.get("/reports/monthly", response_model=MonthlyRevenueReportResponse)
async def get_monthly_revenue_report(
    start_date: date = Query(description="Start date for the report"),
    end_date: date = Query(description="End date for the report"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["owner"])),
):
    """Get monthly revenue report for a date range."""
    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    studio = await _get_studio_for_user(db, current_user)
    studio_id = studio.id if studio else None

    # Get monthly revenue data
    result = await db.execute(
        select(
            func.to_char(EarnedCommission.completed_at, 'YYYY-MM').label("month"),
            func.coalesce(func.sum(EarnedCommission.service_total), 0).label("revenue"),
            func.coalesce(func.sum(EarnedCommission.tips_amount), 0).label("tips"),
            func.count(EarnedCommission.id).label("bookings"),
        )
        .where(
            and_(
                EarnedCommission.completed_at >= start_dt,
                EarnedCommission.completed_at <= end_dt,
                EarnedCommission.studio_id == studio_id if studio_id else True,
            )
        )
        .group_by(func.to_char(EarnedCommission.completed_at, 'YYYY-MM'))
        .order_by(func.to_char(EarnedCommission.completed_at, 'YYYY-MM'))
    )
    rows = result.all()

    # Get deposits by month
    deposit_result = await db.execute(
        select(
            func.to_char(BookingRequest.deposit_paid_at, 'YYYY-MM').label("month"),
            func.coalesce(func.sum(BookingRequest.deposit_amount), 0).label("deposits"),
        )
        .where(
            and_(
                BookingRequest.deposit_paid_at >= start_dt,
                BookingRequest.deposit_paid_at <= end_dt,
                BookingRequest.studio_id == studio_id if studio_id else True,
            )
        )
        .group_by(func.to_char(BookingRequest.deposit_paid_at, 'YYYY-MM'))
    )
    deposit_data = {row.month: row.deposits for row in deposit_result.all()}

    # Build monthly data
    month_names = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]
    monthly_data = []
    total_revenue = 0
    total_tips = 0
    total_deposits = 0
    total_bookings = 0
    highest_day = None
    highest_revenue = 0
    lowest_day = None
    lowest_revenue = float('inf')
    prev_revenue = None

    for row in rows:
        month_parts = row.month.split('-')
        year = int(month_parts[0])
        month_num = int(month_parts[1])
        month_name = f"{month_names[month_num - 1]} {year}"
        month_start = date(year, month_num, 1)

        deposits = deposit_data.get(row.month, 0)
        avg_booking = row.revenue // row.bookings if row.bookings > 0 else 0

        # Calculate change from previous month
        change = None
        if prev_revenue is not None and prev_revenue > 0:
            change = round(((row.revenue - prev_revenue) / prev_revenue) * 100, 1)

        monthly_data.append(
            RevenueByMonth(
                month=row.month,
                month_name=month_name,
                revenue=row.revenue,
                tips=row.tips,
                deposits=deposits,
                bookings=row.bookings,
                average_booking=avg_booking,
                change_from_previous=change,
            )
        )

        total_revenue += row.revenue
        total_tips += row.tips
        total_deposits += deposits
        total_bookings += row.bookings

        if row.revenue > highest_revenue:
            highest_revenue = row.revenue
            highest_day = month_start
        if row.revenue < lowest_revenue:
            lowest_revenue = row.revenue
            lowest_day = month_start

        prev_revenue = row.revenue

    # Summary
    summary = RevenueSummary(
        total_revenue=total_revenue,
        total_tips=total_tips,
        total_deposits=total_deposits,
        total_bookings=total_bookings,
        average_booking_value=total_revenue // total_bookings if total_bookings > 0 else 0,
        highest_day=highest_day,
        highest_day_revenue=highest_revenue,
        lowest_day=lowest_day,
        lowest_day_revenue=lowest_revenue if lowest_revenue != float('inf') else 0,
    )

    # Get breakdowns
    by_artist = await _get_revenue_by_artist(db, start_dt, end_dt, studio_id)

    return MonthlyRevenueReportResponse(
        period_start=start_date,
        period_end=end_date,
        summary=summary,
        monthly_data=monthly_data,
        by_artist=by_artist,
    )


@router.get("/reports/custom", response_model=CustomRevenueReportResponse)
async def get_custom_revenue_report(
    start_date: date = Query(description="Start date for the report"),
    end_date: date = Query(description="End date for the report"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["owner"])),
):
    """Get custom date range revenue report."""
    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    studio = await _get_studio_for_user(db, current_user)
    studio_id = studio.id if studio else None

    # Get daily revenue data
    result = await db.execute(
        select(
            func.date(EarnedCommission.completed_at).label("date"),
            func.coalesce(func.sum(EarnedCommission.service_total), 0).label("revenue"),
            func.coalesce(func.sum(EarnedCommission.tips_amount), 0).label("tips"),
            func.count(EarnedCommission.id).label("bookings"),
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
    rows = result.all()

    # Get deposits data
    deposit_result = await db.execute(
        select(
            func.date(BookingRequest.deposit_paid_at).label("date"),
            func.coalesce(func.sum(BookingRequest.deposit_amount), 0).label("deposits"),
        )
        .where(
            and_(
                BookingRequest.deposit_paid_at >= start_dt,
                BookingRequest.deposit_paid_at <= end_dt,
                BookingRequest.studio_id == studio_id if studio_id else True,
            )
        )
        .group_by(func.date(BookingRequest.deposit_paid_at))
    )
    deposit_data = {row.date: row.deposits for row in deposit_result.all()}

    # Build daily data
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    daily_data = []
    total_revenue = 0
    total_tips = 0
    total_deposits = 0
    total_bookings = 0
    highest_day = None
    highest_revenue = 0
    lowest_day = None
    lowest_revenue = float('inf')

    for row in rows:
        deposits = deposit_data.get(row.date, 0)
        avg_booking = row.revenue // row.bookings if row.bookings > 0 else 0

        daily_data.append(
            RevenueByDay(
                date=row.date,
                day_name=day_names[row.date.weekday()],
                revenue=row.revenue,
                tips=row.tips,
                deposits=deposits,
                bookings=row.bookings,
                average_booking=avg_booking,
            )
        )

        total_revenue += row.revenue
        total_tips += row.tips
        total_deposits += deposits
        total_bookings += row.bookings

        if row.revenue > highest_revenue:
            highest_revenue = row.revenue
            highest_day = row.date
        if row.revenue < lowest_revenue:
            lowest_revenue = row.revenue
            lowest_day = row.date

    # Summary
    summary = RevenueSummary(
        total_revenue=total_revenue,
        total_tips=total_tips,
        total_deposits=total_deposits,
        total_bookings=total_bookings,
        average_booking_value=total_revenue // total_bookings if total_bookings > 0 else 0,
        highest_day=highest_day,
        highest_day_revenue=highest_revenue,
        lowest_day=lowest_day,
        lowest_day_revenue=lowest_revenue if lowest_revenue != float('inf') else 0,
    )

    # Get breakdowns
    by_artist = await _get_revenue_by_artist(db, start_dt, end_dt, studio_id)
    by_size = await _get_revenue_by_category(db, start_dt, end_dt, studio_id, "size")
    by_placement = await _get_revenue_by_category(db, start_dt, end_dt, studio_id, "placement")

    return CustomRevenueReportResponse(
        period_start=start_date,
        period_end=end_date,
        summary=summary,
        daily_data=daily_data,
        by_artist=by_artist,
        by_size=by_size,
        by_placement=by_placement,
    )


# ========== Client Retention Report Endpoint ==========


@router.get("/reports/retention", response_model=ClientRetentionReportResponse)
async def get_client_retention_report(
    start_date: date = Query(description="Start date for the report"),
    end_date: date = Query(description="End date for the report"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["owner"])),
):
    """Get detailed client retention report."""
    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    studio = await _get_studio_for_user(db, current_user)
    studio_id = studio.id if studio else None

    base_filter = []
    if studio_id:
        base_filter.append(BookingRequest.studio_id == studio_id)

    # === TOTAL CLIENTS (all time) ===
    total_clients_result = await db.execute(
        select(func.count(func.distinct(BookingRequest.client_email))).where(
            and_(*base_filter) if base_filter else True
        )
    )
    total_clients = total_clients_result.scalar() or 0

    # === NEW CLIENTS (first booking in period) ===
    # Get clients whose first booking was in this period
    first_booking_subquery = (
        select(
            BookingRequest.client_email,
            func.min(BookingRequest.created_at).label("first_booking"),
        )
        .where(and_(*base_filter) if base_filter else True)
        .group_by(BookingRequest.client_email)
        .subquery()
    )

    new_clients_result = await db.execute(
        select(func.count(first_booking_subquery.c.client_email)).where(
            and_(
                first_booking_subquery.c.first_booking >= start_dt,
                first_booking_subquery.c.first_booking <= end_dt,
            )
        )
    )
    new_clients = new_clients_result.scalar() or 0

    # === RETURNING CLIENTS (more than 1 booking all time) ===
    returning_result = await db.execute(
        select(func.count(BookingRequest.client_email))
        .where(and_(*base_filter) if base_filter else True)
        .group_by(BookingRequest.client_email)
        .having(func.count(BookingRequest.id) > 1)
    )
    returning_clients = len(returning_result.all())

    # === LOYAL CLIENTS (3+ bookings) ===
    loyal_result = await db.execute(
        select(func.count(BookingRequest.client_email))
        .where(and_(*base_filter) if base_filter else True)
        .group_by(BookingRequest.client_email)
        .having(func.count(BookingRequest.id) >= 3)
    )
    loyal_clients = len(loyal_result.all())

    # === LAPSED CLIENTS (no booking in 90+ days) ===
    ninety_days_ago = datetime.now() - timedelta(days=90)
    lapsed_subquery = (
        select(
            BookingRequest.client_email,
            func.max(BookingRequest.created_at).label("last_booking"),
        )
        .where(and_(*base_filter) if base_filter else True)
        .group_by(BookingRequest.client_email)
        .subquery()
    )

    lapsed_result = await db.execute(
        select(func.count(lapsed_subquery.c.client_email)).where(
            lapsed_subquery.c.last_booking < ninety_days_ago
        )
    )
    lapsed_clients = lapsed_result.scalar() or 0

    # Calculate rates
    retention_rate = (returning_clients / total_clients * 100) if total_clients > 0 else 0
    churn_rate = (lapsed_clients / total_clients * 100) if total_clients > 0 else 0

    # === CLIENT SEGMENTS ===
    one_time_clients = total_clients - returning_clients

    # Get revenue by segment
    segments = []

    # New clients revenue
    new_client_revenue_result = await db.execute(
        select(func.coalesce(func.sum(BookingRequest.quoted_price), 0)).where(
            and_(
                BookingRequest.created_at >= start_dt,
                BookingRequest.created_at <= end_dt,
                BookingRequest.status == BookingRequestStatus.COMPLETED,
                *base_filter,
            )
        )
    )
    new_client_revenue = new_client_revenue_result.scalar() or 0

    segments.append(
        ClientSegment(
            segment="New",
            count=new_clients,
            percentage=round((new_clients / total_clients * 100) if total_clients > 0 else 0, 1),
            revenue=new_client_revenue,
        )
    )

    segments.append(
        ClientSegment(
            segment="Returning",
            count=returning_clients - loyal_clients,
            percentage=round(((returning_clients - loyal_clients) / total_clients * 100) if total_clients > 0 else 0, 1),
            revenue=0,  # Would need more complex query
        )
    )

    segments.append(
        ClientSegment(
            segment="Loyal",
            count=loyal_clients,
            percentage=round((loyal_clients / total_clients * 100) if total_clients > 0 else 0, 1),
            revenue=0,  # Would need more complex query
        )
    )

    segments.append(
        ClientSegment(
            segment="Lapsed",
            count=lapsed_clients,
            percentage=round((lapsed_clients / total_clients * 100) if total_clients > 0 else 0, 1),
            revenue=0,
        )
    )

    # === LIFETIME VALUE METRICS ===
    # Average revenue per client (all time)
    total_revenue_result = await db.execute(
        select(func.coalesce(func.sum(BookingRequest.quoted_price), 0)).where(
            and_(
                BookingRequest.status == BookingRequestStatus.COMPLETED,
                *base_filter,
            )
        )
    )
    total_revenue = total_revenue_result.scalar() or 0
    avg_ltv = total_revenue // total_clients if total_clients > 0 else 0

    # Average bookings per client
    total_bookings_result = await db.execute(
        select(func.count(BookingRequest.id)).where(
            and_(
                BookingRequest.status == BookingRequestStatus.COMPLETED,
                *base_filter,
            )
        )
    )
    total_bookings = total_bookings_result.scalar() or 0
    avg_bookings = total_bookings / total_clients if total_clients > 0 else 0

    # Average time between visits (for returning clients)
    avg_time_between = 45.0  # Default placeholder - complex query needed

    # Highest value client - use subquery to avoid nested aggregates
    client_totals_subquery = (
        select(func.sum(BookingRequest.quoted_price).label("client_total"))
        .where(
            and_(
                BookingRequest.status == BookingRequestStatus.COMPLETED,
                *base_filter,
            )
        )
        .group_by(BookingRequest.client_email)
        .subquery()
    )
    highest_value_result = await db.execute(
        select(func.max(client_totals_subquery.c.client_total))
    )
    highest_value = highest_value_result.scalar() or 0

    lifetime_value = ClientLifetimeValue(
        average_lifetime_value=avg_ltv,
        average_bookings=round(avg_bookings, 2),
        average_time_between_visits=avg_time_between,
        highest_value_client_revenue=highest_value,
    )

    # === ACQUISITION BY MONTH ===
    month_names = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]

    month_expr = func.to_char(BookingRequest.created_at, 'YYYY-MM')
    acquisition_result = await db.execute(
        select(
            month_expr.label("month"),
            func.count(func.distinct(BookingRequest.client_email)).label("clients"),
            func.count(BookingRequest.id).label("bookings"),
        )
        .where(
            and_(
                BookingRequest.created_at >= start_dt,
                BookingRequest.created_at <= end_dt,
                *base_filter,
            )
        )
        .group_by(month_expr)
        .order_by(month_expr)
    )

    acquisition_by_month = []
    for row in acquisition_result.all():
        month_parts = row.month.split('-')
        year = int(month_parts[0])
        month_num = int(month_parts[1])
        month_name = f"{month_names[month_num - 1]} {year}"

        acquisition_by_month.append(
            ClientAcquisitionByMonth(
                month=row.month,
                month_name=month_name,
                new_clients=row.clients,  # Simplified - all clients in month
                returning_clients=0,  # Would need more complex query
                total_bookings=row.bookings,
            )
        )

    # === BY ARTIST BREAKDOWN ===
    by_artist = []
    artist_result = await db.execute(
        select(
            BookingRequest.assigned_artist_id,
            func.count(func.distinct(BookingRequest.client_email)).label("total_clients"),
            func.count(BookingRequest.id).label("total_bookings"),
        )
        .where(
            and_(
                BookingRequest.assigned_artist_id.isnot(None),
                BookingRequest.status == BookingRequestStatus.COMPLETED,
                *base_filter,
            )
        )
        .group_by(BookingRequest.assigned_artist_id)
    )

    for row in artist_result.all():
        # Get artist name
        artist_q = await db.execute(select(User).where(User.id == row.assigned_artist_id))
        artist = artist_q.scalar_one_or_none()
        if artist:
            # Get returning clients for this artist
            returning_for_artist = await db.execute(
                select(func.count(BookingRequest.client_email))
                .where(
                    and_(
                        BookingRequest.assigned_artist_id == row.assigned_artist_id,
                        BookingRequest.status == BookingRequestStatus.COMPLETED,
                    )
                )
                .group_by(BookingRequest.client_email)
                .having(func.count(BookingRequest.id) > 1)
            )
            returning_count = len(returning_for_artist.all())
            artist_retention = (returning_count / row.total_clients * 100) if row.total_clients > 0 else 0
            avg_per_client = row.total_bookings / row.total_clients if row.total_clients > 0 else 0

            by_artist.append(
                ClientByArtist(
                    artist_id=str(row.assigned_artist_id),
                    artist_name=f"{artist.first_name} {artist.last_name}",
                    total_clients=row.total_clients,
                    returning_clients=returning_count,
                    retention_rate=round(artist_retention, 1),
                    average_bookings_per_client=round(avg_per_client, 2),
                )
            )

    # === TOP CLIENTS ===
    top_clients_result = await db.execute(
        select(
            BookingRequest.client_email,
            BookingRequest.client_name,
            func.count(BookingRequest.id).label("total_bookings"),
            func.coalesce(func.sum(BookingRequest.quoted_price), 0).label("total_spent"),
            func.min(BookingRequest.created_at).label("first_visit"),
            func.max(BookingRequest.created_at).label("last_visit"),
        )
        .where(
            and_(
                BookingRequest.status == BookingRequestStatus.COMPLETED,
                *base_filter,
            )
        )
        .group_by(BookingRequest.client_email, BookingRequest.client_name)
        .order_by(func.sum(BookingRequest.quoted_price).desc())
        .limit(10)
    )

    top_clients = []
    for row in top_clients_result.all():
        top_clients.append(
            TopClient(
                client_email=row.client_email,
                client_name=row.client_name,
                total_bookings=row.total_bookings,
                total_spent=row.total_spent,
                first_visit=row.first_visit.date(),
                last_visit=row.last_visit.date(),
                favorite_artist=None,  # Would need additional query
            )
        )

    # === PERIOD COMPARISON ===
    # Calculate previous period for comparison
    period_days = (end_date - start_date).days
    prev_start = start_date - timedelta(days=period_days + 1)
    prev_end = start_date - timedelta(days=1)
    prev_start_dt = datetime.combine(prev_start, datetime.min.time())
    prev_end_dt = datetime.combine(prev_end, datetime.max.time())

    # Previous period returning clients
    prev_returning_result = await db.execute(
        select(func.count(BookingRequest.client_email))
        .where(
            and_(
                BookingRequest.created_at <= prev_end_dt,
                *base_filter,
            )
        )
        .group_by(BookingRequest.client_email)
        .having(func.count(BookingRequest.id) > 1)
    )
    prev_returning = len(prev_returning_result.all())

    prev_total_result = await db.execute(
        select(func.count(func.distinct(BookingRequest.client_email))).where(
            and_(
                BookingRequest.created_at <= prev_end_dt,
                *base_filter,
            )
        )
    )
    prev_total = prev_total_result.scalar() or 0
    prev_retention = (prev_returning / prev_total * 100) if prev_total > 0 else 0

    retention_change = retention_rate - prev_retention if prev_total > 0 else None

    # Previous period new clients
    prev_new_result = await db.execute(
        select(func.count(first_booking_subquery.c.client_email)).where(
            and_(
                first_booking_subquery.c.first_booking >= prev_start_dt,
                first_booking_subquery.c.first_booking <= prev_end_dt,
            )
        )
    )
    prev_new = prev_new_result.scalar() or 0
    new_clients_change = (
        ((new_clients - prev_new) / prev_new * 100) if prev_new > 0 else None
    )

    return ClientRetentionReportResponse(
        period_start=start_date,
        period_end=end_date,
        total_clients=total_clients,
        new_clients=new_clients,
        returning_clients=returning_clients,
        loyal_clients=loyal_clients,
        lapsed_clients=lapsed_clients,
        retention_rate=round(retention_rate, 1),
        churn_rate=round(churn_rate, 1),
        segments=segments,
        lifetime_value=lifetime_value,
        acquisition_by_month=acquisition_by_month,
        by_artist=by_artist,
        top_clients=top_clients,
        retention_rate_change=round(retention_change, 1) if retention_change is not None else None,
        new_clients_change=round(new_clients_change, 1) if new_clients_change is not None else None,
    )


@router.get("/reports/no-shows", response_model=NoShowReportResponse)
async def get_no_show_report(
    start_date: date = Query(..., description="Start date for report"),
    end_date: date = Query(..., description="End date for report"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get comprehensive no-show tracking report."""
    studio = await _get_studio_for_user(db, current_user)
    studio_id = studio.id if studio else None

    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    # Base filter for this period
    base_filter = [
        BookingRequest.scheduled_date >= start_dt,
        BookingRequest.scheduled_date <= end_dt,
        BookingRequest.scheduled_date.isnot(None),
    ]
    if studio_id:
        base_filter.append(BookingRequest.studio_id == studio_id)

    # === SUMMARY METRICS ===
    # Total appointments (confirmed, completed, no_show)
    total_result = await db.execute(
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
    total_appointments = total_result.scalar() or 0

    # Total no-shows
    no_show_result = await db.execute(
        select(func.count(BookingRequest.id)).where(
            and_(
                *base_filter,
                BookingRequest.status == BookingRequestStatus.NO_SHOW,
            )
        )
    )
    total_no_shows = no_show_result.scalar() or 0

    # No-show rate
    no_show_rate = (total_no_shows / total_appointments * 100) if total_appointments > 0 else 0

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
    total_deposits_forfeited = forfeited_result.scalar() or 0

    # Estimated revenue lost (quoted price of no-shows)
    revenue_lost_result = await db.execute(
        select(func.coalesce(func.sum(BookingRequest.quoted_price), 0)).where(
            and_(
                *base_filter,
                BookingRequest.status == BookingRequestStatus.NO_SHOW,
            )
        )
    )
    estimated_revenue_lost = revenue_lost_result.scalar() or 0

    # === PREVIOUS PERIOD COMPARISON ===
    period_days = (end_date - start_date).days
    prev_start = start_date - timedelta(days=period_days + 1)
    prev_end = start_date - timedelta(days=1)
    prev_start_dt = datetime.combine(prev_start, datetime.min.time())
    prev_end_dt = datetime.combine(prev_end, datetime.max.time())

    prev_filter = [
        BookingRequest.scheduled_date >= prev_start_dt,
        BookingRequest.scheduled_date <= prev_end_dt,
        BookingRequest.scheduled_date.isnot(None),
    ]
    if studio_id:
        prev_filter.append(BookingRequest.studio_id == studio_id)

    prev_total_result = await db.execute(
        select(func.count(BookingRequest.id)).where(
            and_(
                *prev_filter,
                BookingRequest.status.in_([
                    BookingRequestStatus.CONFIRMED,
                    BookingRequestStatus.COMPLETED,
                    BookingRequestStatus.NO_SHOW,
                ]),
            )
        )
    )
    prev_total = prev_total_result.scalar() or 0

    prev_no_show_result = await db.execute(
        select(func.count(BookingRequest.id)).where(
            and_(
                *prev_filter,
                BookingRequest.status == BookingRequestStatus.NO_SHOW,
            )
        )
    )
    prev_no_shows = prev_no_show_result.scalar() or 0

    prev_no_show_rate = (prev_no_shows / prev_total * 100) if prev_total > 0 else 0
    no_show_rate_change = no_show_rate - prev_no_show_rate if prev_total > 0 else None
    no_shows_change = total_no_shows - prev_no_shows if prev_total > 0 else None

    # === BY ARTIST ===
    artist_result = await db.execute(
        select(
            User.id.label("artist_id"),
            func.concat(User.first_name, ' ', User.last_name).label("artist_name"),
            func.count(BookingRequest.id).filter(
                BookingRequest.status.in_([
                    BookingRequestStatus.CONFIRMED,
                    BookingRequestStatus.COMPLETED,
                    BookingRequestStatus.NO_SHOW,
                ])
            ).label("total_appointments"),
            func.count(BookingRequest.id).filter(
                BookingRequest.status == BookingRequestStatus.NO_SHOW
            ).label("no_shows"),
            func.coalesce(
                func.sum(BookingRequest.deposit_amount).filter(
                    and_(
                        BookingRequest.status == BookingRequestStatus.NO_SHOW,
                        BookingRequest.deposit_forfeited == True,
                    )
                ), 0
            ).label("deposits_forfeited"),
            func.coalesce(
                func.sum(BookingRequest.quoted_price).filter(
                    BookingRequest.status == BookingRequestStatus.NO_SHOW
                ), 0
            ).label("revenue_lost"),
        )
        .join(User, BookingRequest.assigned_artist_id == User.id)
        .where(
            and_(
                *base_filter,
                BookingRequest.assigned_artist_id.isnot(None),
            )
        )
        .group_by(User.id, User.first_name, User.last_name)
        .order_by(func.count(BookingRequest.id).filter(
            BookingRequest.status == BookingRequestStatus.NO_SHOW
        ).desc())
    )

    by_artist = []
    for row in artist_result.all():
        artist_no_show_rate = (
            row.no_shows / row.total_appointments * 100
        ) if row.total_appointments > 0 else 0
        by_artist.append(
            NoShowByArtist(
                artist_id=str(row.artist_id),
                artist_name=row.artist_name,
                total_appointments=row.total_appointments,
                no_shows=row.no_shows,
                no_show_rate=round(artist_no_show_rate, 1),
                deposits_forfeited=row.deposits_forfeited,
                revenue_lost=row.revenue_lost,
            )
        )

    # === BY DAY OF WEEK ===
    day_names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

    day_result = await db.execute(
        select(
            func.extract("dow", BookingRequest.scheduled_date).label("day"),
            func.count(BookingRequest.id).filter(
                BookingRequest.status.in_([
                    BookingRequestStatus.CONFIRMED,
                    BookingRequestStatus.COMPLETED,
                    BookingRequestStatus.NO_SHOW,
                ])
            ).label("total_appointments"),
            func.count(BookingRequest.id).filter(
                BookingRequest.status == BookingRequestStatus.NO_SHOW
            ).label("no_shows"),
        )
        .where(and_(*base_filter))
        .group_by(func.extract("dow", BookingRequest.scheduled_date))
        .order_by(func.extract("dow", BookingRequest.scheduled_date))
    )

    by_day_of_week = []
    for row in day_result.all():
        if row.day is not None:
            day_no_show_rate = (
                row.no_shows / row.total_appointments * 100
            ) if row.total_appointments > 0 else 0
            by_day_of_week.append(
                NoShowByDayOfWeek(
                    day_of_week=int(row.day),
                    day_name=day_names[int(row.day)],
                    total_appointments=row.total_appointments,
                    no_shows=row.no_shows,
                    no_show_rate=round(day_no_show_rate, 1),
                )
            )

    # === BY TIME SLOT ===
    time_result = await db.execute(
        select(
            func.extract("hour", BookingRequest.scheduled_date).label("hour"),
            func.count(BookingRequest.id).filter(
                BookingRequest.status.in_([
                    BookingRequestStatus.CONFIRMED,
                    BookingRequestStatus.COMPLETED,
                    BookingRequestStatus.NO_SHOW,
                ])
            ).label("total_appointments"),
            func.count(BookingRequest.id).filter(
                BookingRequest.status == BookingRequestStatus.NO_SHOW
            ).label("no_shows"),
        )
        .where(and_(*base_filter))
        .group_by(func.extract("hour", BookingRequest.scheduled_date))
        .order_by(func.extract("hour", BookingRequest.scheduled_date))
    )

    by_time_slot = []
    for row in time_result.all():
        if row.hour is not None:
            hour = int(row.hour)
            time_no_show_rate = (
                row.no_shows / row.total_appointments * 100
            ) if row.total_appointments > 0 else 0
            # Format time label (e.g., "9:00 AM - 10:00 AM")
            start_hour = hour
            end_hour = hour + 1
            start_period = "AM" if start_hour < 12 else "PM"
            end_period = "AM" if end_hour < 12 else "PM"
            start_display = start_hour if start_hour <= 12 else start_hour - 12
            end_display = end_hour if end_hour <= 12 else end_hour - 12
            if start_display == 0:
                start_display = 12
            if end_display == 0:
                end_display = 12
            time_label = f"{start_display}:00 {start_period} - {end_display}:00 {end_period}"

            by_time_slot.append(
                NoShowByTimeSlot(
                    hour=hour,
                    time_label=time_label,
                    total_appointments=row.total_appointments,
                    no_shows=row.no_shows,
                    no_show_rate=round(time_no_show_rate, 1),
                )
            )

    # === TRENDS (Weekly) ===
    trends = []
    current_start = start_date
    week_num = 1
    while current_start <= end_date:
        week_end = min(current_start + timedelta(days=6), end_date)
        week_start_dt = datetime.combine(current_start, datetime.min.time())
        week_end_dt = datetime.combine(week_end, datetime.max.time())

        week_filter = [
            BookingRequest.scheduled_date >= week_start_dt,
            BookingRequest.scheduled_date <= week_end_dt,
            BookingRequest.scheduled_date.isnot(None),
        ]
        if studio_id:
            week_filter.append(BookingRequest.studio_id == studio_id)

        week_total_result = await db.execute(
            select(func.count(BookingRequest.id)).where(
                and_(
                    *week_filter,
                    BookingRequest.status.in_([
                        BookingRequestStatus.CONFIRMED,
                        BookingRequestStatus.COMPLETED,
                        BookingRequestStatus.NO_SHOW,
                    ]),
                )
            )
        )
        week_total = week_total_result.scalar() or 0

        week_no_show_result = await db.execute(
            select(func.count(BookingRequest.id)).where(
                and_(
                    *week_filter,
                    BookingRequest.status == BookingRequestStatus.NO_SHOW,
                )
            )
        )
        week_no_shows = week_no_show_result.scalar() or 0

        week_forfeited_result = await db.execute(
            select(func.coalesce(func.sum(BookingRequest.deposit_amount), 0)).where(
                and_(
                    *week_filter,
                    BookingRequest.status == BookingRequestStatus.NO_SHOW,
                    BookingRequest.deposit_forfeited == True,
                )
            )
        )
        week_forfeited = week_forfeited_result.scalar() or 0

        week_rate = (week_no_shows / week_total * 100) if week_total > 0 else 0

        trends.append(
            NoShowTrend(
                period=f"Week {week_num}",
                period_start=current_start,
                total_appointments=week_total,
                no_shows=week_no_shows,
                no_show_rate=round(week_rate, 1),
                deposits_forfeited=week_forfeited,
            )
        )

        current_start = week_end + timedelta(days=1)
        week_num += 1

    # === REPEAT OFFENDERS ===
    # Get clients with multiple no-shows
    repeat_result = await db.execute(
        select(
            BookingRequest.client_email,
            BookingRequest.client_name,
            BookingRequest.client_phone,
            func.count(BookingRequest.id).label("total_bookings"),
            func.count(BookingRequest.id).filter(
                BookingRequest.status == BookingRequestStatus.NO_SHOW
            ).label("no_show_count"),
            func.max(BookingRequest.scheduled_date).filter(
                BookingRequest.status == BookingRequestStatus.NO_SHOW
            ).label("last_no_show"),
            func.coalesce(
                func.sum(BookingRequest.deposit_amount).filter(
                    and_(
                        BookingRequest.status == BookingRequestStatus.NO_SHOW,
                        BookingRequest.deposit_forfeited == True,
                    )
                ), 0
            ).label("deposits_forfeited"),
        )
        .where(
            and_(
                BookingRequest.studio_id == studio_id if studio_id else True,
            )
        )
        .group_by(
            BookingRequest.client_email,
            BookingRequest.client_name,
            BookingRequest.client_phone,
        )
        .having(
            func.count(BookingRequest.id).filter(
                BookingRequest.status == BookingRequestStatus.NO_SHOW
            ) >= 2
        )
        .order_by(
            func.count(BookingRequest.id).filter(
                BookingRequest.status == BookingRequestStatus.NO_SHOW
            ).desc()
        )
        .limit(20)
    )

    repeat_no_show_clients = []
    for row in repeat_result.all():
        client_no_show_rate = (
            row.no_show_count / row.total_bookings * 100
        ) if row.total_bookings > 0 else 0
        repeat_no_show_clients.append(
            NoShowClient(
                client_email=row.client_email,
                client_name=row.client_name,
                client_phone=row.client_phone,
                total_bookings=row.total_bookings,
                no_show_count=row.no_show_count,
                no_show_rate=round(client_no_show_rate, 1),
                last_no_show=row.last_no_show.date() if row.last_no_show else None,
                deposits_forfeited=row.deposits_forfeited,
                is_blocked=False,  # Would check against blocked list
            )
        )

    # === RISK METRICS ===
    # Unique clients with no-shows
    clients_with_no_shows_result = await db.execute(
        select(func.count(func.distinct(BookingRequest.client_email))).where(
            and_(
                BookingRequest.status == BookingRequestStatus.NO_SHOW,
                BookingRequest.studio_id == studio_id if studio_id else True,
            )
        )
    )
    clients_with_no_shows = clients_with_no_shows_result.scalar() or 0

    # Repeat offender count (2+ no-shows)
    repeat_offender_count = len(repeat_no_show_clients)

    # High risk upcoming appointments
    # Get clients with previous no-shows who have upcoming appointments
    now = datetime.utcnow()
    high_risk_result = await db.execute(
        select(func.count(BookingRequest.id)).where(
            and_(
                BookingRequest.scheduled_date > now,
                BookingRequest.status == BookingRequestStatus.CONFIRMED,
                BookingRequest.studio_id == studio_id if studio_id else True,
                BookingRequest.client_email.in_(
                    select(BookingRequest.client_email)
                    .where(BookingRequest.status == BookingRequestStatus.NO_SHOW)
                    .group_by(BookingRequest.client_email)
                    .having(func.count(BookingRequest.id) >= 1)
                ),
            )
        )
    )
    high_risk_upcoming = high_risk_result.scalar() or 0

    return NoShowReportResponse(
        period_start=start_date,
        period_end=end_date,
        total_appointments=total_appointments,
        total_no_shows=total_no_shows,
        no_show_rate=round(no_show_rate, 1),
        total_deposits_forfeited=total_deposits_forfeited,
        estimated_revenue_lost=estimated_revenue_lost,
        no_show_rate_change=round(no_show_rate_change, 1) if no_show_rate_change is not None else None,
        no_shows_change=no_shows_change,
        by_artist=by_artist,
        by_day_of_week=by_day_of_week,
        by_time_slot=by_time_slot,
        trends=trends,
        repeat_no_show_clients=repeat_no_show_clients,
        clients_with_no_shows=clients_with_no_shows,
        repeat_offender_count=repeat_offender_count,
        high_risk_upcoming=high_risk_upcoming,
    )
