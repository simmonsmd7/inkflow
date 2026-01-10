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
} from '../types/api';

// === Pre-built Templates ===

export async function listPrebuiltTemplates(): Promise<PrebuiltAftercareTemplatesResponse> {
  return api.get<PrebuiltAftercareTemplatesResponse>('/aftercare/prebuilt');
}

export async function createFromPrebuilt(templateId: string): Promise<AftercareTemplateResponse> {
  return api.post<AftercareTemplateResponse>(`/aftercare/prebuilt/${templateId}/create`, {});
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
  return api.get<AftercareTemplateListResponse>(`/aftercare/templates${query ? `?${query}` : ''}`);
}

export async function getTemplate(templateId: string): Promise<AftercareTemplateResponse> {
  return api.get<AftercareTemplateResponse>(`/aftercare/templates/${templateId}`);
}

export async function createTemplate(data: AftercareTemplateCreate): Promise<AftercareTemplateResponse> {
  return api.post<AftercareTemplateResponse>('/aftercare/templates', data);
}

export async function updateTemplate(
  templateId: string,
  data: AftercareTemplateUpdate
): Promise<AftercareTemplateResponse> {
  return api.patch<AftercareTemplateResponse>(`/aftercare/templates/${templateId}`, data);
}

export async function deleteTemplate(templateId: string): Promise<void> {
  return api.delete(`/aftercare/templates/${templateId}`);
}

// === Enum Lists ===

export async function listTattooTypes(): Promise<{ types: TattooType[] }> {
  return api.get<{ types: TattooType[] }>('/aftercare/tattoo-types');
}

export async function listPlacements(): Promise<{ placements: TattooPlacement[] }> {
  return api.get<{ placements: TattooPlacement[] }>('/aftercare/placements');
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
  return api.get<AftercareSentListResponse>(`/aftercare/sent${query ? `?${query}` : ''}`);
}

export async function getSentAftercare(sentId: string): Promise<AftercareSentResponse> {
  return api.get<AftercareSentResponse>(`/aftercare/sent/${sentId}`);
}

export async function sendAftercare(data: AftercareSendInput): Promise<AftercareSentResponse> {
  return api.post<AftercareSentResponse>('/aftercare/send', data);
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
