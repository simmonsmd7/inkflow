/**
 * Aftercare API service.
 */

import api from './api';
import type {
  AftercareTemplateCreate,
  AftercareTemplateListResponse,
  AftercareTemplateResponse,
  AftercareTemplateUpdate,
  AftercareSentListResponse,
  AftercareSentResponse,
  AftercareSendInput,
  PrebuiltAftercareTemplatesResponse,
  TattooPlacement,
  TattooType,
  FollowUpListResponse,
  FollowUpResponse,
  FollowUpUpdate,
  PendingFollowUpsResponse,
  ProcessFollowUpsResult,
  SendFollowUpInput,
  SendFollowUpResponse,
  CancelFollowUpResponse,
  FollowUpStatus,
  FollowUpType,
  HealingIssueListResponse,
  HealingIssueResponse,
  HealingIssueSummary,
  HealingIssueUpdate,
  HealingIssueSeverity,
  HealingIssueStatus,
  HealingIssueWithTouchUp,
  TouchUpScheduleInput,
  TouchUpResponse,
  ClientTouchUpRequestInput,
  ClientTouchUpRequestResponse,
} from '../types/api';

// === Pre-built Templates ===

export async function listPrebuiltTemplates(): Promise<PrebuiltAftercareTemplatesResponse> {
  return api.get<PrebuiltAftercareTemplatesResponse>('/api/v1/aftercare/prebuilt');
}

export async function createFromPrebuilt(templateId: string): Promise<AftercareTemplateResponse> {
  return api.post<AftercareTemplateResponse>(`/api/v1/aftercare/prebuilt/${templateId}/create`, {});
}

// === Template CRUD ===

export async function listTemplates(params?: {
  page?: number;
  page_size?: number;
  is_active?: boolean;
  tattoo_type?: TattooType;
  placement?: TattooPlacement;
}): Promise<AftercareTemplateListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.page_size) searchParams.set('page_size', params.page_size.toString());
  if (params?.is_active !== undefined) searchParams.set('is_active', params.is_active.toString());
  if (params?.tattoo_type) searchParams.set('tattoo_type', params.tattoo_type);
  if (params?.placement) searchParams.set('placement', params.placement);

  const query = searchParams.toString();
  return api.get<AftercareTemplateListResponse>(`/api/v1/aftercare/templates${query ? `?${query}` : ''}`);
}

export async function getTemplate(templateId: string): Promise<AftercareTemplateResponse> {
  return api.get<AftercareTemplateResponse>(`/api/v1/aftercare/templates/${templateId}`);
}

export async function createTemplate(data: AftercareTemplateCreate): Promise<AftercareTemplateResponse> {
  return api.post<AftercareTemplateResponse>('/api/v1/aftercare/templates', data);
}

export async function updateTemplate(
  templateId: string,
  data: AftercareTemplateUpdate
): Promise<AftercareTemplateResponse> {
  return api.patch<AftercareTemplateResponse>(`/api/v1/aftercare/templates/${templateId}`, data);
}

export async function deleteTemplate(templateId: string): Promise<void> {
  return api.delete(`/api/v1/aftercare/templates/${templateId}`);
}

// === Enum Lists ===

export async function listTattooTypes(): Promise<{ types: TattooType[] }> {
  return api.get<{ types: TattooType[] }>('/api/v1/aftercare/tattoo-types');
}

export async function listPlacements(): Promise<{ placements: TattooPlacement[] }> {
  return api.get<{ placements: TattooPlacement[] }>('/api/v1/aftercare/placements');
}

// === Helper functions ===

export function getTattooTypeLabel(type: TattooType): string {
  const labels: Record<TattooType, string> = {
    traditional: 'Traditional',
    fine_line: 'Fine Line',
    blackwork: 'Blackwork',
    watercolor: 'Watercolor',
    realism: 'Realism',
    neo_traditional: 'Neo-Traditional',
    geometric: 'Geometric',
    tribal: 'Tribal',
    dotwork: 'Dotwork',
    script: 'Script/Lettering',
    cover_up: 'Cover-Up',
    touch_up: 'Touch-Up',
    other: 'Other',
  };
  return labels[type] || type;
}

