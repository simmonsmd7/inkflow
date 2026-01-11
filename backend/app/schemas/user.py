"""User schemas for request/response validation."""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


# Base schemas
class UserBase(BaseModel):
    """Base user schema with common fields."""

    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: str | None = Field(None, max_length=20)


# Request schemas
class UserCreate(UserBase):
    """Schema for user registration."""

    password: str = Field(..., min_length=8, max_length=100)
    role: UserRole = UserRole.ARTIST


class UserLogin(BaseModel):
    """Schema for user login."""

    email: EmailStr
    password: str


class EmailVerification(BaseModel):
    """Schema for email verification."""

    token: str


class PasswordResetRequest(BaseModel):
    """Schema for requesting password reset."""

    email: EmailStr


class PasswordReset(BaseModel):
    """Schema for resetting password."""

    token: str
    new_password: str = Field(..., min_length=8, max_length=100)


class PasswordChange(BaseModel):
    """Schema for changing password while logged in."""

    current_password: str
    new_password: str = Field(..., min_length=8, max_length=100)


class UserUpdate(BaseModel):
    """Schema for updating user details (owner only)."""

    first_name: str | None = Field(None, min_length=1, max_length=100)
    last_name: str | None = Field(None, min_length=1, max_length=100)
    phone: str | None = Field(None, max_length=20)
    role: UserRole | None = None
    is_active: bool | None = None


class UserInvite(BaseModel):
    """Schema for inviting a new team member (owner only)."""

    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    role: UserRole = UserRole.ARTIST


class UsersListResponse(BaseModel):
    """Schema for paginated users list."""

    users: list["UserResponse"]
    total: int
    skip: int
    limit: int


# Response schemas
class UserResponse(UserBase):
    """Schema for user response (public info)."""

    id: uuid.UUID
    role: UserRole
    is_active: bool
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserDetailResponse(UserResponse):
    """Schema for detailed user response (own profile)."""

    last_login_at: datetime | None
    verified_at: datetime | None
    updated_at: datetime

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    """Schema for authentication response."""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    has_studio: bool = False


class OnboardingRequest(BaseModel):
    """Schema for onboarding - creating a business."""

    business_name: str = Field(..., min_length=2, max_length=255)
    business_email: EmailStr


class MessageResponse(BaseModel):
    """Schema for simple message responses."""

    message: str
    success: bool = True
