/**
 * Public booking request form for clients.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  getStudioArtists,
  submitBookingRequest,
  uploadReferenceImage,
} from '../services/bookings';
import type {
  ArtistOption,
  BookingRequestCreate,
  TattooSize,
  ReferenceImage,
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
  client_name: string;
  client_email: string;
  client_phone: string;
  design_idea: string;
  placement: string;
  size: TattooSize;
  is_cover_up: boolean;
  is_first_tattoo: boolean;
  color_preference: string;
  budget_range: string;
  additional_notes: string;
  preferred_artist_id: string;
  preferred_dates: string;
}

interface UploadedImage {
  file: File;
  preview: string;
  uploading?: boolean;
  uploaded?: ReferenceImage;
  error?: string;
}

export function BookingForm() {
  const { studioSlug } = useParams<{ studioSlug: string }>();
  const [artists, setArtists] = useState<ArtistOption[]>([]);
  const [loadingArtists, setLoadingArtists] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<UploadedImage[]>([]);

  const [formData, setFormData] = useState<FormData>({
    client_name: '',
    client_email: '',
    client_phone: '',
    design_idea: '',
    placement: '',
    size: 'medium',
    is_cover_up: false,
    is_first_tattoo: false,
    color_preference: '',
    budget_range: '',
    additional_notes: '',
    preferred_artist_id: '',
    preferred_dates: '',
  });

  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  // Fetch artists for the studio
  useEffect(() => {
    if (!studioSlug) return;

    const slug = studioSlug; // Capture for closure
    async function loadArtists() {
      try {
        const data = await getStudioArtists(slug);
        setArtists(data);
      } catch (err) {
        console.error('Failed to load artists:', err);
      } finally {
        setLoadingArtists(false);
      }
    }

    loadArtists();
  }, [studioSlug]);

  const updateField = useCallback((field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear validation error when field is updated
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }, [validationErrors]);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: UploadedImage[] = [];
    const maxImages = 5 - images.length;

    for (let i = 0; i < Math.min(files.length, maxImages); i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 10 * 1024 * 1024) continue; // 10MB max

      newImages.push({
        file,
        preview: URL.createObjectURL(file),
      });
    }

    setImages((prev) => [...prev, ...newImages]);
    e.target.value = ''; // Reset input
  }, [images.length]);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].preview);
      newImages.splice(index, 1);
      return newImages;
    });
  }, []);

  const validate = useCallback((): boolean => {
    const errors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.client_name.trim()) {
      errors.client_name = 'Name is required';
    }

    if (!formData.client_email.trim()) {
      errors.client_email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.client_email)) {
      errors.client_email = 'Please enter a valid email';
    }

    if (!formData.design_idea.trim()) {
      errors.design_idea = 'Please describe your design idea';
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

    if (!validate() || !studioSlug) return;

    setSubmitting(true);
    setError(null);

    try {
      const requestData: BookingRequestCreate = {
        client_name: formData.client_name.trim(),
        client_email: formData.client_email.trim(),
        client_phone: formData.client_phone.trim() || null,
        design_idea: formData.design_idea.trim(),
        placement: formData.placement.trim(),
        size: formData.size,
        is_cover_up: formData.is_cover_up,
        is_first_tattoo: formData.is_first_tattoo,
        color_preference: formData.color_preference || null,
        budget_range: formData.budget_range || null,
        additional_notes: formData.additional_notes.trim() || null,
        preferred_artist_id: formData.preferred_artist_id || null,
        preferred_dates: formData.preferred_dates.trim() || null,
      };

      const result = await submitBookingRequest(studioSlug, requestData);
      setRequestId(result.request_id);

      // Upload images if any
      if (images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          setImages((prev) => {
            const updated = [...prev];
            updated[i] = { ...updated[i], uploading: true };
            return updated;
          });

          try {
            const uploaded = await uploadReferenceImage(result.request_id, images[i].file);
            setImages((prev) => {
              const updated = [...prev];
              updated[i] = { ...updated[i], uploading: false, uploaded };
              return updated;
            });
          } catch (uploadErr) {
            setImages((prev) => {
              const updated = [...prev];
              updated[i] = {
                ...updated[i],
                uploading: false,
                error: uploadErr instanceof Error ? uploadErr.message : 'Upload failed',
              };
              return updated;
            });
          }
        }
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  if (!studioSlug) {
    return (
      <div className="min-h-screen bg-ink-950 flex items-center justify-center p-4">
        <div className="bg-ink-900 rounded-xl p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Studio Not Found</h1>
          <p className="text-ink-400">Please use a valid booking link from your tattoo studio.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-ink-950 flex items-center justify-center p-4">
        <div className="bg-ink-900 rounded-xl p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Request Submitted!</h1>
          <p className="text-ink-400 mb-6">
            Thank you for your booking request. We'll review your submission and get back to you soon at{' '}
            <span className="text-accent-400">{formData.client_email}</span>.
          </p>
          <p className="text-sm text-ink-500">
            Reference: <code className="bg-ink-800 px-2 py-1 rounded">{requestId}</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-950 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Request a Tattoo</h1>
          <p className="text-ink-400">
            Fill out the form below to request a consultation. We'll review your idea and get back to you with availability and pricing.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Contact Information */}
          <div className="bg-ink-900 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Contact Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1">
                  Your Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={(e) => updateField('client_name', e.target.value)}
                  className={`w-full px-4 py-2 bg-ink-800 border ${
                    validationErrors.client_name ? 'border-red-500' : 'border-ink-700'
                  } rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent-500`}
                  placeholder="John Doe"
                />
                {validationErrors.client_name && (
                  <p className="text-red-400 text-sm mt-1">{validationErrors.client_name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1">
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={formData.client_email}
                  onChange={(e) => updateField('client_email', e.target.value)}
                  className={`w-full px-4 py-2 bg-ink-800 border ${
                    validationErrors.client_email ? 'border-red-500' : 'border-ink-700'
                  } rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent-500`}
                  placeholder="john@example.com"
                />
                {validationErrors.client_email && (
                  <p className="text-red-400 text-sm mt-1">{validationErrors.client_email}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-ink-300 mb-1">
                  Phone Number <span className="text-ink-500">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={formData.client_phone}
                  onChange={(e) => updateField('client_phone', e.target.value)}
                  className="w-full px-4 py-2 bg-ink-800 border border-ink-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
          </div>

          {/* Tattoo Details */}
          <div className="bg-ink-900 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Tattoo Details</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1">
                  Design Idea <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={formData.design_idea}
                  onChange={(e) => updateField('design_idea', e.target.value)}
                  rows={4}
                  className={`w-full px-4 py-2 bg-ink-800 border ${
                    validationErrors.design_idea ? 'border-red-500' : 'border-ink-700'
                  } rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent-500 resize-none`}
                  placeholder="Describe your tattoo idea in detail. Include style preferences (traditional, realism, watercolor, etc.), specific elements, and any meaningful symbolism..."
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
                    className={`w-full px-4 py-2 bg-ink-800 border ${
                      validationErrors.placement ? 'border-red-500' : 'border-ink-700'
                    } rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent-500`}
                    placeholder="e.g., Inner forearm, Upper back"
                  />
                  {validationErrors.placement && (
                    <p className="text-red-400 text-sm mt-1">{validationErrors.placement}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-300 mb-1">
                    Size <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={formData.size}
                    onChange={(e) => updateField('size', e.target.value)}
                    className="w-full px-4 py-2 bg-ink-800 border border-ink-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
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
                    className="w-full px-4 py-2 bg-ink-800 border border-ink-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
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
                    className="w-full px-4 py-2 bg-ink-800 border border-ink-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
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

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_cover_up}
                    onChange={(e) => updateField('is_cover_up', e.target.checked)}
                    className="w-5 h-5 rounded border-ink-700 bg-ink-800 text-accent-500 focus:ring-accent-500 focus:ring-offset-ink-900"
                  />
                  <span className="text-ink-300">This is a cover-up</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_first_tattoo}
                    onChange={(e) => updateField('is_first_tattoo', e.target.checked)}
                    className="w-5 h-5 rounded border-ink-700 bg-ink-800 text-accent-500 focus:ring-accent-500 focus:ring-offset-ink-900"
                  />
                  <span className="text-ink-300">This is my first tattoo</span>
                </label>
              </div>
            </div>
          </div>

          {/* Reference Images */}
          <div className="bg-ink-900 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Reference Images</h2>
            <p className="text-sm text-ink-400 mb-4">
              Upload up to 5 reference images to help us understand your vision.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {images.map((img, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-ink-800">
                  <img
                    src={img.preview}
                    alt={`Reference ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {img.uploading && (
                    <div className="absolute inset-0 bg-ink-900/80 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-accent-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {img.error && (
                    <div className="absolute inset-0 bg-red-900/80 flex items-center justify-center p-2">
                      <span className="text-xs text-white text-center">{img.error}</span>
                    </div>
                  )}
                  {img.uploaded && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  {!submitting && (
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 left-1 w-6 h-6 bg-ink-900/80 rounded-full flex items-center justify-center text-white hover:bg-red-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}

              {images.length < 5 && (
                <label className="aspect-square rounded-lg border-2 border-dashed border-ink-700 hover:border-accent-500 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2">
                  <svg className="w-8 h-8 text-ink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-xs text-ink-500">Add Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                    multiple
                  />
                </label>
              )}
            </div>
          </div>

          {/* Preferences */}
          <div className="bg-ink-900 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Preferences</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1">
                  Preferred Artist <span className="text-ink-500">(optional)</span>
                </label>
                {loadingArtists ? (
                  <div className="w-full px-4 py-2 bg-ink-800 border border-ink-700 rounded-lg text-ink-500 flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-ink-500 border-t-transparent rounded-full animate-spin" />
                    Loading artists...
                  </div>
                ) : (
                  <select
                    value={formData.preferred_artist_id}
                    onChange={(e) => updateField('preferred_artist_id', e.target.value)}
                    className="w-full px-4 py-2 bg-ink-800 border border-ink-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
                  >
                    <option value="">No preference</option>
                    {artists.map((artist) => (
                      <option key={artist.id} value={artist.id}>
                        {artist.name}
                        {artist.specialties.length > 0 && ` - ${artist.specialties.slice(0, 2).join(', ')}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1">
                  Preferred Dates <span className="text-ink-500">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.preferred_dates}
                  onChange={(e) => updateField('preferred_dates', e.target.value)}
                  className="w-full px-4 py-2 bg-ink-800 border border-ink-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
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
                  className="w-full px-4 py-2 bg-ink-800 border border-ink-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent-500 resize-none"
                  placeholder="Anything else we should know?"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 bg-accent-500 hover:bg-accent-600 disabled:bg-ink-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Booking Request'
            )}
          </button>

          <p className="text-center text-sm text-ink-500">
            By submitting, you agree to be contacted about your tattoo request.
          </p>
        </form>
      </div>
    </div>
  );
}
