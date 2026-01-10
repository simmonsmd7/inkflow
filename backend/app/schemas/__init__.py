"""Pydantic schemas package."""

from app.schemas.artist import (
    ArtistDetailResponse,
    ArtistProfileCreate,
    ArtistProfileResponse,
    ArtistProfileUpdate,
    ArtistsListResponse,
    ArtistSummary,
    PortfolioImageCreate,
    PortfolioImageResponse,
    PortfolioImageUpdate,
    ReorderPortfolioRequest,
)
from app.schemas.studio import (
    BusinessHours,
    BusinessHoursDay,
    StudioCreate,
    StudioListResponse,
    StudioLogoUpload,
    StudioResponse,
    StudioUpdate,
)
from app.schemas.user import (
    AuthResponse,
    EmailVerification,
    MessageResponse,
    PasswordChange,
    PasswordReset,
    PasswordResetRequest,
    UserCreate,
    UserDetailResponse,
    UserLogin,
    UserResponse,
)

__all__ = [
    # Artist schemas
    "ArtistDetailResponse",
    "ArtistProfileCreate",
    "ArtistProfileResponse",
    "ArtistProfileUpdate",
    "ArtistsListResponse",
    "ArtistSummary",
    "PortfolioImageCreate",
    "PortfolioImageResponse",
    "PortfolioImageUpdate",
    "ReorderPortfolioRequest",
    # Studio schemas
    "BusinessHours",
    "BusinessHoursDay",
    "StudioCreate",
    "StudioListResponse",
    "StudioLogoUpload",
    "StudioResponse",
    "StudioUpdate",
    # User schemas
    "AuthResponse",
    "EmailVerification",
    "MessageResponse",
    "PasswordChange",
    "PasswordReset",
    "PasswordResetRequest",
    "UserCreate",
    "UserDetailResponse",
    "UserLogin",
    "UserResponse",
]
