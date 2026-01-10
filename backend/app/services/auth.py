"""Authentication service for password hashing and JWT tokens."""

import uuid
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate

settings = get_settings()

# Password hashing context - using argon2 (more secure and Python 3.13 compatible)
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a plain text password."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    user_id: uuid.UUID,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a JWT access token."""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.access_token_expire_minutes
        )

    to_encode = {
        "sub": str(user_id),
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access",
    }

    return jwt.encode(
        to_encode,
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(token: str) -> dict | None:
    """Decode and verify a JWT access token."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        return payload
    except JWTError:
        return None


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    """Get a user by email address."""
    result = await db.execute(
        select(User).where(User.email == email, User.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def list_users(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    include_inactive: bool = False,
) -> list[User]:
    """List all users with pagination."""
    query = select(User).where(User.deleted_at.is_(None))
    if not include_inactive:
        query = query.where(User.is_active.is_(True))
    query = query.order_by(User.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    """Get a user by ID."""
    result = await db.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def get_user_by_verification_token(
    db: AsyncSession, token: str
) -> User | None:
    """Get a user by email verification token."""
    result = await db.execute(
        select(User).where(
            User.verification_token == token,
            User.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def get_user_by_reset_token(
    db: AsyncSession, token: str
) -> User | None:
    """Get a user by password reset token."""
    result = await db.execute(
        select(User).where(
            User.password_reset_token == token,
            User.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def create_user(
    db: AsyncSession,
    user_data: UserCreate,
    auto_verify: bool = False,
) -> User:
    """Create a new user."""
    user = User(
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        phone=user_data.phone,
        role=user_data.role,
        is_verified=auto_verify,
    )

    if not auto_verify:
        user.generate_verification_token()

    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def authenticate_user(
    db: AsyncSession,
    email: str,
    password: str,
) -> User | None:
    """Authenticate a user by email and password."""
    user = await get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    return user


# Security scheme for JWT Bearer tokens
security = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """
    Dependency to get the current authenticated user from JWT token.

    Raises HTTPException 401 if token is invalid or user not found.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = credentials.credentials
    payload = decode_access_token(token)

    if payload is None:
        raise credentials_exception

    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise credentials_exception

    user = await get_user_by_id(db, user_id)
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    return user


async def get_current_active_verified_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """
    Dependency to get the current user and verify they're active and verified.
    """
    if not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email first",
        )
    return current_user


async def reset_user_password(
    db: AsyncSession,
    user: User,
    new_password: str,
) -> None:
    """Reset a user's password and clear the reset token."""
    user.hashed_password = hash_password(new_password)
    user.clear_password_reset()
    await db.flush()


def require_role(*allowed_roles: str):
    """
    Create a dependency that requires the current user to have one of the specified roles.

    Usage:
        @router.get("/admin-only", dependencies=[Depends(require_role("owner"))])
        async def admin_endpoint():
            ...

        # Or use the return value directly:
        @router.get("/settings")
        async def settings(user: User = Depends(require_role("owner", "artist"))):
            ...

        # Also accepts a list for convenience:
        @router.get("/any")
        async def any_endpoint(user: User = Depends(require_role(["owner", "artist"]))):
            ...
    """
    from app.models.user import UserRole

    # Normalize allowed_roles: if a single list was passed, flatten it
    normalized_roles: list[str] = []
    for role in allowed_roles:
        if isinstance(role, (list, tuple)):
            # Handle list/tuple of roles
            for r in role:
                if isinstance(r, UserRole):
                    normalized_roles.append(r.value)
                else:
                    normalized_roles.append(str(r))
        elif isinstance(role, UserRole):
            normalized_roles.append(role.value)
        else:
            normalized_roles.append(str(role))

    async def role_checker(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        # Normalize role values for comparison
        user_role = current_user.role.value if isinstance(current_user.role, UserRole) else current_user.role
        if user_role not in normalized_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {', '.join(normalized_roles)}",
            )
        return current_user

    return role_checker


# Pre-built role dependencies for common use cases
require_owner = require_role("owner")
require_artist_or_owner = require_role("owner", "artist")
require_any_staff = require_role("owner", "artist", "receptionist")
