"""Client authentication router for client portal."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.client import Client
from app.schemas.client import (
    ClientAuthResponse,
    ClientCreate,
    ClientDetailResponse,
    ClientEmailVerification,
    ClientLogin,
    ClientMessageResponse,
    ClientPasswordReset,
    ClientPasswordResetRequest,
    ClientResponse,
    ClientUpdate,
)
from app.services.client_auth import (
    authenticate_client,
    create_client,
    create_client_access_token,
    get_client_by_email,
    get_client_by_reset_token,
    get_client_by_verification_token,
    get_current_client,
    reset_client_password,
)
from app.services.email import email_service

settings = get_settings()
router = APIRouter(prefix="/client/auth", tags=["Client Authentication"])


@router.post(
    "/register",
    response_model=ClientMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    client_data: ClientCreate,
    db: AsyncSession = Depends(get_db),
) -> ClientMessageResponse:
    """
    Register a new client account.

    - Creates client with hashed password
    - Generates email verification token
    - Sends verification email (or logs to console in dev mode)
    """
    # Check if email already exists
    existing_client = await get_client_by_email(db, client_data.email)
    if existing_client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists",
        )

    # In development mode without email configured, auto-verify clients
    auto_verify = settings.app_env == "development" and not settings.is_email_configured

    # Create the client
    client = await create_client(db, client_data, auto_verify=auto_verify)

    if auto_verify:
        return ClientMessageResponse(
            message="Account created successfully. You can now log in.",
            success=True,
        )

    # Send verification email
    await email_service.send_verification_email(
        to_email=client.email,
        first_name=client.first_name,
        token=client.verification_token,
    )

    return ClientMessageResponse(
        message="Account created. Please check your email to verify your account.",
        success=True,
    )


@router.post("/verify-email", response_model=ClientMessageResponse)
async def verify_email(
    data: ClientEmailVerification,
    db: AsyncSession = Depends(get_db),
) -> ClientMessageResponse:
    """Verify a client's email address using the token sent via email."""
    client = await get_client_by_verification_token(db, data.token)

    if not client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token",
        )

    if client.verification_token_expires and client.verification_token_expires < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token has expired. Please request a new one.",
        )

    client.verify_email()
    await db.flush()

    return ClientMessageResponse(
        message="Email verified successfully. You can now log in.",
        success=True,
    )


@router.post("/resend-verification", response_model=ClientMessageResponse)
async def resend_verification(
    email_data: dict,
    db: AsyncSession = Depends(get_db),
) -> ClientMessageResponse:
    """Resend the verification email."""
    email = email_data.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is required",
        )

    client = await get_client_by_email(db, email)

    # Don't reveal if client exists or not for security
    if not client or client.is_verified:
        return ClientMessageResponse(
            message="If an unverified account exists with this email, a new verification link has been sent.",
            success=True,
        )

    # Generate new token
    client.generate_verification_token()
    await db.flush()

    # Send verification email
    await email_service.send_verification_email(
        to_email=client.email,
        first_name=client.first_name,
        token=client.verification_token,
    )

    return ClientMessageResponse(
        message="If an unverified account exists with this email, a new verification link has been sent.",
        success=True,
    )


@router.post("/login", response_model=ClientAuthResponse)
async def login(
    credentials: ClientLogin,
    db: AsyncSession = Depends(get_db),
) -> ClientAuthResponse:
    """
    Authenticate a client and return an access token.
    """
    client = await authenticate_client(db, credentials.email, credentials.password)

    if not client:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not client.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in",
        )

    # Update last login
    client.last_login_at = datetime.utcnow()
    await db.flush()

    # Create access token
    access_token = create_client_access_token(client.id)

    return ClientAuthResponse(
        access_token=access_token,
        client=ClientResponse.model_validate(client),
    )


@router.get("/me", response_model=ClientDetailResponse)
async def get_me(
    current_client: Client = Depends(get_current_client),
) -> ClientDetailResponse:
    """
    Get the current authenticated client's profile.
    """
    return ClientDetailResponse.model_validate(current_client)


@router.patch("/me", response_model=ClientDetailResponse)
async def update_me(
    update_data: ClientUpdate,
    current_client: Client = Depends(get_current_client),
    db: AsyncSession = Depends(get_db),
) -> ClientDetailResponse:
    """
    Update the current authenticated client's profile.
    """
    update_dict = update_data.model_dump(exclude_unset=True)

    for field, value in update_dict.items():
        setattr(current_client, field, value)

    await db.flush()
    await db.refresh(current_client)

    return ClientDetailResponse.model_validate(current_client)


@router.post("/logout", response_model=ClientMessageResponse)
async def logout() -> ClientMessageResponse:
    """
    Log out the current client.

    Note: Since we use stateless JWTs, logout is handled client-side
    by removing the token. This endpoint is for API completeness.
    """
    return ClientMessageResponse(
        message="Successfully logged out",
        success=True,
    )


@router.post("/forgot-password", response_model=ClientMessageResponse)
async def forgot_password(
    data: ClientPasswordResetRequest,
    db: AsyncSession = Depends(get_db),
) -> ClientMessageResponse:
    """
    Request a password reset email.

    Always returns success message to prevent email enumeration attacks.
    """
    client = await get_client_by_email(db, data.email)

    # For security, always return success even if client doesn't exist
    if not client or not client.is_active:
        return ClientMessageResponse(
            message="If an account exists with this email, a password reset link has been sent.",
            success=True,
        )

    # Generate reset token
    token = client.generate_password_reset_token()
    await db.flush()

    # Send password reset email
    await email_service.send_password_reset_email(
        to_email=client.email,
        first_name=client.first_name,
        token=token,
    )

    return ClientMessageResponse(
        message="If an account exists with this email, a password reset link has been sent.",
        success=True,
    )


@router.post("/reset-password", response_model=ClientMessageResponse)
async def reset_password(
    data: ClientPasswordReset,
    db: AsyncSession = Depends(get_db),
) -> ClientMessageResponse:
    """
    Reset a client's password using the token from email.
    """
    client = await get_client_by_reset_token(db, data.token)

    if not client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    if client.password_reset_expires and client.password_reset_expires < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired. Please request a new one.",
        )

    # Reset the password
    await reset_client_password(db, client, data.new_password)

    return ClientMessageResponse(
        message="Password reset successfully. You can now log in with your new password.",
        success=True,
    )
