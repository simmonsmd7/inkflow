/**
 * Hook for checking API health status.
 */

import { useEffect, useState } from 'react';
import api from '../services/api';
import type { HealthResponse } from '../types/api';

interface UseApiHealthResult {
  health: HealthResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApiHealth(): UseApiHealthResult {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<HealthResponse>('/health', {
        skipAuth: true,
      });
      setHealth(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to API');
      setHealth(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return {
    health,
    isLoading,
    error,
    refetch: fetchHealth,
  };
}

export default useApiHealth;
