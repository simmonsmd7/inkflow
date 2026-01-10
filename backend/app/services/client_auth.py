"""Client authentication service for client portal."""

import uuid
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.client import Client
from app.schemas.client import ClientCreate
from app.services.auth import hash_password, verify_password

settings = get_settings()


def create_client_access_token(
    client_id: uuid.UUID,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a JWT access token for a client."""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.access_token_expire_minutes
        )

    to_encode = {
        "sub": str(client_id),
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "client_access",  # Different type to distinguish from staff tokens
    }

    return jwt.encode(
        to_encode,
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def decode_client_access_token(token: str) -> dict | None:
    """Decode and verify a JWT client access token."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        # Verify this is a client token
        if payload.get("type") != "client_access":
            return None
        return payload
    except JWTError:
        return None


async def get_client_by_email(db: AsyncSession, email: str) -> Client | None:
    """Get a client by email address."""
    result = await db.execute(
        select(Client).where(Client.email == email, Client.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def get_client_by_id(db: AsyncSession, client_id: uuid.UUID) -> Client | None:
    """Get a client by ID."""
    result = await db.execute(
        select(Client).where(Client.id == client_id, Client.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def get_client_by_verification_token(
    db: AsyncSession, token: str
) -> Client | None:
    """Get a client by email verification token."""
    result = await db.execute(
        select(Client).where(
            Client.verification_token == token,
            Client.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def get_client_by_reset_token(
    db: AsyncSession, token: str
) -> Client | None:
    """Get a client by password reset token."""
    result = await db.execute(
        select(Client).where(
            Client.password_reset_token == token,
            Client.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def create_client(
    db: AsyncSession,
    client_data: ClientCreate,
    auto_verify: bool = False,
) -> Client:
    """Create a new client."""
    client = Client(
        email=client_data.email,
        password_hash=hash_password(client_data.password),
        first_name=client_data.first_name,
        last_name=client_data.last_name,
        phone=client_data.phone,
        is_verified=auto_verify,
    )

    if not auto_verify:
        client.generate_verification_token()

    db.add(client)
    await db.flush()
    await db.refresh(client)
    return client


async def authenticate_client(
    db: AsyncSession,
    email: str,
    password: str,
) -> Client | None:
    """Authenticate a client by email and password."""
    client = await get_client_by_email(db, email)
    if not client:
        return None
    if not verify_password(password, client.password_hash):
        return None
    if not client.is_active:
        return None
    return client


# Security scheme for JWT Bearer tokens (reuse from auth)
client_security = HTTPBearer()


async def get_current_client(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(client_security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Client:
    """
    Dependency to get the current authenticated client from JWT token.

    Raises HTTPException 401 if token is invalid or client not found.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = credentials.credentials
    payload = decode_client_access_token(token)

    if payload is None:
        raise credentials_exception

    client_id_str = payload.get("sub")
    if client_id_str is None:
        raise credentials_exception

    try:
        client_id = uuid.UUID(client_id_str)
    except ValueError:
        raise credentials_exception

    client = await get_client_by_id(db, client_id)
    if client is None:
        raise credentials_exception

    if not client.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Client account is deactivated",
        )

    return client


async def get_current_active_verified_client(
    current_client: Annotated[Client, Depends(get_current_client)],
) -> Client:
    """
    Dependency to get the current client and verify they're active and verified.
    """
    if not current_client.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email first",
        )
    return current_client


async def reset_client_password(
    db: AsyncSession,
    client: Client,
    new_password: str,
) -> None:
    """Reset a client's password and clear the reset token."""
    client.password_hash = hash_password(new_password)
    client.clear_password_reset_token()
    await db.flush()
