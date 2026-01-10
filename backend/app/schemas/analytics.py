"""Pydantic schemas for analytics and dashboard."""

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


# Time period types for analytics
TimeRange = Literal["today", "week", "month", "quarter", "year", "custom"]


class DateRangeInput(BaseModel):
    """Input for custom date range."""

    start_date: date
    end_date: date


class RevenueMetrics(BaseModel):
    """Revenue metrics for a time period."""

    total_revenue: int = Field(description="Total revenue in cents")
    total_deposits: int = Field(description="Total deposits collected in cents")
    total_tips: int = Field(description="Total tips in cents")
    booking_count: int = Field(description="Number of completed bookings")
    average_booking_value: int = Field(description="Average booking value in cents")
    revenue_change_percent: Optional[float] = Field(
        None, description="Percent change from previous period"
    )


class BookingMetrics(BaseModel):
    """Booking metrics for a time period."""

    total_requests: int = Field(description="Total booking requests received")
    pending_requests: int = Field(description="Requests awaiting review")
    confirmed_bookings: int = Field(description="Confirmed upcoming bookings")
    completed_bookings: int = Field(description="Completed bookings")
    cancelled_bookings: int = Field(description="Cancelled bookings")
    no_shows: int = Field(description="No-show count")
    conversion_rate: float = Field(description="Request to confirmed conversion rate")


class OccupancyMetrics(BaseModel):
    """Studio occupancy and utilization metrics."""

    total_available_hours: float = Field(description="Total available artist hours")
    booked_hours: float = Field(description="Hours booked")
    occupancy_rate: float = Field(description="Percentage of available hours booked")
    average_booking_duration: float = Field(description="Average booking duration in hours")


class ArtistPerformanceSummary(BaseModel):
    """Summary of an artist's performance."""

    artist_id: str
    artist_name: str
    completed_bookings: int
    total_revenue: int
    total_tips: int
    average_rating: Optional[float] = None
    no_show_count: int = 0


class UpcomingAppointment(BaseModel):
    """Upcoming appointment for dashboard."""

    id: str
    client_name: str
    client_email: str
    artist_name: str
    scheduled_date: datetime
    duration_hours: float
    design_summary: str
    status: str


class RecentActivity(BaseModel):
    """Recent activity item for dashboard."""

    id: str
    type: Literal[
        "booking_request", "booking_confirmed", "booking_completed",
        "payment_received", "consent_signed", "message_received",
        "no_show", "cancellation"
    ]
    title: str
    description: str
    timestamp: datetime
    actor_name: Optional[str] = None


class DashboardStats(BaseModel):
    """Main dashboard statistics card data."""

    # Today's numbers
    appointments_today: int
    revenue_today: int
    new_requests_today: int
    unread_messages: int

    # This week
    appointments_this_week: int
    revenue_this_week: int

    # Pending items
    pending_requests: int
    pending_deposits: int
    pending_consent_forms: int


class DashboardResponse(BaseModel):
    """Full dashboard response with all metrics."""

    stats: DashboardStats
    revenue: RevenueMetrics
    bookings: BookingMetrics
    occupancy: OccupancyMetrics
    upcoming_appointments: list[UpcomingAppointment]
    recent_activity: list[RecentActivity]
    top_artists: list[ArtistPerformanceSummary]


class RevenueChartData(BaseModel):
    """Revenue data point for charts."""

    date: date
    revenue: int
    bookings: int
    tips: int


class RevenueChartResponse(BaseModel):
    """Revenue chart data over time."""

    data: list[RevenueChartData]
    total_revenue: int
    total_bookings: int
    total_tips: int


class BookingStatusBreakdown(BaseModel):
    """Breakdown of bookings by status."""

    status: str
    count: int
    percentage: float


class BookingAnalyticsResponse(BaseModel):
    """Detailed booking analytics."""

    status_breakdown: list[BookingStatusBreakdown]
    by_size: dict[str, int]
    by_placement: dict[str, int]
    by_artist: dict[str, int]
    peak_hours: dict[int, int]  # Hour -> booking count
    peak_days: dict[int, int]  # Day of week -> booking count


class NoShowMetrics(BaseModel):
    """No-show tracking metrics."""

    total_no_shows: int
    no_show_rate: float
    deposits_forfeited: int
    repeat_no_show_clients: int


class ClientRetentionMetrics(BaseModel):
    """Client retention metrics."""

    total_clients: int
    returning_clients: int
    retention_rate: float
    average_bookings_per_client: float
    clients_this_period: int
    new_clients_this_period: int


class PopularTimeSlot(BaseModel):
    """Popular time slot data."""

    day_of_week: int  # 0=Monday, 6=Sunday
    hour: int  # 0-23
    booking_count: int
    percentage_of_total: float


