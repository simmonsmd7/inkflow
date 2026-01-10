/**
 * Commission management API service.
 */

import { api } from './api';
import type {
  ArtistCommissionInfo,
  ArtistPayoutReportResponse,
  ArtistsWithCommissionResponse,
  AssignCommissionRuleInput,
  AssignToPayPeriodInput,
  AssignToPayPeriodResponse,
  ClosePayPeriodInput,
  ClosePayPeriodResponse,
  CommissionCalculationInput,
  CommissionCalculationResult,
  CommissionRule,
  CommissionRuleCreate,
  CommissionRulesListResponse,
  CommissionRuleUpdate,
  EarnedCommissionsListResponse,
  MarkPayPeriodPaidInput,
  MarkPayPeriodPaidResponse,
  MessageResponse,
  PayoutHistoryResponse,
  PayPeriod,
  PayPeriodCreate,
  PayPeriodSettings,
  PayPeriodSettingsUpdate,
  PayPeriodStatus,
  PayPeriodsListResponse,
  PayPeriodWithCommissions,
  TipReportResponse,
  TipSettings,
  TipSettingsUpdate,
} from '../types/api';

/**
 * List all commission rules for the user's studio.
 */
export async function listCommissionRules(
  page: number = 1,
  pageSize: number = 20,
  isActive?: boolean
): Promise<CommissionRulesListResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
  });
  if (isActive !== undefined) {
    params.append('is_active', isActive.toString());
  }
  return api.get<CommissionRulesListResponse>(`/commissions?${params.toString()}`);
}

/**
 * Get a commission rule by ID.
 */
export async function getCommissionRule(ruleId: string): Promise<CommissionRule> {
  return api.get<CommissionRule>(`/commissions/${ruleId}`);
}

/**
 * Create a new commission rule.
 */
export async function createCommissionRule(
  data: CommissionRuleCreate
): Promise<CommissionRule> {
  return api.post<CommissionRule>('/commissions', data);
}

/**
 * Update a commission rule.
 */
export async function updateCommissionRule(
  ruleId: string,
  data: CommissionRuleUpdate
): Promise<CommissionRule> {
  return api.put<CommissionRule>(`/commissions/${ruleId}`, data);
}

/**
 * Delete a commission rule.
 */
export async function deleteCommissionRule(ruleId: string): Promise<MessageResponse> {
  return api.delete<MessageResponse>(`/commissions/${ruleId}`);
}

/**
 * List all artists with their commission rule assignments.
 */
export async function listArtistsWithCommission(): Promise<ArtistsWithCommissionResponse> {
  return api.get<ArtistsWithCommissionResponse>('/commissions/artists/assignments');
}

/**
 * Assign a commission rule to an artist.
 */
export async function assignCommissionRule(
  artistId: string,
  data: AssignCommissionRuleInput
): Promise<ArtistCommissionInfo> {
  return api.put<ArtistCommissionInfo>(`/commissions/artists/${artistId}/assignment`, data);
}

/**
 * Calculate commission using a specific rule.
 */
export async function calculateCommission(
  ruleId: string,
  data: CommissionCalculationInput
): Promise<CommissionCalculationResult> {
  return api.post<CommissionCalculationResult>(`/commissions/${ruleId}/calculate`, data);
}

/**
 * Calculate commission for an artist using their assigned rule.
 */
export async function calculateArtistCommission(
  artistId: string,
  data: CommissionCalculationInput
): Promise<CommissionCalculationResult> {
  return api.post<CommissionCalculationResult>(
    `/commissions/artists/${artistId}/calculate`,
    data
  );
}

/**
 * Helper to format cents to dollars.
 */
export function formatCentsToDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Helper to parse dollars to cents.
 */
export function parseDollarsToCents(dollars: string): number {
  const parsed = parseFloat(dollars.replace(/[^0-9.]/g, ''));
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

// ============ Pay Period Settings ============

/**
 * Get pay period settings for the studio.
 */
export async function getPayPeriodSettings(): Promise<PayPeriodSettings> {
  return api.get<PayPeriodSettings>('/commissions/pay-periods/settings');
}

/**
 * Update pay period settings for the studio.
 */
export async function updatePayPeriodSettings(
  data: PayPeriodSettingsUpdate
): Promise<PayPeriodSettings> {
  return api.put<PayPeriodSettings>('/commissions/pay-periods/settings', data);
}

// ============ Pay Periods CRUD ============

/**
 * List all pay periods for the studio.
 */
export async function listPayPeriods(
  page: number = 1,
  pageSize: number = 20,
  status?: PayPeriodStatus
): Promise<PayPeriodsListResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
  });
  if (status) {
    params.append('status', status);
  }
  return api.get<PayPeriodsListResponse>(`/commissions/pay-periods?${params.toString()}`);
}

/**
 * Create a new pay period.
 */
export async function createPayPeriod(data: PayPeriodCreate): Promise<PayPeriod> {
  return api.post<PayPeriod>('/commissions/pay-periods', data);
}

