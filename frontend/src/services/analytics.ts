/**
 * Analytics API service for dashboard and reporting.
 */

import { api } from './api';

// Types for analytics
export type TimeRange = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface RevenueMetrics {
  total_revenue: number;
  total_deposits: number;
  total_tips: number;
  booking_count: number;
  average_booking_value: number;
  revenue_change_percent: number | null;
}

export interface BookingMetrics {
  total_requests: number;
  pending_requests: number;
  confirmed_bookings: number;
  completed_bookings: number;
  cancelled_bookings: number;
  no_shows: number;
  conversion_rate: number;
}

export interface OccupancyMetrics {
  total_available_hours: number;
  booked_hours: number;
  occupancy_rate: number;
  average_booking_duration: number;
}

export interface ArtistPerformanceSummary {
  artist_id: string;
  artist_name: string;
  completed_bookings: number;
  total_revenue: number;
  total_tips: number;
  average_rating: number | null;
  no_show_count: number;
}

export interface UpcomingAppointment {
  id: string;
  client_name: string;
  client_email: string;
  artist_name: string;
  scheduled_date: string;
  duration_hours: number;
  design_summary: string;
  status: string;
}

export type ActivityType =
  | 'booking_request'
  | 'booking_confirmed'
  | 'booking_completed'
  | 'payment_received'
  | 'consent_signed'
  | 'message_received'
  | 'no_show'
  | 'cancellation';

export interface RecentActivity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
  actor_name: string | null;
}

export interface DashboardStats {
  appointments_today: number;
  revenue_today: number;
  new_requests_today: number;
  unread_messages: number;
  appointments_this_week: number;
  revenue_this_week: number;
  pending_requests: number;
  pending_deposits: number;
  pending_consent_forms: number;
}

export interface DashboardResponse {
  stats: DashboardStats;
  revenue: RevenueMetrics;
  bookings: BookingMetrics;
  occupancy: OccupancyMetrics;
  upcoming_appointments: UpcomingAppointment[];
  recent_activity: RecentActivity[];
  top_artists: ArtistPerformanceSummary[];
}

export interface RevenueChartData {
  date: string;
  revenue: number;
  bookings: number;
  tips: number;
}

export interface RevenueChartResponse {
  data: RevenueChartData[];
  total_revenue: number;
  total_bookings: number;
  total_tips: number;
}

export interface BookingStatusBreakdown {
  status: string;
  count: number;
  percentage: number;
}

export interface BookingAnalyticsResponse {
  status_breakdown: BookingStatusBreakdown[];
  by_size: Record<string, number>;
  by_placement: Record<string, number>;
  by_artist: Record<string, number>;
  peak_hours: Record<number, number>;
  peak_days: Record<number, number>;
}

export interface NoShowMetrics {
  total_no_shows: number;
  no_show_rate: number;
  deposits_forfeited: number;
  repeat_no_show_clients: number;
}

export interface ClientRetentionMetrics {
  total_clients: number;
  returning_clients: number;
  retention_rate: number;
  average_bookings_per_client: number;
  clients_this_period: number;
  new_clients_this_period: number;
}

export interface PopularTimeSlot {
  day_of_week: number;
  hour: number;
  booking_count: number;
  percentage_of_total: number;
}

export interface TimeSlotAnalyticsResponse {
  popular_slots: PopularTimeSlot[];
  busiest_day: string;
  busiest_hour: number;
  quietest_day: string;
  quietest_hour: number;
}

// Artist Performance Types

export interface ArtistRevenueBreakdown {
  service_revenue: number;
  tips: number;
  commission_earned: number;
  average_per_booking: number;
}

export interface ArtistBookingStats {
  total_requests: number;
  completed: number;
  confirmed: number;
  cancelled: number;
  no_shows: number;
  completion_rate: number;
}

export interface ArtistSpecialtyStats {
  placement_breakdown: Record<string, number>;
  size_breakdown: Record<string, number>;
  top_placements: string[];
}

export interface ArtistTimeStats {
  total_hours_booked: number;
  average_duration: number;
  busiest_day: string;
  busiest_hour: number;
  utilization_rate: number;
}

export interface MonthlyPerformance {
  month: string;
  revenue: number;
  bookings: number;
  tips: number;
}

