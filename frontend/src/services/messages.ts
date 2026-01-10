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
