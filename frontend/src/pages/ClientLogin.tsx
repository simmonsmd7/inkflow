/**
 * Client portal login page for client authentication.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clientAuthService } from '../services/clientAuth';

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

export function ClientLogin() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
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
      await clientAuthService.login(formData.email, formData.password);
      navigate('/client');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Login failed. Please try again.';
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
          <Link to="/" className="inline-flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-accent-primary to-accent-secondary rounded-xl flex items-center justify-center">
              <span className="text-xl font-bold text-white">IF</span>
            </div>
            <span className="text-2xl font-bold text-ink-100">InkFlow</span>
          </Link>
          <h1 className="text-xl font-semibold text-ink-100">Client Portal</h1>
          <p className="text-ink-400 mt-1">Sign in to view your appointments and more</p>
        </div>

        {/* Login form */}
        <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* General error */}
            {errors.general && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">{errors.general}</p>
              </div>
            )}

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

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-ink-200"
                >
                  Password
                </label>
                <Link
                  to="/client/forgot-password"
                  className="text-sm text-accent-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                autoComplete="current-password"
                className={`
                  w-full px-4 py-2.5 bg-ink-700 border rounded-lg text-ink-100
                  placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-primary/50
                  transition-colors
                  ${errors.password ? 'border-red-500' : 'border-ink-600'}
                `}
                placeholder="Enter your password"
              />
              {errors.password && (
                <p className="text-red-400 text-sm mt-1">{errors.password}</p>
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
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Register link */}
          <p className="text-center text-sm text-ink-400 mt-6 pt-6 border-t border-ink-700">
            Don't have an account?{' '}
            <Link to="/client/register" className="text-accent-primary hover:underline">
              Register
            </Link>
          </p>

          {/* Staff login link */}
          <p className="text-center text-sm text-ink-500 mt-4">
            Are you a studio staff member?{' '}
            <Link to="/login" className="text-ink-400 hover:text-ink-300">
              Staff login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default ClientLogin;