export interface ArtistDetailedPerformance {
  artist_id: string;
  artist_name: string;
  artist_email: string;
  profile_image: string | null;
  specialties: string[];
  bio: string | null;
  revenue: ArtistRevenueBreakdown;
  bookings: ArtistBookingStats;
  specialties_stats: ArtistSpecialtyStats;
  time_stats: ArtistTimeStats;
  monthly_performance: MonthlyPerformance[];
  total_clients: number;
  returning_clients: number;
  client_retention_rate: number;
}

export interface ArtistPerformanceListItem {
  artist_id: string;
  artist_name: string;
  profile_image: string | null;
  completed_bookings: number;
  total_revenue: number;
  total_tips: number;
  commission_earned: number;
  no_show_count: number;
  completion_rate: number;
  utilization_rate: number;
}

export interface ArtistPerformanceListResponse {
  artists: ArtistPerformanceListItem[];
  total_artists: number;
  period_label: string;
}

// API functions

/**
 * Get main dashboard data.
 */
export async function getDashboard(): Promise<DashboardResponse> {
  return api.get<DashboardResponse>('/api/v1/analytics/dashboard');
}

/**
 * Get revenue chart data.
 */
export async function getRevenueChart(
  rangeType: TimeRange = 'month',
  startDate?: string,
  endDate?: string
): Promise<RevenueChartResponse> {
  const params = new URLSearchParams({ range_type: rangeType });
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  return api.get<RevenueChartResponse>(`/analytics/revenue/chart?${params}`);
}

/**
 * Get booking breakdown analytics.
 */
export async function getBookingBreakdown(
  rangeType: TimeRange = 'month',
  startDate?: string,
  endDate?: string
): Promise<BookingAnalyticsResponse> {
  const params = new URLSearchParams({ range_type: rangeType });
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  return api.get<BookingAnalyticsResponse>(`/analytics/bookings/breakdown?${params}`);
}

/**
 * Get no-show metrics.
 */
export async function getNoShowMetrics(
  rangeType: TimeRange = 'month',
  startDate?: string,
  endDate?: string
): Promise<NoShowMetrics> {
  const params = new URLSearchParams({ range_type: rangeType });
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  return api.get<NoShowMetrics>(`/analytics/no-shows?${params}`);
}

/**
 * Get client retention metrics.
 */
export async function getClientRetention(
  rangeType: TimeRange = 'month',
  startDate?: string,
  endDate?: string
): Promise<ClientRetentionMetrics> {
  const params = new URLSearchParams({ range_type: rangeType });
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  return api.get<ClientRetentionMetrics>(`/analytics/retention?${params}`);
}

/**
 * Get time slot analytics.
 */
export async function getTimeSlotAnalytics(
  rangeType: TimeRange = 'month',
  startDate?: string,
  endDate?: string
): Promise<TimeSlotAnalyticsResponse> {
  const params = new URLSearchParams({ range_type: rangeType });
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  return api.get<TimeSlotAnalyticsResponse>(`/analytics/time-slots?${params}`);
}

/**
 * Get artist performance list.
 */
export async function getArtistPerformanceList(
  rangeType: TimeRange = 'month',
  startDate?: string,
  endDate?: string
): Promise<ArtistPerformanceListResponse> {
  const params = new URLSearchParams({ range_type: rangeType });
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  return api.get<ArtistPerformanceListResponse>(`/analytics/artists?${params}`);
}

/**
 * Get detailed performance for a specific artist.
 */
export async function getArtistDetailedPerformance(
  artistId: string,
  rangeType: TimeRange = 'month',
  startDate?: string,
  endDate?: string
): Promise<ArtistDetailedPerformance> {
  const params = new URLSearchParams({ range_type: rangeType });
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  return api.get<ArtistDetailedPerformance>(`/analytics/artists/${artistId}?${params}`);
}

// Helper functions

/**
 * Format cents to dollars string.
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/**
 * Format percentage.
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Get day name from day of week number.
 */
export function getDayName(dayOfWeek: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek] || 'Unknown';
}

/**
 * Format hour to 12-hour format.
 */
export function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

/**
 * Get activity icon based on type.
 */
