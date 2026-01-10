"""Pydantic schemas for artist profiles and portfolio."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class PortfolioImageBase(BaseModel):
    """Base schema for portfolio images."""

    title: str | None = Field(None, max_length=200)
    description: str | None = None
    style: str | None = Field(None, max_length=100)
    placement: str | None = Field(None, max_length=100)
    display_order: int = 0


class PortfolioImageCreate(PortfolioImageBase):
    """Schema for creating a portfolio image (after upload)."""

    pass


class PortfolioImageUpdate(BaseModel):
    """Schema for updating portfolio image metadata."""

    title: str | None = Field(None, max_length=200)
    description: str | None = None
    style: str | None = Field(None, max_length=100)
    placement: str | None = Field(None, max_length=100)
    display_order: int | None = None


class PortfolioImageResponse(PortfolioImageBase):
    """Schema for portfolio image response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    image_url: str
    thumbnail_url: str | None
    created_at: datetime


class ArtistProfileBase(BaseModel):
    """Base schema for artist profile."""

    bio: str | None = None
    specialties: list[str] = Field(default_factory=list)
    years_experience: int | None = Field(None, ge=0, le=100)
    hourly_rate: int | None = Field(None, ge=0)  # in cents
    minimum_booking_hours: int | None = Field(None, ge=1, le=24)
    instagram_handle: str | None = Field(None, max_length=100)
    website_url: str | None = Field(None, max_length=255)


class ArtistProfileCreate(ArtistProfileBase):
    """Schema for creating an artist profile."""

    pass


class ArtistProfileUpdate(BaseModel):
    """Schema for updating an artist profile."""

    bio: str | None = None
    specialties: list[str] | None = None
    years_experience: int | None = None
    hourly_rate: int | None = None
    minimum_booking_hours: int | None = None
    instagram_handle: str | None = None
    website_url: str | None = None


class ArtistProfileResponse(ArtistProfileBase):
    """Schema for artist profile response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    portfolio_images: list[PortfolioImageResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class ArtistSummary(BaseModel):
    """Brief artist info for listings."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    first_name: str
    last_name: str
    role: str
    specialties: list[str] = Field(default_factory=list)
    years_experience: int | None = None
    hourly_rate: int | None = None
    portfolio_count: int = 0


class ArtistDetailResponse(BaseModel):
    """Full artist detail including user info and profile."""

    model_config = ConfigDict(from_attributes=True)

    # User info
    id: UUID
    first_name: str
    last_name: str
    email: str
    phone: str | None = None

    # Profile info
    bio: str | None = None
    specialties: list[str] = Field(default_factory=list)
    years_experience: int | None = None
    hourly_rate: int | None = None
    minimum_booking_hours: int | None = None
    instagram_handle: str | None = None
    website_url: str | None = None

    # Portfolio
    portfolio_images: list[PortfolioImageResponse] = Field(default_factory=list)


class ArtistsListResponse(BaseModel):
    """Paginated list of artists."""

    artists: list[ArtistSummary]
    total: int
    page: int
    per_page: int
    pages: int


class ReorderPortfolioRequest(BaseModel):
    """Request to reorder portfolio images."""

    image_ids: list[UUID] = Field(..., min_length=1)
