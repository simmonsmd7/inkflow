"""Pydantic schemas for booking requests."""

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class TattooSize(str, Enum):
    """Tattoo size options."""

    TINY = "tiny"
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"
    EXTRA_LARGE = "extra_large"
    HALF_SLEEVE = "half_sleeve"
    FULL_SLEEVE = "full_sleeve"
    BACK_PIECE = "back_piece"
    FULL_BODY = "full_body"


class BookingRequestStatus(str, Enum):
    """Booking request status options."""

    PENDING = "pending"
    REVIEWING = "reviewing"
    QUOTED = "quoted"
    DEPOSIT_REQUESTED = "deposit_requested"
    DEPOSIT_PAID = "deposit_paid"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    NO_SHOW = "no_show"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class ReferenceImageResponse(BaseModel):
    """Response schema for reference images."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    image_url: str
    thumbnail_url: str | None = None
    original_filename: str | None = None
    display_order: int = 0
    notes: str | None = None
    created_at: datetime


class BookingRequestCreate(BaseModel):
    """Schema for creating a booking request (client submission)."""

    # Client info
    client_name: str = Field(..., min_length=1, max_length=255)
    client_email: EmailStr
    client_phone: str | None = Field(None, max_length=50)

    # Design details
    design_idea: str = Field(..., min_length=10, max_length=5000)
    placement: str = Field(..., min_length=1, max_length=255)
    size: TattooSize
    is_cover_up: bool = False
    is_first_tattoo: bool = False
    color_preference: str | None = Field(None, max_length=100)
    budget_range: str | None = Field(None, max_length=100)
    additional_notes: str | None = Field(None, max_length=2000)

    # Preferences
    preferred_artist_id: UUID | None = None
    preferred_dates: str | None = Field(None, max_length=500)


class BookingRequestUpdate(BaseModel):
    """Schema for updating a booking request (artist/staff action)."""

    status: BookingRequestStatus | None = None
    assigned_artist_id: UUID | None = None
    quoted_price: int | None = Field(None, ge=0)  # In cents
    deposit_amount: int | None = Field(None, ge=0)  # In cents
    estimated_hours: float | None = Field(None, ge=0.5, le=100)
    quote_notes: str | None = Field(None, max_length=2000)
    scheduled_date: datetime | None = None
    scheduled_duration_hours: float | None = Field(None, ge=0.5, le=24)
    internal_notes: str | None = Field(None, max_length=5000)


class BookingRequestResponse(BaseModel):
    """Full booking request response for staff view."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID

    # Client info
    client_name: str
    client_email: str
    client_phone: str | None = None

    # Design details
    design_idea: str
    placement: str
    size: TattooSize
    is_cover_up: bool = False
    is_first_tattoo: bool = False
    color_preference: str | None = None
    budget_range: str | None = None
    additional_notes: str | None = None

    # Studio and artist
    studio_id: UUID
    preferred_artist_id: UUID | None = None
    assigned_artist_id: UUID | None = None

    # Status
    status: BookingRequestStatus

    # Quote and pricing
    quoted_price: int | None = None
    deposit_amount: int | None = None
    estimated_hours: float | None = None
    quote_notes: str | None = None
    quoted_at: datetime | None = None

    # Deposit tracking
    deposit_requested_at: datetime | None = None
    deposit_request_expires_at: datetime | None = None
    deposit_paid_at: datetime | None = None

    # Scheduling
    preferred_dates: str | None = None
    scheduled_date: datetime | None = None
    scheduled_duration_hours: float | None = None

    # Cancellation tracking
    cancelled_at: datetime | None = None
    cancelled_by: str | None = None
    cancellation_reason: str | None = None
    deposit_forfeited: bool = False

    # Reschedule tracking
    reschedule_count: int = 0
    original_scheduled_date: datetime | None = None
    last_rescheduled_at: datetime | None = None
    last_reschedule_reason: str | None = None

    # No-show tracking
    no_show_at: datetime | None = None
    no_show_marked_by_id: UUID | None = None
    no_show_notes: str | None = None

    # Internal
    internal_notes: str | None = None

    # Reference images
    reference_images: list[ReferenceImageResponse] = Field(default_factory=list)

    # Metadata
    created_at: datetime
    updated_at: datetime


class BookingRequestSummary(BaseModel):
    """Summary of booking request for list views."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    client_name: str
    client_email: str
    design_idea: str
    placement: str
    size: TattooSize
    status: BookingRequestStatus
    preferred_artist_id: UUID | None = None
    assigned_artist_id: UUID | None = None
    quoted_price: int | None = None
    scheduled_date: datetime | None = None
    reference_image_count: int = 0
    created_at: datetime


class BookingRequestsListResponse(BaseModel):
    """Paginated list of booking requests."""

    requests: list[BookingRequestSummary]
    total: int
    page: int
    per_page: int
    pages: int


class BookingSubmissionResponse(BaseModel):
    """Response after client submits a booking request."""

    message: str
    request_id: UUID
    status: str = "pending"


class ArtistOptionResponse(BaseModel):
    """Artist option for booking form dropdown."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    specialties: list[str] = Field(default_factory=list)


