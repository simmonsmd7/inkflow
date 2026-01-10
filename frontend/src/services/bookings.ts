/**
 * Booking requests service for client submissions.
 */

import { api } from './api';
import type {
  ArtistOption,
  BookingRequestCreate,
  BookingSubmissionResponse,
  ReferenceImage,
} from '../types/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Get list of artists for a studio (for booking form dropdown).
 */
export async function getStudioArtists(studioSlug: string): Promise<ArtistOption[]> {
  return api.get<ArtistOption[]>(`/api/v1/bookings/studios/${studioSlug}/artists`);
}

/**
 * Submit a booking request to a studio.
 */
export async function submitBookingRequest(
  studioSlug: string,
  data: BookingRequestCreate
): Promise<BookingSubmissionResponse> {
  return api.post<BookingSubmissionResponse>(
    `/api/v1/bookings/studios/${studioSlug}/submit`,
    data
  );
}

/**
 * Upload a reference image for a booking request.
 */
export async function uploadReferenceImage(
  requestId: string,
  file: File,
  notes?: string
): Promise<ReferenceImage> {
  const formData = new FormData();
  formData.append('file', file);

  const url = new URL(`${API_URL}/api/v1/bookings/requests/${requestId}/images`);
  if (notes) {
    url.searchParams.set('notes', notes);
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to upload image');
  }

  return response.json();
}
