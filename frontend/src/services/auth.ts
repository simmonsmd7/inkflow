/**
 * Authentication service for user registration, login, and session management.
 */

import api from './api';
import type { AuthResponse, MessageResponse, RegisterRequest } from '../types/api';

const TOKEN_KEY = 'inkflow_token';

export const authService = {
  /**
   * Register a new user account.
   */
  async register(data: RegisterRequest): Promise<MessageResponse> {
    return api.post<MessageResponse>('/api/v1/auth/register', data, {
      skipAuth: true,
    });
  },

  /**
   * Verify email with token.
   */
  async verifyEmail(token: string): Promise<MessageResponse> {
    return api.post<MessageResponse>(
      '/api/v1/auth/verify-email',
      { token },
      { skipAuth: true }
    );
  },

  /**
   * Resend verification email.
   */
  async resendVerification(email: string): Promise<MessageResponse> {
    return api.post<MessageResponse>(
      '/api/v1/auth/resend-verification',
      { email },
      { skipAuth: true }
    );
  },

  /**
   * Log in with email and password.
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>(
      '/api/v1/auth/login',
      null,
      {
        skipAuth: true,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ email, password }).toString(),
      }
    );

    // Store token
    localStorage.setItem(TOKEN_KEY, response.access_token);

    return response;
  },

  /**
   * Log out the current user.
   */
  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
  },

  /**
   * Check if user is logged in.
   */
  isAuthenticated(): boolean {
    return !!localStorage.getItem(TOKEN_KEY);
  },

  /**
   * Get the stored access token.
   */
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
};

export default authService;
