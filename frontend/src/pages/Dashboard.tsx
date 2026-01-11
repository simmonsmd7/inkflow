/**
 * Dashboard page - main overview for logged-in users.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getStudios } from '../services/studios';
import type { DashboardResponse } from '../services/analytics';
import type { Studio } from '../types/api';
import {
  getDashboard,
  formatCurrency,
  formatPercent,
  getActivityIcon,
  getActivityColor,
} from '../services/analytics';

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  trend?: { value: string; positive: boolean };
  loading?: boolean;
  to?: string;
}

function StatCard({ title, value, subtitle, icon, trend, loading, to }: StatCardProps) {
  const cardContent = (
    <div className={`bg-ink-800 rounded-xl border border-ink-700 p-5 ${to ? 'hover:border-accent-primary/50 transition-colors cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="p-2 bg-ink-700 rounded-lg text-accent-primary">{icon}</div>
        {trend && (
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${
              trend.positive
                ? 'bg-green-500/10 text-green-400'
                : 'bg-red-500/10 text-red-400'
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>
      <div className="mt-4">
        {loading ? (
          <div className="animate-pulse">
            <div className="h-8 bg-ink-700 rounded w-20 mb-2"></div>
            <div className="h-4 bg-ink-700 rounded w-32"></div>
          </div>
        ) : (
          <>
            <p className="text-2xl font-bold text-ink-100">{value}</p>
            <p className="text-sm text-ink-400 mt-1">{title}</p>
            <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>
          </>
        )}
      </div>
    </div>
  );

  if (to) {
    return <Link to={to}>{cardContent}</Link>;
  }
  return cardContent;
}

interface AppointmentRowProps {
  time: string;
  client: string;
  type: string;
  artist: string;
  status: string;
}

function AppointmentRow({ time, client, type, artist, status }: AppointmentRowProps) {
  const statusStyles: Record<string, string> = {
    confirmed: 'bg-green-500/10 text-green-400',
    pending: 'bg-yellow-500/10 text-yellow-400',
    deposit_paid: 'bg-blue-500/10 text-blue-400',
    cancelled: 'bg-red-500/10 text-red-400',
    completed: 'bg-purple-500/10 text-purple-400',
  };

  return (
    <div className="flex items-center gap-4 p-3 bg-ink-700/50 rounded-lg hover:bg-ink-700 transition-colors">
      <div className="text-sm font-medium text-ink-300 w-20">{time}</div>
      <div className="flex-1">
        <p className="text-sm font-medium text-ink-100">{client}</p>
        <p className="text-xs text-ink-400 truncate">{type}</p>
      </div>
      <div className="text-sm text-ink-400">{artist}</div>
      <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${statusStyles[status] || 'bg-ink-600 text-ink-300'}`}>
        {status.replace('_', ' ')}
      </span>
    </div>
  );
}

function MetricCard({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <div className="bg-ink-700/50 rounded-lg p-4">
      <p className="text-xs text-ink-400 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-ink-100 mt-1">{value}</p>
      {subtext && <p className="text-xs text-ink-500 mt-1">{subtext}</p>}
    </div>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studio, setStudio] = useState<Studio | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  async function fetchDashboard(isPolling = false) {
    try {
      if (!isPolling) setLoading(true);
      const response = await getDashboard();
      setData(response);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch dashboard:', err);
      if (!isPolling) setError('Failed to load dashboard data');
    } finally {
      if (!isPolling) setLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboard();
    // Fetch studio info for booking link (owners only)
    if (user?.role === 'owner') {
      getStudios().then((response) => {
        if (response.studios.length > 0) {
          setStudio(response.studios[0]);
        }
      }).catch(console.error);
    }
  }, [user?.role]);

  // Auto-refresh polling for real-time dashboard updates (every 60 seconds)
  useEffect(() => {
    const pollInterval = setInterval(() => {
      fetchDashboard(true);
    }, 60000); // 60 seconds

    return () => clearInterval(pollInterval);
  }, []);

  // Format date for display
  const formatAppointmentTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatActivityTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  // Get the booking link URL
  const bookingUrl = studio?.slug
    ? `${window.location.origin}/book/${studio.slug}`
    : null;

  // Copy booking link to clipboard
  const copyBookingLink = async () => {
    if (!bookingUrl) return;
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Dashboard</h1>
          <p className="text-ink-400 mt-1">Welcome back! Here's what's happening at your studio.</p>
        </div>
        <div className="text-sm text-ink-400">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      </div>

      {/* Booking Link Sharing (Owner Only) */}
      {user?.role === 'owner' && bookingUrl && (
        <div className="bg-gradient-to-r from-accent-primary/10 to-accent-primary/5 rounded-xl border border-accent-primary/20 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent-primary/20 rounded-lg">
                <svg className="w-5 h-5 text-accent-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink-100">Your Booking Link</h3>
                <p className="text-xs text-ink-400">Share this link with clients to accept booking requests</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 sm:flex-none bg-ink-800 rounded-lg px-3 py-2 border border-ink-700">
                <span className="text-sm text-ink-300 font-mono truncate block max-w-xs">
                  {bookingUrl}
                </span>
              </div>
              <button
                onClick={copyBookingLink}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
                  linkCopied
                    ? 'bg-green-600 text-white'
                    : 'bg-accent-primary hover:bg-accent-primary/90 text-white'
                }`}
              >
                {linkCopied ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy Link
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Bookings"
          value={data?.stats.appointments_today.toString() || '0'}
          subtitle={`${data?.stats.pending_requests || 0} pending requests`}
          loading={loading}
          to="/bookings"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatCard
          title="Unread Messages"
          value={data?.stats.unread_messages.toString() || '0'}
          subtitle="Messages awaiting response"
          loading={loading}
          to="/inbox"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          }
        />
        <StatCard
          title="This Week's Revenue"
          value={data ? formatCurrency(data.stats.revenue_this_week) : '$0'}
          subtitle={`${data?.stats.appointments_this_week || 0} appointments`}
          loading={loading}
          to="/analytics/revenue"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          title="Pending Items"
          value={(data?.stats.pending_deposits || 0) + (data?.stats.pending_consent_forms || 0) + ''}
          subtitle={`${data?.stats.pending_deposits || 0} deposits, ${data?.stats.pending_consent_forms || 0} consent`}
          loading={loading}
          to="/bookings"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
      </div>

      {/* Month Metrics */}
      {data && (
        <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
          <h2 className="text-lg font-semibold text-ink-100 mb-4">This Month</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <MetricCard
              label="Total Revenue"
              value={formatCurrency(data.revenue.total_revenue)}
              subtext={`${data.revenue.booking_count} bookings`}
            />
            <MetricCard
              label="Avg. Booking"
              value={formatCurrency(data.revenue.average_booking_value)}
            />
            <MetricCard
              label="Total Tips"
              value={formatCurrency(data.revenue.total_tips)}
            />
            <MetricCard
              label="Conversion Rate"
              value={formatPercent(data.bookings.conversion_rate)}
              subtext="Requests to confirmed"
            />
            <MetricCard
              label="Occupancy"
              value={formatPercent(data.occupancy.occupancy_rate)}
              subtext={`${data.occupancy.booked_hours.toFixed(1)}h booked`}
            />
            <MetricCard
              label="No-Shows"
              value={data.bookings.no_shows.toString()}
              subtext={`${data.bookings.cancelled_bookings} cancelled`}
            />
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Appointments */}
        <div className="lg:col-span-2 bg-ink-800 rounded-xl border border-ink-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-ink-100">Upcoming Appointments</h2>
            <Link to="/bookings" className="text-sm text-accent-primary hover:text-accent-primary/80 transition-colors">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse flex items-center gap-4 p-3 bg-ink-700/50 rounded-lg">
                  <div className="h-4 bg-ink-600 rounded w-20"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-ink-600 rounded w-32 mb-1"></div>
                    <div className="h-3 bg-ink-600 rounded w-24"></div>
                  </div>
                  <div className="h-4 bg-ink-600 rounded w-20"></div>
                </div>
              ))
            ) : data?.upcoming_appointments.length === 0 ? (
              <div className="text-center py-8 text-ink-400">
                <svg className="w-12 h-12 mx-auto mb-3 text-ink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p>No upcoming appointments</p>
                <Link to="/bookings" className="text-accent-primary hover:underline text-sm mt-2 inline-block">
                  View pending requests
                </Link>
              </div>
            ) : (
              data?.upcoming_appointments.map((appt) => (
                <AppointmentRow
                  key={appt.id}
                  time={formatAppointmentTime(appt.scheduled_date)}
                  client={appt.client_name}
                  type={appt.design_summary || `${appt.duration_hours}hr session`}
                  artist={appt.artist_name}
                  status={appt.status}
                />
              ))
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-ink-100">Recent Activity</h2>
          </div>
          <div className="space-y-4">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse flex items-start gap-3">
                  <div className="w-8 h-8 bg-ink-700 rounded-lg"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-ink-700 rounded w-full mb-1"></div>
                    <div className="h-3 bg-ink-700 rounded w-16"></div>
                  </div>
                </div>
              ))
            ) : data?.recent_activity.length === 0 ? (
              <div className="text-center py-8 text-ink-400">
                <p>No recent activity</p>
              </div>
            ) : (
              data?.recent_activity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className={`text-xl ${getActivityColor(activity.type)}`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-200">{activity.title}</p>
                    <p className="text-xs text-ink-400 truncate">{activity.description}</p>
                    <p className="text-xs text-ink-500 mt-0.5">{formatActivityTime(activity.timestamp)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Top Artists */}
      {data && data.top_artists.length > 0 && (
        <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-ink-100">Top Artists This Month</h2>
            <Link to="/commissions" className="text-sm text-accent-primary hover:text-accent-primary/80 transition-colors">
              View Commissions
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-ink-400 uppercase tracking-wider">
                  <th className="pb-3 font-medium">Artist</th>
                  <th className="pb-3 font-medium text-right">Bookings</th>
                  <th className="pb-3 font-medium text-right">Revenue</th>
                  <th className="pb-3 font-medium text-right">Tips</th>
                  <th className="pb-3 font-medium text-right">No-Shows</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {data.top_artists.map((artist, index) => (
                  <tr key={artist.artist_id} className="text-sm">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent-primary/20 flex items-center justify-center text-accent-primary font-medium">
                          {index + 1}
                        </div>
                        <span className="text-ink-100 font-medium">{artist.artist_name}</span>
                      </div>
                    </td>
                    <td className="py-3 text-right text-ink-300">{artist.completed_bookings}</td>
                    <td className="py-3 text-right text-ink-100 font-medium">{formatCurrency(artist.total_revenue)}</td>
                    <td className="py-3 text-right text-green-400">{formatCurrency(artist.total_tips)}</td>
                    <td className="py-3 text-right">
                      {artist.no_show_count > 0 ? (
                        <span className="text-amber-400">{artist.no_show_count}</span>
                      ) : (
                        <span className="text-ink-500">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          to="/bookings"
          className="bg-ink-800 rounded-xl border border-ink-700 p-4 hover:border-accent-primary/50 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-ink-700 rounded-lg text-accent-primary group-hover:bg-accent-primary/20 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-ink-200 font-medium">Bookings</span>
          </div>
        </Link>
        <Link
          to="/inbox"
          className="bg-ink-800 rounded-xl border border-ink-700 p-4 hover:border-accent-primary/50 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-ink-700 rounded-lg text-accent-primary group-hover:bg-accent-primary/20 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <span className="text-ink-200 font-medium">Inbox</span>
          </div>
        </Link>
        <Link
          to="/consent"
          className="bg-ink-800 rounded-xl border border-ink-700 p-4 hover:border-accent-primary/50 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-ink-700 rounded-lg text-accent-primary group-hover:bg-accent-primary/20 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-ink-200 font-medium">Consent Forms</span>
          </div>
        </Link>
        <Link
          to="/commissions"
          className="bg-ink-800 rounded-xl border border-ink-700 p-4 hover:border-accent-primary/50 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-ink-700 rounded-lg text-accent-primary group-hover:bg-accent-primary/20 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-ink-200 font-medium">Commissions</span>
          </div>
        </Link>
      </div>
    </div>
  );
}

export default Dashboard;
