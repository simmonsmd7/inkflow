/**
 * Messages API service for unified inbox.
 */

import { api } from './api';
import type {
  Conversation,
  ConversationCreate,
  ConversationsListResponse,
  ConversationStatus,
  ConversationSummary,
  ConversationUpdate,
  ConversationWithBooking,
  CreateConversationFromBookingInput,
  InboxMessage,
  InboxStats,
  MarkReadResponse,
  MessageCreate,
  AssignConversationResponse,
  TeamMembersResponse,
  ReplyTemplate,
  ReplyTemplateCreate,
  ReplyTemplateUpdate,
  ReplyTemplatesListResponse,
  TemplateCategoriesResponse,
} from '../types/api';

const BASE_URL = '/api/v1/messages';

export interface ListConversationsParams {
  skip?: number;
  limit?: number;
  status?: ConversationStatus;
  assigned_to_me?: boolean;
  search?: string;
}

/**
 * List conversations with optional filtering.
 */
export async function listConversations(
  params: ListConversationsParams = {}
): Promise<ConversationsListResponse> {
  const searchParams = new URLSearchParams();

  if (params.skip !== undefined) searchParams.set('skip', String(params.skip));
  if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
  if (params.status) searchParams.set('status', params.status);
  if (params.assigned_to_me) searchParams.set('assigned_to_me', 'true');
  if (params.search) searchParams.set('search', params.search);

  const queryString = searchParams.toString();
  const url = `${BASE_URL}/conversations${queryString ? `?${queryString}` : ''}`;

  return api.get<ConversationsListResponse>(url);
}

/**
 * Create a new conversation.
 */
export async function createConversation(
  data: ConversationCreate
): Promise<Conversation> {
  return api.post<Conversation>(`${BASE_URL}/conversations`, data);
}

/**
 * Get a conversation with all its messages and booking details.
 */
export async function getConversation(conversationId: string): Promise<ConversationWithBooking> {
  return api.get<ConversationWithBooking>(`${BASE_URL}/conversations/${conversationId}`);
}

/**
 * Update a conversation's status or assignment.
 */
export async function updateConversation(
  conversationId: string,
  data: ConversationUpdate
): Promise<ConversationSummary> {
  return api.patch<ConversationSummary>(`${BASE_URL}/conversations/${conversationId}`, data);
}

/**
 * Assign a conversation to a team member.
 */
export async function assignConversation(
  conversationId: string,
  assigneeId: string | null
): Promise<AssignConversationResponse> {
  const params = assigneeId ? `?assignee_id=${assigneeId}` : '';
  return api.post<AssignConversationResponse>(
    `${BASE_URL}/conversations/${conversationId}/assign${params}`
  );
}

/**
 * Send a message in a conversation.
 */
export async function sendMessage(
  conversationId: string,
  data: MessageCreate
): Promise<InboxMessage> {
  return api.post<InboxMessage>(`${BASE_URL}/conversations/${conversationId}/messages`, data);
}

/**
 * Mark all unread messages in a conversation as read.
 */
export async function markConversationRead(
  conversationId: string
): Promise<MarkReadResponse> {
  return api.post<MarkReadResponse>(`${BASE_URL}/conversations/${conversationId}/mark-read`);
}

/**
 * Get inbox statistics.
 */
export async function getInboxStats(): Promise<InboxStats> {
  return api.get<InboxStats>(`${BASE_URL}/stats`);
}

/**
 * Get team members for assignment dropdown.
 */
export async function getTeamMembers(): Promise<TeamMembersResponse> {
  return api.get<TeamMembersResponse>(`${BASE_URL}/team-members`);
}

/**
 * Create a conversation from a booking request.
 */
export async function createConversationFromBooking(
  data: CreateConversationFromBookingInput
): Promise<ConversationWithBooking> {
  return api.post<ConversationWithBooking>(`${BASE_URL}/from-booking`, data);
}

// ============ Reply Templates ============

export interface ListTemplatesParams {
  skip?: number;
  limit?: number;
  category?: string;
  search?: string;
}

/**
 * List reply templates accessible to the current user.
 */
export async function listReplyTemplates(
  params: ListTemplatesParams = {}
): Promise<ReplyTemplatesListResponse> {
  const searchParams = new URLSearchParams();

  if (params.skip !== undefined) searchParams.set('skip', String(params.skip));
  if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
  if (params.category) searchParams.set('category', params.category);
  if (params.search) searchParams.set('search', params.search);

  const queryString = searchParams.toString();
  const url = `${BASE_URL}/templates${queryString ? `?${queryString}` : ''}`;

  return api.get<ReplyTemplatesListResponse>(url);
}

/**
 * Create a new reply template.
 */
export async function createReplyTemplate(
  data: ReplyTemplateCreate
): Promise<ReplyTemplate> {
  return api.post<ReplyTemplate>(`${BASE_URL}/templates`, data);
}

/**
 * Get a specific reply template.
 */
export async function getReplyTemplate(templateId: string): Promise<ReplyTemplate> {
  return api.get<ReplyTemplate>(`${BASE_URL}/templates/${templateId}`);
}

/**
 * Update a reply template.
 */
export async function updateReplyTemplate(
  templateId: string,
  data: ReplyTemplateUpdate
): Promise<ReplyTemplate> {
  return api.put<ReplyTemplate>(`${BASE_URL}/templates/${templateId}`, data);
}

/**
 * Delete a reply template.
 */
export async function deleteReplyTemplate(templateId: string): Promise<void> {
  return api.delete(`${BASE_URL}/templates/${templateId}`);
}

/**
 * Mark a template as used and get its content.
 */
export async function useReplyTemplate(templateId: string): Promise<ReplyTemplate> {
  return api.post<ReplyTemplate>(`${BASE_URL}/templates/${templateId}/use`);
}

/**
 * Get all unique template categories.
 */
export async function getTemplateCategories(): Promise<TemplateCategoriesResponse> {
  return api.get<TemplateCategoriesResponse>(`${BASE_URL}/templates/categories/list`);
}
