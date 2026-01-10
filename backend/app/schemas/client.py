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
