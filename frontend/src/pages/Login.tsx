/**
 * Login page - stub for P2.2 implementation.
 */

import { Link } from 'react-router-dom';

export function Login() {
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
          <h1 className="text-xl font-semibold text-ink-100">Welcome back</h1>
          <p className="text-ink-400 mt-1">Sign in to your account</p>
        </div>

        {/* Login form placeholder */}
        <div className="bg-ink-800 rounded-xl border border-ink-700 p-6">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-ink-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-ink-400 mb-4">Login functionality coming in P2.2</p>
            <Link
              to="/"
              className="inline-block text-accent-primary hover:underline"
            >
              Go to Dashboard
            </Link>
          </div>

          {/* Register link */}
          <p className="text-center text-sm text-ink-400 mt-4 pt-4 border-t border-ink-700">
            Don't have an account?{' '}
            <Link to="/register" className="text-accent-primary hover:underline">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
