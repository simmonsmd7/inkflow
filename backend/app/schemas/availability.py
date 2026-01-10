"""Pydantic schemas for artist availability and time-off."""

from datetime import date, datetime, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AvailabilitySlotBase(BaseModel):
    """Base schema for availability slot."""

    day_of_week: int = Field(..., ge=0, le=6, description="0=Monday, 6=Sunday")
    start_time: time
    end_time: time
    is_available: bool = True

    @field_validator("end_time")
    @classmethod
    def end_after_start(cls, v: time, info) -> time:
        """Ensure end time is after start time."""
        start = info.data.get("start_time")
        if start and v <= start:
            raise ValueError("end_time must be after start_time")
        return v


class AvailabilitySlotCreate(AvailabilitySlotBase):
    """Schema for creating an availability slot."""

    pass


class AvailabilitySlotUpdate(BaseModel):
    """Schema for updating an availability slot."""

    start_time: time | None = None
    end_time: time | None = None
    is_available: bool | None = None


class AvailabilitySlotResponse(AvailabilitySlotBase):
    """Schema for availability slot response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime


class WeeklySchedule(BaseModel):
    """Full weekly schedule for an artist."""

    slots: list[AvailabilitySlotResponse] = Field(default_factory=list)
    user_id: UUID


class BulkAvailabilityUpdate(BaseModel):
    """Bulk update for weekly schedule."""

    slots: list[AvailabilitySlotCreate] = Field(..., min_length=0)


class TimeOffBase(BaseModel):
    """Base schema for time-off periods."""

    start_date: date
    end_date: date
    reason: str | None = Field(None, max_length=255)
    notes: str | None = None
    all_day: bool = True

    @field_validator("end_date")
    @classmethod
    def end_not_before_start(cls, v: date, info) -> date:
        """Ensure end date is not before start date."""
        start = info.data.get("start_date")
        if start and v < start:
            raise ValueError("end_date cannot be before start_date")
        return v


class TimeOffCreate(TimeOffBase):
    """Schema for creating time-off."""

    pass


class TimeOffUpdate(BaseModel):
    """Schema for updating time-off."""

    start_date: date | None = None
    end_date: date | None = None
    reason: str | None = None
    notes: str | None = None
    all_day: bool | None = None


class TimeOffResponse(TimeOffBase):
    """Schema for time-off response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime


class TimeOffListResponse(BaseModel):
    """List of time-off periods."""

    time_off: list[TimeOffResponse]
    total: int


class AvailabilityCheckRequest(BaseModel):
    """Request to check availability for a specific date/time."""

    artist_id: UUID
    date: date
    start_time: time
    end_time: time


class AvailabilityCheckResponse(BaseModel):
    """Response for availability check."""

    available: bool
    reason: str | None = None  # e.g., "time_off", "outside_hours", "already_booked"


class AvailableSlot(BaseModel):
    """An available time slot on a specific date."""

    date: date
    start_time: time
    end_time: time
    duration_minutes: int


class AvailableSlotsRequest(BaseModel):
    """Request for available slots within a date range."""

    artist_id: UUID
    start_date: date
    end_date: date
    min_duration_minutes: int = Field(60, ge=30, le=480)


class AvailableSlotsResponse(BaseModel):
    """Response with available time slots."""

    artist_id: UUID
    slots: list[AvailableSlot]
