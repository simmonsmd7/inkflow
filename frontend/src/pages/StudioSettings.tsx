/**
 * Studio Settings page - manage studio profile (owner only).
 */

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  getStudios,
  createStudio,
  updateStudio,
  uploadLogo,
  deleteLogo,
} from '../services/studios';
import type { Studio, StudioCreate, StudioUpdate, BusinessHours, BusinessHoursDay } from '../types/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
type DayKey = typeof DAYS[number];

const DEFAULT_HOURS: BusinessHoursDay = {
  open: '10:00',
  close: '18:00',
  closed: false,
};

const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  monday: { ...DEFAULT_HOURS },
  tuesday: { ...DEFAULT_HOURS },
  wednesday: { ...DEFAULT_HOURS },
  thursday: { ...DEFAULT_HOURS },
  friday: { ...DEFAULT_HOURS },
  saturday: { open: '11:00', close: '17:00', closed: false },
  sunday: { open: null, close: null, closed: true },
};

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
];

function TimeSelect({ value, onChange, disabled }: {
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const times: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      times.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="px-2 py-1.5 bg-ink-900 border border-ink-600 rounded text-sm text-ink-100 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {times.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}

export function StudioSettings() {
  const { user } = useAuth();
  const [studio, setStudio] = useState<Studio | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Form state
  const [formData, setFormData] = useState<StudioCreate>({
    name: '',
    description: '',
    email: '',
    phone: '',
    website: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'US',
    timezone: 'America/New_York',
    business_hours: DEFAULT_BUSINESS_HOURS,
  });

  useEffect(() => {
    loadStudio();
  }, []);

  const loadStudio = async () => {
    try {
      const response = await getStudios();
      if (response.studios.length > 0) {
        const existingStudio = response.studios[0];
        setStudio(existingStudio);
        setFormData({
          name: existingStudio.name,
          description: existingStudio.description || '',
          email: existingStudio.email || '',
          phone: existingStudio.phone || '',
          website: existingStudio.website || '',
          address_line1: existingStudio.address_line1 || '',
          address_line2: existingStudio.address_line2 || '',
          city: existingStudio.city || '',
          state: existingStudio.state || '',
          postal_code: existingStudio.postal_code || '',
          country: existingStudio.country || 'US',
          timezone: existingStudio.timezone || 'America/New_York',
          business_hours: existingStudio.business_hours || DEFAULT_BUSINESS_HOURS,
        });
        setIsCreating(false);
      } else {
        setIsCreating(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load studio');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      if (isCreating) {
        const newStudio = await createStudio(formData);
        setStudio(newStudio);
        setIsCreating(false);
        setSuccessMessage('Studio created successfully!');
      } else if (studio) {
        const updateData: StudioUpdate = { ...formData };
        const updatedStudio = await updateStudio(studio.id, updateData);
        setStudio(updatedStudio);
        setSuccessMessage('Studio settings saved!');
      }
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save studio');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !studio) return;

    setUploadingLogo(true);
    setError('');

    try {
      const response = await uploadLogo(studio.id, file);
      setStudio({ ...studio, logo_url: response.logo_url });
      setSuccessMessage('Logo uploaded successfully!');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleLogoDelete = async () => {
    if (!studio || !studio.logo_url) return;
    if (!confirm('Are you sure you want to delete the studio logo?')) return;

    try {
      await deleteLogo(studio.id);
      setStudio({ ...studio, logo_url: null });
      setSuccessMessage('Logo deleted successfully!');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete logo');
    }
  };

  const updateBusinessHours = (day: DayKey, field: keyof BusinessHoursDay, value: string | boolean) => {
    const currentHours = formData.business_hours || DEFAULT_BUSINESS_HOURS;
    setFormData({
      ...formData,
      business_hours: {
        ...currentHours,
        [day]: {
          ...currentHours[day],
          [field]: value,
        },
      },
    });
  };

  // Only owners can access this page
  if (user?.role !== 'owner') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <svg className="w-16 h-16 text-ink-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="text-xl font-semibold text-ink-200">Access Denied</h2>
          <p className="text-ink-400 mt-1">Only studio owners can manage studio settings.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink-100">
          {isCreating ? 'Create Your Studio' : 'Studio Settings'}
        </h1>
        <p className="text-ink-400 mt-1">
          {isCreating
            ? 'Set up your studio profile to get started.'
            : 'Manage your studio profile, contact info, and business hours.'}
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Logo Section (only show for existing studios) */}
        {!isCreating && studio && (
          <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
            <h2 className="text-lg font-semibold text-ink-100 mb-4">Studio Logo</h2>
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-xl bg-ink-700 flex items-center justify-center overflow-hidden border-2 border-dashed border-ink-600">
                {studio.logo_url ? (
                  <img
                    src={`${API_URL}${studio.logo_url}`}
                    alt="Studio logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg className="w-10 h-10 text-ink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm text-ink-300 mb-3">
                  Upload a logo for your studio. Recommended size: 200x200 pixels.
                </p>
                <div className="flex gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleLogoUpload}
                    className="hidden"
                    id="logo-upload"
                  />
                  <label
                    htmlFor="logo-upload"
                    className={`px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-lg transition-colors cursor-pointer ${uploadingLogo ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    {uploadingLogo ? 'Uploading...' : studio.logo_url ? 'Change Logo' : 'Upload Logo'}
                  </label>
                  {studio.logo_url && (
                    <button
                      type="button"
                      onClick={handleLogoDelete}
                      className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Basic Info */}
        <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
          <h2 className="text-lg font-semibold text-ink-100 mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1.5">
                Studio Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
                placeholder="Ink Masters Studio"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1.5">Description</label>
              <textarea
                rows={3}
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all resize-none"
                placeholder="A brief description of your studio..."
              />
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
          <h2 className="text-lg font-semibold text-ink-100 mb-4">Contact Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1.5">Email</label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
                placeholder="contact@studio.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1.5">Phone</label>
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
                placeholder="(555) 123-4567"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-ink-300 mb-1.5">Website</label>
              <input
                type="url"
                value={formData.website || ''}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
                placeholder="https://www.yourstudio.com"
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
          <h2 className="text-lg font-semibold text-ink-100 mb-4">Address</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1.5">Address Line 1</label>
              <input
                type="text"
                value={formData.address_line1 || ''}
                onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
                placeholder="123 Main Street"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1.5">Address Line 2</label>
              <input
                type="text"
                value={formData.address_line2 || ''}
                onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
                placeholder="Suite 100"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-ink-300 mb-1.5">City</label>
                <input
                  type="text"
                  value={formData.city || ''}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
                  placeholder="New York"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1.5">State</label>
                <input
                  type="text"
                  value={formData.state || ''}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
                  placeholder="NY"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1.5">ZIP Code</label>
                <input
                  type="text"
                  value={formData.postal_code || ''}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
                  placeholder="10001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1.5">Country</label>
                <select
                  value={formData.country || 'US'}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
                >
                  <option value="US">USA</option>
                  <option value="CA">Canada</option>
                  <option value="GB">UK</option>
                  <option value="AU">Australia</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Business Hours */}
        <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-ink-100">Business Hours</h2>
            <select
              value={formData.timezone || 'America/New_York'}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              className="px-3 py-1.5 bg-ink-900 border border-ink-600 rounded-lg text-sm text-ink-100 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {DAYS.map((day) => {
              const hours = formData.business_hours?.[day] || DEFAULT_HOURS;
              return (
                <div key={day} className="flex items-center gap-4">
                  <div className="w-28">
                    <span className="text-sm font-medium text-ink-200 capitalize">{day}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hours.closed}
                        onChange={(e) => updateBusinessHours(day, 'closed', e.target.checked)}
                        className="rounded border-ink-600 bg-ink-900 text-accent-primary focus:ring-accent-primary"
                      />
                      <span className="text-sm text-ink-400">Closed</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <TimeSelect
                      value={hours.open}
                      onChange={(v) => updateBusinessHours(day, 'open', v)}
                      disabled={hours.closed}
                    />
                    <span className="text-ink-500">to</span>
                    <TimeSelect
                      value={hours.close}
                      onChange={(v) => updateBusinessHours(day, 'close', v)}
                      disabled={hours.closed}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-accent-primary hover:bg-accent-primary/90 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving && (
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
            )}
            {isCreating ? 'Create Studio' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default StudioSettings;
