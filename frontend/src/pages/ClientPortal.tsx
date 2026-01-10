/**
 * Client portal dashboard - main landing page for logged-in clients.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clientAuthService } from '../services/clientAuth';
import type { ClientDetailResponse } from '../types/api';

export function ClientPortal() {
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClient = async () => {
      if (!clientAuthService.isAuthenticated()) {
        navigate('/client/login');
        return;
      }

      try {
        const data = await clientAuthService.getMe();
        setClient(data);
      } catch (err) {
        setError('Failed to load profile. Please log in again.');
        clientAuthService.logout();
        navigate('/client/login');
      } finally {
        setIsLoading(false);
      }
    };

    fetchClient();
  }, [navigate]);

  const handleLogout = () => {
    clientAuthService.logout();
    navigate('/client/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ink-900 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <svg
            className="animate-spin h-8 w-8 text-accent-primary"
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
          <span className="text-ink-300">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-ink-900 flex items-center justify-center p-4">
        <div className="bg-ink-800 rounded-xl border border-ink-700 p-6 max-w-md text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Link
            to="/client/login"
            className="text-accent-primary hover:underline"
          >
            Return to login
          </Link>
        </div>
      </div>
    );
  }

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
              <span className="text-ink-300 text-sm">
                Welcome, {client?.first_name}
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-ink-300 hover:text-ink-100 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-ink-100">Client Portal</h1>
          <p className="text-ink-400 mt-1">
            Manage your appointments, view aftercare instructions, and more
          </p>
        </div>

        {/* Quick actions grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Upcoming Appointments */}
          <Link
            to="/client/appointments"
            className="bg-ink-800 rounded-xl border border-ink-700 p-6 hover:border-ink-600 transition-colors block"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-accent-primary/20 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-accent-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-ink-100">Appointments</h2>
            </div>
            <p className="text-ink-400 text-sm mb-4">
              View your upcoming scheduled appointments
            </p>
            <span className="text-accent-primary text-sm font-medium">View Appointments &rarr;</span>
          </Link>

          {/* Booking History */}
          <Link
            to="/client/bookings"
            className="bg-ink-800 rounded-xl border border-ink-700 p-6 hover:border-ink-600 transition-colors block"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-green-400"
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
              </div>
              <h2 className="text-lg font-semibold text-ink-100">History</h2>
            </div>
            <p className="text-ink-400 text-sm mb-4">
              View your complete booking history
            </p>
            <span className="text-accent-primary text-sm font-medium">View History &rarr;</span>
          </Link>

          {/* Consent Forms */}
          <Link
            to="/client/consent"
            className="bg-ink-800 rounded-xl border border-ink-700 p-6 hover:border-ink-600 transition-colors block"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-ink-100">Consent Forms</h2>
            </div>
            <p className="text-ink-400 text-sm mb-4">
              Sign consent forms before your appointment
            </p>
            <span className="text-accent-primary text-sm font-medium">View Forms &rarr;</span>
          </Link>

          {/* Aftercare */}
          <Link
            to="/client/aftercare"
            className="bg-ink-800 rounded-xl border border-ink-700 p-6 hover:border-ink-600 transition-colors block"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-purple-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-ink-100">Aftercare</h2>
            </div>
            <p className="text-ink-400 text-sm mb-4">
              Access your aftercare instructions
            </p>
            <span className="text-accent-primary text-sm font-medium">View Instructions &rarr;</span>
          </Link>

          {/* Book New */}
          <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-yellow-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-ink-100">Book New</h2>
            </div>
            <p className="text-ink-400 text-sm mb-4">
              Request a new appointment
            </p>
            <span className="text-ink-500 text-sm">Coming soon</span>
          </div>

          {/* Profile */}
          <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-ink-600 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-ink-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-ink-100">Profile</h2>
            </div>
            <p className="text-ink-400 text-sm mb-4">
              Update your contact information
            </p>
            <span className="text-ink-500 text-sm">Coming soon</span>
          </div>
        </div>

        {/* Account info */}
        <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
          <h2 className="text-lg font-semibold text-ink-100 mb-4">Account Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-ink-500">Name</span>
              <p className="text-ink-200">
                {client?.first_name} {client?.last_name}
              </p>
            </div>
            <div>
              <span className="text-sm text-ink-500">Email</span>
              <p className="text-ink-200">{client?.email}</p>
            </div>
            <div>
              <span className="text-sm text-ink-500">Phone</span>
              <p className="text-ink-200">{client?.phone || 'Not provided'}</p>
            </div>
            <div>
              <span className="text-sm text-ink-500">Member since</span>
              <p className="text-ink-200">
                {client?.created_at
                  ? new Date(client.created_at).toLocaleDateString()
                  : '-'}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default ClientPortal;
