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
