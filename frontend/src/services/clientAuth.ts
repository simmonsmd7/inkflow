/**
 * Client authentication service for client portal registration, login, and session management.
 */

import api from './api';
import type { ClientAuthResponse, ClientDetailResponse, ClientRegisterRequest, MessageResponse } from '../types/api';

const CLIENT_TOKEN_KEY = 'inkflow_client_token';

export const clientAuthService = {
  /**
   * Register a new client account.
   */
  async register(data: ClientRegisterRequest): Promise<MessageResponse> {
    return api.post<MessageResponse>('/api/v1/client/auth/register', data, {
      skipAuth: true,
    });
  },

  /**
   * Verify email with token.
   */
  async verifyEmail(token: string): Promise<MessageResponse> {
    return api.post<MessageResponse>(
      '/api/v1/client/auth/verify-email',
      { token },
      { skipAuth: true }
    );
  },

  /**
   * Resend verification email.
   */
  async resendVerification(email: string): Promise<MessageResponse> {
    return api.post<MessageResponse>(
      '/api/v1/client/auth/resend-verification',
      { email },
      { skipAuth: true }
    );
  },

  /**
   * Log in with email and password.
   */
  async login(email: string, password: string): Promise<ClientAuthResponse> {
    const response = await api.post<ClientAuthResponse>(
      '/api/v1/client/auth/login',
      { email, password },
      { skipAuth: true }
    );

    // Store token
    localStorage.setItem(CLIENT_TOKEN_KEY, response.access_token);

    return response;
  },

  /**
   * Log out the current client.
   */
  logout(): void {
    localStorage.removeItem(CLIENT_TOKEN_KEY);
  },

  /**
   * Get the current client's profile.
   */
  async getMe(): Promise<ClientDetailResponse> {
    const token = this.getToken();
    return api.get<ClientDetailResponse>('/api/v1/client/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  /**
   * Check if client is logged in.
   */
  isAuthenticated(): boolean {
    return !!localStorage.getItem(CLIENT_TOKEN_KEY);
  },

  /**
   * Get the stored access token.
   */
  getToken(): string | null {
    return localStorage.getItem(CLIENT_TOKEN_KEY);
  },

  /**
   * Request a password reset email.
   */
  async forgotPassword(email: string): Promise<MessageResponse> {
    return api.post<MessageResponse>(
      '/api/v1/client/auth/forgot-password',
      { email },
      { skipAuth: true }
    );
  },

  /**
   * Reset password with token from email.
   */
  async resetPassword(token: string, newPassword: string): Promise<MessageResponse> {
    return api.post<MessageResponse>(
      '/api/v1/client/auth/reset-password',
      { token, new_password: newPassword },
      { skipAuth: true }
    );
  },
};

export default clientAuthService;
