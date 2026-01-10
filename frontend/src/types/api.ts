/**
 * API response types for the InkFlow backend.
 */

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  app: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
}

export interface ApiHealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  api_version: string;
}

export interface RootResponse {
  message: string;
  docs: string;
}

export interface ErrorResponse {
  detail: string;
}

// User roles
export type UserRole = 'owner' | 'artist' | 'receptionist';

// User types
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

// Auth request types
export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role?: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// Auth response types
export interface MessageResponse {
  message: string;
  success: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}
