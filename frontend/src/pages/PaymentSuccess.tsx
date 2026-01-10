/**
 * Payment success page shown after a successful deposit payment.
 */

import { useParams } from 'react-router-dom';

export function PaymentSuccess() {
  const { token } = useParams<{ token: string }>();

  return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center p-4">
      <div className="bg-ink-800 border border-ink-700 rounded-xl p-8 max-w-md w-full text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-ink-100 mb-2">
          Payment Successful!
        </h1>

        {/* Description */}
        <p className="text-ink-400 mb-6">
          Your deposit has been received. You'll receive a confirmation email shortly
          with details about your upcoming appointment.
        </p>

        {/* What's Next */}
        <div className="bg-ink-750 rounded-lg p-4 text-left mb-6">
          <h3 className="text-sm font-medium text-ink-200 mb-3">What happens next?</h3>
          <ul className="space-y-2 text-sm text-ink-400">
            <li className="flex items-start gap-2">
              <svg
                className="w-4 h-4 text-accent-400 shrink-0 mt-0.5"
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
              <span>You'll receive a confirmation email with your booking details</span>
            </li>
            <li className="flex items-start gap-2">
              <svg
                className="w-4 h-4 text-accent-400 shrink-0 mt-0.5"
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
              <span>Your artist will reach out to schedule your appointment</span>
            </li>
            <li className="flex items-start gap-2">
              <svg
                className="w-4 h-4 text-accent-400 shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              <span>You'll receive aftercare instructions before your appointment</span>
            </li>
          </ul>
        </div>

        {/* Receipt ID */}
        {token && (
          <div className="bg-ink-750 rounded-lg p-3 mb-6">
            <p className="text-xs text-ink-500 mb-1">Reference ID</p>
            <p className="text-sm font-mono text-ink-300 break-all">
              {token.substring(0, 24)}...
            </p>
          </div>
        )}

        {/* Close Button */}
        <p className="text-sm text-ink-500">
          You can close this window now. We'll be in touch soon!
        </p>
      </div>
    </div>
  );
}
