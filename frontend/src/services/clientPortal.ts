/**
 * Client portal service for booking history and portal functionality.
 */

import api from './api';
import { clientAuthService } from './clientAuth';
import type {
  ClientBookingDetail,
  ClientBookingsListResponse,
  ClientBookingStats,
  ClientConsentPendingResponse,
  ClientSignedConsentsResponse,
  ClientConsentTemplateResponse,
  ClientConsentSignInput,
  ClientConsentSignResponse,
  ClientAftercareListResponse,
  ClientAftercareDetail,
  ClientHealingIssueInput,
  ClientHealingIssueResponse,
  ClientHealingIssueSummary,
  ClientRebookingData,
  ClientRebookingSubmit,
  ClientRebookingResponse,
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
      { skipAuth: true, headers: getClientAuthHeaders() }
    );
  },

  /**
   * Get details of a specific booking.
   */
  async getBookingDetail(bookingId: string): Promise<ClientBookingDetail> {
    return api.get<ClientBookingDetail>(
      `/api/v1/client/portal/bookings/${bookingId}`,
      { skipAuth: true, headers: getClientAuthHeaders() }
    );
  },

  /**
   * Get booking statistics summary.
   */
  async getBookingStats(): Promise<ClientBookingStats> {
    return api.get<ClientBookingStats>(
      '/api/v1/client/portal/bookings/stats/summary',
      { skipAuth: true, headers: getClientAuthHeaders() }
    );
  },

  // ============ Consent Form Functions ============

  /**
   * Get bookings that need consent forms signed.
   */
  async getPendingConsentForms(): Promise<ClientConsentPendingResponse> {
    return api.get<ClientConsentPendingResponse>(
      '/api/v1/client/portal/consent/pending',
      { skipAuth: true, headers: getClientAuthHeaders() }
    );
  },

  /**
   * Get previously signed consent forms.
   */
  async getSignedConsentForms(params: { page?: number; per_page?: number } = {}): Promise<ClientSignedConsentsResponse> {
    const { page = 1, per_page = 10 } = params;

    const queryParams = new URLSearchParams({
      page: page.toString(),
      per_page: per_page.toString(),
    });

    return api.get<ClientSignedConsentsResponse>(
      `/api/v1/client/portal/consent/signed?${queryParams.toString()}`,
      { skipAuth: true, headers: getClientAuthHeaders() }
    );
  },

  /**
   * Get consent form template for a booking.
   */
  async getConsentTemplate(bookingId: string): Promise<ClientConsentTemplateResponse> {
    return api.get<ClientConsentTemplateResponse>(
      `/api/v1/client/portal/consent/template/${bookingId}`,
      { skipAuth: true, headers: getClientAuthHeaders() }
    );
  },

  /**
   * Sign a consent form for a booking.
   */
  async signConsentForm(data: ClientConsentSignInput): Promise<ClientConsentSignResponse> {
    return api.post<ClientConsentSignResponse>(
      '/api/v1/client/portal/consent/sign',
      data,
      { skipAuth: true, headers: getClientAuthHeaders() }
    );
  },

  // ============ Aftercare Functions ============

  /**
   * Get the client's aftercare instructions with pagination.
   */
  async getAftercareList(params: { page?: number; per_page?: number } = {}): Promise<ClientAftercareListResponse> {
    const { page = 1, per_page = 10 } = params;

    const queryParams = new URLSearchParams({
      page: page.toString(),
      per_page: per_page.toString(),
    });

    return api.get<ClientAftercareListResponse>(
      `/api/v1/client/portal/aftercare?${queryParams.toString()}`,
      { skipAuth: true, headers: getClientAuthHeaders() }
    );
  },

  /**
   * Get detailed aftercare instructions by ID.
   */
  async getAftercareDetail(aftercareId: string): Promise<ClientAftercareDetail> {
    return api.get<ClientAftercareDetail>(
      `/api/v1/client/portal/aftercare/${aftercareId}`,
      { skipAuth: true, headers: getClientAuthHeaders() }
    );
  },

  /**
   * Report a healing issue for aftercare.
   */
  async reportHealingIssue(aftercareId: string, data: ClientHealingIssueInput): Promise<ClientHealingIssueResponse> {
    return api.post<ClientHealingIssueResponse>(
      `/api/v1/client/portal/aftercare/${aftercareId}/report-issue`,
      data,
      { skipAuth: true, headers: getClientAuthHeaders() }
    );
  },

  /**
   * Get healing issues for an aftercare record.
   */
  async getHealingIssues(aftercareId: string): Promise<ClientHealingIssueSummary[]> {
    return api.get<ClientHealingIssueSummary[]>(
      `/api/v1/client/portal/aftercare/${aftercareId}/issues`,
      { skipAuth: true, headers: getClientAuthHeaders() }
    );
  },

  // ============ Rebooking Functions ============

  /**
   * Get rebooking data for a completed booking.
   */
  async getRebookingData(bookingId: string): Promise<ClientRebookingData> {
    return api.get<ClientRebookingData>(
      `/api/v1/client/portal/rebooking/${bookingId}`,
      { skipAuth: true, headers: getClientAuthHeaders() }
    );
  },

  /**
   * Submit a rebooking request.
   */
  async submitRebooking(data: ClientRebookingSubmit): Promise<ClientRebookingResponse> {
    return api.post<ClientRebookingResponse>(
      '/api/v1/client/portal/rebooking/submit',
      data,
      { skipAuth: true, headers: getClientAuthHeaders() }
    );
  },
};

export default clientPortalService;