class SendDepositRequestInput(BaseModel):
    """Input for sending a deposit request to a client."""

    deposit_amount: int = Field(..., ge=100, description="Deposit amount in cents (min $1)")
    expires_in_days: int = Field(default=7, ge=1, le=30, description="Days until deposit expires")
    message: str | None = Field(None, max_length=1000, description="Custom message to client")


class SendDepositRequestResponse(BaseModel):
    """Response after sending a deposit request."""

    message: str
    deposit_amount: int
    expires_at: datetime
    payment_url: str


class DepositPaymentInfo(BaseModel):
    """Public deposit payment information (for clients)."""

    request_id: UUID
    client_name: str
    studio_name: str
    artist_name: str | None = None
    design_summary: str
    quoted_price: int | None = None
    deposit_amount: int
    expires_at: datetime
    is_expired: bool
    quote_notes: str | None = None


class CheckoutSessionResponse(BaseModel):
    """Response from creating a Stripe checkout session."""

    stub_mode: bool
    session_id: str
    checkout_url: str
    message: str | None = None


class StubPaymentConfirmation(BaseModel):
    """Confirmation of a stub payment (for testing without Stripe)."""

    message: str
    status: str
    deposit_paid_at: datetime


class ConfirmBookingInput(BaseModel):
    """Input for confirming a booking with a scheduled date/time."""

    scheduled_date: datetime = Field(..., description="Scheduled date and time for the appointment")
    scheduled_duration_hours: float = Field(
        ..., ge=0.5, le=24, description="Duration in hours"
    )
    send_confirmation_email: bool = Field(
        default=True, description="Whether to send confirmation email with calendar invite"
    )


class BookingConfirmationResponse(BaseModel):
    """Response after confirming a booking."""

    message: str
    request_id: UUID
    status: str
    scheduled_date: datetime
    scheduled_duration_hours: float
    confirmation_email_sent: bool


class RescheduleInput(BaseModel):
    """Input for rescheduling an appointment."""

    new_date: datetime = Field(..., description="New scheduled date and time")
    new_duration_hours: float | None = Field(
        None, ge=0.5, le=24, description="New duration in hours (optional)"
    )
    reason: str | None = Field(None, max_length=500, description="Reason for rescheduling")
    notify_client: bool = Field(
        default=True, description="Whether to send notification email to client"
    )


class RescheduleResponse(BaseModel):
    """Response after rescheduling an appointment."""

    message: str
    request_id: UUID
    old_date: datetime
    new_date: datetime
    reschedule_count: int
    notification_sent: bool


class CancelInput(BaseModel):
    """Input for cancelling a booking."""

    reason: str | None = Field(None, max_length=500, description="Reason for cancellation")
    cancelled_by: str = Field(
        default="studio",
        pattern="^(client|artist|studio)$",
        description="Who initiated the cancellation",
    )
    forfeit_deposit: bool = Field(
        default=False, description="Whether to forfeit the client's deposit"
    )
    notify_client: bool = Field(
        default=True, description="Whether to send notification email to client"
    )


class CancelResponse(BaseModel):
    """Response after cancelling a booking."""

    message: str
    request_id: UUID
    status: str
    cancelled_at: datetime
    cancelled_by: str
    deposit_forfeited: bool
    deposit_amount: int | None
    notification_sent: bool


class MarkNoShowInput(BaseModel):
    """Input for marking a booking as a no-show."""

    notes: str | None = Field(None, max_length=500, description="Notes about the no-show")
    forfeit_deposit: bool = Field(
        default=True, description="Whether to forfeit the client's deposit"
    )
    notify_client: bool = Field(
        default=True, description="Whether to send notification email to client"
    )


class NoShowResponse(BaseModel):
    """Response after marking a booking as a no-show."""

    message: str
    request_id: UUID
    status: str
    no_show_at: datetime
    deposit_forfeited: bool
    deposit_amount: int | None
    notification_sent: bool


class ClientNoShowHistoryItem(BaseModel):
    """A single no-show record for a client."""

    request_id: UUID
    scheduled_date: datetime | None
    no_show_at: datetime
    deposit_forfeited: bool
    deposit_amount: int | None
    design_idea: str
    studio_id: UUID


class ClientNoShowHistory(BaseModel):
    """No-show history for a client by email."""

    client_email: str
    total_bookings: int
    no_show_count: int
    no_show_rate: float  # Percentage 0-100
    total_forfeited_deposits: int  # In cents
    no_shows: list[ClientNoShowHistoryItem]
