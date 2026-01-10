/**
 * Booking requests service for client submissions and artist management.
 */

import { api } from './api';
import type {
  ArtistOption,
  BookingRequest,
  BookingRequestCreate,
  BookingRequestsListResponse,
  BookingRequestStatus,
  BookingRequestUpdate,
  BookingSubmissionResponse,
  DepositPaymentInfo,
  ReferenceImage,
  SendDepositRequestInput,
  SendDepositRequestResponse,
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

// ============================================================================
// AUTHENTICATED ENDPOINTS (For artists/staff to manage requests)
// ============================================================================

export interface ListBookingRequestsParams {
  page?: number;
  per_page?: number;
  status?: BookingRequestStatus;
  artist_id?: string;
}

/**
 * List booking requests (authenticated).
 */
export async function listBookingRequests(
  params: ListBookingRequestsParams = {}
): Promise<BookingRequestsListResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.per_page) searchParams.set('per_page', params.per_page.toString());
  if (params.status) searchParams.set('status', params.status);
  if (params.artist_id) searchParams.set('artist_id', params.artist_id);

  const query = searchParams.toString();
  return api.get<BookingRequestsListResponse>(
    `/api/v1/bookings/requests${query ? `?${query}` : ''}`
  );
}

/**
 * Get a single booking request (authenticated).
 */
export async function getBookingRequest(requestId: string): Promise<BookingRequest> {
  return api.get<BookingRequest>(`/api/v1/bookings/requests/${requestId}`);
}

/**
 * Update a booking request (authenticated).
 */
export async function updateBookingRequest(
  requestId: string,
  data: BookingRequestUpdate
): Promise<BookingRequest> {
  return api.patch<BookingRequest>(`/api/v1/bookings/requests/${requestId}`, data);
}

/**
 * Delete a booking request (owner only).
 */
export async function deleteBookingRequest(requestId: string): Promise<void> {
  return api.delete(`/api/v1/bookings/requests/${requestId}`);
}

// ============================================================================
// DEPOSIT ENDPOINTS
// ============================================================================

/**
 * Send a deposit request to the client.
 */
export async function sendDepositRequest(
  requestId: string,
  data: SendDepositRequestInput
): Promise<SendDepositRequestResponse> {
  return api.post<SendDepositRequestResponse>(
    `/api/v1/bookings/requests/${requestId}/send-deposit-request`,
    data
  );
}

/**
 * Get deposit payment information by token (public).
 */
export async function getDepositInfo(token: string): Promise<DepositPaymentInfo> {
  return api.get<DepositPaymentInfo>(`/api/v1/bookings/deposit/${token}`);
}
