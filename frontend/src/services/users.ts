/**
 * Users service for team management API calls.
 */

import { api } from './api';
import type {
  MessageResponse,
  User,
  UserDetailResponse,
  UserInvite,
  UsersListResponse,
  UserUpdate,
} from '../types/api';

/**
 * Fetch all users (owner only).
 */
export async function getUsers(
  skip = 0,
  limit = 100,
  includeInactive = false
): Promise<UsersListResponse> {
  const params = new URLSearchParams({
    skip: skip.toString(),
    limit: limit.toString(),
    include_inactive: includeInactive.toString(),
  });
  return api.get<UsersListResponse>(`/api/v1/users?${params}`);
}

/**
 * Get a specific user by ID (owner only).
 */
export async function getUser(userId: string): Promise<UserDetailResponse> {
  return api.get<UserDetailResponse>(`/api/v1/users/${userId}`);
}

/**
 * Update a user (owner only).
 */
export async function updateUser(
  userId: string,
  data: UserUpdate
): Promise<User> {
  return api.put<User>(`/api/v1/users/${userId}`, data);
}

/**
 * Invite a new team member (owner only).
 */
export async function inviteUser(data: UserInvite): Promise<MessageResponse> {
  return api.post<MessageResponse>('/api/v1/users/invite', data);
}

/**
 * Deactivate a user (owner only).
 */
export async function deactivateUser(userId: string): Promise<MessageResponse> {
  return api.delete<MessageResponse>(`/api/v1/users/${userId}`);
}
