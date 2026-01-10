/**
 * Public page for viewing submitted consent forms by access token.
 * Accessible at /consent/view/:accessToken
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

interface ConsentSubmissionPublic {
  id: string;
  template_name: string;
  client_name: string;
  responses: Record<string, unknown>;
  signature_timestamp: string | null;
  submitted_at: string;
  is_voided: boolean;
}

export function ConsentView() {
  const { accessToken } = useParams<{ accessToken: string }>();
  const [submission, setSubmission] = useState<ConsentSubmissionPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSubmission() {
      if (!accessToken) {
        setError('Invalid access token');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/consent/view/${accessToken}`
        );

        if (!response.ok) {
          throw new Error('Consent form not found');
        }

        const data = await response.json();
        setSubmission(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load consent form');
      } finally {
        setLoading(false);
      }
    }

    loadSubmission();
  }, [accessToken]);

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-ink-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-500"></div>
      </div>
    );
  }

  // Error state
  if (error || !submission) {
    return (
      <div className="min-h-screen bg-ink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-ink-900 mb-2">Consent Form Not Found</h2>
          <p className="text-ink-600">{error || 'Unable to load consent form'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          {submission.is_voided && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-700 font-medium">
                This consent form has been voided and is no longer valid.
              </p>
            </div>
          )}

          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-ink-900">{submission.template_name}</h1>
              <p className="text-sm text-ink-600">Signed Consent Form</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-ink-500">Client Name:</span>
              <p className="font-medium text-ink-900">{submission.client_name}</p>
            </div>
            <div>
              <span className="text-ink-500">Submitted:</span>
              <p className="font-medium text-ink-900">{formatDate(submission.submitted_at)}</p>
            </div>
            {submission.signature_timestamp && (
              <div>
                <span className="text-ink-500">Signed:</span>
                <p className="font-medium text-ink-900">{formatDate(submission.signature_timestamp)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Responses */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-ink-900 mb-4">Form Responses</h2>

          {Object.keys(submission.responses).length === 0 ? (
            <p className="text-ink-500 text-sm">No responses recorded.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(submission.responses).map(([key, value]) => (
                <div key={key} className="border-b border-ink-100 pb-3 last:border-0">
                  <span className="text-sm text-ink-500 block mb-1">
                    {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </span>
                  <p className="text-ink-900">
                    {typeof value === 'boolean'
                      ? value
                        ? 'Yes'
                        : 'No'
                      : String(value) || 'N/A'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-ink-500">
          <p>This is a record of your signed consent form.</p>
          <p>Please keep this link for your records.</p>
        </div>
      </div>
    </div>
  );
}

export default ConsentView;
