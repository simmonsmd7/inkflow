/**
 * Protected route component that requires client authentication.
 * Redirects to client login if not authenticated.
 */

import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { clientAuthService } from '../services/clientAuth';

interface ClientProtectedRouteProps {
  children: React.ReactNode;
}

export function ClientProtectedRoute({ children }: ClientProtectedRouteProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      if (!clientAuthService.isAuthenticated()) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      try {
        // Verify token is still valid by fetching profile
        await clientAuthService.getMe();
        setIsAuthenticated(true);
      } catch {
        // Token is invalid, clear it
        clientAuthService.logout();
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to client login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/client/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
