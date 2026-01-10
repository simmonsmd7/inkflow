/**
 * Client portal - Upcoming appointments page.
 * Shows upcoming scheduled appointments with countdown and details.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clientAuthService } from '../services/clientAuth';
import { clientPortalService } from '../services/clientPortal';
import type { ClientBookingSummary } from '../types/api';

// Status badges for upcoming appointments
const statusBadgeStyles: Record<string, string> = {
  confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
  deposit_paid: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const statusLabels: Record<string, string> = {
  confirmed: 'Confirmed',
  deposit_paid: 'Deposit Paid',
};

function formatDate(dateString: string | null): string {
  if (!dateString) return 'Not scheduled';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getCountdown(dateString: string | null): { days: number; hours: number; isToday: boolean; isPast: boolean } | null {
  if (!dateString) return null;

  const now = new Date();
  const appointmentDate = new Date(dateString);
  const diffMs = appointmentDate.getTime() - now.getTime();

  if (diffMs < 0) {
    return { days: 0, hours: 0, isToday: false, isPast: true };
  }

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  // Check if it's today
  const isToday = appointmentDate.toDateString() === now.toDateString();

  return { days: diffDays, hours: diffHours, isToday, isPast: false };
}

function CountdownDisplay({ scheduled_date }: { scheduled_date: string | null }) {
  const countdown = getCountdown(scheduled_date);

  if (!countdown || countdown.isPast) {
    return (
      <div className="text-ink-500 text-sm">
        Time has passed
      </div>
    );
  }

  if (countdown.isToday) {
    return (
      <div className="bg-accent-primary/20 text-accent-primary px-3 py-2 rounded-lg text-center">
        <div className="text-lg font-bold">TODAY</div>
        <div className="text-sm">in {countdown.hours}h</div>
      </div>
    );
  }

  if (countdown.days === 0) {
    return (
      <div className="bg-yellow-500/20 text-yellow-400 px-3 py-2 rounded-lg text-center">
        <div className="text-lg font-bold">{countdown.hours}h</div>
        <div className="text-sm">remaining</div>
      </div>
    );
  }

  return (
    <div className="bg-ink-700 px-3 py-2 rounded-lg text-center">
      <div className="text-lg font-bold text-ink-100">{countdown.days}d {countdown.hours}h</div>
      <div className="text-sm text-ink-400">until appointment</div>
    </div>
  );
}

function AppointmentCard({ booking }: { booking: ClientBookingSummary }) {
  const statusStyle = statusBadgeStyles[booking.status] || 'bg-ink-700 text-ink-300 border-ink-600';
  const statusLabel = statusLabels[booking.status] || booking.status;

  return (
    <div className="bg-ink-800 rounded-xl border border-ink-700 overflow-hidden">
      {/* Header with date and countdown */}
      <div className="bg-ink-750 border-b border-ink-700 px-6 py-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xl font-semibold text-ink-100">
              {formatDate(booking.scheduled_date)}
            </div>
            <div className="text-accent-primary font-medium">
              {formatTime(booking.scheduled_date)}
              {booking.scheduled_duration_hours && (
                <span className="text-ink-400 ml-2">
                  ({booking.scheduled_duration_hours}h session)
                </span>
              )}
            </div>
          </div>
          <CountdownDisplay scheduled_date={booking.scheduled_date} />
        </div>
      </div>

      {/* Body */}
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span
                className={`px-3 py-1 text-xs font-medium rounded-full border ${statusStyle}`}
              >
                {statusLabel}
              </span>
              <span className="text-ink-400 text-sm capitalize">
                {booking.size.replace('_', ' ')}
              </span>
            </div>
            <p className="text-ink-200 line-clamp-2">{booking.design_idea}</p>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <span className="text-ink-500">Placement</span>
            <p className="text-ink-200">{booking.placement}</p>
          </div>
          {booking.artist && (
            <div>
              <span className="text-ink-500">Artist</span>
              <p className="text-ink-200">{booking.artist.name}</p>
            </div>
          )}
          {booking.studio && (
            <div>
              <span className="text-ink-500">Studio</span>
              <p className="text-ink-200">{booking.studio.name}</p>
            </div>
          )}
          {booking.quoted_price !== null && (
            <div>
              <span className="text-ink-500">Total</span>
              <p className="text-ink-200">
                ${(booking.quoted_price / 100).toFixed(2)}
              </p>
            </div>
          )}
        </div>

        {/* Deposit info */}
        {booking.deposit_paid_at && booking.deposit_amount && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 mb-4">
            <div className="flex items-center gap-2 text-green-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium">
                Deposit paid: ${(booking.deposit_amount / 100).toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Action */}
        <Link
          to={`/client/bookings?id=${booking.id}`}
          className="text-accent-primary text-sm font-medium hover:underline inline-flex items-center gap-1"
        >
          View details
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <div key={i} className="bg-ink-800 rounded-xl border border-ink-700 overflow-hidden animate-pulse">
          <div className="bg-ink-750 border-b border-ink-700 px-6 py-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="h-6 bg-ink-700 rounded w-48" />
                <div className="h-4 bg-ink-700 rounded w-32" />
              </div>
              <div className="h-16 w-20 bg-ink-700 rounded" />
            </div>
          </div>
          <div className="p-6">
            <div className="h-5 bg-ink-700 rounded w-24 mb-3" />
            <div className="h-4 bg-ink-700 rounded w-full mb-2" />
            <div className="h-4 bg-ink-700 rounded w-2/3 mb-4" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-10 bg-ink-700 rounded" />
              <div className="h-10 bg-ink-700 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ClientUpcomingAppointments() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<ClientBookingSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAppointments = async () => {
      if (!clientAuthService.isAuthenticated()) {
        navigate('/client/login');
        return;
      }

      try {
        // Fetch confirmed appointments
        const confirmedResponse = await clientPortalService.getBookings({
          status_filter: 'confirmed',
          per_page: 50,
        });

        // Fetch deposit paid appointments
        const depositPaidResponse = await clientPortalService.getBookings({
          status_filter: 'deposit_paid',
          per_page: 50,
        });

        // Combine and sort by scheduled date
        const allUpcoming = [
          ...confirmedResponse.bookings,
          ...depositPaidResponse.bookings,
        ].filter((b) => b.scheduled_date !== null);

        // Sort by date (soonest first)
        allUpcoming.sort((a, b) => {
          if (!a.scheduled_date) return 1;
          if (!b.scheduled_date) return -1;
          return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
        });

        setAppointments(allUpcoming);
      } catch (err) {
        setError('Failed to load appointments');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAppointments();
  }, [navigate]);

  // Filter to only show future appointments
  const futureAppointments = appointments.filter((a) => {
    if (!a.scheduled_date) return false;
    return new Date(a.scheduled_date) >= new Date();
  });

  return (
    <div className="min-h-screen bg-ink-900">
      {/* Header */}
      <header className="bg-ink-800 border-b border-ink-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                to="/client"
                className="text-ink-400 hover:text-ink-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-xl font-semibold text-ink-100">
                Upcoming Appointments
              </h1>
            </div>
            <Link
              to="/client/bookings"
              className="text-sm text-accent-primary hover:underline"
            >
              View all bookings
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="bg-ink-800 rounded-xl border border-ink-700 p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-accent-primary hover:underline"
            >
              Try again
            </button>
          </div>
        ) : futureAppointments.length === 0 ? (
          <div className="bg-ink-800 rounded-xl border border-ink-700 p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-ink-700 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-ink-200 mb-2">
              No Upcoming Appointments
            </h3>
            <p className="text-ink-400 mb-6 max-w-sm mx-auto">
              You don&apos;t have any scheduled appointments at the moment. Check your booking requests or request a new appointment.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                to="/client/bookings"
                className="px-4 py-2 bg-ink-700 text-ink-200 rounded-lg hover:bg-ink-600 transition-colors"
              >
                View Booking History
              </Link>
              <Link
                to="/client"
                className="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90 transition-colors"
              >
                Back to Portal
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="mb-6 flex items-center justify-between">
              <p className="text-ink-400">
                {futureAppointments.length} upcoming appointment{futureAppointments.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Appointments list */}
            <div className="space-y-4">
              {futureAppointments.map((appointment) => (
                <AppointmentCard key={appointment.id} booking={appointment} />
              ))}
            </div>

            {/* Past scheduled (but not completed) note */}
            {appointments.length > futureAppointments.length && (
              <div className="mt-8 bg-ink-800 rounded-lg border border-ink-700 px-4 py-3">
                <p className="text-ink-400 text-sm">
                  {appointments.length - futureAppointments.length} past scheduled appointment(s) not shown.{' '}
                  <Link to="/client/bookings" className="text-accent-primary hover:underline">
                    View all bookings
                  </Link>
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default ClientUpcomingAppointments;
