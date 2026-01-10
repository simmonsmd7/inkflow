/**
 * API response types for the InkFlow backend.
 */

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  app: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
}

export interface ApiHealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  api_version: string;
}

export interface RootResponse {
  message: string;
  docs: string;
}

export interface ErrorResponse {
  detail: string;
}

// User roles
export type UserRole = 'owner' | 'artist' | 'receptionist';

// User types
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface UserDetailResponse extends User {
  last_login_at: string | null;
  verified_at: string | null;
  updated_at: string;
}

// Auth request types
export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role?: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// Auth response types
export interface MessageResponse {
  message: string;
  success: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// User management types
export interface UserUpdate {
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  role?: UserRole;
  is_active?: boolean;
}

export interface UserInvite {
  email: string;
  first_name: string;
  last_name: string;
  role?: UserRole;
}

export interface UsersListResponse {
  users: User[];
  total: number;
  skip: number;
  limit: number;
}

// Studio types
export interface BusinessHoursDay {
  open: string | null;
  close: string | null;
  closed: boolean;
}

export interface BusinessHours {
  monday: BusinessHoursDay;
  tuesday: BusinessHoursDay;
  wednesday: BusinessHoursDay;
  thursday: BusinessHoursDay;
  friday: BusinessHoursDay;
  saturday: BusinessHoursDay;
  sunday: BusinessHoursDay;
}

export interface Studio {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  timezone: string;
  business_hours: BusinessHours | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface StudioCreate {
  name: string;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string;
  timezone?: string;
  business_hours?: BusinessHours | null;
}

export interface StudioUpdate {
  name?: string;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string;
  timezone?: string;
  business_hours?: BusinessHours | null;
}

export interface StudioListResponse {
  studios: Studio[];
  total: number;
  skip: number;
  limit: number;
}

export interface StudioLogoResponse {
  logo_url: string;
}

// Artist types
export interface PortfolioImage {
  id: string;
  image_url: string;
  thumbnail_url: string | null;
  title: string | null;
  description: string | null;
  style: string | null;
  placement: string | null;
  display_order: number;
  created_at: string;
}

export interface ArtistSummary {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  specialties: string[];
  years_experience: number | null;
  hourly_rate: number | null;
  portfolio_count: number;
}

export interface ArtistDetail {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  bio: string | null;
  specialties: string[];
  years_experience: number | null;
  hourly_rate: number | null;
  minimum_booking_hours: number | null;
  instagram_handle: string | null;
  website_url: string | null;
  portfolio_images: PortfolioImage[];
}

export interface ArtistProfileUpdate {
  bio?: string | null;
  specialties?: string[];
  years_experience?: number | null;
  hourly_rate?: number | null;
  minimum_booking_hours?: number | null;
  instagram_handle?: string | null;
  website_url?: string | null;
}

export interface PortfolioImageUpdate {
  title?: string | null;
  description?: string | null;
  style?: string | null;
  placement?: string | null;
  display_order?: number;
}

export interface ArtistsListResponse {
  artists: ArtistSummary[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

// Availability types
export interface AvailabilitySlot {
  id: string;
  user_id: string;
  day_of_week: number; // 0=Monday, 6=Sunday
  start_time: string; // HH:MM:SS
  end_time: string; // HH:MM:SS
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface AvailabilitySlotCreate {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available?: boolean;
}

export interface AvailabilitySlotUpdate {
  start_time?: string;
  end_time?: string;
  is_available?: boolean;
}

export interface WeeklySchedule {
  slots: AvailabilitySlot[];
  user_id: string;
}

export interface BulkAvailabilityUpdate {
  slots: AvailabilitySlotCreate[];
}

export interface TimeOff {
  id: string;
  user_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  reason: string | null;
  notes: string | null;
  all_day: boolean;
  created_at: string;
  updated_at: string;
}

export interface TimeOffCreate {
  start_date: string;
  end_date: string;
  reason?: string | null;
  notes?: string | null;
  all_day?: boolean;
}

export interface TimeOffUpdate {
  start_date?: string;
  end_date?: string;
  reason?: string | null;
  notes?: string | null;
  all_day?: boolean;
}

export interface TimeOffListResponse {
  time_off: TimeOff[];
  total: number;
}
