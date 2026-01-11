/**
 * Availability API service for managing artist schedules and time-off.
 */

import { api } from './api';
import type {
  AvailabilitySlot,
  AvailabilitySlotCreate,
  BulkAvailabilityUpdate,
  MessageResponse,
  TimeOff,
  TimeOffCreate,
  TimeOffListResponse,
  TimeOffUpdate,
  WeeklySchedule,
} from '../types/api';

const BASE_URL = '/api/v1/availability';

/**
 * Get current artist's weekly availability schedule.
 */
export async function getMyAvailability(): Promise<WeeklySchedule> {
  return api.get<WeeklySchedule>(`${BASE_URL}/me`);
}

/**
 * Update current artist's weekly availability schedule (bulk replace).
 */
export async function updateMyAvailability(
  data: BulkAvailabilityUpdate
): Promise<WeeklySchedule> {
  return api.put<WeeklySchedule>(`${BASE_URL}/me`, data);
}

/**
 * Add a single availability slot.
 */
export async function addAvailabilitySlot(
  data: AvailabilitySlotCreate
): Promise<AvailabilitySlot> {
  return api.post<AvailabilitySlot>(`${BASE_URL}/me/slot`, data);
}

/**
 * Update a single availability slot.
 */
export async function updateAvailabilitySlot(
  slotId: string,
  data: Partial<AvailabilitySlotCreate>
): Promise<AvailabilitySlot> {
  return api.put<AvailabilitySlot>(`${BASE_URL}/me/slot/${slotId}`, data);
}

/**
 * Delete a single availability slot.
 */
export async function deleteAvailabilitySlot(slotId: string): Promise<MessageResponse> {
  return api.delete<MessageResponse>(`${BASE_URL}/me/slot/${slotId}`);
}

/**
 * Get an artist's public availability schedule.
 */
export async function getArtistAvailability(artistId: string): Promise<WeeklySchedule> {
  return api.get<WeeklySchedule>(`${BASE_URL}/${artistId}`);
}

// Time-off management

/**
 * Get current artist's time-off periods.
 */
export async function getMyTimeOff(upcomingOnly = true): Promise<TimeOffListResponse> {
  const params = new URLSearchParams();
  params.set('upcoming_only', String(upcomingOnly));
  return api.get<TimeOffListResponse>(`${BASE_URL}/me/time-off?${params}`);
}

/**
 * Add a time-off period.
 */
export async function addTimeOff(data: TimeOffCreate): Promise<TimeOff> {
  return api.post<TimeOff>(`${BASE_URL}/me/time-off`, data);
}

/**
 * Update a time-off period.
 */
export async function updateTimeOff(
  timeOffId: string,
  data: TimeOffUpdate
): Promise<TimeOff> {
  return api.put<TimeOff>(`${BASE_URL}/me/time-off/${timeOffId}`, data);
}

/**
 * Delete a time-off period.
 */
export async function deleteTimeOff(timeOffId: string): Promise<MessageResponse> {
  return api.delete<MessageResponse>(`${BASE_URL}/me/time-off/${timeOffId}`);
}

/**
 * Get an artist's public time-off periods.
 */
export async function getArtistTimeOff(artistId: string): Promise<TimeOffListResponse> {
  return api.get<TimeOffListResponse>(`${BASE_URL}/${artistId}/time-off`);
}
