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

// Booking types
export type TattooSize =
  | 'tiny'
  | 'small'
  | 'medium'
  | 'large'
  | 'extra_large'
  | 'half_sleeve'
  | 'full_sleeve'
  | 'back_piece'
  | 'full_body';

export type BookingRequestStatus =
  | 'pending'
  | 'reviewing'
  | 'quoted'
  | 'deposit_requested'
  | 'deposit_paid'
  | 'confirmed'
  | 'completed'
  | 'no_show'
  | 'rejected'
  | 'cancelled';

export interface ReferenceImage {
  id: string;
  image_url: string;
  thumbnail_url: string | null;
  original_filename: string | null;
  display_order: number;
  notes: string | null;
  created_at: string;
}

export interface BookingRequestCreate {
  client_name: string;
  client_email: string;
  client_phone?: string | null;
  design_idea: string;
  placement: string;
  size: TattooSize;
  is_cover_up?: boolean;
  is_first_tattoo?: boolean;
  color_preference?: string | null;
  budget_range?: string | null;
  additional_notes?: string | null;
  preferred_artist_id?: string | null;
  preferred_dates?: string | null;
}

export interface BookingSubmissionResponse {
  message: string;
  request_id: string;
  status: string;
}

export interface ArtistOption {
  id: string;
  name: string;
  specialties: string[];
}

export interface BookingRequestSummary {
  id: string;
  client_name: string;
  client_email: string;
  design_idea: string;
  placement: string;
  size: TattooSize;
  status: BookingRequestStatus;
  preferred_artist_id: string | null;
  assigned_artist_id: string | null;
  quoted_price: number | null;
  scheduled_date: string | null;
  reference_image_count: number;
  created_at: string;
}

export interface BookingRequest {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  design_idea: string;
  placement: string;
  size: TattooSize;
  is_cover_up: boolean;
  is_first_tattoo: boolean;
  color_preference: string | null;
  budget_range: string | null;
  additional_notes: string | null;
  studio_id: string;
  preferred_artist_id: string | null;
  assigned_artist_id: string | null;
  status: BookingRequestStatus;
  quoted_price: number | null;
  deposit_amount: number | null;
  estimated_hours: number | null;
  quote_notes: string | null;
  quoted_at: string | null;
  deposit_requested_at: string | null;
  deposit_request_expires_at: string | null;
  deposit_paid_at: string | null;
  preferred_dates: string | null;
  scheduled_date: string | null;
  scheduled_duration_hours: number | null;
  internal_notes: string | null;
  reference_images: ReferenceImage[];
  created_at: string;
  updated_at: string;
}

