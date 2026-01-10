/**
 * Client portal registration page for new client accounts.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clientAuthService } from '../services/clientAuth';

interface FormErrors {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirm_password?: string;
  general?: string;
}

export function ClientRegister() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
  });

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.first_name.trim()) {
      newErrors.first_name = 'First name is required';
    }

    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Last name is required';
    }

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (formData.phone && !/^[\d\s\-+()]*$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (!formData.confirm_password) {
      newErrors.confirm_password = 'Please confirm your password';
    } else if (formData.password !== formData.confirm_password) {
      newErrors.confirm_password = 'Passwords do not match';
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
      await clientAuthService.register({
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone || undefined,
        password: formData.password,
      });
      setSuccess(true);
      // Redirect to login after a short delay
      setTimeout(() => {
        navigate('/client/login');
      }, 2000);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Registration failed. Please try again.';
      setErrors({ general: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-ink-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-ink-800 rounded-xl border border-ink-700 p-8 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-400"
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
            <h2 className="text-xl font-semibold text-ink-100 mb-2">Account Created!</h2>
            <p className="text-ink-400 mb-4">
              Your account has been created successfully. You can now log in.
            </p>
            <Link
              to="/client/login"
              className="inline-block px-6 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-lg font-medium transition-colors"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo and heading */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-accent-primary to-accent-secondary rounded-xl flex items-center justify-center">
              <span className="text-xl font-bold text-white">IF</span>
            </div>
            <span className="text-2xl font-bold text-ink-100">InkFlow</span>
          </Link>
          <h1 className="text-xl font-semibold text-ink-100">Create Client Account</h1>
          <p className="text-ink-400 mt-1">Book appointments and track your tattoo journey</p>
        </div>

        {/* Registration form */}
        <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* General error */}
            {errors.general && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">{errors.general}</p>
              </div>
            )}

            {/* Name fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="first_name"
                  className="block text-sm font-medium text-ink-200 mb-1.5"
                >
                  First name
                </label>
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  autoComplete="given-name"
                  className={`
                    w-full px-4 py-2.5 bg-ink-700 border rounded-lg text-ink-100
                    placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-primary/50
                    transition-colors
                    ${errors.first_name ? 'border-red-500' : 'border-ink-600'}
                  `}
                  placeholder="John"
                />
                {errors.first_name && (
                  <p className="text-red-400 text-sm mt-1">{errors.first_name}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="last_name"
                  className="block text-sm font-medium text-ink-200 mb-1.5"
                >
                  Last name
                </label>
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  autoComplete="family-name"
                  className={`
                    w-full px-4 py-2.5 bg-ink-700 border rounded-lg text-ink-100
                    placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-primary/50
                    transition-colors
                    ${errors.last_name ? 'border-red-500' : 'border-ink-600'}
                  `}
                  placeholder="Doe"
                />
                {errors.last_name && (
                  <p className="text-red-400 text-sm mt-1">{errors.last_name}</p>
                )}
              </div>
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-ink-200 mb-1.5"
              >
                Email address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
                className={`
                  w-full px-4 py-2.5 bg-ink-700 border rounded-lg text-ink-100
                  placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-primary/50
                  transition-colors
                  ${errors.email ? 'border-red-500' : 'border-ink-600'}
                `}
                placeholder="you@example.com"
              />
              {errors.email && (
                <p className="text-red-400 text-sm mt-1">{errors.email}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-ink-200 mb-1.5"
              >
                Phone number{' '}
                <span className="text-ink-500 font-normal">(optional)</span>
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                autoComplete="tel"
                className={`
                  w-full px-4 py-2.5 bg-ink-700 border rounded-lg text-ink-100
                  placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-primary/50
                  transition-colors
                  ${errors.phone ? 'border-red-500' : 'border-ink-600'}
                `}
                placeholder="(555) 123-4567"
              />
              {errors.phone && (
                <p className="text-red-400 text-sm mt-1">{errors.phone}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-ink-200 mb-1.5"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                autoComplete="new-password"
                className={`
                  w-full px-4 py-2.5 bg-ink-700 border rounded-lg text-ink-100
                  placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-primary/50
                  transition-colors
                  ${errors.password ? 'border-red-500' : 'border-ink-600'}
                `}
                placeholder="At least 8 characters"
              />
              {errors.password && (
                <p className="text-red-400 text-sm mt-1">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirm_password"
                className="block text-sm font-medium text-ink-200 mb-1.5"
              >
                Confirm password
              </label>
              <input
                type="password"
                id="confirm_password"
                name="confirm_password"
                value={formData.confirm_password}
                onChange={handleChange}
                autoComplete="new-password"
                className={`
                  w-full px-4 py-2.5 bg-ink-700 border rounded-lg text-ink-100
                  placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-primary/50
                  transition-colors
                  ${errors.confirm_password ? 'border-red-500' : 'border-ink-600'}
                `}
                placeholder="Confirm your password"
              />
              {errors.confirm_password && (
                <p className="text-red-400 text-sm mt-1">{errors.confirm_password}</p>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`
                w-full py-2.5 px-4 rounded-lg font-medium text-white
                transition-all duration-200
                ${
                  isLoading
                    ? 'bg-accent-primary/50 cursor-not-allowed'
                    : 'bg-accent-primary hover:bg-accent-primary/90 active:scale-[0.98]'
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
                  Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Login link */}
          <p className="text-center text-sm text-ink-400 mt-6 pt-6 border-t border-ink-700">
            Already have an account?{' '}
            <Link to="/client/login" className="text-accent-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default ClientRegister;
