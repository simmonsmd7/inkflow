/**
 * Artists API service for profile and portfolio management.
 */

import { api } from './api';
import type {
  ArtistDetail,
  ArtistProfileUpdate,
  ArtistsListResponse,
  MessageResponse,
  PortfolioImage,
  PortfolioImageUpdate,
} from '../types/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Get the current artist's profile.
 */
export async function getMyProfile(): Promise<ArtistDetail> {
  return api.get<ArtistDetail>('/api/v1/artists/me/profile');
}

/**
 * Update the current artist's profile.
 */
export async function updateMyProfile(data: ArtistProfileUpdate): Promise<ArtistDetail> {
  return api.put<ArtistDetail>('/api/v1/artists/me/profile', data);
}

/**
 * Get a specific artist's public profile.
 */
export async function getArtist(artistId: string): Promise<ArtistDetail> {
  return api.get<ArtistDetail>(`/api/v1/artists/${artistId}`);
}

/**
 * List all artists with pagination.
 */
export async function listArtists(
  page: number = 1,
  perPage: number = 20,
  specialty?: string
): Promise<ArtistsListResponse> {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('per_page', String(perPage));
  if (specialty) {
    params.set('specialty', specialty);
  }
  return api.get<ArtistsListResponse>(`/api/v1/artists?${params.toString()}`);
}

/**
 * Upload a portfolio image.
 */
export async function uploadPortfolioImage(
  file: File,
  metadata?: {
    title?: string;
    description?: string;
    style?: string;
    placement?: string;
  }
): Promise<PortfolioImage> {
  const formData = new FormData();
  formData.append('file', file);

  // Build URL with query params for metadata
  const params = new URLSearchParams();
  if (metadata?.title) params.set('title', metadata.title);
  if (metadata?.description) params.set('description', metadata.description);
  if (metadata?.style) params.set('style', metadata.style);
  if (metadata?.placement) params.set('placement', metadata.placement);

  const queryString = params.toString();
  const url = `/artists/me/portfolio${queryString ? `?${queryString}` : ''}`;

  const token = localStorage.getItem('inkflow_token');
  const response = await fetch(`${API_URL}/api/v1${url}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to upload image');
  }

  return response.json();
}

/**
 * Update portfolio image metadata.
 */
export async function updatePortfolioImage(
  imageId: string,
  data: PortfolioImageUpdate
): Promise<PortfolioImage> {
  return api.put<PortfolioImage>(`/api/v1/artists/me/portfolio/${imageId}`, data);
}

/**
 * Delete a portfolio image.
 */
export async function deletePortfolioImage(imageId: string): Promise<MessageResponse> {
  return api.delete<MessageResponse>(`/api/v1/artists/me/portfolio/${imageId}`);
}

/**
 * Reorder portfolio images.
 */
export async function reorderPortfolio(imageIds: string[]): Promise<PortfolioImage[]> {
  return api.put<PortfolioImage[]>('/api/v1/artists/me/portfolio/reorder', { image_ids: imageIds });
}