export function getActivityIcon(type: ActivityType): string {
  switch (type) {
    case 'booking_request':
      return '📩';
    case 'booking_confirmed':
      return '✅';
    case 'booking_completed':
      return '🎨';
    case 'payment_received':
      return '💰';
    case 'consent_signed':
      return '📝';
    case 'message_received':
      return '💬';
    case 'no_show':
      return '❌';
    case 'cancellation':
      return '🚫';
    default:
      return '📋';
  }
}

/**
 * Get activity color based on type.
 */
export function getActivityColor(type: ActivityType): string {
  switch (type) {
    case 'booking_request':
      return 'text-blue-400';
    case 'booking_confirmed':
      return 'text-green-400';
    case 'booking_completed':
      return 'text-purple-400';
    case 'payment_received':
      return 'text-emerald-400';
    case 'consent_signed':
      return 'text-cyan-400';
    case 'message_received':
      return 'text-yellow-400';
    case 'no_show':
      return 'text-red-400';
    case 'cancellation':
      return 'text-orange-400';
    default:
      return 'text-ink-400';
  }
}

// ============ Revenue Report Types ============

export type ReportType = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface RevenueByCategory {
  category: string;
  revenue: number;
  count: number;
  percentage: number;
}

export interface RevenueByArtist {
  artist_id: string;
  artist_name: string;
  revenue: number;
  tips: number;
  bookings: number;
  percentage: number;
}

export interface RevenueByDay {
  date: string;
  day_name: string;
  revenue: number;
  tips: number;
  deposits: number;
  bookings: number;
  average_booking: number;
}

export interface RevenueByWeek {
  week_start: string;
  week_end: string;
  week_number: number;
  revenue: number;
  tips: number;
  deposits: number;
  bookings: number;
  average_booking: number;
  change_from_previous: number | null;
}

export interface RevenueByMonth {
  month: string;
  month_name: string;
  revenue: number;
  tips: number;
  deposits: number;
  bookings: number;
  average_booking: number;
  change_from_previous: number | null;
}

export interface RevenueSummary {
  total_revenue: number;
  total_tips: number;
  total_deposits: number;
  total_bookings: number;
  average_booking_value: number;
  highest_day: string | null;
  highest_day_revenue: number;
  lowest_day: string | null;
  lowest_day_revenue: number;
}

export interface DailyRevenueReport {
  report_type: 'daily';
  period_start: string;
  period_end: string;
  summary: RevenueSummary;
  daily_data: RevenueByDay[];
  by_artist: RevenueByArtist[];
  by_size: RevenueByCategory[];
  by_placement: RevenueByCategory[];
}

export interface WeeklyRevenueReport {
  report_type: 'weekly';
  period_start: string;
  period_end: string;
  summary: RevenueSummary;
  weekly_data: RevenueByWeek[];
  by_artist: RevenueByArtist[];
}

export interface MonthlyRevenueReport {
  report_type: 'monthly';
  period_start: string;
  period_end: string;
  summary: RevenueSummary;
  monthly_data: RevenueByMonth[];
  by_artist: RevenueByArtist[];
}

export interface CustomRevenueReport {
  report_type: 'custom';
  period_start: string;
  period_end: string;
  summary: RevenueSummary;
  daily_data: RevenueByDay[];
  by_artist: RevenueByArtist[];
  by_size: RevenueByCategory[];
  by_placement: RevenueByCategory[];
}

export type RevenueReport =
  | DailyRevenueReport
  | WeeklyRevenueReport
  | MonthlyRevenueReport
  | CustomRevenueReport;

// ============ Client Retention Report Types ============

export interface ClientSegment {
  segment: string;
  count: number;
  percentage: number;
  revenue: number;
}

export interface ClientLifetimeValue {
  average_lifetime_value: number;
  average_bookings: number;
  average_time_between_visits: number;
  highest_value_client_revenue: number;
}

export interface ClientAcquisitionByMonth {
  month: string;
  month_name: string;
  new_clients: number;
  returning_clients: number;
  total_bookings: number;
}

export interface ClientByArtist {
  artist_id: string;
  artist_name: string;
  total_clients: number;
  returning_clients: number;
  retention_rate: number;
  average_bookings_per_client: number;
}

export interface TopClient {
  client_email: string;
  client_name: string;
  total_bookings: number;
  total_spent: number;
  first_visit: string;
  last_visit: string;
  favorite_artist: string | null;
}

