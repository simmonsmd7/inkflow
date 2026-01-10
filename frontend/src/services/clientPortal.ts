/**
 * Client portal service for booking history and portal functionality.
 */

import api from './api';
import { clientAuthService } from './clientAuth';
import type {
  ClientBookingDetail,
  ClientBookingsListResponse,
  ClientBookingStats,
} from '../types/api';

export interface GetBookingsParams {
  page?: number;
  per_page?: number;
  status_filter?: string;
}

/**
 * Get auth headers for client portal requests.
 */
function getClientAuthHeaders(): Record<string, string> {
  const token = clientAuthService.getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  return {
    Authorization: `Bearer ${token}`,
  };
}

export const clientPortalService = {
  /**
   * Get the client's booking history with pagination.
   */
  async getBookings(params: GetBookingsParams = {}): Promise<ClientBookingsListResponse> {
    const { page = 1, per_page = 10, status_filter } = params;

    const queryParams = new URLSearchParams({
      page: page.toString(),
      per_page: per_page.toString(),
    });

    if (status_filter) {
      queryParams.set('status_filter', status_filter);
    }

    return api.get<ClientBookingsListResponse>(
      `/api/v1/client/portal/bookings?${queryParams.toString()}`,
      { headers: getClientAuthHeaders() }
    );
  },

  /**
   * Get details of a specific booking.
   */
  async getBookingDetail(bookingId: string): Promise<ClientBookingDetail> {
    return api.get<ClientBookingDetail>(
      `/api/v1/client/portal/bookings/${bookingId}`,
      { headers: getClientAuthHeaders() }
    );
  },

  /**
   * Get booking statistics summary.
   */
  async getBookingStats(): Promise<ClientBookingStats> {
    return api.get<ClientBookingStats>(
      '/api/v1/client/portal/bookings/stats/summary',
      { headers: getClientAuthHeaders() }
    );
  },
};

export default clientPortalService;
