/**
 * Deposit payment page for clients to pay their tattoo deposit.
 * Public page - accessible via unique token link.
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getDepositInfo,
  createCheckoutSession,
} from '../services/bookings';
import type { DepositPaymentInfo } from '../types/api';

export function DepositPayment() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [depositInfo, setDepositInfo] = useState<DepositPaymentInfo | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid payment link');
      setLoading(false);
      return;
    }

    async function fetchDepositInfo() {
      try {
        const info = await getDepositInfo(token!);
        setDepositInfo(info);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load deposit information');
      } finally {
        setLoading(false);
      }
    }

    fetchDepositInfo();
  }, [token]);

  const handlePayDeposit = async () => {
    if (!token) return;

    setProcessingPayment(true);
    setError(null);

    try {
      const session = await createCheckoutSession(token);

      if (session.stub_mode) {
        // In stub mode, navigate to stub checkout page
        navigate(`/pay-deposit/${token}/stub-checkout`);
      } else {
        // Redirect to Stripe Checkout
        window.location.href = session.checkout_url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start payment');
      setProcessingPayment(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ink-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-500"></div>
      </div>
    );
  }

  if (error && !depositInfo) {
    return (
      <div className="min-h-screen bg-ink-900 flex items-center justify-center p-4">
        <div className="bg-ink-800 border border-ink-700 rounded-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-ink-100 mb-2">Unable to Load Payment</h1>
          <p className="text-ink-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!depositInfo) return null;

  return (
    <div className="min-h-screen bg-ink-900 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-ink-100">Deposit Payment</h1>
          <p className="text-ink-400 mt-1">{depositInfo.studio_name}</p>
        </div>

        {/* Deposit Info Card */}
        <div className="bg-ink-800 border border-ink-700 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="bg-ink-750 border-b border-ink-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ink-400">Hello,</p>
                <p className="text-lg font-semibold text-ink-100">{depositInfo.client_name}</p>
              </div>
              {depositInfo.is_expired ? (
                <span className="px-3 py-1 text-sm font-medium text-red-400 bg-red-500/20 rounded-full">
                  Expired
                </span>
              ) : (
                <span className="px-3 py-1 text-sm font-medium text-green-400 bg-green-500/20 rounded-full">
                  Ready to Pay
                </span>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {/* Design Summary */}
            <div>
              <h3 className="text-sm font-medium text-ink-400 mb-2">Your Tattoo</h3>
              <p className="text-ink-200">{depositInfo.design_summary}</p>
              {depositInfo.artist_name && (
                <p className="text-sm text-ink-400 mt-1">
                  Artist: <span className="text-ink-300">{depositInfo.artist_name}</span>
                </p>
              )}
            </div>

            {/* Quote Notes */}
            {depositInfo.quote_notes && (
              <div>
                <h3 className="text-sm font-medium text-ink-400 mb-2">Artist Notes</h3>
                <p className="text-ink-300 text-sm">{depositInfo.quote_notes}</p>
              </div>
            )}

            {/* Pricing */}
            <div className="bg-ink-750 rounded-lg p-4 space-y-3">
              {depositInfo.quoted_price && (
                <div className="flex justify-between">
                  <span className="text-ink-400">Estimated Total</span>
                  <span className="text-ink-200">{formatCurrency(depositInfo.quoted_price)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-semibold">
                <span className="text-ink-200">Deposit Due</span>
                <span className="text-accent-400">{formatCurrency(depositInfo.deposit_amount)}</span>
              </div>
              {depositInfo.quoted_price && (
                <p className="text-xs text-ink-500">
                  Remaining balance of{' '}
                  {formatCurrency(depositInfo.quoted_price - depositInfo.deposit_amount)} due at
                  appointment
                </p>
              )}
            </div>

            {/* Expiry Notice */}
            {!depositInfo.is_expired && (
              <p className="text-sm text-ink-400 text-center">
                This deposit request expires on{' '}
                <span className="text-ink-300">{formatDate(depositInfo.expires_at)}</span>
              </p>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Pay Button */}
            {depositInfo.is_expired ? (
              <div className="text-center py-4">
                <p className="text-red-400 mb-4">
                  This deposit request has expired. Please contact the studio for a new quote.
                </p>
              </div>
            ) : (
              <button
                onClick={handlePayDeposit}
                disabled={processingPayment}
                className="w-full bg-accent-600 hover:bg-accent-500 disabled:bg-ink-600 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-3"
              >
                {processingPayment ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                      />
                    </svg>
                    Pay {formatCurrency(depositInfo.deposit_amount)} Deposit
                  </>
                )}
              </button>
            )}
          </div>

          {/* Footer */}
          <div className="bg-ink-750 border-t border-ink-700 px-6 py-4">
            <div className="flex items-center justify-center gap-2 text-sm text-ink-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <span>Secure payment powered by Stripe</span>
            </div>
          </div>
        </div>

        {/* Studio Info */}
        <div className="mt-6 text-center text-sm text-ink-500">
          <p>Questions about your booking?</p>
          <p>Contact {depositInfo.studio_name}</p>
        </div>
      </div>
    </div>
  );
}
