"""Client schemas for request/response validation."""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# Base schemas
class ClientBase(BaseModel):
    """Base client schema with common fields."""

    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: str | None = Field(None, max_length=50)


# Request schemas
class ClientCreate(ClientBase):
    """Schema for client registration."""

    password: str = Field(..., min_length=8, max_length=100)


class ClientLogin(BaseModel):
    """Schema for client login."""

    email: EmailStr
    password: str


class ClientEmailVerification(BaseModel):
    """Schema for client email verification."""

    token: str


class ClientPasswordResetRequest(BaseModel):
    """Schema for requesting password reset."""

    email: EmailStr


class ClientPasswordReset(BaseModel):
    """Schema for resetting password."""

    token: str
    new_password: str = Field(..., min_length=8, max_length=100)


class ClientPasswordChange(BaseModel):
    """Schema for changing password while logged in."""

    current_password: str
    new_password: str = Field(..., min_length=8, max_length=100)


class ClientUpdate(BaseModel):
    """Schema for updating client profile."""

    first_name: str | None = Field(None, min_length=1, max_length=100)
    last_name: str | None = Field(None, min_length=1, max_length=100)
    phone: str | None = Field(None, max_length=50)
    date_of_birth: datetime | None = None
    address: str | None = None
    emergency_contact_name: str | None = Field(None, max_length=255)
    emergency_contact_phone: str | None = Field(None, max_length=50)
    medical_notes: str | None = None


# Response schemas
class ClientResponse(ClientBase):
    """Schema for client response (public info)."""

    id: uuid.UUID
    is_active: bool
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ClientDetailResponse(ClientResponse):
    """Schema for detailed client response (own profile)."""

    last_login_at: datetime | None
    date_of_birth: datetime | None
    address: str | None
    emergency_contact_name: str | None
    emergency_contact_phone: str | None
    medical_notes: str | None
    primary_studio_id: uuid.UUID | None
    updated_at: datetime

    class Config:
        from_attributes = True


class ClientAuthResponse(BaseModel):
    """Schema for client authentication response."""

    access_token: str
    token_type: str = "bearer"
    client: ClientResponse


class ClientMessageResponse(BaseModel):
    """Schema for simple message responses."""

    message: str
    success: bool = True


# ============================================================================
# Client Portal Booking Schemas
# ============================================================================


class ClientBookingArtistInfo(BaseModel):
    """Artist info for client booking view."""

    id: uuid.UUID
    name: str


class ClientBookingStudioInfo(BaseModel):
    """Studio info for client booking view."""

    id: uuid.UUID
    name: str


class ClientBookingSummary(BaseModel):
    """Summary of a booking for client portal list view."""

    id: uuid.UUID
    design_idea: str
    placement: str
    size: str
    status: str
    quoted_price: int | None = None
    deposit_amount: int | None = None
    deposit_paid_at: datetime | None = None
    scheduled_date: datetime | None = None
    scheduled_duration_hours: float | None = None
    created_at: datetime
    artist: ClientBookingArtistInfo | None = None
    studio: ClientBookingStudioInfo | None = None

    class Config:
        from_attributes = True


class ClientBookingDetail(ClientBookingSummary):
    """Detailed booking view for client portal."""

    client_name: str
    client_email: str
    client_phone: str | None = None
    is_cover_up: bool = False
    is_first_tattoo: bool = False
    color_preference: str | None = None
    budget_range: str | None = None
    additional_notes: str | None = None
    preferred_dates: str | None = None
    quote_notes: str | None = None
    quoted_at: datetime | None = None
    cancelled_at: datetime | None = None
    cancellation_reason: str | None = None
    deposit_forfeited: bool = False
    reschedule_count: int = 0
    updated_at: datetime

    class Config:
        from_attributes = True


class ClientBookingsListResponse(BaseModel):
    """Paginated list of client bookings."""

    bookings: list[ClientBookingSummary]
    total: int
    page: int
    per_page: int
    pages: int
