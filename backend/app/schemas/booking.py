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

    # Scheduling
    preferred_dates: str | None = None
    scheduled_date: datetime | None = None
    scheduled_duration_hours: float | None = None

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
