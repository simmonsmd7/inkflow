/**
 * Commission management API service.
 */

import { api } from './api';
import type {
  ArtistCommissionInfo,
  ArtistsWithCommissionResponse,
  AssignCommissionRuleInput,
  CommissionCalculationInput,
  CommissionCalculationResult,
  CommissionRule,
  CommissionRuleCreate,
  CommissionRulesListResponse,
  CommissionRuleUpdate,
  MessageResponse,
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
