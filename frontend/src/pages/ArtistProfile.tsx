/**
 * Artist Profile page for managing bio, specialties, and portfolio gallery.
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  getMyProfile,
  updateMyProfile,
  uploadPortfolioImage,
  deletePortfolioImage,
  updatePortfolioImage,
} from '../services/artists';
import type { ArtistDetail, ArtistProfileUpdate, PortfolioImage } from '../types/api';

// Common tattoo styles
const TATTOO_STYLES = [
  'Traditional',
  'Neo-Traditional',
  'Realism',
  'Blackwork',
  'Geometric',
  'Watercolor',
  'Japanese',
  'Tribal',
  'Minimalist',
  'Dotwork',
  'Lettering',
  'New School',
  'Trash Polka',
  'Biomechanical',
  'Portrait',
];

// Common placements
const PLACEMENTS = [
  'Arm',
  'Forearm',
  'Upper Arm',
  'Sleeve',
  'Back',
  'Chest',
  'Leg',
  'Thigh',
  'Calf',
  'Hand',
  'Finger',
  'Neck',
  'Shoulder',
  'Ribs',
  'Foot',
  'Ankle',
];

export function ArtistProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ArtistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [bio, setBio] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [yearsExperience, setYearsExperience] = useState<number | ''>('');
  const [hourlyRate, setHourlyRate] = useState<number | ''>('');
  const [minimumBookingHours, setMinimumBookingHours] = useState<number | ''>('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');

  // Portfolio state
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<PortfolioImage | null>(null);
  const [editingImage, setEditingImage] = useState(false);
  const [imageTitle, setImageTitle] = useState('');
  const [imageDescription, setImageDescription] = useState('');
  const [imageStyle, setImageStyle] = useState('');
  const [imagePlacement, setImagePlacement] = useState('');

  // Check if user is an artist or owner
  const canEdit = user?.role === 'artist' || user?.role === 'owner';

  const loadProfile = useCallback(async () => {
    if (!canEdit) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getMyProfile();
      setProfile(data);

      // Populate form
      setBio(data.bio || '');
      setSpecialties(data.specialties || []);
      setYearsExperience(data.years_experience ?? '');
      setHourlyRate(data.hourly_rate ? data.hourly_rate / 100 : '');
      setMinimumBookingHours(data.minimum_booking_hours ?? '');
      setInstagramHandle(data.instagram_handle || '');
      setWebsiteUrl(data.website_url || '');
    } catch (err) {
      // Profile might not exist yet, that's ok
      const errMsg = err instanceof Error ? err.message : '';
      if (errMsg.includes('404') || errMsg.includes('Not Found') || errMsg.includes('not found')) {
        setProfile(null);
      } else {
        setError(errMsg || 'Failed to load profile');
      }
    } finally {
      setLoading(false);
    }
  }, [canEdit]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const updateData: ArtistProfileUpdate = {
        bio: bio || null,
        specialties,
        years_experience: yearsExperience === '' ? null : Number(yearsExperience),
        hourly_rate: hourlyRate === '' ? null : Math.round(Number(hourlyRate) * 100),
        minimum_booking_hours: minimumBookingHours === '' ? null : Number(minimumBookingHours),
        instagram_handle: instagramHandle || null,
        website_url: websiteUrl || null,
      };

      const updated = await updateMyProfile(updateData);
      setProfile(updated);
      setSuccess('Profile saved successfully');

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSpecialty = () => {
    if (newSpecialty.trim() && !specialties.includes(newSpecialty.trim())) {
      setSpecialties([...specialties, newSpecialty.trim()]);
      setNewSpecialty('');
    }
  };

  const handleRemoveSpecialty = (specialty: string) => {
    setSpecialties(specialties.filter((s) => s !== specialty));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      setError(null);

      const newImage = await uploadPortfolioImage(file);

      // Add to portfolio
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              portfolio_images: [...prev.portfolio_images, newImage],
            }
          : null
      );

      setSuccess('Image uploaded successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploadingImage(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return;

    try {
      setError(null);
      await deletePortfolioImage(imageId);

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              portfolio_images: prev.portfolio_images.filter((img) => img.id !== imageId),
            }
          : null
      );

      setSelectedImage(null);
      setSuccess('Image deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete image');
    }
  };

  const handleEditImage = (image: PortfolioImage) => {
    setSelectedImage(image);
    setImageTitle(image.title || '');
    setImageDescription(image.description || '');
    setImageStyle(image.style || '');
    setImagePlacement(image.placement || '');
    setEditingImage(true);
  };

  const handleSaveImageEdit = async () => {
    if (!selectedImage) return;

    try {
      setError(null);
      const updated = await updatePortfolioImage(selectedImage.id, {
        title: imageTitle || null,
        description: imageDescription || null,
        style: imageStyle || null,
        placement: imagePlacement || null,
      });

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              portfolio_images: prev.portfolio_images.map((img) =>
                img.id === updated.id ? updated : img
              ),
            }
          : null
      );

      setEditingImage(false);
      setSelectedImage(null);
      setSuccess('Image updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update image');
    }
  };

  if (!canEdit) {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500 rounded-lg p-4">
          <h2 className="text-red-400 font-semibold">Access Denied</h2>
          <p className="text-ink-400 mt-1">
            Only artists and studio owners can access this page.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-ink-700 rounded w-1/4" />
          <div className="h-32 bg-ink-700 rounded" />
          <div className="h-64 bg-ink-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-ink-100 mb-6">Artist Profile</h1>

      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-500/10 border border-green-500 rounded-lg p-4">
          <p className="text-green-400">{success}</p>
        </div>
      )}

      {/* Profile Form */}
      <form onSubmit={handleSaveProfile} className="space-y-8">
        {/* Bio Section */}
        <section className="bg-ink-800 rounded-lg border border-ink-700 p-6">
          <h2 className="text-lg font-semibold text-ink-100 mb-4">About You</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent resize-none"
                placeholder="Tell clients about yourself, your style, and your approach to tattooing..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1">
                  Years of Experience
                </label>
                <input
                  type="number"
                  value={yearsExperience}
                  onChange={(e) =>
                    setYearsExperience(e.target.value === '' ? '' : parseInt(e.target.value))
                  }
                  min={0}
                  max={100}
                  className="w-full px-4 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                  placeholder="5"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1">
                  Hourly Rate ($)
                </label>
                <input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) =>
                    setHourlyRate(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  min={0}
                  step={0.01}
                  className="w-full px-4 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                  placeholder="150"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1">
                  Min Booking (hours)
                </label>
                <input
                  type="number"
                  value={minimumBookingHours}
                  onChange={(e) =>
                    setMinimumBookingHours(e.target.value === '' ? '' : parseInt(e.target.value))
                  }
                  min={1}
                  max={24}
                  className="w-full px-4 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                  placeholder="2"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Specialties Section */}
        <section className="bg-ink-800 rounded-lg border border-ink-700 p-6">
          <h2 className="text-lg font-semibold text-ink-100 mb-4">Specialties</h2>

          <div className="flex flex-wrap gap-2 mb-4">
            {specialties.map((specialty) => (
              <span
                key={specialty}
                className="inline-flex items-center gap-1 px-3 py-1 bg-accent-500/20 text-accent-400 rounded-full text-sm"
              >
                {specialty}
                <button
                  type="button"
                  onClick={() => handleRemoveSpecialty(specialty)}
                  className="ml-1 hover:text-red-400"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <select
              value={newSpecialty}
              onChange={(e) => setNewSpecialty(e.target.value)}
              className="flex-1 px-4 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
            >
              <option value="">Select a style...</option>
              {TATTOO_STYLES.filter((s) => !specialties.includes(s)).map((style) => (
                <option key={style} value={style}>
                  {style}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddSpecialty}
              disabled={!newSpecialty}
              className="px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
          </div>
        </section>

        {/* Social Links Section */}
        <section className="bg-ink-800 rounded-lg border border-ink-700 p-6">
          <h2 className="text-lg font-semibold text-ink-100 mb-4">Social Links</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1">
                Instagram Handle
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 bg-ink-700 border border-r-0 border-ink-600 rounded-l-lg text-ink-400">
                  @
                </span>
                <input
                  type="text"
                  value={instagramHandle}
                  onChange={(e) => setInstagramHandle(e.target.value.replace('@', ''))}
                  className="flex-1 px-4 py-2 bg-ink-900 border border-ink-600 rounded-r-lg text-ink-100 placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                  placeholder="yourusername"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1">Website</label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="w-full px-4 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                placeholder="https://yourwebsite.com"
              />
            </div>
          </div>
        </section>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Saving...
              </>
            ) : (
              'Save Profile'
            )}
          </button>
        </div>
      </form>

      {/* Portfolio Section */}
      <section className="mt-8 bg-ink-800 rounded-lg border border-ink-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink-100">Portfolio Gallery</h2>

          <label className="px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 cursor-pointer transition-colors flex items-center gap-2">
            {uploadingImage ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Uploading...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Upload Image
              </>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleImageUpload}
              disabled={uploadingImage}
              className="hidden"
            />
          </label>
        </div>

        <p className="text-ink-400 text-sm mb-4">
          Upload photos of your work. Max 10MB per image. Supported formats: JPG, PNG, GIF, WebP.
        </p>

        {profile?.portfolio_images.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-ink-600 rounded-lg">
            <svg
              className="mx-auto h-12 w-12 text-ink-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="mt-4 text-ink-400">No portfolio images yet</p>
            <p className="text-ink-500 text-sm">Upload your first image to showcase your work</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {profile?.portfolio_images.map((image) => (
              <div
                key={image.id}
                className="relative group aspect-square bg-ink-900 rounded-lg overflow-hidden"
              >
                <img
                  src={`http://localhost:8000${image.image_url}`}
                  alt={image.title || 'Portfolio image'}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEditImage(image)}
                    className="p-2 bg-ink-700 rounded-lg hover:bg-ink-600 transition-colors"
                    title="Edit"
                  >
                    <svg className="w-5 h-5 text-ink-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteImage(image.id)}
                    className="p-2 bg-red-600 rounded-lg hover:bg-red-500 transition-colors"
                    title="Delete"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
                {image.style && (
                  <span className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 text-xs text-ink-200 rounded">
                    {image.style}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Image Edit Modal */}
      {editingImage && selectedImage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-ink-800 rounded-lg border border-ink-700 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-ink-100">Edit Image Details</h3>
              <button
                onClick={() => {
                  setEditingImage(false);
                  setSelectedImage(null);
                }}
                className="text-ink-400 hover:text-ink-200"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1">Title</label>
                <input
                  type="text"
                  value={imageTitle}
                  onChange={(e) => setImageTitle(e.target.value)}
                  className="w-full px-4 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                  placeholder="e.g., Dragon Sleeve"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1">Description</label>
                <textarea
                  value={imageDescription}
                  onChange={(e) => setImageDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent resize-none"
                  placeholder="Describe this piece..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1">Style</label>
                <select
                  value={imageStyle}
                  onChange={(e) => setImageStyle(e.target.value)}
                  className="w-full px-4 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                >
                  <option value="">Select style...</option>
                  {TATTOO_STYLES.map((style) => (
                    <option key={style} value={style}>
                      {style}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1">Placement</label>
                <select
                  value={imagePlacement}
                  onChange={(e) => setImagePlacement(e.target.value)}
                  className="w-full px-4 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                >
                  <option value="">Select placement...</option>
                  {PLACEMENTS.map((placement) => (
                    <option key={placement} value={placement}>
                      {placement}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setEditingImage(false);
                    setSelectedImage(null);
                  }}
                  className="px-4 py-2 text-ink-300 hover:text-ink-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveImageEdit}
                  className="px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