export function getPlacementLabel(placement: TattooPlacement): string {
  const labels: Record<TattooPlacement, string> = {
    arm_upper: 'Upper Arm',
    arm_lower: 'Lower Arm/Forearm',
    arm_inner: 'Inner Arm',
    hand: 'Hand',
    finger: 'Finger',
    leg_upper: 'Upper Leg/Thigh',
    leg_lower: 'Lower Leg/Calf',
    foot: 'Foot',
    chest: 'Chest',
    back: 'Back',
    ribs: 'Ribs/Side',
    stomach: 'Stomach',
    neck: 'Neck',
    face: 'Face',
    head: 'Head/Scalp',
    shoulder: 'Shoulder',
    hip: 'Hip',
    other: 'Other',
  };
  return labels[placement] || placement;
}

// === Sent Aftercare ===

export async function listSentAftercare(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  client_email?: string;
}): Promise<AftercareSentListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.page_size) searchParams.set('page_size', params.page_size.toString());
  if (params?.status) searchParams.set('status', params.status);
  if (params?.client_email) searchParams.set('client_email', params.client_email);

  const query = searchParams.toString();
  return api.get<AftercareSentListResponse>(`/api/v1/aftercare/sent${query ? `?${query}` : ''}`);
}

export async function getSentAftercare(sentId: string): Promise<AftercareSentResponse> {
  return api.get<AftercareSentResponse>(`/api/v1/aftercare/sent/${sentId}`);
}

export async function sendAftercare(data: AftercareSendInput): Promise<AftercareSentResponse> {
  return api.post<AftercareSentResponse>('/api/v1/aftercare/send', data);
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    sent: 'Sent',
    delivered: 'Viewed',
    failed: 'Failed',
  };
  return labels[status] || status;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-400',
    sent: 'bg-blue-500/10 text-blue-400',
    delivered: 'bg-green-500/10 text-green-400',
    failed: 'bg-red-500/10 text-red-400',
  };
  return colors[status] || 'bg-ink-600 text-ink-400';
}

// === Follow-Up Management ===

export async function listFollowUps(params?: {
  page?: number;
  page_size?: number;
  status?: FollowUpStatus;
  follow_up_type?: FollowUpType;
  aftercare_sent_id?: string;
}): Promise<FollowUpListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.page_size) searchParams.set('page_size', params.page_size.toString());
  if (params?.status) searchParams.set('status', params.status);
  if (params?.follow_up_type) searchParams.set('follow_up_type', params.follow_up_type);
  if (params?.aftercare_sent_id) searchParams.set('aftercare_sent_id', params.aftercare_sent_id);

  const query = searchParams.toString();
  return api.get<FollowUpListResponse>(`/api/v1/aftercare/follow-ups${query ? `?${query}` : ''}`);
}

export async function getPendingFollowUps(limit?: number): Promise<PendingFollowUpsResponse> {
  const query = limit ? `?limit=${limit}` : '';
  return api.get<PendingFollowUpsResponse>(`/api/v1/aftercare/follow-ups/pending${query}`);
}

export async function processFollowUps(limit?: number): Promise<ProcessFollowUpsResult> {
  const query = limit ? `?limit=${limit}` : '';
  return api.post<ProcessFollowUpsResult>(`/api/v1/aftercare/follow-ups/process${query}`, {});
}

export async function getFollowUp(followUpId: string): Promise<FollowUpResponse> {
  return api.get<FollowUpResponse>(`/api/v1/aftercare/follow-ups/${followUpId}`);
}

