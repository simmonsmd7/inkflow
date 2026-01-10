"""Studios router for studio profile management (owner only for writes)."""

import os
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.studio import Studio
from app.models.user import User
from app.schemas.studio import (
    StudioCreate,
    StudioListResponse,
    StudioLogoUpload,
    StudioResponse,
    StudioUpdate,
)
from app.schemas.user import MessageResponse
from app.services.auth import get_current_user, require_owner

router = APIRouter(prefix="/studios", tags=["Studios"])

# Upload directory for logos
UPLOAD_DIR = Path("uploads/logos")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Allowed image extensions
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


def generate_slug(name: str) -> str:
    """Generate a URL-friendly slug from studio name."""
    slug = name.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug


async def get_studio_by_id(db: AsyncSession, studio_id: uuid.UUID) -> Studio | None:
    """Get a studio by ID."""
    query = select(Studio).where(
        Studio.id == studio_id,
        Studio.deleted_at.is_(None),
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_studio_by_slug(db: AsyncSession, slug: str) -> Studio | None:
    """Get a studio by slug."""
    query = select(Studio).where(
        Studio.slug == slug,
        Studio.deleted_at.is_(None),
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def ensure_unique_slug(db: AsyncSession, base_slug: str, exclude_id: uuid.UUID | None = None) -> str:
    """Ensure the slug is unique, appending a number if necessary."""
    slug = base_slug
    counter = 1

    while True:
        query = select(Studio).where(
            Studio.slug == slug,
            Studio.deleted_at.is_(None),
        )
        if exclude_id:
            query = query.where(Studio.id != exclude_id)

        result = await db.execute(query)
        existing = result.scalar_one_or_none()

        if not existing:
            return slug

        slug = f"{base_slug}-{counter}"
        counter += 1


@router.get("", response_model=StudioListResponse)
async def list_studios(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
) -> StudioListResponse:
    """
    List all studios the current user has access to.

    For now, this returns studios owned by the user.
    In future, this can include studios where the user is a team member.
    """
    query = (
        select(Studio)
        .where(
            Studio.owner_id == current_user.id,
            Studio.deleted_at.is_(None),
        )
        .order_by(Studio.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    studios = result.scalars().all()

    # Get total count
    count_query = select(func.count()).select_from(Studio).where(
        Studio.owner_id == current_user.id,
        Studio.deleted_at.is_(None),
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    return StudioListResponse(
        studios=[StudioResponse.model_validate(s) for s in studios],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.post("", response_model=StudioResponse, status_code=status.HTTP_201_CREATED)
async def create_studio(
    studio_data: StudioCreate,
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> StudioResponse:
    """
    Create a new studio (owner only).

    Creates a new studio profile with the specified details.
    """
    # Generate unique slug
    base_slug = generate_slug(studio_data.name)
    slug = await ensure_unique_slug(db, base_slug)

    # Prepare business hours
    business_hours = None
    if studio_data.business_hours:
        business_hours = studio_data.business_hours.model_dump()

    studio = Studio(
        name=studio_data.name,
        slug=slug,
        description=studio_data.description,
        email=studio_data.email,
        phone=studio_data.phone,
        website=studio_data.website,
        address_line1=studio_data.address_line1,
        address_line2=studio_data.address_line2,
        city=studio_data.city,
        state=studio_data.state,
        postal_code=studio_data.postal_code,
        country=studio_data.country,
        timezone=studio_data.timezone,
        business_hours=business_hours,
        owner_id=current_user.id,
    )

    db.add(studio)
    await db.flush()
    await db.refresh(studio)

    return StudioResponse.model_validate(studio)


@router.get("/{studio_id}", response_model=StudioResponse)
async def get_studio(
    studio_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StudioResponse:
    """
    Get a studio by ID.

    Any authenticated user can view studio details.
    """
    studio = await get_studio_by_id(db, studio_id)
    if not studio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Studio not found",
        )

    return StudioResponse.model_validate(studio)


@router.put("/{studio_id}", response_model=StudioResponse)
async def update_studio(
    studio_id: uuid.UUID,
    studio_data: StudioUpdate,
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> StudioResponse:
    """
    Update a studio's details (owner only).
    """
    studio = await get_studio_by_id(db, studio_id)
    if not studio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Studio not found",
        )

    # Check ownership
    if studio.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this studio",
        )

    # Apply updates
    update_fields = studio_data.model_dump(exclude_unset=True)

    # Handle name change (update slug)
    if "name" in update_fields and update_fields["name"]:
        base_slug = generate_slug(update_fields["name"])
        update_fields["slug"] = await ensure_unique_slug(db, base_slug, exclude_id=studio.id)

    # Handle business hours - already converted to dict by model_dump() above
    # No additional processing needed

    for field, value in update_fields.items():
        setattr(studio, field, value)

    await db.flush()
    await db.refresh(studio)

    return StudioResponse.model_validate(studio)


@router.post("/{studio_id}/logo", response_model=StudioLogoUpload)
async def upload_logo(
    studio_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> StudioLogoUpload:
    """
    Upload a studio logo (owner only).

    Accepts JPG, PNG, GIF, or WebP images up to 5MB.
    """
    studio = await get_studio_by_id(db, studio_id)
    if not studio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Studio not found",
        )

    # Check ownership
    if studio.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this studio",
        )

    # Validate file extension
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided",
        )

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Read file content and check size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE // 1024 // 1024}MB",
        )

    # Generate unique filename
    filename = f"{studio.id}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = UPLOAD_DIR / filename

    # Delete old logo if exists
    if studio.logo_url:
        old_filename = studio.logo_url.split("/")[-1]
        old_filepath = UPLOAD_DIR / old_filename
        if old_filepath.exists():
            old_filepath.unlink()

    # Save new logo
    with open(filepath, "wb") as f:
        f.write(content)

    # Update studio with logo URL
    logo_url = f"/uploads/logos/{filename}"
    studio.logo_url = logo_url

    await db.flush()
    await db.refresh(studio)

    return StudioLogoUpload(logo_url=logo_url)


@router.delete("/{studio_id}/logo", response_model=MessageResponse)
async def delete_logo(
    studio_id: uuid.UUID,
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """
    Delete the studio logo (owner only).
    """
    studio = await get_studio_by_id(db, studio_id)
    if not studio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Studio not found",
        )

    # Check ownership
    if studio.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this studio",
        )

    if not studio.logo_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Studio has no logo to delete",
        )

    # Delete file
    filename = studio.logo_url.split("/")[-1]
    filepath = UPLOAD_DIR / filename
    if filepath.exists():
        filepath.unlink()

    # Clear logo URL
    studio.logo_url = None
    await db.flush()

    return MessageResponse(
        message="Logo deleted successfully",
        success=True,
    )


@router.delete("/{studio_id}", response_model=MessageResponse)
async def delete_studio(
    studio_id: uuid.UUID,
    current_user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """
    Soft delete a studio (owner only).

    The studio data is preserved but marked as deleted.
    """
    studio = await get_studio_by_id(db, studio_id)
    if not studio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Studio not found",
        )

    # Check ownership
    if studio.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this studio",
        )

    # Soft delete
    from datetime import datetime
    studio.deleted_at = datetime.utcnow()
    await db.flush()

    return MessageResponse(
        message=f"Studio '{studio.name}' has been deleted",
        success=True,
    )
