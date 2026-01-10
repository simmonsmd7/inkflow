"""Studio schemas for request/response validation."""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


class BusinessHoursDay(BaseModel):
    """Schema for a single day's business hours."""

    open: str | None = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    close: str | None = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    closed: bool = False


class BusinessHours(BaseModel):
    """Schema for weekly business hours."""

    monday: BusinessHoursDay = Field(default_factory=BusinessHoursDay)
    tuesday: BusinessHoursDay = Field(default_factory=BusinessHoursDay)
    wednesday: BusinessHoursDay = Field(default_factory=BusinessHoursDay)
    thursday: BusinessHoursDay = Field(default_factory=BusinessHoursDay)
    friday: BusinessHoursDay = Field(default_factory=BusinessHoursDay)
    saturday: BusinessHoursDay = Field(default_factory=BusinessHoursDay)
    sunday: BusinessHoursDay = Field(default_factory=BusinessHoursDay)


# Base schema
class StudioBase(BaseModel):
    """Base studio schema with common fields."""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(None, max_length=2000)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=20)
    website: str | None = Field(None, max_length=255)
    address_line1: str | None = Field(None, max_length=255)
    address_line2: str | None = Field(None, max_length=255)
    city: str | None = Field(None, max_length=100)
    state: str | None = Field(None, max_length=100)
    postal_code: str | None = Field(None, max_length=20)
    country: str = Field("US", min_length=2, max_length=2)
    timezone: str = Field("America/New_York", max_length=50)


# Request schemas
class StudioCreate(StudioBase):
    """Schema for creating a studio."""

    business_hours: BusinessHours | None = None


class StudioUpdate(BaseModel):
    """Schema for updating a studio."""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = Field(None, max_length=2000)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=20)
    website: str | None = Field(None, max_length=255)
    address_line1: str | None = Field(None, max_length=255)
    address_line2: str | None = Field(None, max_length=255)
    city: str | None = Field(None, max_length=100)
    state: str | None = Field(None, max_length=100)
    postal_code: str | None = Field(None, max_length=20)
    country: str | None = Field(None, min_length=2, max_length=2)
    timezone: str | None = Field(None, max_length=50)
    business_hours: BusinessHours | None = None


class StudioLogoUpload(BaseModel):
    """Schema for logo upload response."""

    logo_url: str


# Response schemas
class StudioResponse(StudioBase):
    """Schema for studio response."""

    id: uuid.UUID
    slug: str
    logo_url: str | None
    business_hours: dict | None
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StudioListResponse(BaseModel):
    """Schema for paginated studio list."""

    studios: list[StudioResponse]
    total: int
    skip: int
    limit: int
