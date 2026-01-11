/**
 * Client Forgot Password page - request password reset email for client portal.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { clientAuthService } from '../services/clientAuth';

export function ClientForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setError('Please enter your email address');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await clientAuthService.forgotPassword(email);
      setSuccess(true);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to send reset email. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo and heading */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-accent-primary to-accent-secondary rounded-xl flex items-center justify-center">
              <span className="text-xl font-bold text-white">IF</span>
            </div>
            <span className="text-2xl font-bold text-ink-100">InkFlow</span>
          </Link>
          <h1 className="text-xl font-semibold text-ink-100">Client Portal</h1>
          <p className="text-ink-400 mt-1">
            Enter your email and we'll send you a reset link
          </p>
        </div>

        {/* Form card */}
        <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
          {success ? (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-500/10 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-ink-100 mb-2">Check your email</h2>
              <p className="text-ink-400 text-sm mb-6">
                If an account exists with {email}, we've sent a password reset link.
                Check your inbox and spam folder.
              </p>
              <Link
                to="/client/login"
                className="inline-flex items-center text-accent-primary hover:underline"
              >
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error message */}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Email field */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-ink-200 mb-1.5"
                >
                  Email address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError('');
                  }}
                  autoComplete="email"
                  className={`
                    w-full px-4 py-2.5 bg-ink-700 border rounded-lg text-ink-100
                    placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-primary/50
                    transition-colors
                    ${error ? 'border-red-500' : 'border-ink-600'}
                  `}
                  placeholder="you@example.com"
                />
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`
                  w-full py-2.5 px-4 rounded-lg font-medium text-white
                  transition-all duration-200
                  ${
                    isLoading
                      ? 'bg-accent-primary/50 cursor-not-allowed'
                      : 'bg-accent-primary hover:bg-accent-primary/80 active:scale-[0.98]'
                  }
                `}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5"
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
                    Sending...
                  </span>
                ) : (
                  'Send reset link'
                )}
              </button>
            </form>
          )}

          {/* Back to login link */}
          {!success && (
            <p className="text-center text-sm text-ink-400 mt-6 pt-6 border-t border-ink-700">
              Remember your password?{' '}
              <Link to="/client/login" className="text-accent-primary hover:underline">
                Sign in
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ClientForgotPassword;
