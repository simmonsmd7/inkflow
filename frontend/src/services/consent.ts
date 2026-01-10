/**
 * Consent forms API service.
 */

import api from './api';
import type {
  ConsentAuditLogsListResponse,
  ConsentFormTemplate,
  ConsentFormTemplateCreate,
  ConsentFormTemplatesListResponse,
  ConsentFormTemplateUpdate,
  ConsentSubmission,
  ConsentSubmissionsListResponse,
  CreateFromPrebuiltInput,
  PrebuiltTemplatesListResponse,
  SubmitSigningInput,
  SubmitSigningResponse,
  VerifyPhotoIdInput,
  VerifyPhotoIdResponse,
  VoidConsentInput,
  VoidConsentResponse,
} from '../types/api';

// === Pre-built Templates ===

export async function listPrebuiltTemplates(): Promise<PrebuiltTemplatesListResponse> {
  return api.get<PrebuiltTemplatesListResponse>('/consent/prebuilt');
}

export async function createFromPrebuilt(
  data: CreateFromPrebuiltInput
): Promise<ConsentFormTemplate> {
  return api.post<ConsentFormTemplate>('/consent/templates/from-prebuilt', data);
}

// === Template CRUD ===

export async function listTemplates(params?: {
  page?: number;
  page_size?: number;
  active_only?: boolean;
}): Promise<ConsentFormTemplatesListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.page_size) searchParams.set('page_size', params.page_size.toString());
  if (params?.active_only !== undefined) searchParams.set('active_only', params.active_only.toString());

  const query = searchParams.toString();
  return api.get<ConsentFormTemplatesListResponse>(`/consent/templates${query ? `?${query}` : ''}`);
}

export async function getTemplate(templateId: string): Promise<ConsentFormTemplate> {
  return api.get<ConsentFormTemplate>(`/consent/templates/${templateId}`);
}

export async function createTemplate(data: ConsentFormTemplateCreate): Promise<ConsentFormTemplate> {
  return api.post<ConsentFormTemplate>('/consent/templates', data);
}

export async function updateTemplate(
  templateId: string,
  data: ConsentFormTemplateUpdate
): Promise<ConsentFormTemplate> {
  return api.put<ConsentFormTemplate>(`/consent/templates/${templateId}`, data);
}

export async function deleteTemplate(templateId: string): Promise<void> {
  return api.delete(`/consent/templates/${templateId}`);
}

// === Submissions ===

export async function listSubmissions(params?: {
  page?: number;
  page_size?: number;
  client_email?: string;
  booking_request_id?: string;
  include_voided?: boolean;
}): Promise<ConsentSubmissionsListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.page_size) searchParams.set('page_size', params.page_size.toString());
  if (params?.client_email) searchParams.set('client_email', params.client_email);
  if (params?.booking_request_id) searchParams.set('booking_request_id', params.booking_request_id);
  if (params?.include_voided !== undefined) searchParams.set('include_voided', params.include_voided.toString());

  const query = searchParams.toString();
  return api.get<ConsentSubmissionsListResponse>(`/consent/submissions${query ? `?${query}` : ''}`);
}

export async function getSubmission(submissionId: string): Promise<ConsentSubmission> {
  return api.get<ConsentSubmission>(`/consent/submissions/${submissionId}`);
}

export async function verifyPhotoId(
  submissionId: string,
  data: VerifyPhotoIdInput
): Promise<VerifyPhotoIdResponse> {
  return api.post<VerifyPhotoIdResponse>(
    `/consent/submissions/${submissionId}/verify-photo-id`,
    data
  );
}

export async function voidSubmission(
  submissionId: string,
  data: VoidConsentInput
): Promise<VoidConsentResponse> {
  return api.post<VoidConsentResponse>(`/consent/submissions/${submissionId}/void`, data);
}

export async function getSubmissionAuditLog(
  submissionId: string,
  params?: { page?: number; page_size?: number }
): Promise<ConsentAuditLogsListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.page_size) searchParams.set('page_size', params.page_size.toString());

  const query = searchParams.toString();
  return api.get<ConsentAuditLogsListResponse>(
    `/consent/submissions/${submissionId}/audit-log${query ? `?${query}` : ''}`
  );
}

// === Public Signing ===

export async function getTemplateForSigning(
  studioSlug: string,
  templateId: string
): Promise<ConsentFormTemplate> {
  return api.get<ConsentFormTemplate>(`/consent/sign/${studioSlug}/${templateId}`);
}

export async function submitSignedConsent(
  studioSlug: string,
  data: SubmitSigningInput
): Promise<SubmitSigningResponse> {
  return api.post<SubmitSigningResponse>(`/consent/sign/${studioSlug}`, data);
}

export async function uploadPhotoIdForSubmission(
  submissionId: string,
  file: File
): Promise<{ photo_id_url: string; message: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/consent/submissions/${submissionId}/photo-id`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to upload photo ID');
  }

  return response.json();
}

// === Helper Functions ===

export function generateFieldId(): string {
  return `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function getFieldTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    text: 'Text Input',
    textarea: 'Text Area',
    checkbox: 'Checkbox',
    signature: 'Signature',
    date: 'Date Picker',
    select: 'Dropdown',
    radio: 'Radio Buttons',
    photo_id: 'Photo ID Upload',
    heading: 'Heading',
    paragraph: 'Paragraph',
  };
  return labels[type] || type;
}

export function getFieldTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    text: 'T',
    textarea: 'P',
    checkbox: '[]',
    signature: 'S',
    date: 'D',
    select: 'v',
    radio: 'o',
    photo_id: 'ID',
    heading: 'H',
    paragraph: 'P',
  };
  return icons[type] || '?';
}
