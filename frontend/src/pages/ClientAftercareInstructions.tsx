/**
 * Client aftercare instructions page - view aftercare instructions and report issues.
 */

import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { clientAuthService } from '../services/clientAuth';
import { clientPortalService } from '../services/clientPortal';
import type {
  ClientAftercareSummary,
  ClientAftercareDetail,
  ClientHealingIssueSummary,
} from '../types/api';

// Status badge colors
function getStatusBadge(status: string): { bg: string; text: string; label: string } {
  switch (status) {
    case 'sent':
      return { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Sent' };
    case 'delivered':
      return { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Delivered' };
    case 'pending':
      return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Pending' };
    case 'failed':
      return { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Failed' };
    default:
      return { bg: 'bg-ink-600', text: 'text-ink-300', label: status };
  }
}

// Follow-up type labels
function getFollowUpLabel(type: string): string {
  switch (type) {
    case 'day_3':
      return 'Day 3 Check-in';
    case 'week_1':
      return 'Week 1 Check-in';
    case 'week_2':
      return 'Week 2 Check-in';
    case 'week_4':
      return 'Week 4 Check-in';
    case 'custom':
      return 'Custom Follow-up';
    default:
      return type;
  }
}

// Severity colors
function getSeverityBadge(severity: string): { bg: string; text: string } {
  switch (severity) {
    case 'minor':
      return { bg: 'bg-gray-500/20', text: 'text-gray-400' };
    case 'moderate':
      return { bg: 'bg-yellow-500/20', text: 'text-yellow-400' };
    case 'concerning':
      return { bg: 'bg-orange-500/20', text: 'text-orange-400' };
    case 'urgent':
      return { bg: 'bg-red-500/20', text: 'text-red-400' };
    default:
      return { bg: 'bg-ink-600', text: 'text-ink-300' };
  }
}

// List view component
function AftercareList() {
  const navigate = useNavigate();
  const [instructions, setInstructions] = useState<ClientAftercareSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchInstructions = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await clientPortalService.getAftercareList({ page, per_page: 10 });
      setInstructions(data.instructions);
      setTotalPages(data.pages);
      setError(null);
    } catch (err) {
      setError('Failed to load aftercare instructions');
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (!clientAuthService.isAuthenticated()) {
      navigate('/client/login');
      return;
    }
    fetchInstructions();
  }, [navigate, fetchInstructions]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-ink-800 rounded-xl border border-ink-700 p-6 animate-pulse">
            <div className="h-5 bg-ink-700 rounded w-1/3 mb-3" />
            <div className="h-4 bg-ink-700 rounded w-1/2 mb-2" />
            <div className="h-4 bg-ink-700 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={fetchInstructions}
          className="px-4 py-2 bg-ink-700 text-ink-200 rounded-lg hover:bg-ink-600 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (instructions.length === 0) {
    return (
      <div className="bg-ink-800 rounded-xl border border-ink-700 p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-purple-500/20 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-ink-100 mb-2">No Aftercare Instructions</h3>
        <p className="text-ink-400">
          Aftercare instructions will appear here after your tattoo appointments.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {instructions.map((instruction) => {
        const statusBadge = getStatusBadge(instruction.status);
        return (
          <Link
            key={instruction.id}
            to={`/client/aftercare/${instruction.id}`}
            className="block bg-ink-800 rounded-xl border border-ink-700 p-6 hover:border-ink-600 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-medium text-ink-100">{instruction.template_name}</h3>
                <p className="text-sm text-ink-400">{instruction.studio_name}</p>
              </div>
              <span className={`px-2 py-1 text-xs font-medium rounded ${statusBadge.bg} ${statusBadge.text}`}>
                {statusBadge.label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
              <div>
                <span className="text-ink-500">Appointment:</span>
                <p className="text-ink-200">
                  {new Date(instruction.appointment_date).toLocaleDateString()}
                </p>
              </div>
              {instruction.artist_name && (
                <div>
                  <span className="text-ink-500">Artist:</span>
                  <p className="text-ink-200">{instruction.artist_name}</p>
                </div>
              )}
            </div>

            {(instruction.tattoo_type || instruction.placement) && (
              <div className="flex gap-2 flex-wrap mb-3">
                {instruction.tattoo_type && (
                  <span className="px-2 py-1 text-xs bg-ink-700 text-ink-300 rounded">
                    {instruction.tattoo_type.replace(/_/g, ' ')}
                  </span>
                )}
                {instruction.placement && (
                  <span className="px-2 py-1 text-xs bg-ink-700 text-ink-300 rounded">
                    {instruction.placement.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            )}

            {instruction.booking_design_idea && (
              <p className="text-sm text-ink-400 mb-3">{instruction.booking_design_idea}</p>
            )}

            <div className="flex items-center justify-between text-xs text-ink-500">
              <span>Viewed {instruction.view_count} {instruction.view_count === 1 ? 'time' : 'times'}</span>
              <span>View Instructions &rarr;</span>
            </div>
          </Link>
        );
      })}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 rounded bg-ink-700 text-ink-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-ink-600 transition-colors"
          >
            Previous
          </button>
          <span className="text-ink-400 px-3">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 rounded bg-ink-700 text-ink-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-ink-600 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// Detail view component
function AftercareDetailView({ aftercareId }: { aftercareId: string }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ClientAftercareDetail | null>(null);
  const [issues, setIssues] = useState<ClientHealingIssueSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportDescription, setReportDescription] = useState('');
  const [reportSeverity, setReportSeverity] = useState('minor');
  const [reportSymptoms, setReportSymptoms] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);

  const symptomOptions = [
    'redness',
    'swelling',
    'itching',
    'oozing',
    'scabbing',
    'color_loss',
    'infection_signs',
    'pain',
    'other',
  ];

  useEffect(() => {
    if (!clientAuthService.isAuthenticated()) {
      navigate('/client/login');
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [detailData, issuesData] = await Promise.all([
          clientPortalService.getAftercareDetail(aftercareId),
          clientPortalService.getHealingIssues(aftercareId),
        ]);
        setDetail(detailData);
        setIssues(issuesData);
        setError(null);
      } catch (err) {
        setError('Failed to load aftercare instructions');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [navigate, aftercareId]);

  const handleSubmitIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDescription.trim()) return;

    try {
      setIsSubmitting(true);
      const response = await clientPortalService.reportHealingIssue(aftercareId, {
        description: reportDescription,
        severity: reportSeverity,
        symptoms: reportSymptoms,
      });
      setReportSuccess(response.message);
      setShowReportForm(false);
      setReportDescription('');
      setReportSeverity('minor');
      setReportSymptoms([]);
      // Refresh issues
      const updatedIssues = await clientPortalService.getHealingIssues(aftercareId);
      setIssues(updatedIssues);
    } catch (err) {
      setError('Failed to report issue. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSymptom = (symptom: string) => {
    setReportSymptoms((prev) =>
      prev.includes(symptom)
        ? prev.filter((s) => s !== symptom)
        : [...prev, symptom]
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-ink-700 rounded w-1/3" />
        <div className="h-4 bg-ink-700 rounded w-1/2" />
        <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
          <div className="h-4 bg-ink-700 rounded w-full mb-3" />
          <div className="h-4 bg-ink-700 rounded w-full mb-3" />
          <div className="h-4 bg-ink-700 rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-red-400 mb-4">{error || 'Instructions not found'}</p>
        <Link
          to="/client/aftercare"
          className="px-4 py-2 bg-ink-700 text-ink-200 rounded-lg hover:bg-ink-600 transition-colors inline-block"
        >
          Back to Aftercare
        </Link>
      </div>
    );
  }

  const statusBadge = getStatusBadge(detail.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/client/aftercare"
          className="text-accent-primary hover:underline text-sm mb-2 inline-block"
        >
          &larr; Back to Aftercare
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink-100">{detail.template_name}</h1>
            <p className="text-ink-400">{detail.studio_name}</p>
          </div>
          <span className={`px-3 py-1 text-sm font-medium rounded ${statusBadge.bg} ${statusBadge.text}`}>
            {statusBadge.label}
          </span>
        </div>
      </div>

      {/* Success message */}
      {reportSuccess && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <p className="text-green-400">{reportSuccess}</p>
        </div>
      )}

      {/* Appointment info */}
      <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
        <h2 className="text-lg font-semibold text-ink-100 mb-4">Appointment Details</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-ink-500">Date:</span>
            <p className="text-ink-200">
              {new Date(detail.appointment_date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          {detail.artist_name && (
            <div>
              <span className="text-ink-500">Artist:</span>
              <p className="text-ink-200">{detail.artist_name}</p>
            </div>
          )}
          {detail.tattoo_type && (
            <div>
              <span className="text-ink-500">Tattoo Type:</span>
              <p className="text-ink-200 capitalize">{detail.tattoo_type.replace(/_/g, ' ')}</p>
            </div>
          )}
          {detail.placement && (
            <div>
              <span className="text-ink-500">Placement:</span>
              <p className="text-ink-200 capitalize">{detail.placement.replace(/_/g, ' ')}</p>
            </div>
          )}
          {detail.booking_design_idea && (
            <div className="col-span-2 sm:col-span-3">
              <span className="text-ink-500">Design:</span>
              <p className="text-ink-200">{detail.booking_design_idea}</p>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
        <h2 className="text-lg font-semibold text-ink-100 mb-4">Aftercare Instructions</h2>
        <div
          className="prose prose-invert prose-sm max-w-none text-ink-300"
          dangerouslySetInnerHTML={{ __html: detail.instructions_html }}
        />
      </div>

      {/* Extra data - key points, products, warnings */}
      {detail.extra_data && (
        <div className="grid gap-4 sm:grid-cols-2">
          {detail.extra_data.key_points.length > 0 && (
            <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
              <h3 className="text-md font-semibold text-ink-100 mb-3">Key Points</h3>
              <ul className="space-y-2">
                {detail.extra_data.key_points.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink-300">
                    <span className="text-green-400 mt-0.5">&#10003;</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {detail.extra_data.products_recommended.length > 0 && (
            <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
              <h3 className="text-md font-semibold text-ink-100 mb-3">Recommended Products</h3>
              <ul className="space-y-2">
                {detail.extra_data.products_recommended.map((product, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink-300">
                    <span className="text-blue-400 mt-0.5">+</span>
                    {product}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {detail.extra_data.products_to_avoid.length > 0 && (
            <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
              <h3 className="text-md font-semibold text-ink-100 mb-3">Products to Avoid</h3>
              <ul className="space-y-2">
                {detail.extra_data.products_to_avoid.map((product, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink-300">
                    <span className="text-red-400 mt-0.5">-</span>
                    {product}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {detail.extra_data.warning_signs.length > 0 && (
            <div className="bg-ink-800 rounded-xl border border-red-500/30 p-6">
              <h3 className="text-md font-semibold text-red-400 mb-3">Warning Signs</h3>
              <ul className="space-y-2">
                {detail.extra_data.warning_signs.map((sign, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink-300">
                    <span className="text-red-400 mt-0.5">!</span>
                    {sign}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Follow-ups */}
      {detail.follow_ups.length > 0 && (
        <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
          <h2 className="text-lg font-semibold text-ink-100 mb-4">Follow-up Schedule</h2>
          <div className="space-y-3">
            {detail.follow_ups.map((followUp) => {
              const fStatus = getStatusBadge(followUp.status);
              return (
                <div
                  key={followUp.id}
                  className="flex items-center justify-between p-3 bg-ink-700/50 rounded-lg"
                >
                  <div>
                    <p className="text-ink-200 font-medium">{getFollowUpLabel(followUp.follow_up_type)}</p>
                    <p className="text-xs text-ink-400">
                      {followUp.subject} - {new Date(followUp.scheduled_for).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded ${fStatus.bg} ${fStatus.text}`}>
                    {fStatus.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Healing Issues */}
      {issues.length > 0 && (
        <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
          <h2 className="text-lg font-semibold text-ink-100 mb-4">Reported Issues</h2>
          <div className="space-y-4">
            {issues.map((issue) => {
              const sevBadge = getSeverityBadge(issue.severity);
              return (
                <div key={issue.id} className="p-4 bg-ink-700/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-1 text-xs rounded capitalize ${sevBadge.bg} ${sevBadge.text}`}>
                      {issue.severity}
                    </span>
                    <span className="text-xs text-ink-500">
                      Day {issue.days_since_appointment} - {new Date(issue.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-ink-300 mb-2">{issue.description}</p>
                  {issue.symptoms.length > 0 && (
                    <div className="flex gap-1 flex-wrap mb-2">
                      {issue.symptoms.map((s) => (
                        <span key={s} className="px-2 py-0.5 text-xs bg-ink-600 text-ink-300 rounded">
                          {s.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs">
                    <span className={`capitalize ${issue.status === 'resolved' ? 'text-green-400' : 'text-yellow-400'}`}>
                      Status: {issue.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {issue.staff_notes && (
                    <div className="mt-2 p-2 bg-ink-600/50 rounded text-sm">
                      <span className="text-ink-500">Studio Response:</span>
                      <p className="text-ink-200">{issue.staff_notes}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Report Issue Button / Form */}
      <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
        {!showReportForm ? (
          <div className="text-center">
            <h3 className="text-lg font-semibold text-ink-100 mb-2">Having Issues?</h3>
            <p className="text-ink-400 text-sm mb-4">
              If you're experiencing any healing concerns, let us know and the studio will follow up.
            </p>
            <button
              onClick={() => setShowReportForm(true)}
              className="px-6 py-2 bg-accent-primary hover:bg-accent-primary/80 text-white rounded-lg transition-colors"
            >
              Report Healing Issue
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmitIssue}>
            <h3 className="text-lg font-semibold text-ink-100 mb-4">Report Healing Issue</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-ink-300 mb-2">Describe the issue *</label>
                <textarea
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  className="w-full px-4 py-2 bg-ink-700 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:outline-none focus:border-accent-primary"
                  rows={4}
                  placeholder="Please describe what you're experiencing..."
                  required
                  minLength={10}
                />
              </div>

              <div>
                <label className="block text-sm text-ink-300 mb-2">Severity</label>
                <select
                  value={reportSeverity}
                  onChange={(e) => setReportSeverity(e.target.value)}
                  className="w-full px-4 py-2 bg-ink-700 border border-ink-600 rounded-lg text-ink-100 focus:outline-none focus:border-accent-primary"
                >
                  <option value="minor">Minor - Normal healing concern</option>
                  <option value="moderate">Moderate - Worth monitoring</option>
                  <option value="concerning">Concerning - Should contact artist</option>
                  <option value="urgent">Urgent - May need medical attention</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-ink-300 mb-2">Symptoms (select all that apply)</label>
                <div className="flex flex-wrap gap-2">
                  {symptomOptions.map((symptom) => (
                    <button
                      key={symptom}
                      type="button"
                      onClick={() => toggleSymptom(symptom)}
                      className={`px-3 py-1 text-sm rounded-full transition-colors ${
                        reportSymptoms.includes(symptom)
                          ? 'bg-accent-primary text-white'
                          : 'bg-ink-700 text-ink-300 hover:bg-ink-600'
                      }`}
                    >
                      {symptom.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowReportForm(false);
                    setReportDescription('');
                    setReportSeverity('minor');
                    setReportSymptoms([]);
                  }}
                  className="px-4 py-2 bg-ink-700 text-ink-300 rounded-lg hover:bg-ink-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || reportDescription.length < 10}
                  className="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// Main component with routing
export function ClientAftercareInstructions() {
  const { aftercareId } = useParams<{ aftercareId?: string }>();

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

            <Link
              to="/client"
              className="text-ink-300 hover:text-ink-100 text-sm transition-colors"
            >
              Back to Portal
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!aftercareId && (
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-ink-100">Aftercare Instructions</h1>
            <p className="text-ink-400 mt-1">
              View your tattoo aftercare instructions and report any healing issues
            </p>
          </div>
        )}

        {aftercareId ? (
          <AftercareDetailView aftercareId={aftercareId} />
        ) : (
          <AftercareList />
        )}
      </main>
    </div>
  );
}

export default ClientAftercareInstructions;