export interface ClientRetentionReport {
  period_start: string;
  period_end: string;
  total_clients: number;
  new_clients: number;
  returning_clients: number;
  loyal_clients: number;
  lapsed_clients: number;
  retention_rate: number;
  churn_rate: number;
  segments: ClientSegment[];
  lifetime_value: ClientLifetimeValue;
  acquisition_by_month: ClientAcquisitionByMonth[];
  by_artist: ClientByArtist[];
  top_clients: TopClient[];
  retention_rate_change: number | null;
  new_clients_change: number | null;
}

// ============ Revenue Report API Functions ============

/**
 * Get daily revenue report for a date range.
 */
export async function getDailyRevenueReport(
  startDate: string,
  endDate: string
): Promise<DailyRevenueReport> {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });
  return api.get<DailyRevenueReport>(`/api/v1/analytics/reports/daily?${params}`);
}

/**
 * Get weekly revenue report for a date range.
 */
export async function getWeeklyRevenueReport(
  startDate: string,
  endDate: string
): Promise<WeeklyRevenueReport> {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });
  return api.get<WeeklyRevenueReport>(`/api/v1/analytics/reports/weekly?${params}`);
}

/**
 * Get monthly revenue report for a date range.
 */
export async function getMonthlyRevenueReport(
  startDate: string,
  endDate: string
): Promise<MonthlyRevenueReport> {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });
  return api.get<MonthlyRevenueReport>(`/api/v1/analytics/reports/monthly?${params}`);
}

/**
 * Get custom revenue report for a date range.
 */
export async function getCustomRevenueReport(
  startDate: string,
  endDate: string
): Promise<CustomRevenueReport> {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });
  return api.get<CustomRevenueReport>(`/api/v1/analytics/reports/custom?${params}`);
}

/**
 * Get revenue report based on type.
 */
export async function getRevenueReport(
  reportType: ReportType,
  startDate: string,
  endDate: string
): Promise<RevenueReport> {
  switch (reportType) {
    case 'daily':
      return getDailyRevenueReport(startDate, endDate);
    case 'weekly':
      return getWeeklyRevenueReport(startDate, endDate);
    case 'monthly':
      return getMonthlyRevenueReport(startDate, endDate);
    case 'custom':
    default:
      return getCustomRevenueReport(startDate, endDate);
  }
}

/**
 * Format date range for display.
 */
export function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };
  return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
}

/**
 * Get preset date ranges.
 */
export function getPresetDateRanges(): {
  label: string;
  value: string;
  startDate: string;
  endDate: string;
}[] {
  const today = new Date();
  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  // This week (Monday to today)
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1);

  // This month
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Last month
  const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

  // This quarter
  const quarterMonth = Math.floor(today.getMonth() / 3) * 3;
  const startOfQuarter = new Date(today.getFullYear(), quarterMonth, 1);

  // This year
  const startOfYear = new Date(today.getFullYear(), 0, 1);

  // Last 7 days
  const last7Days = new Date(today);
  last7Days.setDate(today.getDate() - 6);

  // Last 30 days
  const last30Days = new Date(today);
  last30Days.setDate(today.getDate() - 29);

  // Last 90 days
  const last90Days = new Date(today);
  last90Days.setDate(today.getDate() - 89);

  return [
    {
      label: 'Last 7 Days',
      value: 'last7',
      startDate: formatDate(last7Days),
      endDate: formatDate(today),
    },
    {
      label: 'Last 30 Days',
      value: 'last30',
      startDate: formatDate(last30Days),
      endDate: formatDate(today),
    },
    {
      label: 'Last 90 Days',
      value: 'last90',
      startDate: formatDate(last90Days),
      endDate: formatDate(today),
    },
    {
      label: 'This Week',
      value: 'thisWeek',
      startDate: formatDate(startOfWeek),
      endDate: formatDate(today),
    },
    {
      label: 'This Month',
      value: 'thisMonth',
      startDate: formatDate(startOfMonth),
      endDate: formatDate(today),
    },
    {
      label: 'Last Month',
      value: 'lastMonth',
      startDate: formatDate(startOfLastMonth),
      endDate: formatDate(endOfLastMonth),
    },
    {
      label: 'This Quarter',
      value: 'thisQuarter',
      startDate: formatDate(startOfQuarter),
      endDate: formatDate(today),
    },
    {
      label: 'This Year',
      value: 'thisYear',
      startDate: formatDate(startOfYear),
      endDate: formatDate(today),
    },
  ];
}

