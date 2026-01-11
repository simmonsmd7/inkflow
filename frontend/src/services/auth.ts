/**
 * Authentication service for user registration, login, and session management.
 */

import api from './api';
import type { AuthResponse, MessageResponse, RegisterRequest, UserDetailResponse } from '../types/api';

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
      { email, password },
      { skipAuth: true }
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
   * Get the current user's profile.
   */
  async getMe(): Promise<UserDetailResponse> {
    return api.get<UserDetailResponse>('/api/v1/auth/me');
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

  /**
   * Request a password reset email.
   */
  async forgotPassword(email: string): Promise<MessageResponse> {
    return api.post<MessageResponse>(
      '/api/v1/auth/forgot-password',
      { email },
      { skipAuth: true }
    );
  },

  /**
   * Reset password with token from email.
   */
  async resetPassword(token: string, newPassword: string): Promise<MessageResponse> {
    return api.post<MessageResponse>(
      '/api/v1/auth/reset-password',
      { token, new_password: newPassword },
      { skipAuth: true }
    );
  },

  /**
   * Create a business during onboarding.
   */
  async createBusiness(businessName: string, businessEmail: string): Promise<MessageResponse> {
    return api.post<MessageResponse>(
      '/api/v1/auth/onboarding/create-business',
      { business_name: businessName, business_email: businessEmail }
    );
  },
};

export default authService;
