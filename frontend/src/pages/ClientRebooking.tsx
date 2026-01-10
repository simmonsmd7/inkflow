/**
 * Client rebooking page - allows clients to book a touch-up or new tattoo
 * based on a previous completed booking.
 */

import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { clientAuthService } from '../services/clientAuth';
import { clientPortalService } from '../services/clientPortal';
import type {
  ClientRebookingData,
  ClientRebookingSubmit,
  TattooSize,
} from '../types/api';

const TATTOO_SIZES: { value: TattooSize; label: string; description: string }[] = [
  { value: 'tiny', label: 'Tiny', description: 'Under 2 inches' },
  { value: 'small', label: 'Small', description: '2-4 inches' },
  { value: 'medium', label: 'Medium', description: '4-6 inches' },
  { value: 'large', label: 'Large', description: '6-10 inches' },
  { value: 'extra_large', label: 'Extra Large', description: '10+ inches' },
  { value: 'half_sleeve', label: 'Half Sleeve', description: 'Arm or leg half' },
  { value: 'full_sleeve', label: 'Full Sleeve', description: 'Full arm or leg' },
  { value: 'back_piece', label: 'Back Piece', description: 'Partial or full back' },
  { value: 'full_body', label: 'Full Body', description: 'Multi-session large piece' },
];

const BUDGET_OPTIONS = [
  'Under $200',
  '$200 - $500',
  '$500 - $1,000',
  '$1,000 - $2,000',
  '$2,000 - $5,000',
  '$5,000+',
  'Flexible / Open to discussion',
];

const COLOR_OPTIONS = [
  'Black & Grey only',
  'Full color',
  'Limited palette (2-3 colors)',
  'Black with color accents',
  'No preference',
];

interface FormData {
  design_idea: string;
  placement: string;
  size: TattooSize;
  is_cover_up: boolean;
  color_preference: string;
  budget_range: string;
  additional_notes: string;
  preferred_artist_id: string;
  preferred_dates: string;
}

