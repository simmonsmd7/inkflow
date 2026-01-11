/**
 * Onboarding page for new users to set up their business.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/auth';

interface FormData {
  business_name: string;
  business_email: string;
}

interface FormErrors {
  business_name?: string;
  business_email?: string;
  general?: string;
}

export function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formData, setFormData] = useState<FormData>({
    business_name: '',
    business_email: '',
  });

  // Pre-fill email from user account
  useEffect(() => {
    if (user?.email) {
      setFormData((prev) => ({ ...prev, business_email: user.email }));
    }
  }, [user]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.business_name.trim()) {
      newErrors.business_name = 'Business name is required';
    } else if (formData.business_name.trim().length < 2) {
      newErrors.business_name = 'Business name must be at least 2 characters';
    }

    if (!formData.business_email.trim()) {
      newErrors.business_email = 'Business email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.business_email)) {
      newErrors.business_email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      await authService.createBusiness(formData.business_name, formData.business_email);
      // Navigate to dashboard with success message
      navigate('/dashboard', {
        state: { message: 'Your business has been created successfully!' }
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create business. Please try again.';
      setErrors({ general: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo and heading */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-accent-primary to-accent-secondary rounded-xl flex items-center justify-center">
              <span className="text-xl font-bold text-white">IF</span>
            </div>
            <span className="text-2xl font-bold text-ink-100">InkFlow</span>
          </div>
          <h1 className="text-xl font-semibold text-ink-100">Set up your business</h1>
          <p className="text-ink-400 mt-1">
            Let's get your studio up and running
          </p>
        </div>

        {/* Onboarding form */}
        <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* General error */}
            {errors.general && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">{errors.general}</p>
              </div>
            )}

            {/* Welcome message */}
            <div className="p-4 bg-accent-primary/10 border border-accent-primary/20 rounded-lg">
              <p className="text-sm text-ink-200">
                Welcome, <span className="font-medium text-ink-100">{user?.first_name}</span>!
                Create your studio to start accepting bookings.
              </p>
            </div>

            {/* Business name */}
            <div>
              <label
                htmlFor="business_name"
                className="block text-sm font-medium text-ink-200 mb-1.5"
              >
                Business name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                id="business_name"
                name="business_name"
                value={formData.business_name}
                onChange={handleChange}
                className={`
                  w-full px-4 py-2.5 bg-ink-700 border rounded-lg text-ink-100
                  placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-primary/50
                  transition-colors
                  ${errors.business_name ? 'border-red-500' : 'border-ink-600'}
                `}
                placeholder="e.g., Midnight Ink Studio"
              />
              {errors.business_name && (
                <p className="text-red-400 text-sm mt-1">{errors.business_name}</p>
              )}
            </div>

            {/* Business email */}
            <div>
              <label
                htmlFor="business_email"
                className="block text-sm font-medium text-ink-200 mb-1.5"
              >
                Business email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                id="business_email"
                name="business_email"
                value={formData.business_email}
                onChange={handleChange}
                className={`
                  w-full px-4 py-2.5 bg-ink-700 border rounded-lg text-ink-100
                  placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-primary/50
                  transition-colors
                  ${errors.business_email ? 'border-red-500' : 'border-ink-600'}
                `}
                placeholder="studio@example.com"
              />
              {errors.business_email && (
                <p className="text-red-400 text-sm mt-1">{errors.business_email}</p>
              )}
              <p className="text-ink-500 text-xs mt-1">
                This email will be used for client communications
              </p>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`
                w-full py-3 px-4 rounded-lg font-medium text-white
                transition-all duration-200
                ${
                  isLoading
                    ? 'bg-accent-primary/50 cursor-not-allowed'
                    : 'bg-accent-primary hover:bg-accent-primary/80 active:scale-[0.98]'
                }
              `}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
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
                  Creating your studio...
                </span>
              ) : (
                'Create Studio'
              )}
            </button>
          </form>
        </div>

        {/* Info note */}
        <p className="text-center text-sm text-ink-500 mt-4">
          You can update your studio details anytime in Settings
        </p>
      </div>
    </div>
  );
}

export default Onboarding;
