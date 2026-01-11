/**
 * Stub checkout page for testing deposit payments without Stripe.
 * Simulates the Stripe checkout experience.
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { confirmStubPayment } from '../services/bookings';

export function StubCheckout() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirmPayment = async () => {
    if (!token) return;

    setProcessing(true);
    setError(null);

    try {
      await confirmStubPayment(token);
      // Redirect to success page
      navigate(`/pay-deposit/${token}/success`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setProcessing(false);
    }
  };

  const handleCancel = () => {
    if (token) {
      navigate(`/pay-deposit/${token}`);
    }
  };

  return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center p-4">
      <div className="bg-ink-800 border border-ink-700 rounded-xl p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent-primary/20 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-accent-secondary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-ink-100">Test Payment</h1>
          <p className="text-ink-400 mt-2 text-sm">
            Stripe is not configured. This is a simulated checkout.
          </p>
        </div>

        {/* Fake card form */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-ink-300 mb-1">
              Card Number
            </label>
            <input
              type="text"
              value="4242 4242 4242 4242"
              disabled
              className="w-full px-4 py-2 bg-ink-700 border border-ink-600 rounded-lg text-ink-300 cursor-not-allowed"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1">
                Expiry
              </label>
              <input
                type="text"
                value="12/28"
                disabled
                className="w-full px-4 py-2 bg-ink-700 border border-ink-600 rounded-lg text-ink-300 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1">
                CVC
              </label>
              <input
                type="text"
                value="123"
                disabled
                className="w-full px-4 py-2 bg-ink-700 border border-ink-600 rounded-lg text-ink-300 cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Info notice */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-yellow-200">
              <strong>Development Mode:</strong> No actual payment will be processed.
              Click "Confirm Payment" to simulate a successful payment.
            </p>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleConfirmPayment}
            disabled={processing}
            className="w-full bg-accent-primary hover:bg-accent-primary/80 disabled:bg-ink-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {processing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                Processing...
              </>
            ) : (
              'Confirm Payment'
            )}
          </button>

          <button
            onClick={handleCancel}
            disabled={processing}
            className="w-full bg-ink-700 hover:bg-ink-600 disabled:cursor-not-allowed text-ink-300 font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-ink-500">
            Powered by InkFlow (Test Mode)
          </p>
        </div>
      </div>
    </div>
  );
}