/**
 * Get a pay period by ID with its commissions.
 */
export async function getPayPeriod(payPeriodId: string): Promise<PayPeriodWithCommissions> {
  return api.get<PayPeriodWithCommissions>(`/commissions/pay-periods/${payPeriodId}`);
}

/**
 * Assign commissions to a pay period.
 */
export async function assignToPayPeriod(
  payPeriodId: string,
  data: AssignToPayPeriodInput
): Promise<AssignToPayPeriodResponse> {
  return api.post<AssignToPayPeriodResponse>(
    `/commissions/pay-periods/${payPeriodId}/assign`,
    data
  );
}

/**
 * Close a pay period.
 */
export async function closePayPeriod(
  payPeriodId: string,
  data: ClosePayPeriodInput
): Promise<ClosePayPeriodResponse> {
  return api.post<ClosePayPeriodResponse>(
    `/commissions/pay-periods/${payPeriodId}/close`,
    data
  );
}

/**
 * Mark a pay period as paid.
 */
export async function markPayPeriodPaid(
  payPeriodId: string,
  data: MarkPayPeriodPaidInput
): Promise<MarkPayPeriodPaidResponse> {
  return api.post<MarkPayPeriodPaidResponse>(
    `/commissions/pay-periods/${payPeriodId}/mark-paid`,
    data
  );
}

/**
 * Delete a pay period.
 */
export async function deletePayPeriod(payPeriodId: string): Promise<MessageResponse> {
  return api.delete<MessageResponse>(`/commissions/pay-periods/${payPeriodId}`);
}

/**
 * List unassigned commissions (not assigned to any pay period).
 */
export async function listUnassignedCommissions(
  page: number = 1,
  pageSize: number = 20
): Promise<EarnedCommissionsListResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
  });
  return api.get<EarnedCommissionsListResponse>(
    `/commissions/pay-periods/unassigned?${params.toString()}`
  );
}

/**
 * List earned commissions for the studio.
 */
export async function listEarnedCommissions(
  page: number = 1,
  pageSize: number = 20,
  options?: {
    artistId?: string;
    startDate?: string;
    endDate?: string;
    unpaidOnly?: boolean;
  }
): Promise<EarnedCommissionsListResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
  });
  if (options?.artistId) {
    params.append('artist_id', options.artistId);
  }
  if (options?.startDate) {
    params.append('start_date', options.startDate);
  }
  if (options?.endDate) {
    params.append('end_date', options.endDate);
  }
  if (options?.unpaidOnly) {
    params.append('unpaid_only', 'true');
  }
  return api.get<EarnedCommissionsListResponse>(`/commissions/earned?${params.toString()}`);
}

// ============ Payout Reports ============

/**
 * Get payout history report showing paid pay periods with artist breakdowns.
 */
export async function getPayoutHistory(
  page: number = 1,
  pageSize: number = 20,
  options?: {
    startDate?: string;
    endDate?: string;
  }
): Promise<PayoutHistoryResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
  });
  if (options?.startDate) {
    params.append('start_date', options.startDate);
  }
  if (options?.endDate) {
    params.append('end_date', options.endDate);
  }
  return api.get<PayoutHistoryResponse>(`/commissions/reports/payout-history?${params.toString()}`);
}

/**
 * Get artist payouts report showing totals per artist.
 */
export async function getArtistPayoutsReport(options?: {
  startDate?: string;
  endDate?: string;
  paidOnly?: boolean;
}): Promise<ArtistPayoutReportResponse> {
  const params = new URLSearchParams();
  if (options?.startDate) {
    params.append('start_date', options.startDate);
  }
  if (options?.endDate) {
    params.append('end_date', options.endDate);
  }
  if (options?.paidOnly !== undefined) {
    params.append('paid_only', options.paidOnly.toString());
  }
  return api.get<ArtistPayoutReportResponse>(`/commissions/reports/artist-payouts?${params.toString()}`);
}

// ============ Tip Distribution ============

/**
 * Get tip distribution settings for the studio.
 */
export async function getTipSettings(): Promise<TipSettings> {
  return api.get<TipSettings>('/commissions/tips/settings');
}

/**
 * Update tip distribution settings for the studio.
 */
export async function updateTipSettings(data: TipSettingsUpdate): Promise<TipSettings> {
  return api.put<TipSettings>('/commissions/tips/settings', data);
}

/**
 * Get tip distribution report showing tips by artist with card/cash breakdown.
 */
export async function getTipReport(options?: {
  startDate?: string;
  endDate?: string;
}): Promise<TipReportResponse> {
  const params = new URLSearchParams();
  if (options?.startDate) {
    params.append('start_date', options.startDate);
  }
  if (options?.endDate) {
    params.append('end_date', options.endDate);
  }
  return api.get<TipReportResponse>(`/commissions/tips/report?${params.toString()}`);
}
