/**
 * Studios API service for studio management.
 */

import { api } from './api';
import type {
  Studio,
  StudioCreate,
  StudioUpdate,
  StudioListResponse,
  StudioLogoResponse,
  MessageResponse,
} from '../types/api';

const API_BASE = '/api/v1/studios';

/**
 * Get list of studios for the current user.
 */
export async function getStudios(skip = 0, limit = 100): Promise<StudioListResponse> {
  return api.get<StudioListResponse>(`${API_BASE}?skip=${skip}&limit=${limit}`);
}

/**
 * Get a specific studio by ID.
 */
export async function getStudio(studioId: string): Promise<Studio> {
  return api.get<Studio>(`${API_BASE}/${studioId}`);
}

/**
 * Create a new studio.
 */
export async function createStudio(data: StudioCreate): Promise<Studio> {
  return api.post<Studio>(API_BASE, data);
}

/**
 * Update a studio.
 */
export async function updateStudio(studioId: string, data: StudioUpdate): Promise<Studio> {
  return api.put<Studio>(`${API_BASE}/${studioId}`, data);
}

/**
 * Upload a studio logo.
 */
export async function uploadLogo(studioId: string, file: File): Promise<StudioLogoResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const token = localStorage.getItem('auth_token');
  const response = await fetch(`http://localhost:8000${API_BASE}/${studioId}/logo`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(errorData.detail || 'Upload failed');
  }

  return response.json();
}

/**
 * Delete a studio logo.
 */
export async function deleteLogo(studioId: string): Promise<MessageResponse> {
  return api.delete<MessageResponse>(`${API_BASE}/${studioId}/logo`);
}

/**
 * Delete a studio.
 */
export async function deleteStudio(studioId: string): Promise<MessageResponse> {
  return api.delete<MessageResponse>(`${API_BASE}/${studioId}`);
}
