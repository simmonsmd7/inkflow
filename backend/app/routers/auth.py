"""Authentication router for user registration, login, and verification."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.schemas.user import (
    AuthResponse,
    EmailVerification,
    MessageResponse,
    PasswordReset,
    PasswordResetRequest,
    UserCreate,
    UserDetailResponse,
    UserLogin,
    UserResponse,
)
from app.services.auth import (
    authenticate_user,
    create_access_token,
    create_user,
    get_current_user,
    get_user_by_email,
    get_user_by_reset_token,
    get_user_by_verification_token,
    reset_user_password,
)
from app.models.user import User
from app.services.email import email_service

settings = get_settings()
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """
    Register a new user account.

    - Creates user with hashed password
    - Generates email verification token
    - Sends verification email (or logs to console in dev mode)
    """
    # Check if email already exists
    existing_user = await get_user_by_email(db, user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists",
        )

    # In development mode without email configured, auto-verify users
    auto_verify = settings.app_env == "development" and not settings.is_email_configured

    # Create the user
    user = await create_user(db, user_data, auto_verify=auto_verify)

    if auto_verify:
        return MessageResponse(
            message="Account created successfully. You can now log in.",
            success=True,
        )

    # Send verification email
    await email_service.send_verification_email(
        to_email=user.email,
        first_name=user.first_name,
        token=user.verification_token,
    )

    return MessageResponse(
        message="Account created. Please check your email to verify your account.",
        success=True,
    )


@router.post("/verify-email", response_model=MessageResponse)
async def verify_email(
    data: EmailVerification,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Verify a user's email address using the token sent via email."""
    user = await get_user_by_verification_token(db, data.token)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token",
        )

    if user.verification_token_expires and user.verification_token_expires < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token has expired. Please request a new one.",
        )

    user.verify_email()
    await db.flush()

    return MessageResponse(
        message="Email verified successfully. You can now log in.",
        success=True,
    )


@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification(
    email_data: dict,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Resend the verification email."""
    email = email_data.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is required",
        )

    user = await get_user_by_email(db, email)

    # Don't reveal if user exists or not for security
    if not user or user.is_verified:
        return MessageResponse(
            message="If an unverified account exists with this email, a new verification link has been sent.",
            success=True,
        )

    # Generate new token
    user.generate_verification_token()
    await db.flush()

    # Send verification email
    await email_service.send_verification_email(
        to_email=user.email,
        first_name=user.first_name,
        token=user.verification_token,
    )

    return MessageResponse(
        message="If an unverified account exists with this email, a new verification link has been sent.",
        success=True,
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    credentials: UserLogin,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    """
    Authenticate a user and return an access token.
    """
    user = await authenticate_user(db, credentials.email, credentials.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in",
        )

    # Update last login
    user.last_login_at = datetime.utcnow()
    await db.flush()

    # Create access token
    access_token = create_access_token(user.id)

    return AuthResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserDetailResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> UserDetailResponse:
    """
    Get the current authenticated user's profile.
    """
    return UserDetailResponse.model_validate(current_user)


@router.post("/logout", response_model=MessageResponse)
async def logout() -> MessageResponse:
    """
    Log out the current user.

    Note: Since we use stateless JWTs, logout is handled client-side
    by removing the token. This endpoint is for API completeness.
    """
    return MessageResponse(
        message="Successfully logged out",
        success=True,
    )


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    data: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """
    Request a password reset email.

    Always returns success message to prevent email enumeration attacks.
    """
    user = await get_user_by_email(db, data.email)

    # For security, always return success even if user doesn't exist
    if not user or not user.is_active:
        return MessageResponse(
            message="If an account exists with this email, a password reset link has been sent.",
            success=True,
        )

    # Generate reset token
    token = user.generate_password_reset_token()
    await db.flush()

    # Send password reset email
    await email_service.send_password_reset_email(
        to_email=user.email,
        first_name=user.first_name,
        token=token,
    )

    return MessageResponse(
        message="If an account exists with this email, a password reset link has been sent.",
        success=True,
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    data: PasswordReset,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """
    Reset a user's password using the token from email.
    """
    user = await get_user_by_reset_token(db, data.token)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    if user.password_reset_expires and user.password_reset_expires < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired. Please request a new one.",
        )

    # Reset the password
    await reset_user_password(db, user, data.new_password)

    return MessageResponse(
        message="Password reset successfully. You can now log in with your new password.",
        success=True,
    )