export async function updateFollowUp(
  followUpId: string,
  data: FollowUpUpdate
): Promise<FollowUpResponse> {
  return api.patch<FollowUpResponse>(`/api/v1/aftercare/follow-ups/${followUpId}`, data);
}

export async function sendFollowUpNow(
  followUpId: string,
  data?: SendFollowUpInput
): Promise<SendFollowUpResponse> {
  return api.post<SendFollowUpResponse>(
    `/api/v1/aftercare/follow-ups/${followUpId}/send`,
    data || {}
  );
}

export async function cancelFollowUp(followUpId: string): Promise<CancelFollowUpResponse> {
  return api.post<CancelFollowUpResponse>(`/api/v1/aftercare/follow-ups/${followUpId}/cancel`, {});
}

// === Follow-Up Helper Functions ===

export function getFollowUpTypeLabel(type: FollowUpType): string {
  const labels: Record<FollowUpType, string> = {
    day_3: 'Day 3 Check-in',
    week_1: 'Week 1 Check-in',
    week_2: 'Week 2 Check-in',
    week_4: 'Week 4 Check-in',
    custom: 'Custom Follow-up',
  };
  return labels[type] || type;
}

export function getFollowUpStatusLabel(status: FollowUpStatus): string {
  const labels: Record<FollowUpStatus, string> = {
    scheduled: 'Scheduled',
    sent: 'Sent',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    failed: 'Failed',
  };
  return labels[status] || status;
}

export function getFollowUpStatusColor(status: FollowUpStatus): string {
  const colors: Record<FollowUpStatus, string> = {
    scheduled: 'bg-blue-500/10 text-blue-400',
    sent: 'bg-green-500/10 text-green-400',
    delivered: 'bg-green-500/10 text-green-400',
    cancelled: 'bg-ink-600 text-ink-400',
    failed: 'bg-red-500/10 text-red-400',
  };
  return colors[status] || 'bg-ink-600 text-ink-400';
}

// === Healing Issue Management ===

export async function listHealingIssues(params?: {
  page?: number;
  page_size?: number;
  status?: HealingIssueStatus;
  severity?: HealingIssueSeverity;
}): Promise<HealingIssueListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.page_size) searchParams.set('page_size', params.page_size.toString());
  if (params?.status) searchParams.set('status', params.status);
  if (params?.severity) searchParams.set('severity', params.severity);

  const query = searchParams.toString();
  return api.get<HealingIssueListResponse>(`/api/v1/aftercare/healing-issues${query ? `?${query}` : ''}`);
}

export async function getHealingIssue(issueId: string): Promise<HealingIssueResponse> {
  return api.get<HealingIssueResponse>(`/api/v1/aftercare/healing-issues/${issueId}`);
}

export async function updateHealingIssue(
  issueId: string,
  data: HealingIssueUpdate
): Promise<HealingIssueResponse> {
  return api.patch<HealingIssueResponse>(`/api/v1/aftercare/healing-issues/${issueId}`, data);
}

export async function acknowledgeHealingIssue(
  issueId: string,
  staffNotes?: string
): Promise<HealingIssueResponse> {
  const query = staffNotes ? `?staff_notes=${encodeURIComponent(staffNotes)}` : '';
  return api.post<HealingIssueResponse>(`/api/v1/aftercare/healing-issues/${issueId}/acknowledge${query}`, {});
}

export async function resolveHealingIssue(
  issueId: string,
  resolutionNotes: string,
  requestTouchUp: boolean = false
): Promise<HealingIssueResponse> {
  const params = new URLSearchParams();
  params.set('resolution_notes', resolutionNotes);
  params.set('request_touch_up', requestTouchUp.toString());
  return api.post<HealingIssueResponse>(
    `/api/v1/aftercare/healing-issues/${issueId}/resolve?${params.toString()}`,
    {}
  );
}

// === Healing Issue Helper Functions ===

