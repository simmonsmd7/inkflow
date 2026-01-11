/**
 * Public page for clients to request a touch-up via their aftercare access token.
 * Accessible at /aftercare/:accessToken/touch-up
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { clientRequestTouchUp } from '../services/aftercare';
import type { ClientTouchUpRequestInput } from '../types/api';

interface AftercareInfo {
  client_name: string;
  studio_name: string;
  appointment_date: string;
  tattoo_placement: string | null;
}

export function TouchUpRequest() {
  const { accessToken } = useParams<{ accessToken: string }>();
  const [aftercareInfo, setAftercareInfo] = useState<AftercareInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [response, setResponse] = useState<{ studio_name: string; expected_contact_within: string } | null>(null);

  // Form state
  const [reason, setReason] = useState('');
  const [preferredDates, setPreferredDates] = useState<string[]>(['']);
  const [additionalNotes, setAdditionalNotes] = useState('');

  useEffect(() => {
    async function loadAftercareInfo() {
      if (!accessToken) {
        setError('Invalid access link');
        setLoading(false);
        return;
      }

      try {
        // Fetch basic aftercare info to verify the token
        const res = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/aftercare/view/${accessToken}`
        );

        if (!res.ok) {
          throw new Error('Invalid or expired access link');
        }

        const data = await res.json();
        setAftercareInfo({
          client_name: data.client_name,
          studio_name: data.studio_name,
          appointment_date: data.appointment_date,
          tattoo_placement: data.placement,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load aftercare information');
      } finally {
        setLoading(false);
      }
    }

    loadAftercareInfo();
  }, [accessToken]);

  function addPreferredDate() {
    if (preferredDates.length < 5) {
      setPreferredDates([...preferredDates, '']);
    }
  }

  function removePreferredDate(index: number) {
    if (preferredDates.length > 1) {
      setPreferredDates(preferredDates.filter((_, i) => i !== index));
    }
  }

  function updatePreferredDate(index: number, value: string) {
    const updated = [...preferredDates];
    updated[index] = value;
    setPreferredDates(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!accessToken) {
      setError('Invalid access link');
      return;
    }

    if (reason.trim().length < 10) {
      setError('Please provide a more detailed reason for the touch-up (at least 10 characters)');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const input: ClientTouchUpRequestInput = {
        reason: reason.trim(),
        preferred_dates: preferredDates.filter((d) => d.trim() !== ''),
        additional_notes: additionalNotes.trim() || undefined,
      };

      const result = await clientRequestTouchUp(accessToken, input);
      setResponse({
        studio_name: result.studio_name,
        expected_contact_within: result.expected_contact_within,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit touch-up request');
    } finally {
      setSubmitting(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-ink-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  // Error state (invalid token)
  if (error && !aftercareInfo) {
    return (
      <div className="min-h-screen bg-ink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-ink-900 mb-2">Access Link Invalid</h2>
          <p className="text-ink-600">{error}</p>
        </div>
      </div>
    );
  }

  // Success state
  if (submitted && response) {
    return (
      <div className="min-h-screen bg-ink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-ink-900 mb-2">Touch-up Request Submitted</h2>
          <p className="text-ink-600 mb-4">
            Your touch-up request has been sent to {response.studio_name}.
          </p>
          <p className="text-ink-500 text-sm">
            You can expect to hear back within {response.expected_contact_within}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-ink-900">Request a Touch-up</h1>
              <p className="text-sm text-ink-600">{aftercareInfo?.studio_name}</p>
            </div>
          </div>

          {aftercareInfo && (
            <div className="bg-ink-50 rounded-lg p-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-ink-500">Client:</span>
                  <p className="font-medium text-ink-900">{aftercareInfo.client_name}</p>
                </div>
                <div>
                  <span className="text-ink-500">Original Appointment:</span>
                  <p className="font-medium text-ink-900">
                    {new Date(aftercareInfo.appointment_date).toLocaleDateString()}
                  </p>
                </div>
                {aftercareInfo.tattoo_placement && (
                  <div>
                    <span className="text-ink-500">Placement:</span>
                    <p className="font-medium text-ink-900">{aftercareInfo.tattoo_placement}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Request Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-ink-900 mb-4">Touch-up Request Details</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1">
                Why do you need a touch-up? *
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-ink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
                rows={4}
                placeholder="Please describe any issues with your tattoo (fading, color loss, uneven lines, etc.)"
                required
                minLength={10}
              />
              <p className="text-xs text-ink-500 mt-1">
                Be as detailed as possible to help the artist prepare for your touch-up session.
              </p>
            </div>

            {/* Preferred Dates */}
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1">
                Preferred dates (optional)
              </label>
              <div className="space-y-2">
                {preferredDates.map((date, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => updatePreferredDate(index, e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="flex-1 px-3 py-2 border border-ink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
                    />
                    {preferredDates.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePreferredDate(index)}
                        className="p-2 text-ink-400 hover:text-red-500"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {preferredDates.length < 5 && (
                <button
                  type="button"
                  onClick={addPreferredDate}
                  className="mt-2 text-sm text-accent-primary hover:text-accent-primary"
                >
                  + Add another date
                </button>
              )}
            </div>

            {/* Additional Notes */}
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1">
                Additional notes (optional)
              </label>
              <textarea
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                className="w-full px-3 py-2 border border-ink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
                rows={2}
                placeholder="Any other information you'd like to share..."
              />
            </div>
          </div>

          <div className="mt-6">
            <button
              type="submit"
              disabled={submitting || reason.trim().length < 10}
              className="w-full py-3 bg-accent-primary text-white rounded-lg font-medium hover:bg-accent-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Touch-up Request'}
            </button>
          </div>

          <p className="mt-4 text-xs text-ink-500 text-center">
            The studio will review your request and contact you to schedule an appointment.
          </p>
        </form>
      </div>
    </div>
  );
}

export default TouchUpRequest;
