/**
 * User registration page.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/auth';
import type { RegisterRequest } from '../types/api';

interface FormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  first_name?: string;
  last_name?: string;
  general?: string;
}

export function Register() {
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState<RegisterRequest & { confirmPassword: string }>({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    phone: '',
    role: 'artist',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.first_name) {
      newErrors.first_name = 'First name is required';
    }

    if (!formData.last_name) {
      newErrors.last_name = 'Last name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const { confirmPassword, ...registerData } = formData;
      await authService.register(registerData);
      setSuccess(true);
    } catch (error: unknown) {
      let message = 'Registration failed. Please try again.';
      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === 'object' && error !== null) {
        const err = error as Record<string, unknown>;
        if (typeof err.message === 'string') {
          message = err.message;
        } else if (typeof err.detail === 'string') {
          message = err.detail;
        }
      }
      setErrors({ general: message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-ink-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-ink-800 rounded-xl border border-ink-700 p-8 text-center">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-ink-100 mb-2">Account Created!</h2>
          <p className="text-ink-400 mb-6">
            Check your email for a verification link. You'll need to verify your email before logging in.
          </p>
          <Link
            to="/login"
            className="inline-block bg-accent-primary hover:bg-accent-primary/90 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo and heading */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-accent-primary to-accent-secondary rounded-xl flex items-center justify-center">
              <span className="text-xl font-bold text-white">IF</span>
            </div>
            <span className="text-2xl font-bold text-ink-100">InkFlow</span>
          </div>
          <h1 className="text-xl font-semibold text-ink-100">Create your account</h1>
          <p className="text-ink-400 mt-1">Start managing your studio today</p>
        </div>

        {/* Registration form */}
        <form onSubmit={handleSubmit} className="bg-ink-800 rounded-xl border border-ink-700 p-6 space-y-4">
          {errors.general && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
              {errors.general}
            </div>
          )}

          {/* Name fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="first_name" className="block text-sm font-medium text-ink-300 mb-1.5">
                First Name
              </label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                className={`w-full px-3 py-2 bg-ink-700 border rounded-lg text-ink-100 placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent ${
                  errors.first_name ? 'border-red-500' : 'border-ink-600'
                }`}
                placeholder="John"
              />
              {errors.first_name && (
                <p className="mt-1 text-xs text-red-400">{errors.first_name}</p>
              )}
            </div>
            <div>
              <label htmlFor="last_name" className="block text-sm font-medium text-ink-300 mb-1.5">
                Last Name
              </label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                className={`w-full px-3 py-2 bg-ink-700 border rounded-lg text-ink-100 placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent ${
                  errors.last_name ? 'border-red-500' : 'border-ink-600'
                }`}
                placeholder="Doe"
              />
              {errors.last_name && (
                <p className="mt-1 text-xs text-red-400">{errors.last_name}</p>
              )}
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ink-300 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`w-full px-3 py-2 bg-ink-700 border rounded-lg text-ink-100 placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent ${
                errors.email ? 'border-red-500' : 'border-ink-600'
              }`}
              placeholder="john@example.com"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-400">{errors.email}</p>
            )}
          </div>

          {/* Phone (optional) */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-ink-300 mb-1.5">
              Phone <span className="text-ink-500">(optional)</span>
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-ink-700 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
              placeholder="+1 (555) 000-0000"
            />
          </div>

          {/* Role */}
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-ink-300 mb-1.5">
              Role
            </label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-ink-700 border border-ink-600 rounded-lg text-ink-100 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
            >
              <option value="artist">Artist</option>
              <option value="owner">Studio Owner</option>
              <option value="receptionist">Receptionist</option>
            </select>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ink-300 mb-1.5">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={`w-full px-3 py-2 bg-ink-700 border rounded-lg text-ink-100 placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent ${
                errors.password ? 'border-red-500' : 'border-ink-600'
              }`}
              placeholder="At least 8 characters"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-400">{errors.password}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink-300 mb-1.5">
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className={`w-full px-3 py-2 bg-ink-700 border rounded-lg text-ink-100 placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent ${
                errors.confirmPassword ? 'border-red-500' : 'border-ink-600'
              }`}
              placeholder="Confirm your password"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-400">{errors.confirmPassword}</p>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
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
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </button>

          {/* Login link */}
          <p className="text-center text-sm text-ink-400">
            Already have an account?{' '}
            <Link to="/login" className="text-accent-primary hover:underline">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default Register;
