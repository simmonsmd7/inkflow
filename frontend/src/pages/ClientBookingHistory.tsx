/**
 * Client booking history page - displays all bookings for the logged-in client.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clientAuthService } from '../services/clientAuth';
import { clientPortalService } from '../services/clientPortal';
import type { ClientBookingSummary, ClientBookingStats } from '../types/api';

// Status badge colors
const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  reviewing: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  quoted: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  deposit_requested: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  deposit_paid: { bg: 'bg-green-500/20', text: 'text-green-400' },
  confirmed: { bg: 'bg-accent-primary/20', text: 'text-accent-primary' },
  completed: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  no_show: { bg: 'bg-red-500/20', text: 'text-red-400' },
  rejected: { bg: 'bg-red-500/20', text: 'text-red-400' },
  cancelled: { bg: 'bg-ink-500/20', text: 'text-ink-400' },
};

// Format status for display
function formatStatus(status: string): string {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Format price in cents to dollars
function formatPrice(cents: number | null): string {
  if (cents === null) return '-';
  return `$${(cents / 100).toFixed(2)}`;
}

// Format date
function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Format date with time
function formatDateTime(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ClientBookingHistory() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<ClientBookingSummary[]>([]);
  const [stats, setStats] = useState<ClientBookingStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const perPage = 10;

  useEffect(() => {
    if (!clientAuthService.isAuthenticated()) {
      navigate('/client/login');
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch bookings and stats in parallel
        const [bookingsResponse, statsResponse] = await Promise.all([
          clientPortalService.getBookings({
            page,
            per_page: perPage,
            status_filter: statusFilter || undefined,
          }),
          clientPortalService.getBookingStats(),
        ]);

        setBookings(bookingsResponse.bookings);
        setTotalPages(bookingsResponse.pages);
        setTotal(bookingsResponse.total);
        setStats(statsResponse);
      } catch (err) {
        setError('Failed to load booking history. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [navigate, page, statusFilter]);

  const handleFilterChange = (newFilter: string) => {
    setStatusFilter(newFilter);
    setPage(1); // Reset to first page when filter changes
  };

  return (
    <div className="min-h-screen bg-ink-900">
      {/* Header */}
      <header className="bg-ink-800 border-b border-ink-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/client" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-accent-primary to-accent-secondary rounded-xl flex items-center justify-center">
                <span className="text-lg font-bold text-white">IF</span>
              </div>
              <span className="text-xl font-bold text-ink-100">InkFlow</span>
            </Link>

            <div className="flex items-center gap-4">
              <Link
                to="/client"
                className="px-4 py-2 text-sm text-ink-300 hover:text-ink-100 transition-colors"
              >
                Back to Portal
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-ink-100">Booking History</h1>
          <p className="text-ink-400 mt-1">View all your past and current bookings</p>
        </div>

        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div className="bg-ink-800 rounded-xl border border-ink-700 p-4">
              <p className="text-sm text-ink-400">Total Bookings</p>
              <p className="text-2xl font-bold text-ink-100">{stats.total_bookings}</p>
            </div>
            <div className="bg-ink-800 rounded-xl border border-ink-700 p-4">
              <p className="text-sm text-ink-400">Completed</p>
              <p className="text-2xl font-bold text-emerald-400">{stats.completed}</p>
            </div>
            <div className="bg-ink-800 rounded-xl border border-ink-700 p-4">
              <p className="text-sm text-ink-400">Upcoming</p>
              <p className="text-2xl font-bold text-accent-primary">{stats.upcoming}</p>
            </div>
            <div className="bg-ink-800 rounded-xl border border-ink-700 p-4">
              <p className="text-sm text-ink-400">Total Spent</p>
              <p className="text-2xl font-bold text-ink-100">
                {formatPrice(stats.total_spent_cents)}
              </p>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex items-center gap-4 mb-6">
          <label className="text-sm text-ink-400">Filter by status:</label>
          <select
            value={statusFilter}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="bg-ink-800 border border-ink-600 text-ink-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="reviewing">Reviewing</option>
            <option value="quoted">Quoted</option>
            <option value="deposit_requested">Deposit Requested</option>
            <option value="deposit_paid">Deposit Paid</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          {statusFilter && (
            <button
              onClick={() => handleFilterChange('')}
              className="text-sm text-ink-400 hover:text-ink-200"
            >
              Clear filter
            </button>
          )}
        </div>

        {/* Loading state */}
        {isLoading ? (
          <div className="bg-ink-800 rounded-xl border border-ink-700 p-8">
            <div className="flex items-center justify-center gap-3">
              <svg
                className="animate-spin h-6 w-6 text-accent-primary"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-ink-300">Loading booking history...</span>
            </div>
          </div>
        ) : error ? (
          <div className="bg-ink-800 rounded-xl border border-red-500/30 p-8 text-center">
            <p className="text-red-400">{error}</p>
            <button
              onClick={() => setPage(1)}
              className="mt-4 px-4 py-2 text-sm text-accent-primary hover:underline"
            >
              Try again
            </button>
          </div>
        ) : bookings.length === 0 ? (
          <div className="bg-ink-800 rounded-xl border border-ink-700 p-8 text-center">
            <svg
              className="w-12 h-12 text-ink-500 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <h3 className="text-lg font-medium text-ink-200 mb-2">No bookings found</h3>
            <p className="text-ink-400">
              {statusFilter
                ? 'No bookings match the selected filter.'
                : "You haven't made any booking requests yet."}
            </p>
          </div>
        ) : (
          <>
            {/* Bookings list */}
            <div className="space-y-4">
              {bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="bg-ink-800 rounded-xl border border-ink-700 p-6 hover:border-ink-600 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    {/* Left side - booking info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                            statusColors[booking.status]?.bg || 'bg-ink-600'
                          } ${statusColors[booking.status]?.text || 'text-ink-300'}`}
                        >
                          {formatStatus(booking.status)}
                        </span>
                        <span className="text-sm text-ink-500">
                          {formatDate(booking.created_at)}
                        </span>
                      </div>

                      <h3 className="text-lg font-medium text-ink-100 mb-1">
                        {booking.design_idea}
                      </h3>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-400">
                        <span>
                          <span className="text-ink-500">Placement:</span> {booking.placement}
                        </span>
                        <span>
                          <span className="text-ink-500">Size:</span>{' '}
                          {booking.size.replace('_', ' ')}
                        </span>
                        {booking.artist && (
                          <span>
                            <span className="text-ink-500">Artist:</span> {booking.artist.name}
                          </span>
                        )}
                        {booking.studio && (
                          <span>
                            <span className="text-ink-500">Studio:</span> {booking.studio.name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right side - pricing and schedule */}
                    <div className="flex flex-col items-end gap-2 text-right">
                      {booking.quoted_price && (
                        <div>
                          <span className="text-sm text-ink-500">Quote: </span>
                          <span className="text-lg font-semibold text-ink-100">
                            {formatPrice(booking.quoted_price)}
                          </span>
                        </div>
                      )}

                      {booking.scheduled_date && (
                        <div className="text-sm">
                          <span className="text-ink-500">Scheduled: </span>
                          <span className="text-ink-200">
                            {formatDateTime(booking.scheduled_date)}
                          </span>
                          {booking.scheduled_duration_hours && (
                            <span className="text-ink-400">
                              {' '}
                              ({booking.scheduled_duration_hours}h)
                            </span>
                          )}
                        </div>
                      )}

                      {booking.deposit_amount && (
                        <div className="text-sm">
                          <span className="text-ink-500">Deposit: </span>
                          <span
                            className={
                              booking.deposit_paid_at ? 'text-emerald-400' : 'text-orange-400'
                            }
                          >
                            {formatPrice(booking.deposit_amount)}
                            {booking.deposit_paid_at ? ' (Paid)' : ' (Due)'}
                          </span>
                        </div>
                      )}

                      {/* Rebook button for completed bookings */}
                      {booking.status === 'completed' && (
                        <Link
                          to={`/client/rebook/${booking.id}`}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-accent-primary hover:text-accent-primary/80 bg-accent-primary/10 hover:bg-accent-primary/20 rounded-lg transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                          Rebook / Touch-Up
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-8">
                <p className="text-sm text-ink-400">
                  Showing {(page - 1) * perPage + 1} -{' '}
                  {Math.min(page * perPage, total)} of {total} bookings
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-2 text-sm rounded-lg border border-ink-600 text-ink-300 hover:bg-ink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        pageNum = i + 1;
                      } else if (page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = page - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`w-8 h-8 text-sm rounded-lg ${
                            page === pageNum
                              ? 'bg-accent-primary text-white'
                              : 'text-ink-300 hover:bg-ink-700'
                          } transition-colors`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-2 text-sm rounded-lg border border-ink-600 text-ink-300 hover:bg-ink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default ClientBookingHistory;