class TimeSlotAnalyticsResponse(BaseModel):
    """Time slot analysis response."""

    popular_slots: list[PopularTimeSlot]
    busiest_day: str
    busiest_hour: int
    quietest_day: str
    quietest_hour: int


# ========== Artist Performance Schemas ==========


class ArtistRevenueBreakdown(BaseModel):
    """Revenue breakdown for an artist."""

    service_revenue: int = Field(description="Total service revenue in cents")
    tips: int = Field(description="Total tips received in cents")
    commission_earned: int = Field(description="Commission earned in cents")
    average_per_booking: int = Field(description="Average revenue per booking in cents")


class ArtistBookingStats(BaseModel):
    """Booking statistics for an artist."""

    total_requests: int = Field(description="Total booking requests assigned")
    completed: int = Field(description="Completed bookings")
    confirmed: int = Field(description="Confirmed upcoming bookings")
    cancelled: int = Field(description="Cancelled bookings")
    no_shows: int = Field(description="No-show count")
    completion_rate: float = Field(description="Completion rate percentage")


class ArtistSpecialtyStats(BaseModel):
    """Statistics for an artist's specialties."""

    placement_breakdown: dict[str, int] = Field(description="Bookings by body placement")
    size_breakdown: dict[str, int] = Field(description="Bookings by tattoo size")
    top_placements: list[str] = Field(description="Top 3 most popular placements")


class ArtistTimeStats(BaseModel):
    """Time-based statistics for an artist."""

    total_hours_booked: float = Field(description="Total hours of bookings")
    average_duration: float = Field(description="Average booking duration in hours")
    busiest_day: str = Field(description="Day with most bookings")
    busiest_hour: int = Field(description="Hour with most bookings")
    utilization_rate: float = Field(description="Percentage of available time booked")


class MonthlyPerformance(BaseModel):
    """Monthly performance data point."""

    month: str = Field(description="Month in YYYY-MM format")
    revenue: int = Field(description="Revenue in cents")
    bookings: int = Field(description="Number of bookings")
    tips: int = Field(description="Tips in cents")


class ArtistDetailedPerformance(BaseModel):
    """Detailed performance metrics for a single artist."""

    artist_id: str
    artist_name: str
    artist_email: str
    profile_image: Optional[str] = None
    specialties: list[str] = []
    bio: Optional[str] = None

    # Summary metrics
    revenue: ArtistRevenueBreakdown
    bookings: ArtistBookingStats
    specialties_stats: ArtistSpecialtyStats
    time_stats: ArtistTimeStats

    # Trend data
    monthly_performance: list[MonthlyPerformance] = []

    # Client metrics
    total_clients: int = Field(description="Total unique clients served")
    returning_clients: int = Field(description="Clients with repeat bookings")
    client_retention_rate: float = Field(description="Percentage of returning clients")


class ArtistPerformanceListItem(BaseModel):
    """Artist performance item for list view."""

    artist_id: str
    artist_name: str
    profile_image: Optional[str] = None
    completed_bookings: int
    total_revenue: int
    total_tips: int
    commission_earned: int
    no_show_count: int
    completion_rate: float
    utilization_rate: float


class ArtistPerformanceListResponse(BaseModel):
    """Response for artist performance list."""

    artists: list[ArtistPerformanceListItem]
    total_artists: int
    period_label: str


# ========== Revenue Report Schemas ==========


class RevenueByCategory(BaseModel):
    """Revenue breakdown by category."""

    category: str
    revenue: int = Field(description="Revenue in cents")
    count: int = Field(description="Number of bookings")
    percentage: float = Field(description="Percentage of total revenue")


class RevenueByArtist(BaseModel):
    """Revenue breakdown by artist."""

    artist_id: str
    artist_name: str
    revenue: int = Field(description="Revenue in cents")
    tips: int = Field(description="Tips in cents")
    bookings: int
    percentage: float = Field(description="Percentage of total revenue")


class RevenueByDay(BaseModel):
    """Revenue for a specific day."""

    date: date
    day_name: str
    revenue: int = Field(description="Revenue in cents")
    tips: int = Field(description="Tips in cents")
    deposits: int = Field(description="Deposits collected in cents")
    bookings: int
    average_booking: int = Field(description="Average booking value in cents")


class RevenueByWeek(BaseModel):
    """Revenue for a specific week."""

    week_start: date
    week_end: date
    week_number: int
    revenue: int = Field(description="Revenue in cents")
    tips: int = Field(description="Tips in cents")
    deposits: int = Field(description="Deposits collected in cents")
    bookings: int
    average_booking: int = Field(description="Average booking value in cents")
    change_from_previous: Optional[float] = Field(
        None, description="Percentage change from previous week"
    )


