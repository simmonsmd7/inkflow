/**
 * Client Reset Password page - set new password with token from email.
 * Client portal version - uses client auth service.
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { clientAuthService } from '../services/clientAuth';

interface FormErrors {
  password?: string;
  confirmPassword?: string;
  general?: string;
}

export function ClientResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (!token) {
      setErrors({ general: 'Invalid or missing reset token. Please request a new reset link.' });
    }
  }, [token]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setErrors({ general: 'Invalid or missing reset token.' });
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      await clientAuthService.resetPassword(token, formData.password);
      setSuccess(true);
      // Redirect to client login after 3 seconds
      setTimeout(() => {
        navigate('/client/login');
      }, 3000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to reset password. Please try again.';
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
          <Link to="/client/login" className="inline-flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-accent-primary to-accent-secondary rounded-xl flex items-center justify-center">
              <span className="text-xl font-bold text-white">IF</span>
            </div>
            <span className="text-2xl font-bold text-ink-100">InkFlow</span>
          </Link>
          <p className="text-accent-secondary font-medium">Client Portal</p>
          <h1 className="text-xl font-semibold text-ink-100 mt-2">Set new password</h1>
          <p className="text-ink-400 mt-1">Choose a strong password for your account</p>
        </div>

        {/* Form card */}
        <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
          {success ? (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-500/10 rounded-full flex items-center justify-center">
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
              <h2 className="text-lg font-semibold text-ink-100 mb-2">Password reset successful</h2>
              <p className="text-ink-400 text-sm mb-6">
                Your password has been reset. Redirecting you to login...
              </p>
              <Link
                to="/client/login"
                className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-lg font-medium text-white bg-accent-primary hover:bg-accent-primary/80 transition-all"
              >
                Sign in now
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error message */}
              {errors.general && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm">{errors.general}</p>
                </div>
              )}

              {/* New password field */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-ink-200 mb-1.5"
                >
                  New password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  disabled={!token}
                  className={`
                    w-full px-4 py-2.5 bg-ink-700 border rounded-lg text-ink-100
                    placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-primary/50
                    transition-colors disabled:opacity-50
                    ${errors.password ? 'border-red-500' : 'border-ink-600'}
                  `}
                  placeholder="Minimum 8 characters"
                />
                {errors.password && (
                  <p className="text-red-400 text-sm mt-1">{errors.password}</p>
                )}
              </div>

              {/* Confirm password field */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-ink-200 mb-1.5"
                >
                  Confirm new password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                  disabled={!token}
                  className={`
                    w-full px-4 py-2.5 bg-ink-700 border rounded-lg text-ink-100
                    placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-primary/50
                    transition-colors disabled:opacity-50
                    ${errors.confirmPassword ? 'border-red-500' : 'border-ink-600'}
                  `}
                  placeholder="Repeat your password"
                />
                {errors.confirmPassword && (
                  <p className="text-red-400 text-sm mt-1">{errors.confirmPassword}</p>
                )}
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading || !token}
                className={`
                  w-full py-2.5 px-4 rounded-lg font-medium text-white
                  transition-all duration-200
                  ${
                    isLoading || !token
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
                    Resetting...
                  </span>
                ) : (
                  'Reset password'
                )}
              </button>
            </form>
          )}

          {/* Request new link */}
          {!success && !token && (
            <p className="text-center text-sm text-ink-400 mt-6 pt-6 border-t border-ink-700">
              Need a new reset link?{' '}
              <Link to="/client/forgot-password" className="text-accent-primary hover:underline">
                Request one
              </Link>
            </p>
          )}
        </div>

        {/* Back to login link */}
        <p className="text-center text-sm text-ink-400 mt-6">
          Remember your password?{' '}
          <Link to="/client/login" className="text-accent-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default ClientResetPassword;