// ============ Client Retention Report API Functions ============

/**
 * Get detailed client retention report for a date range.
 */
export async function getClientRetentionReport(
  startDate: string,
  endDate: string
): Promise<ClientRetentionReport> {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });
  return api.get<ClientRetentionReport>(`/api/v1/analytics/reports/retention?${params}`);
}

/**
 * Get segment color for visualization.
 */
export function getSegmentColor(segment: string): string {
  switch (segment.toLowerCase()) {
    case 'new':
      return 'bg-blue-500';
    case 'returning':
      return 'bg-green-500';
    case 'loyal':
      return 'bg-purple-500';
    case 'lapsed':
      return 'bg-red-500';
    default:
      return 'bg-ink-500';
  }
}

/**
 * Get segment text color for visualization.
 */
export function getSegmentTextColor(segment: string): string {
  switch (segment.toLowerCase()) {
    case 'new':
      return 'text-blue-400';
    case 'returning':
      return 'text-green-400';
    case 'loyal':
      return 'text-purple-400';
    case 'lapsed':
      return 'text-red-400';
    default:
      return 'text-ink-400';
  }
}

// ============ No-Show Report Types ============

export interface NoShowByArtist {
  artist_id: string;
  artist_name: string;
  total_appointments: number;
  no_shows: number;
  no_show_rate: number;
  deposits_forfeited: number;
  revenue_lost: number;
}

export interface NoShowByDayOfWeek {
  day_of_week: number;
  day_name: string;
  total_appointments: number;
  no_shows: number;
  no_show_rate: number;
}

export interface NoShowByTimeSlot {
  hour: number;
  time_label: string;
  total_appointments: number;
  no_shows: number;
  no_show_rate: number;
}

export interface NoShowClient {
  client_email: string;
  client_name: string;
  client_phone: string | null;
  total_bookings: number;
  no_show_count: number;
  no_show_rate: number;
  last_no_show: string | null;
  deposits_forfeited: number;
  is_blocked: boolean;
}

export interface NoShowTrend {
  period: string;
  period_start: string;
  total_appointments: number;
  no_shows: number;
  no_show_rate: number;
  deposits_forfeited: number;
}

export interface NoShowReport {
  period_start: string;
  period_end: string;
  total_appointments: number;
  total_no_shows: number;
  no_show_rate: number;
  total_deposits_forfeited: number;
  estimated_revenue_lost: number;
  no_show_rate_change: number | null;
  no_shows_change: number | null;
  by_artist: NoShowByArtist[];
  by_day_of_week: NoShowByDayOfWeek[];
  by_time_slot: NoShowByTimeSlot[];
  trends: NoShowTrend[];
  repeat_no_show_clients: NoShowClient[];
  clients_with_no_shows: number;
  repeat_offender_count: number;
  high_risk_upcoming: number;
}

// ============ No-Show Report API Functions ============

/**
 * Get comprehensive no-show report for a date range.
 */
export async function getNoShowReport(
  startDate: string,
  endDate: string
): Promise<NoShowReport> {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });
  return api.get<NoShowReport>(`/api/v1/analytics/reports/no-shows?${params}`);
}

/**
 * Get no-show rate severity level.
 */
export function getNoShowRateSeverity(rate: number): {
  level: 'low' | 'medium' | 'high' | 'critical';
  color: string;
  bgColor: string;
} {
  if (rate <= 5) {
    return { level: 'low', color: 'text-green-400', bgColor: 'bg-green-500/20' };
  } else if (rate <= 10) {
    return { level: 'medium', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' };
  } else if (rate <= 20) {
    return { level: 'high', color: 'text-orange-400', bgColor: 'bg-orange-500/20' };
  } else {
    return { level: 'critical', color: 'text-red-400', bgColor: 'bg-red-500/20' };
  }
}

/**
 * Get bar color for no-show rate visualization.
 */
export function getNoShowBarColor(rate: number): string {
  if (rate <= 5) return 'bg-green-500';
  if (rate <= 10) return 'bg-yellow-500';
  if (rate <= 20) return 'bg-orange-500';
  return 'bg-red-500';
}