export function getHealingIssueSeverityLabel(severity: HealingIssueSeverity): string {
  const labels: Record<HealingIssueSeverity, string> = {
    minor: 'Minor',
    moderate: 'Moderate',
    concerning: 'Concerning',
    urgent: 'Urgent',
  };
  return labels[severity] || severity;
}

export function getHealingIssueSeverityColor(severity: HealingIssueSeverity): string {
  const colors: Record<HealingIssueSeverity, string> = {
    minor: 'bg-green-500/10 text-green-400',
    moderate: 'bg-yellow-500/10 text-yellow-400',
    concerning: 'bg-orange-500/10 text-orange-400',
    urgent: 'bg-red-500/10 text-red-400',
  };
  return colors[severity] || 'bg-ink-600 text-ink-400';
}

export function getHealingIssueStatusLabel(status: HealingIssueStatus): string {
  const labels: Record<HealingIssueStatus, string> = {
    reported: 'Reported',
    acknowledged: 'Acknowledged',
    in_progress: 'In Progress',
    resolved: 'Resolved',
    escalated: 'Escalated',
  };
  return labels[status] || status;
}

export function getHealingIssueStatusColor(status: HealingIssueStatus): string {
  const colors: Record<HealingIssueStatus, string> = {
    reported: 'bg-red-500/10 text-red-400',
    acknowledged: 'bg-blue-500/10 text-blue-400',
    in_progress: 'bg-yellow-500/10 text-yellow-400',
    resolved: 'bg-green-500/10 text-green-400',
    escalated: 'bg-purple-500/10 text-purple-400',
  };
  return colors[status] || 'bg-ink-600 text-ink-400';
}

// Symptoms list for UI
export const HEALING_ISSUE_SYMPTOMS = [
  { id: 'redness', label: 'Excessive Redness' },
  { id: 'swelling', label: 'Swelling' },
  { id: 'itching', label: 'Intense Itching' },
  { id: 'oozing', label: 'Oozing or Discharge' },
  { id: 'scabbing', label: 'Excessive Scabbing' },
  { id: 'color_loss', label: 'Color Loss or Fading' },
  { id: 'infection_signs', label: 'Signs of Infection' },
  { id: 'pain', label: 'Unusual Pain' },
  { id: 'bumps', label: 'Bumps or Raised Areas' },
  { id: 'bleeding', label: 'Bleeding' },
];

// === Touch-up Scheduling ===

/**
 * Get a healing issue with its touch-up booking information.
 */
export async function getHealingIssueWithTouchUp(
  issueId: string
): Promise<HealingIssueWithTouchUp> {
  return api.get<HealingIssueWithTouchUp>(`/api/v1/aftercare/healing-issues/${issueId}/touch-up`);
}

/**
 * Schedule a touch-up appointment for a healing issue.
 */
export async function scheduleTouchUp(
  issueId: string,
  data: TouchUpScheduleInput
): Promise<TouchUpResponse> {
  return api.post<TouchUpResponse>(
    `/api/v1/aftercare/healing-issues/${issueId}/schedule-touch-up`,
    data
  );
}

/**
 * Get all healing issues that need touch-ups but haven't been scheduled yet.
 */
export async function getPendingTouchUps(): Promise<HealingIssueSummary[]> {
  return api.get<HealingIssueSummary[]>('/api/v1/aftercare/touch-up/pending');
}

/**
 * Unlink a touch-up booking from a healing issue.
 */
export async function cancelTouchUp(issueId: string): Promise<void> {
  return api.delete(`/api/v1/aftercare/healing-issues/${issueId}/touch-up`);
}

/**
 * Client-facing: Request a touch-up via aftercare access token (public endpoint).
 */
export async function clientRequestTouchUp(
  accessToken: string,
  data: ClientTouchUpRequestInput
): Promise<ClientTouchUpRequestResponse> {
  return api.post<ClientTouchUpRequestResponse>(
    `/api/v1/aftercare/touch-up/request/${accessToken}`,
    data
  );
}