export interface BookingRequestsListResponse {
  requests: BookingRequestSummary[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface BookingRequestUpdate {
  status?: BookingRequestStatus;
  assigned_artist_id?: string | null;
  quoted_price?: number | null;
  deposit_amount?: number | null;
  estimated_hours?: number | null;
  quote_notes?: string | null;
  scheduled_date?: string | null;
  scheduled_duration_hours?: number | null;
  internal_notes?: string | null;
}

// Deposit request types
export interface SendDepositRequestInput {
  deposit_amount: number; // In cents
  expires_in_days?: number; // Default 7
  message?: string | null;
}

export interface SendDepositRequestResponse {
  message: string;
  deposit_amount: number;
  expires_at: string;
  payment_url: string;
}

export interface DepositPaymentInfo {
  request_id: string;
  client_name: string;
  studio_name: string;
  artist_name: string | null;
  design_summary: string;
  quoted_price: number | null;
  deposit_amount: number;
  expires_at: string;
  is_expired: boolean;
  quote_notes: string | null;
}

// Booking confirmation types
export interface ConfirmBookingInput {
  scheduled_date: string; // ISO datetime string
  scheduled_duration_hours: number;
  send_confirmation_email?: boolean;
}

export interface BookingConfirmationResponse {
  message: string;
  request_id: string;
  status: string;
  scheduled_date: string;
  scheduled_duration_hours: number;
  confirmation_email_sent: boolean;
}

// Reschedule types
export interface RescheduleInput {
  new_date: string; // ISO datetime string
  new_duration_hours?: number;
  reason?: string;
  notify_client?: boolean;
}

export interface RescheduleResponse {
  message: string;
  request_id: string;
  old_date: string;
  new_date: string;
  reschedule_count: number;
  notification_sent: boolean;
}

// Cancel types
export type CancelledBy = 'client' | 'artist' | 'studio';

export interface CancelInput {
  reason?: string;
  cancelled_by?: CancelledBy;
  forfeit_deposit?: boolean;
  notify_client?: boolean;
}

export interface CancelResponse {
  message: string;
  request_id: string;
  status: string;
  cancelled_at: string;
  cancelled_by: string;
  deposit_forfeited: boolean;
  deposit_amount: number | null;
  notification_sent: boolean;
}

// No-show types
export interface MarkNoShowInput {
  notes?: string;
  forfeit_deposit?: boolean;
  notify_client?: boolean;
}

export interface NoShowResponse {
  message: string;
  request_id: string;
  status: string;
  no_show_at: string;
  deposit_forfeited: boolean;
  deposit_amount: number | null;
  notification_sent: boolean;
}

export interface ClientNoShowHistoryItem {
  request_id: string;
  scheduled_date: string | null;
  no_show_at: string;
  deposit_forfeited: boolean;
  deposit_amount: number | null;
  design_idea: string;
  studio_id: string;
}

export interface ClientNoShowHistory {
  client_email: string;
  total_bookings: number;
  no_show_count: number;
  no_show_rate: number;
  total_forfeited_deposits: number;
  no_shows: ClientNoShowHistoryItem[];
}

// ============ Messaging Types ============

export type ConversationStatus = 'unread' | 'pending' | 'resolved';

export type MessageChannel = 'internal' | 'email' | 'sms';

export type MessageDirection = 'inbound' | 'outbound';

export interface InboxMessage {
  id: string;
  conversation_id: string;
  content: string;
  channel: MessageChannel;
  direction: MessageDirection;
  sender_id: string | null;
  sender_name: string | null;
  external_id: string | null;
  is_read: boolean;
  read_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  // Email threading fields
  email_message_id: string | null;
  email_in_reply_to: string | null;
  email_subject: string | null;
  created_at: string;
}

export interface ConversationSummary {
  id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  status: ConversationStatus;
  subject: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  booking_request_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Conversation extends ConversationSummary {
  studio_id: string | null;
  messages: InboxMessage[];
}

export interface ConversationCreate {
  client_name: string;
  client_email?: string | null;
  client_phone?: string | null;
  subject?: string | null;
  studio_id?: string | null;
  booking_request_id?: string | null;
  initial_message?: string | null;
}

export interface ConversationUpdate {
  status?: ConversationStatus | null;
  assigned_to_id?: string | null;
  subject?: string | null;
}

export interface MessageCreate {
  content: string;
  channel?: MessageChannel;
}

export interface ConversationsListResponse {
  conversations: ConversationSummary[];
  total: number;
  skip: number;
  limit: number;
}

export interface MarkReadResponse {
  conversation_id: string;
  messages_marked_read: number;
  success: boolean;
}

export interface AssignConversationResponse {
  conversation_id: string;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  success: boolean;
}

export interface InboxStats {
  status_counts: Record<ConversationStatus, number>;
  assigned_to_me: number;
  total_unread: number;
  total_conversations: number;
}

// Team assignment types
export interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
}

export interface TeamMembersResponse {
  members: TeamMember[];
}

// Booking brief for conversation context
export interface BookingBrief {
  id: string;
  reference_id: string;
  status: string;
  client_name: string;
  design_idea: string | null;
  placement: string | null;
  size: string | null;
  scheduled_date: string | null;
  quoted_price: number | null;
}

// Extended conversation with booking details
export interface ConversationWithBooking extends ConversationSummary {
  studio_id: string | null;
  booking: BookingBrief | null;
  messages: InboxMessage[];
}

// Create conversation from booking request
export interface CreateConversationFromBookingInput {
  booking_request_id: string;
  subject?: string | null;
  initial_message?: string | null;
}

// ============ Reply Templates ============

export interface ReplyTemplate {
  id: string;
  name: string;
  content: string;
  category: string | null;
  created_by_id: string;
  created_by_name: string | null;
  studio_id: string | null;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReplyTemplateCreate {
  name: string;
  content: string;
  category?: string | null;
}

export interface ReplyTemplateUpdate {
  name?: string | null;
  content?: string | null;
  category?: string | null;
}

export interface ReplyTemplatesListResponse {
  templates: ReplyTemplate[];
  total: number;
  skip: number;
  limit: number;
}

export interface TemplateCategoriesResponse {
  categories: string[];
}

// ============ Commission Types ============

export type CommissionType = 'percentage' | 'flat_fee' | 'tiered';

export interface CommissionTier {
  id: string;
  min_revenue: number; // In cents
  max_revenue: number | null; // In cents, null = unlimited
  percentage: number;
  created_at: string;
}

export interface CommissionTierCreate {
  min_revenue: number;
  max_revenue: number | null;
  percentage: number;
}

export interface CommissionRuleSummary {
  id: string;
  name: string;
  description: string | null;
  commission_type: CommissionType;
  percentage: number | null;
  flat_fee_amount: number | null; // In cents
  is_default: boolean;
  is_active: boolean;
  assigned_artist_count: number;
  created_at: string;
}

export interface CommissionRule extends CommissionRuleSummary {
  studio_id: string;
  created_by_id: string | null;
  updated_at: string | null;
  tiers: CommissionTier[];
}

export interface CommissionRuleCreate {
  name: string;
  description?: string | null;
  commission_type: CommissionType;
  percentage?: number | null;
  flat_fee_amount?: number | null;
  is_default?: boolean;
  is_active?: boolean;
  tiers?: CommissionTierCreate[] | null;
}

export interface CommissionRuleUpdate {
  name?: string | null;
  description?: string | null;
  commission_type?: CommissionType | null;
  percentage?: number | null;
  flat_fee_amount?: number | null;
  is_default?: boolean | null;
  is_active?: boolean | null;
  tiers?: CommissionTierCreate[] | null;
}

export interface CommissionRulesListResponse {
  rules: CommissionRuleSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface ArtistCommissionInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  commission_rule_id: string | null;
  commission_rule_name: string | null;
}

export interface ArtistsWithCommissionResponse {
  artists: ArtistCommissionInfo[];
  total: number;
}

export interface AssignCommissionRuleInput {
  commission_rule_id: string | null;
}

export interface CommissionCalculationInput {
  service_total: number; // In cents
}

export interface CommissionCalculationResult {
  service_total: number;
  commission_amount: number;
  artist_payout: number;
  rule_name: string;
  commission_type: CommissionType;
  calculation_details: string;
}

// ============ Pay Period Types ============

export type PayPeriodSchedule = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

export type PayPeriodStatus = 'open' | 'closed' | 'paid';

export interface PayPeriodSettings {
  pay_period_schedule: PayPeriodSchedule;
  pay_period_start_day: number;
}

export interface PayPeriodSettingsUpdate {
  pay_period_schedule: PayPeriodSchedule;
  pay_period_start_day: number;
}

export interface PayPeriodCreate {
  start_date: string;
  end_date: string;
}

export interface PayPeriodSummary {
  id: string;
  start_date: string;
  end_date: string;
  status: PayPeriodStatus;
  total_service: number;
  total_studio_commission: number;
  total_artist_payout: number;
  total_tips: number;
  commission_count: number;
  closed_at: string | null;
  paid_at: string | null;
  payout_reference: string | null;
  created_at: string;
}

export interface PayPeriod extends PayPeriodSummary {
  studio_id: string;
  payment_notes: string | null;
  updated_at: string | null;
}

export interface EarnedCommission {
  id: string;
  booking_request_id: string;
  artist_id: string | null;
  studio_id: string;
  commission_rule_id: string | null;
  commission_rule_name: string;
  commission_type: CommissionType;
  service_total: number;
  studio_commission: number;
  artist_payout: number;
  tips_amount: number;
  calculation_details: string;
  completed_at: string;
  created_at: string;
  pay_period_start: string | null;
  pay_period_end: string | null;
  paid_at: string | null;
  payout_reference: string | null;
  // Extended fields for list views
  client_name?: string;
  design_idea?: string | null;
  artist_name?: string | null;
}

export interface EarnedCommissionsListResponse {
  commissions: EarnedCommission[];
  total: number;
  page: number;
  page_size: number;
  total_service: number;
  total_studio_commission: number;
  total_artist_payout: number;
  total_tips: number;
}

export interface PayPeriodWithCommissions extends PayPeriod {
  commissions: EarnedCommission[];
}

export interface PayPeriodsListResponse {
  pay_periods: PayPeriodSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface AssignToPayPeriodInput {
  commission_ids: string[];
}

export interface AssignToPayPeriodResponse {
  message: string;
  assigned_count: number;
  pay_period: PayPeriodSummary;
}

export interface ClosePayPeriodInput {
  notes?: string | null;
}

export interface ClosePayPeriodResponse {
  message: string;
  pay_period: PayPeriodSummary;
}

export interface MarkPayPeriodPaidInput {
  payout_reference?: string | null;
  payment_notes?: string | null;
}

export interface MarkPayPeriodPaidResponse {
  message: string;
  pay_period: PayPeriodSummary;
}

// ============ Payout Report Types ============

export interface ArtistPayoutSummary {
  artist_id: string;
  artist_name: string;
  email: string;
  total_service: number;
  total_studio_commission: number;
  total_artist_payout: number;
  total_tips: number;
  booking_count: number;
  pay_period_count: number;
}

export interface PayoutReportSummary {
  total_service: number;
  total_studio_commission: number;
  total_artist_payout: number;
  total_tips: number;
  total_bookings: number;
  total_pay_periods: number;
  artists_paid: number;
}

export interface PayoutHistoryItem {
  id: string;
  start_date: string;
  end_date: string;
  paid_at: string | null;
  payout_reference: string | null;
  total_service: number;
  total_studio_commission: number;
  total_artist_payout: number;
  total_tips: number;
  commission_count: number;
  payment_notes: string | null;
  artist_breakdown: ArtistPayoutSummary[];
}

export interface PayoutHistoryResponse {
  history: PayoutHistoryItem[];
  summary: PayoutReportSummary;
  total: number;
  page: number;
  page_size: number;
}

export interface ArtistPayoutReportResponse {
  artists: ArtistPayoutSummary[];
  summary: PayoutReportSummary;
  start_date: string | null;
  end_date: string | null;
}