class RevenueByMonth(BaseModel):
    """Revenue for a specific month."""

    month: str = Field(description="Month in YYYY-MM format")
    month_name: str = Field(description="Month name (e.g., January 2026)")
    revenue: int = Field(description="Revenue in cents")
    tips: int = Field(description="Tips in cents")
    deposits: int = Field(description="Deposits collected in cents")
    bookings: int
    average_booking: int = Field(description="Average booking value in cents")
    change_from_previous: Optional[float] = Field(
        None, description="Percentage change from previous month"
    )


class RevenueSummary(BaseModel):
    """Summary of revenue metrics."""

    total_revenue: int = Field(description="Total revenue in cents")
    total_tips: int = Field(description="Total tips in cents")
    total_deposits: int = Field(description="Total deposits collected in cents")
    total_bookings: int
    average_booking_value: int = Field(description="Average booking value in cents")
    highest_day: Optional[date] = None
    highest_day_revenue: int = 0
    lowest_day: Optional[date] = None
    lowest_day_revenue: int = 0


class DailyRevenueReportResponse(BaseModel):
    """Daily revenue report response."""

    report_type: str = "daily"
    period_start: date
    period_end: date
    summary: RevenueSummary
    daily_data: list[RevenueByDay]
    by_artist: list[RevenueByArtist]
    by_size: list[RevenueByCategory]
    by_placement: list[RevenueByCategory]


class WeeklyRevenueReportResponse(BaseModel):
    """Weekly revenue report response."""

    report_type: str = "weekly"
    period_start: date
    period_end: date
    summary: RevenueSummary
    weekly_data: list[RevenueByWeek]
    by_artist: list[RevenueByArtist]


class MonthlyRevenueReportResponse(BaseModel):
    """Monthly revenue report response."""

    report_type: str = "monthly"
    period_start: date
    period_end: date
    summary: RevenueSummary
    monthly_data: list[RevenueByMonth]
    by_artist: list[RevenueByArtist]


class CustomRevenueReportResponse(BaseModel):
    """Custom date range revenue report response."""

    report_type: str = "custom"
    period_start: date
    period_end: date
    summary: RevenueSummary
    daily_data: list[RevenueByDay]
    by_artist: list[RevenueByArtist]
    by_size: list[RevenueByCategory]
    by_placement: list[RevenueByCategory]


# ========== Client Retention Report Schemas ==========


class ClientSegment(BaseModel):
    """Client segment breakdown."""

    segment: str = Field(description="Segment name (new, returning, loyal, lapsed)")
    count: int = Field(description="Number of clients in segment")
    percentage: float = Field(description="Percentage of total clients")
    revenue: int = Field(description="Revenue from this segment in cents")


class ClientLifetimeValue(BaseModel):
    """Client lifetime value metrics."""

    average_lifetime_value: int = Field(description="Average lifetime value in cents")
    average_bookings: float = Field(description="Average bookings per client")
    average_time_between_visits: float = Field(description="Average days between visits")
    highest_value_client_revenue: int = Field(description="Revenue from highest value client")


class ClientAcquisitionByMonth(BaseModel):
    """Monthly client acquisition data."""

    month: str = Field(description="Month in YYYY-MM format")
    month_name: str = Field(description="Month name (e.g., January 2026)")
    new_clients: int = Field(description="Number of new clients acquired")
    returning_clients: int = Field(description="Number of returning clients")
    total_bookings: int = Field(description="Total bookings from these clients")


class ClientByArtist(BaseModel):
    """Client breakdown by artist."""

    artist_id: str
    artist_name: str
    total_clients: int
    returning_clients: int
    retention_rate: float
    average_bookings_per_client: float


class TopClient(BaseModel):
    """Top client data."""

    client_email: str
    client_name: str
    total_bookings: int
    total_spent: int = Field(description="Total spent in cents")
    first_visit: date
    last_visit: date
    favorite_artist: Optional[str] = None


class ClientRetentionReportResponse(BaseModel):
    """Detailed client retention report response."""

    period_start: date
    period_end: date

    # Summary metrics
    total_clients: int
    new_clients: int
    returning_clients: int
    loyal_clients: int = Field(description="Clients with 3+ bookings")
    lapsed_clients: int = Field(description="Clients with no booking in 90+ days")
    retention_rate: float
    churn_rate: float

    # Segmentation
    segments: list[ClientSegment]

    # Lifetime value
    lifetime_value: ClientLifetimeValue

    # Trends
    acquisition_by_month: list[ClientAcquisitionByMonth]

    # By artist breakdown
    by_artist: list[ClientByArtist]

    # Top clients
    top_clients: list[TopClient]

    # Comparison to previous period
    retention_rate_change: Optional[float] = None
    new_clients_change: Optional[float] = None
