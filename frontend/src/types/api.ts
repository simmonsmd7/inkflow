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

export type TipPaymentMethod = 'card' | 'cash';

export interface PayPeriodSummary {
  id: string;
  start_date: string;
  end_date: string;
  status: PayPeriodStatus;
  total_service: number;
  total_studio_commission: number;
  total_artist_payout: number;
  total_tips: number;
  total_tips_card: number;
  total_tips_cash: number;
  total_tip_artist_share: number;
  total_tip_studio_share: number;
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
  tip_payment_method: TipPaymentMethod | null;
  tip_artist_share: number;
  tip_studio_share: number;
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

// ============ Tip Distribution Types ============

export interface TipSettings {
  tip_artist_percentage: number;
}

export interface TipSettingsUpdate {
  tip_artist_percentage: number;
}

export interface ArtistTipSummary {
  artist_id: string;
  artist_name: string;
  email: string;
  total_tips: number;
  total_tips_card: number;
  total_tips_cash: number;
  tip_artist_share: number;
  tip_studio_share: number;
  booking_count: number;
}

export interface TipReportSummary {
  total_tips: number;
  total_tips_card: number;
  total_tips_cash: number;
  total_artist_share: number;
  total_studio_share: number;
  total_bookings_with_tips: number;
  artists_with_tips: number;
}

export interface TipReportResponse {
  artists: ArtistTipSummary[];
  summary: TipReportSummary;
  start_date: string | null;
  end_date: string | null;
}

// ============ Consent Form Types ============

export type ConsentFieldType =
  | 'text'
  | 'textarea'
  | 'checkbox'
  | 'signature'
  | 'date'
  | 'select'
  | 'radio'
  | 'photo_id'
  | 'heading'
  | 'paragraph';

export type ConsentAuditAction =
  | 'created'
  | 'viewed'
  | 'downloaded'
  | 'verified'
  | 'voided'
  | 'exported';

export interface FormField {
  id: string;
  type: ConsentFieldType;
  label: string;
  required: boolean;
  order: number;
  placeholder?: string | null;
  help_text?: string | null;
  options?: string[] | null;
  content?: string | null;
}

export interface FormFieldCreate {
  id: string;
  type: ConsentFieldType;
  label: string;
  required?: boolean;
  order?: number;
  placeholder?: string | null;
  help_text?: string | null;
  options?: string[] | null;
  content?: string | null;
}

export interface ConsentFormTemplateCreate {
  name: string;
  description?: string | null;
  header_text?: string | null;
  footer_text?: string | null;
  requires_photo_id?: boolean;
  requires_signature?: boolean;
  age_requirement?: number;
  fields?: FormFieldCreate[];
  is_active?: boolean;
  is_default?: boolean;
}

export interface ConsentFormTemplateUpdate {
  name?: string | null;
  description?: string | null;
  header_text?: string | null;
  footer_text?: string | null;
  requires_photo_id?: boolean | null;
  requires_signature?: boolean | null;
  age_requirement?: number | null;
  fields?: FormFieldCreate[] | null;
  is_active?: boolean | null;
  is_default?: boolean | null;
}

export interface ConsentFormTemplateSummary {
  id: string;
  name: string;
  description: string | null;
  version: number;
  is_active: boolean;
  is_default: boolean;
  requires_photo_id: boolean;
  requires_signature: boolean;
  field_count: number;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsentFormTemplate {
  id: string;
  studio_id: string;
  name: string;
  description: string | null;
  header_text: string | null;
  footer_text: string | null;
  requires_photo_id: boolean;
  requires_signature: boolean;
  age_requirement: number;
  version: number;
  is_active: boolean;
  is_default: boolean;
  fields: FormField[];
  use_count: number;
  last_used_at: string | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsentFormTemplatesListResponse {
  templates: ConsentFormTemplateSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface PrebuiltTemplateInfo {
  id: string;
  name: string;
  description: string;
  field_count: number;
}

export interface PrebuiltTemplatesListResponse {
  templates: PrebuiltTemplateInfo[];
}

export interface CreateFromPrebuiltInput {
  prebuilt_id: string;
  name?: string | null;
  is_default?: boolean;
}

export interface ConsentSubmissionSummary {
  id: string;
  template_name: string;
  template_version: number;
  client_name: string;
  client_email: string;
  submitted_at: string;
  has_signature: boolean;
  has_photo_id: boolean;
  photo_id_verified: boolean;
  age_verified: boolean;
  age_at_signing: number | null;
  has_guardian_consent: boolean;
  is_voided: boolean;
  booking_request_id: string | null;
  created_at: string;
}

export interface ConsentSubmission {
  id: string;
  template_id: string | null;
  template_name: string;
  template_version: number;
  template_fields_snapshot: FormField[];
  studio_id: string;
  booking_request_id: string | null;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  client_date_of_birth: string | null;
  responses: Record<string, unknown>;
  signature_data: string | null;
  signature_timestamp: string | null;
  photo_id_url: string | null;
  photo_id_verified: boolean;
  photo_id_verified_at: string | null;
  age_verified: boolean;
  age_at_signing: number | null;
  age_verified_at: string | null;
  age_verified_by_id: string | null;
  age_verification_notes: string | null;
  has_guardian_consent: boolean;
  guardian_name: string | null;
  guardian_relationship: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  guardian_consent_at: string | null;
  ip_address: string | null;
  submitted_at: string;
  access_token: string;
  is_voided: boolean;
  voided_at: string | null;
  voided_reason: string | null;
  created_at: string;
}

export interface ConsentSubmissionsListResponse {
  submissions: ConsentSubmissionSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface VerifyPhotoIdInput {
  notes?: string | null;
}

export interface VerifyPhotoIdResponse {
  verified: boolean;
  verified_at: string;
  verified_by_id: string;
  verified_by_name: string;
}

export interface VoidConsentInput {
  reason: string;
}

export interface VoidConsentResponse {
  voided: boolean;
  voided_at: string;
  voided_by_id: string;
  voided_by_name: string;
  reason: string;
}

// Age Verification types
export interface AgeVerificationStatus {
  age_verified: boolean;
  age_at_signing: number | null;
  age_requirement: number;
  is_underage: boolean;
  client_date_of_birth: string | null;
  needs_guardian_consent: boolean;
}

export interface VerifyAgeInput {
  age_verified: boolean;
  age_at_signing?: number | null;
  client_date_of_birth?: string | null;
  notes?: string | null;
}

export interface VerifyAgeResponse {
  age_verified: boolean;
  age_at_signing: number | null;
  verified_at: string;
  verified_by_id: string;
  verified_by_name: string;
  notes: string | null;
}

export interface GuardianConsentInput {
  guardian_name: string;
  guardian_relationship: string;
  guardian_phone?: string | null;
  guardian_email?: string | null;
  guardian_signature_data: string;
  notes?: string | null;
}

export interface GuardianConsentResponse {
  success: boolean;
  guardian_name: string;
  guardian_relationship: string;
  consented_at: string;
  message: string;
}

export interface ConsentAuditLog {
  id: string;
  submission_id: string;
  action: ConsentAuditAction;
  performed_by_id: string | null;
  performed_by_name: string | null;
  is_client_access: boolean;
  ip_address: string | null;
  notes: string | null;
  created_at: string;
}

export interface ConsentAuditLogsListResponse {
  logs: ConsentAuditLog[];
  total: number;
  page: number;
  page_size: number;
}

export interface SubmitSigningInput {
  template_id: string;
  booking_request_id?: string | null;
  client_name: string;
  client_email: string;
  client_phone?: string | null;
  client_date_of_birth?: string | null;
  responses: Record<string, unknown>;
  signature_data: string;
  confirms_of_age?: boolean;
}

export interface SubmitSigningResponse {
  submission_id: string;
  access_token: string;
  message: string;
}

// === Aftercare Types ===

export type TattooType =
  | 'traditional'
  | 'fine_line'
  | 'blackwork'
  | 'watercolor'
  | 'realism'
  | 'neo_traditional'
  | 'geometric'
  | 'tribal'
  | 'dotwork'
  | 'script'
  | 'cover_up'
  | 'touch_up'
  | 'other';

export type TattooPlacement =
  | 'arm_upper'
  | 'arm_lower'
  | 'arm_inner'
  | 'hand'
  | 'finger'
  | 'leg_upper'
  | 'leg_lower'
  | 'foot'
  | 'chest'
  | 'back'
  | 'ribs'
  | 'stomach'
  | 'neck'
  | 'face'
  | 'head'
  | 'shoulder'
  | 'hip'
  | 'other';

export type AftercareSentStatus = 'pending' | 'sent' | 'delivered' | 'failed';
export type FollowUpType = 'day_3' | 'week_1' | 'week_2' | 'week_4' | 'custom';
export type FollowUpStatus = 'scheduled' | 'sent' | 'delivered' | 'cancelled' | 'failed';
export type HealingIssueSeverity = 'minor' | 'moderate' | 'concerning' | 'urgent';
export type HealingIssueStatus = 'reported' | 'acknowledged' | 'in_progress' | 'resolved' | 'escalated';

export interface AftercareExtraData {
  days_covered: number | null;
  key_points: string[];
  products_recommended: string[];
  products_to_avoid: string[];
  warning_signs: string[];
}

export interface AftercareTemplateSummary {
  id: string;
  name: string;
  description: string | null;
  tattoo_type: TattooType | null;
  placement: TattooPlacement | null;
  is_active: boolean;
  is_default: boolean;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
}

export interface AftercareTemplateResponse extends AftercareTemplateSummary {
  instructions_html: string;
  instructions_plain: string;
  extra_data: AftercareExtraData | null;
  created_by_id: string | null;
  updated_at: string;
}

export interface AftercareTemplateCreate {
  name: string;
  description?: string | null;
  tattoo_type?: TattooType | null;
  placement?: TattooPlacement | null;
  instructions_html: string;
  instructions_plain: string;
  extra_data?: AftercareExtraData | null;
  is_active?: boolean;
  is_default?: boolean;
}

export interface AftercareTemplateUpdate {
  name?: string;
  description?: string | null;
  tattoo_type?: TattooType | null;
  placement?: TattooPlacement | null;
  instructions_html?: string;
  instructions_plain?: string;
  extra_data?: AftercareExtraData | null;
  is_active?: boolean;
  is_default?: boolean;
}

export interface AftercareTemplateListResponse {
  items: AftercareTemplateSummary[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PrebuiltAftercareTemplate {
  id: string;
  name: string;
  description: string | null;
  tattoo_type: TattooType | null;
  placement: TattooPlacement | null;
}

export interface PrebuiltAftercareTemplatesResponse {
  templates: PrebuiltAftercareTemplate[];
}

// === Sent Aftercare Types ===

export interface AftercareSentSummary {
  id: string;
  template_name: string;
  client_name: string;
  client_email: string;
  appointment_date: string;
  status: AftercareSentStatus;
  sent_at: string | null;
  delivered_at: string | null;
  view_count: number;
  created_at: string;
}

export interface AftercareSentResponse extends AftercareSentSummary {
  template_id: string | null;
  instructions_snapshot: string;
  booking_request_id: string | null;
  artist_id: string | null;
  client_phone: string | null;
  tattoo_type: TattooType | null;
  placement: TattooPlacement | null;
  tattoo_description: string | null;
  sent_via: string;
  first_viewed_at: string | null;
  access_token: string;
}

export interface AftercareSentListResponse {
  items: AftercareSentSummary[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AftercareSendInput {
  template_id: string;
  booking_request_id?: string | null;
  client_name: string;
  client_email: string;
  client_phone?: string | null;
  tattoo_type?: TattooType | null;
  placement?: TattooPlacement | null;
  tattoo_description?: string | null;
  appointment_date: string;
  send_via?: 'email' | 'sms' | 'both';
  schedule_follow_ups?: boolean;
}

// === Follow-Up Management Types ===

export interface FollowUpSummary {
  id: string;
  aftercare_sent_id: string;
  follow_up_type: FollowUpType;
  scheduled_for: string;
  status: FollowUpStatus;
  sent_at: string | null;
  created_at: string;
}

export interface FollowUpResponse extends FollowUpSummary {
  subject: string;
  message_html: string;
  message_plain: string;
  send_via: string;
  delivered_at: string | null;
  failure_reason: string | null;
}

export interface FollowUpWithClientInfo extends FollowUpResponse {
  client_name: string;
  client_email: string;
  appointment_date: string;
  studio_name: string | null;
}

export interface FollowUpListResponse {
  items: FollowUpSummary[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PendingFollowUpsResponse {
  items: FollowUpWithClientInfo[];
  total: number;
}

export interface ProcessFollowUpsResult {
  processed: number;
  sent: number;
  failed: number;
  details: {
    id: string;
    type: string;
    client_email: string;
    status: string;
    reason?: string;
  }[];
}

export interface SendFollowUpInput {
  send_via?: 'email' | 'sms' | null;
}

export interface SendFollowUpResponse {
  id: string;
  status: FollowUpStatus;
  sent_at: string | null;
  message: string;
}

export interface CancelFollowUpResponse {
  id: string;
  status: FollowUpStatus;
  message: string;
}

export interface FollowUpUpdate {
  scheduled_for?: string;
  subject?: string;
  message_html?: string;
  message_plain?: string;
  send_via?: 'email' | 'sms';
}

export interface FollowUpCreate {
  aftercare_sent_id: string;
  follow_up_type?: FollowUpType;
  scheduled_for: string;
  subject: string;
  message_html: string;
  message_plain: string;
  send_via?: 'email' | 'sms';
}

// === Healing Issue Types ===

export interface HealingIssueSummary {
  id: string;
  aftercare_sent_id: string;
  description: string;
  severity: HealingIssueSeverity;
  symptoms: string[];
  days_since_appointment: number;
  status: HealingIssueStatus;
  created_at: string;
}

export interface HealingIssueResponse extends HealingIssueSummary {
  studio_id: string;
  photo_urls: string[];
  resolved_at: string | null;
  resolution_notes: string | null;
  responded_by_id: string | null;
  responded_at: string | null;
  staff_notes: string | null;
  touch_up_requested: boolean;
  touch_up_booking_id: string | null;
}

export interface HealingIssueListResponse {
  items: HealingIssueSummary[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ReportIssueInput {
  description: string;
  severity?: HealingIssueSeverity;
  symptoms?: string[];
}

export interface HealingIssueUpdate {
  status?: HealingIssueStatus;
  staff_notes?: string;
  resolution_notes?: string;
  touch_up_requested?: boolean;
}

// Touch-up Scheduling Types

export interface TouchUpBookingInfo {
  booking_id: string;
  reference_id: string;
  status: string;
  scheduled_date: string | null;
  artist_name: string | null;
  is_free_touch_up: boolean;
  created_at: string;
}

export interface HealingIssueWithTouchUp extends HealingIssueResponse {
  touch_up_booking: TouchUpBookingInfo | null;
}

export interface TouchUpScheduleInput {
  scheduled_date: string;
  duration_hours?: number;
  artist_id?: string;
  notes?: string;
  send_confirmation?: boolean;
  is_free_touch_up?: boolean;
}

export interface TouchUpResponse {
  healing_issue_id: string;
  booking_id: string;
  reference_id: string;
  message: string;
  client_notified: boolean;
}

export interface ClientTouchUpRequestInput {
  reason: string;
  preferred_dates?: string[];
  additional_notes?: string;
}

export interface ClientTouchUpRequestResponse {
  request_id: string;
  message: string;
  studio_name: string;
  expected_contact_within: string;
}

// ============ Revenue Report Types ============

export interface RevenueByCategory {
  category: string;
  revenue: number;
  count: number;
  percentage: number;
}

export interface RevenueByArtist {
  artist_id: string;
  artist_name: string;
  revenue: number;
  tips: number;
  bookings: number;
  percentage: number;
}

export interface RevenueByDay {
  date: string;
  day_name: string;
  revenue: number;
  tips: number;
  deposits: number;
  bookings: number;
  average_booking: number;
}

export interface RevenueByWeek {
  week_start: string;
  week_end: string;
  week_number: number;
  revenue: number;
  tips: number;
  deposits: number;
  bookings: number;
  average_booking: number;
  change_from_previous: number | null;
}

export interface RevenueByMonth {
  month: string;
  month_name: string;
  revenue: number;
  tips: number;
  deposits: number;
  bookings: number;
  average_booking: number;
  change_from_previous: number | null;
}

export interface RevenueSummary {
  total_revenue: number;
  total_tips: number;
  total_deposits: number;
  total_bookings: number;
  average_booking_value: number;
  highest_day: string | null;
  highest_day_revenue: number;
  lowest_day: string | null;
  lowest_day_revenue: number;
}

export interface DailyRevenueReportResponse {
  report_type: 'daily';
  period_start: string;
  period_end: string;
  summary: RevenueSummary;
  daily_data: RevenueByDay[];
  by_artist: RevenueByArtist[];
  by_size: RevenueByCategory[];
  by_placement: RevenueByCategory[];
}

export interface WeeklyRevenueReportResponse {
  report_type: 'weekly';
  period_start: string;
  period_end: string;
  summary: RevenueSummary;
  weekly_data: RevenueByWeek[];
  by_artist: RevenueByArtist[];
}

export interface MonthlyRevenueReportResponse {
  report_type: 'monthly';
  period_start: string;
  period_end: string;
  summary: RevenueSummary;
  monthly_data: RevenueByMonth[];
  by_artist: RevenueByArtist[];
}

export interface CustomRevenueReportResponse {
  report_type: 'custom';
  period_start: string;
  period_end: string;
  summary: RevenueSummary;
  daily_data: RevenueByDay[];
  by_artist: RevenueByArtist[];
  by_size: RevenueByCategory[];
  by_placement: RevenueByCategory[];
}

export type RevenueReportResponse =
  | DailyRevenueReportResponse
  | WeeklyRevenueReportResponse
  | MonthlyRevenueReportResponse
  | CustomRevenueReportResponse;

// ============ Client Portal Types ============

export interface Client {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface ClientDetailResponse extends Client {
  last_login_at: string | null;
  date_of_birth: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  medical_notes: string | null;
  primary_studio_id: string | null;
  updated_at: string;
}

export interface ClientRegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

export interface ClientLoginRequest {
  email: string;
  password: string;
}

export interface ClientAuthResponse {
  access_token: string;
  token_type: string;
  client: Client;
}

export interface ClientUpdate {
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  date_of_birth?: string | null;
  address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  medical_notes?: string | null;
}

// Client Portal Booking Types
export interface ClientBookingArtist {
  id: string;
  name: string;
}

export interface ClientBookingStudio {
  id: string;
  name: string;
}

export interface ClientBookingSummary {
  id: string;
  design_idea: string;
  placement: string;
  size: string;
  status: string;
  quoted_price: number | null;
  deposit_amount: number | null;
  deposit_paid_at: string | null;
  scheduled_date: string | null;
  scheduled_duration_hours: number | null;
  created_at: string;
  artist: ClientBookingArtist | null;
  studio: ClientBookingStudio | null;
}

export interface ClientBookingDetail extends ClientBookingSummary {
  client_name: string;
  client_email: string;
  client_phone: string | null;
  is_cover_up: boolean;
  is_first_tattoo: boolean;
  color_preference: string | null;
  budget_range: string | null;
  additional_notes: string | null;
  preferred_dates: string | null;
  quote_notes: string | null;
  quoted_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  deposit_forfeited: boolean;
  reschedule_count: number;
  updated_at: string;
}

export interface ClientBookingsListResponse {
  bookings: ClientBookingSummary[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface ClientBookingStats {
  total_bookings: number;
  completed: number;
  upcoming: number;
  pending: number;
  cancelled: number;
  total_spent_cents: number;
  status_breakdown: Record<string, number>;
}

// ============ Client Portal Consent Types ============

export interface ClientConsentPendingBooking {
  id: string;
  design_idea: string;
  placement: string;
  size: string;
  status: string;
  scheduled_date: string | null;
  artist_name: string | null;
  studio_id: string;
  studio_name: string;
  template_id: string | null;
  template_name: string | null;
}

export interface ClientConsentPendingResponse {
  bookings: ClientConsentPendingBooking[];
  total: number;
}

export interface ClientSignedConsentSummary {
  id: string;
  template_name: string;
  submitted_at: string;
  booking_id: string | null;
  booking_design_idea: string | null;
  booking_scheduled_date: string | null;
  studio_name: string;
  has_signature: boolean;
  access_token: string;
}

export interface ClientSignedConsentsResponse {
  submissions: ClientSignedConsentSummary[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface ClientConsentFormField {
  id: string;
  type: string;
  label: string;
  required: boolean;
  order: number;
  placeholder?: string | null;
  help_text?: string | null;
  options?: string[] | null;
  content?: string | null;
}

export interface ClientConsentTemplateResponse {
  id: string;
  name: string;
  description: string | null;
  header_text: string | null;
  footer_text: string | null;
  requires_photo_id: boolean;
  requires_signature: boolean;
  age_requirement: number;
  fields: ClientConsentFormField[];
}

export interface ClientConsentSignInput {
  booking_id: string;
  template_id: string;
  client_name: string;
  client_phone?: string | null;
  date_of_birth?: string | null;
  responses: Record<string, unknown>;
  signature_data: string;
}

export interface ClientConsentSignResponse {
  submission_id: string;
  access_token: string;
  message: string;
}

// ============ Client Portal Aftercare Types ============

export interface ClientAftercareExtraData {
  days_covered: number | null;
  key_points: string[];
  products_recommended: string[];
  products_to_avoid: string[];
  warning_signs: string[];
}

export interface ClientAftercareSummary {
  id: string;
  template_name: string;
  client_name: string;
  appointment_date: string;
  tattoo_type: string | null;
  placement: string | null;
  tattoo_description: string | null;
  status: string;
  sent_at: string | null;
  view_count: number;
  studio_name: string;
  artist_name: string | null;
  booking_design_idea: string | null;
  created_at: string;
}

export interface ClientAftercareListResponse {
  instructions: ClientAftercareSummary[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface ClientFollowUpSummary {
  id: string;
  follow_up_type: string;
  scheduled_for: string;
  status: string;
  subject: string;
  sent_at: string | null;
}

export interface ClientAftercareDetail {
  id: string;
  template_name: string;
  client_name: string;
  appointment_date: string;
  tattoo_type: string | null;
  placement: string | null;
  tattoo_description: string | null;
  instructions_html: string;
  extra_data: ClientAftercareExtraData | null;
  status: string;
  sent_at: string | null;
  first_viewed_at: string | null;
  view_count: number;
  studio_name: string;
  studio_id: string;
  artist_name: string | null;
  booking_id: string | null;
  booking_design_idea: string | null;
  follow_ups: ClientFollowUpSummary[];
  created_at: string;
}

export interface ClientHealingIssueInput {
  description: string;
  severity?: string;
  symptoms?: string[];
}

export interface ClientHealingIssueResponse {
  id: string;
  message: string;
  studio_will_contact: boolean;
}

export interface ClientHealingIssueSummary {
  id: string;
  description: string;
  severity: string;
  symptoms: string[];
  days_since_appointment: number;
  status: string;
  staff_notes: string | null;
  created_at: string;
}

// ============ Client Portal Rebooking Types ============

export interface ClientRebookingArtistInfo {
  id: string;
  name: string;
  specialties: string[];
}

export interface ClientRebookingData {
  original_booking_id: string;
  original_design_idea: string;
  original_placement: string;
  original_size: string;
  original_color_preference: string | null;
  original_scheduled_date: string | null;
  original_artist: ClientRebookingArtistInfo | null;
  studio_id: string;
  studio_name: string;
  studio_slug: string;
  available_artists: ClientRebookingArtistInfo[];
  client_name: string;
  client_email: string;
  client_phone: string | null;
}

export interface ClientRebookingSubmit {
  original_booking_id: string;
  design_idea: string;
  placement: string;
  size: string;
  is_cover_up?: boolean;
  is_first_tattoo?: boolean;
  color_preference?: string | null;
  budget_range?: string | null;
  additional_notes?: string | null;
  preferred_artist_id?: string | null;
  preferred_dates?: string | null;
}

export interface ClientRebookingResponse {
  request_id: string;
  message: string;
  is_touch_up: boolean;
}
