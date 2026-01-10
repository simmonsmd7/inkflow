"""Users router for team management (owner only)."""

import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.user import (
    MessageResponse,
    UserDetailResponse,
    UserInvite,
    UserResponse,
    UsersListResponse,
    UserUpdate,
)
from app.services.auth import (
    get_user_by_email,
    get_user_by_id,
    hash_password,
    list_users,
    require_owner,
)
from app.services.email import email_service

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=UsersListResponse)
async def get_users(
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    include_inactive: bool = Query(False),
) -> UsersListResponse:
    """
    List all users (owner only).

    Paginated list of all team members.
    """
    users = await list_users(db, skip=skip, limit=limit, include_inactive=include_inactive)

    # Get total count
    count_query = select(func.count()).select_from(User).where(User.deleted_at.is_(None))
    if not include_inactive:
        count_query = count_query.where(User.is_active.is_(True))
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    return UsersListResponse(
        users=[UserResponse.model_validate(u) for u in users],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/{user_id}", response_model=UserDetailResponse)
async def get_user(
    user_id: uuid.UUID,
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> UserDetailResponse:
    """
    Get a specific user's details (owner only).
    """
    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return UserDetailResponse.model_validate(user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    user_data: UserUpdate,
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """
    Update a user's details (owner only).

    Owners can update:
    - Name and phone
    - Role (owner, artist, receptionist)
    - Active status (deactivate/reactivate accounts)
    """
    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Prevent owner from demoting themselves
    if user.id == current_user.id and user_data.role and user_data.role.value != "owner":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role. Have another owner make this change.",
        )

    # Prevent owner from deactivating themselves
    if user.id == current_user.id and user_data.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account",
        )

    # Apply updates
    update_fields = user_data.model_dump(exclude_unset=True)
    for field, value in update_fields.items():
        setattr(user, field, value)

    await db.flush()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.post("/invite", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def invite_user(
    invite_data: UserInvite,
    _: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """
    Invite a new team member (owner only).

    Creates a new user account with a temporary password and sends
    an invite email with instructions to set their password.
    """
    # Check if email already exists
    existing = await get_user_by_email(db, invite_data.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists",
        )

    # Generate a temporary password
    temp_password = secrets.token_urlsafe(12)

    # Create the user with a verified account (invited users skip email verification)
    user = User(
        email=invite_data.email,
        hashed_password=hash_password(temp_password),
        first_name=invite_data.first_name,
        last_name=invite_data.last_name,
        role=invite_data.role,
        is_verified=True,  # Invited users are pre-verified
        is_active=True,
    )

    # Generate a password reset token so they can set their own password
    reset_token = user.generate_password_reset_token()

    db.add(user)
    await db.flush()
    await db.refresh(user)

    # Send invite email
    await email_service.send_invite_email(
        to_email=user.email,
        first_name=user.first_name,
        token=reset_token,
    )

    return MessageResponse(
        message=f"Invitation sent to {user.email}",
        success=True,
    )


@router.delete("/{user_id}", response_model=MessageResponse)
async def deactivate_user(
    user_id: uuid.UUID,
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """
    Deactivate a user account (owner only).

    This is a soft deactivation - the user's data is preserved but they
    cannot log in. Use PUT to reactivate.
    """
    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Prevent owner from deactivating themselves
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account",
        )

    user.is_active = False
    await db.flush()

    return MessageResponse(
        message=f"User {user.email} has been deactivated",
        success=True,
    )