// Format date
function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function ClientRebooking() {
  const navigate = useNavigate();
  const { bookingId } = useParams<{ bookingId: string }>();
  const [rebookingData, setRebookingData] = useState<ClientRebookingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ requestId: string; isTouchUp: boolean } | null>(null);
  const [isTouchUpMode, setIsTouchUpMode] = useState(true);

  const [formData, setFormData] = useState<FormData>({
    design_idea: '',
    placement: '',
    size: 'medium',
    is_cover_up: false,
    color_preference: '',
    budget_range: '',
    additional_notes: '',
    preferred_artist_id: '',
    preferred_dates: '',
  });

  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  // Fetch rebooking data
  useEffect(() => {
    if (!clientAuthService.isAuthenticated()) {
      navigate('/client/login');
      return;
    }

    if (!bookingId) {
      setError('No booking ID provided');
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await clientPortalService.getRebookingData(bookingId);
        setRebookingData(data);

        // Pre-fill form with original booking data
        setFormData({
          design_idea: data.original_design_idea,
          placement: data.original_placement,
          size: data.original_size as TattooSize,
          is_cover_up: false,
          color_preference: data.original_color_preference || '',
          budget_range: '',
          additional_notes: '',
          preferred_artist_id: data.original_artist?.id || '',
          preferred_dates: '',
        });
      } catch (err) {
        if (err instanceof Error) {
          if (err.message.includes('completed')) {
            setError('Only completed appointments can be rebooked.');
          } else if (err.message.includes('not found')) {
            setError('Booking not found.');
          } else {
            setError(err.message);
          }
        } else {
          setError('Failed to load rebooking data. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [navigate, bookingId]);

  const updateField = useCallback((field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear validation error when field is updated
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }, [validationErrors]);

  const validate = useCallback((): boolean => {
    const errors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.design_idea.trim()) {
      errors.design_idea = 'Please describe your tattoo idea';
    } else if (formData.design_idea.trim().length < 10) {
      errors.design_idea = 'Please provide more detail (at least 10 characters)';
    }

    if (!formData.placement.trim()) {
      errors.placement = 'Please specify placement';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate() || !rebookingData) return;

    setSubmitting(true);
    setError(null);

    try {
      const submitData: ClientRebookingSubmit = {
        original_booking_id: rebookingData.original_booking_id,
        design_idea: formData.design_idea.trim(),
        placement: formData.placement.trim(),
        size: formData.size,
        is_cover_up: formData.is_cover_up,
        is_first_tattoo: false,
        color_preference: formData.color_preference || null,
        budget_range: formData.budget_range || null,
        additional_notes: formData.additional_notes.trim() || null,
        preferred_artist_id: formData.preferred_artist_id || null,
        preferred_dates: formData.preferred_dates.trim() || null,
      };

      const result = await clientPortalService.submitRebooking(submitData);
      setSubmitResult({ requestId: result.request_id, isTouchUp: result.is_touch_up });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchToNewTattoo = () => {
    setIsTouchUpMode(false);
    // Clear design idea for new tattoo
    setFormData((prev) => ({
      ...prev,
      design_idea: '',
      additional_notes: `New tattoo request (previously had: ${rebookingData?.original_design_idea || 'tattoo'})`,
    }));
  };

  const handleSwitchToTouchUp = () => {
    setIsTouchUpMode(true);
    // Restore original design idea for touch-up
    if (rebookingData) {
      setFormData((prev) => ({
        ...prev,
        design_idea: rebookingData.original_design_idea,
        placement: rebookingData.original_placement,
        additional_notes: '',
      }));
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-ink-900 flex items-center justify-center">
        <div className="text-center">
          <svg
            className="animate-spin h-12 w-12 text-accent-primary mx-auto mb-4"
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
          <p className="text-ink-300">Loading rebooking data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !rebookingData) {
    return (
      <div className="min-h-screen bg-ink-900">
        <header className="bg-ink-800 border-b border-ink-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link to="/client" className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-accent-primary to-accent-secondary rounded-xl flex items-center justify-center">
                  <span className="text-lg font-bold text-white">IF</span>
                </div>
                <span className="text-xl font-bold text-ink-100">InkFlow</span>
              </Link>
            </div>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-16">
          <div className="bg-ink-800 rounded-xl border border-red-500/30 p-8 text-center">
            <svg
              className="w-12 h-12 text-red-400 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-ink-100 mb-2">Cannot Rebook</h2>
            <p className="text-ink-400 mb-6">{error}</p>
            <Link
              to="/client/bookings"
              className="inline-block px-6 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90 transition-colors"
            >
              Back to Bookings
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Success state
  if (submitted && submitResult) {
    return (
      <div className="min-h-screen bg-ink-900 flex items-center justify-center p-4">
        <div className="bg-ink-800 rounded-xl border border-ink-700 p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">
            {submitResult.isTouchUp ? 'Touch-Up Request Submitted!' : 'Rebooking Request Submitted!'}
          </h1>
          <p className="text-ink-400 mb-6">
            {submitResult.isTouchUp
              ? "We've received your touch-up request. The studio will review and get back to you soon."
              : "We've received your new booking request. The studio will review and get back to you soon."}
          </p>
          <p className="text-sm text-ink-500 mb-6">
            Reference: <code className="bg-ink-700 px-2 py-1 rounded">{submitResult.requestId.slice(0, 8)}</code>
          </p>
          <div className="flex flex-col gap-3">
            <Link
              to="/client/bookings"
              className="w-full py-2 px-4 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90 transition-colors"
            >
              View All Bookings
            </Link>
            <Link
              to="/client"
              className="w-full py-2 px-4 border border-ink-600 text-ink-300 rounded-lg hover:bg-ink-700 transition-colors"
            >
              Back to Portal
            </Link>
          </div>
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
              <Link
                to="/client/bookings"
                className="px-4 py-2 text-sm text-ink-300 hover:text-ink-100 transition-colors"
              >
                Back to Bookings
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-ink-100">
            {isTouchUpMode ? 'Request a Touch-Up' : 'Book a New Tattoo'}
          </h1>
          <p className="text-ink-400 mt-1">
            {isTouchUpMode
              ? 'Schedule a touch-up session for your previous tattoo'
              : 'Book a new tattoo with the same studio'}
          </p>
        </div>

        {/* Original booking info */}
        {rebookingData && (
          <div className="bg-ink-800 rounded-xl border border-ink-700 p-6 mb-6">
            <h2 className="text-sm font-medium text-ink-400 mb-3">Original Appointment</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-ink-400">Studio</span>
                <span className="text-ink-100">{rebookingData.studio_name}</span>
              </div>
              {rebookingData.original_artist && (
                <div className="flex justify-between">
                  <span className="text-ink-400">Artist</span>
                  <span className="text-ink-100">{rebookingData.original_artist.name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-ink-400">Design</span>
                <span className="text-ink-100 text-right max-w-[60%] truncate">
                  {rebookingData.original_design_idea}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-400">Placement</span>
                <span className="text-ink-100">{rebookingData.original_placement}</span>
              </div>
              {rebookingData.original_scheduled_date && (
                <div className="flex justify-between">
                  <span className="text-ink-400">Date</span>
                  <span className="text-ink-100">
                    {formatDate(rebookingData.original_scheduled_date)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mode toggle */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={handleSwitchToTouchUp}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
              isTouchUpMode
                ? 'bg-accent-primary text-white'
                : 'bg-ink-800 text-ink-400 border border-ink-600 hover:bg-ink-700'
            }`}
          >
            Touch-Up
          </button>
          <button
            type="button"
            onClick={handleSwitchToNewTattoo}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
              !isTouchUpMode
                ? 'bg-accent-primary text-white'
                : 'bg-ink-800 text-ink-400 border border-ink-600 hover:bg-ink-700'
            }`}
          >
            New Tattoo
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tattoo Details */}
          <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Tattoo Details</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1">
                  {isTouchUpMode ? 'Design (pre-filled from original)' : 'Design Idea'}{' '}
                  <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={formData.design_idea}
                  onChange={(e) => updateField('design_idea', e.target.value)}
                  rows={4}
                  className={`w-full px-4 py-2 bg-ink-700 border ${
                    validationErrors.design_idea ? 'border-red-500' : 'border-ink-600'
                  } rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent-primary resize-none`}
                  placeholder={
                    isTouchUpMode
                      ? 'Describe what needs to be touched up...'
                      : 'Describe your new tattoo idea...'
                  }
                />
                {validationErrors.design_idea && (
                  <p className="text-red-400 text-sm mt-1">{validationErrors.design_idea}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink-300 mb-1">
                    Placement <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.placement}
                    onChange={(e) => updateField('placement', e.target.value)}
                    className={`w-full px-4 py-2 bg-ink-700 border ${
                      validationErrors.placement ? 'border-red-500' : 'border-ink-600'
                    } rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent-primary`}
                    placeholder="e.g., Inner forearm"
                  />
                  {validationErrors.placement && (
                    <p className="text-red-400 text-sm mt-1">{validationErrors.placement}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-300 mb-1">Size</label>
                  <select
                    value={formData.size}
                    onChange={(e) => updateField('size', e.target.value)}
                    className="w-full px-4 py-2 bg-ink-700 border border-ink-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent-primary"
                  >
                    {TATTOO_SIZES.map((size) => (
                      <option key={size.value} value={size.value}>
                        {size.label} ({size.description})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink-300 mb-1">
                    Color Preference
                  </label>
                  <select
                    value={formData.color_preference}
                    onChange={(e) => updateField('color_preference', e.target.value)}
                    className="w-full px-4 py-2 bg-ink-700 border border-ink-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent-primary"
                  >
                    <option value="">Select...</option>
                    {COLOR_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-300 mb-1">
                    Budget Range
                  </label>
                  <select
                    value={formData.budget_range}
                    onChange={(e) => updateField('budget_range', e.target.value)}
                    className="w-full px-4 py-2 bg-ink-700 border border-ink-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent-primary"
                  >
                    <option value="">Select...</option>
                    {BUDGET_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!isTouchUpMode && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_cover_up}
                    onChange={(e) => updateField('is_cover_up', e.target.checked)}
                    className="w-5 h-5 rounded border-ink-600 bg-ink-700 text-accent-primary focus:ring-accent-primary focus:ring-offset-ink-800"
                  />
                  <span className="text-ink-300">This is a cover-up</span>
                </label>
              )}
            </div>
          </div>

          {/* Preferences */}
          <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Preferences</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1">
                  Preferred Artist
                </label>
                <select
                  value={formData.preferred_artist_id}
                  onChange={(e) => updateField('preferred_artist_id', e.target.value)}
                  className="w-full px-4 py-2 bg-ink-700 border border-ink-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent-primary"
                >
                  <option value="">No preference</option>
                  {rebookingData?.available_artists.map((artist) => (
                    <option key={artist.id} value={artist.id}>
                      {artist.name}
                      {artist.id === rebookingData.original_artist?.id && ' (Previous)'}
                      {artist.specialties.length > 0 &&
                        ` - ${artist.specialties.slice(0, 2).join(', ')}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1">
                  Preferred Dates <span className="text-ink-500">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.preferred_dates}
                  onChange={(e) => updateField('preferred_dates', e.target.value)}
                  className="w-full px-4 py-2 bg-ink-700 border border-ink-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent-primary"
                  placeholder="e.g., Weekends only, After 3pm, Anytime in March"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1">
                  Additional Notes <span className="text-ink-500">(optional)</span>
                </label>
                <textarea
                  value={formData.additional_notes}
                  onChange={(e) => updateField('additional_notes', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-ink-700 border border-ink-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent-primary resize-none"
                  placeholder={
                    isTouchUpMode
                      ? 'Any specific areas that need attention?'
                      : 'Anything else we should know?'
                  }
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 bg-accent-primary hover:bg-accent-primary/90 disabled:bg-ink-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
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
                Submitting...
              </>
            ) : isTouchUpMode ? (
              'Request Touch-Up'
            ) : (
              'Submit Booking Request'
            )}
          </button>

          <p className="text-center text-sm text-ink-500">
            By submitting, you agree to be contacted about your{' '}
            {isTouchUpMode ? 'touch-up' : 'tattoo'} request.
          </p>
        </form>
      </main>
    </div>
  );
}

export default ClientRebooking;
