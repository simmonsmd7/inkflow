"""Artists router for profile and portfolio management."""

import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import ArtistProfile, PortfolioImage, User, UserRole
from app.schemas.artist import (
    ArtistDetailResponse,
    ArtistProfileCreate,
    ArtistProfileResponse,
    ArtistProfileUpdate,
    ArtistsListResponse,
    ArtistSummary,
    PortfolioImageResponse,
    PortfolioImageUpdate,
    ReorderPortfolioRequest,
)
from app.schemas.user import MessageResponse
from app.services.auth import get_current_user, require_artist_or_owner

router = APIRouter(prefix="/artists", tags=["Artists"])

# Directory for portfolio images
PORTFOLIO_DIR = Path("uploads/portfolio")
PORTFOLIO_DIR.mkdir(parents=True, exist_ok=True)

# Allowed image types
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB for portfolio images


@router.get("", response_model=ArtistsListResponse)
async def list_artists(
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = 1,
    per_page: int = 20,
    specialty: str | None = None,
):
    """
    List all artists with their summary info.

    Public endpoint for browsing artists for booking.
    """
    if page < 1:
        page = 1
    if per_page < 1 or per_page > 100:
        per_page = 20

    offset = (page - 1) * per_page

    # Base query for artists
    base_query = (
        select(User)
        .where(
            User.role == UserRole.ARTIST,
            User.is_active.is_(True),
            User.deleted_at.is_(None),
        )
        .options(selectinload(User.artist_profile).selectinload(ArtistProfile.portfolio_images))
    )

    # Filter by specialty if provided
    if specialty:
        base_query = base_query.join(User.artist_profile).where(
            ArtistProfile.specialties.contains([specialty])
        )

    # Count total
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Fetch paginated results
    query = base_query.order_by(User.created_at.desc()).offset(offset).limit(per_page)
    result = await db.execute(query)
    users = result.scalars().all()

    # Build response
    artists = []
    for user in users:
        profile = user.artist_profile
        artists.append(
            ArtistSummary(
                id=user.id,
                first_name=user.first_name,
                last_name=user.last_name,
                role=user.role.value,
                specialties=profile.specialties if profile else [],
                years_experience=profile.years_experience if profile else None,
                hourly_rate=profile.hourly_rate if profile else None,
                portfolio_count=len(profile.portfolio_images) if profile else 0,
            )
        )

    pages = (total + per_page - 1) // per_page if total > 0 else 1

    return ArtistsListResponse(
        artists=artists,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
    )


@router.get("/me/profile", response_model=ArtistDetailResponse)
async def get_my_profile(
    current_user: Annotated[User, Depends(require_artist_or_owner)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get the current artist's profile.

    Requires artist or owner role.
    """
    # Reload with relationships
    result = await db.execute(
        select(User)
        .where(User.id == current_user.id)
        .options(selectinload(User.artist_profile).selectinload(ArtistProfile.portfolio_images))
    )
    user = result.scalar_one()

    profile = user.artist_profile

    return ArtistDetailResponse(
        id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        phone=user.phone,
        bio=profile.bio if profile else None,
        specialties=profile.specialties if profile else [],
        years_experience=profile.years_experience if profile else None,
        hourly_rate=profile.hourly_rate if profile else None,
        minimum_booking_hours=profile.minimum_booking_hours if profile else None,
        instagram_handle=profile.instagram_handle if profile else None,
        website_url=profile.website_url if profile else None,
        portfolio_images=[
            PortfolioImageResponse(
                id=img.id,
                image_url=img.image_url,
                thumbnail_url=img.thumbnail_url,
                title=img.title,
                description=img.description,
                style=img.style,
                placement=img.placement,
                display_order=img.display_order,
                created_at=img.created_at,
            )
            for img in (profile.portfolio_images if profile else [])
        ],
    )


@router.put("/me/profile", response_model=ArtistDetailResponse)
async def update_my_profile(
    profile_data: ArtistProfileUpdate,
    current_user: Annotated[User, Depends(require_artist_or_owner)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Update the current artist's profile.

    Creates the profile if it doesn't exist.
    Requires artist or owner role.
    """
    # Reload with relationships
    result = await db.execute(
        select(User)
        .where(User.id == current_user.id)
        .options(selectinload(User.artist_profile).selectinload(ArtistProfile.portfolio_images))
    )
    user = result.scalar_one()

    profile = user.artist_profile

    # Create profile if it doesn't exist
    if not profile:
        profile = ArtistProfile(user_id=user.id)
        db.add(profile)
        await db.flush()

    # Update fields
    update_data = profile_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)

    return ArtistDetailResponse(
        id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        phone=user.phone,
        bio=profile.bio,
        specialties=profile.specialties or [],
        years_experience=profile.years_experience,
        hourly_rate=profile.hourly_rate,
        minimum_booking_hours=profile.minimum_booking_hours,
        instagram_handle=profile.instagram_handle,
        website_url=profile.website_url,
        portfolio_images=[
            PortfolioImageResponse(
                id=img.id,
                image_url=img.image_url,
                thumbnail_url=img.thumbnail_url,
                title=img.title,
                description=img.description,
                style=img.style,
                placement=img.placement,
                display_order=img.display_order,
                created_at=img.created_at,
            )
            for img in profile.portfolio_images
        ],
    )


@router.get("/{artist_id}", response_model=ArtistDetailResponse)
async def get_artist(
    artist_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get a specific artist's public profile.

    Public endpoint for viewing artist details before booking.
    """
    result = await db.execute(
        select(User)
        .where(
            User.id == artist_id,
            User.role == UserRole.ARTIST,
            User.is_active.is_(True),
            User.deleted_at.is_(None),
        )
        .options(selectinload(User.artist_profile).selectinload(ArtistProfile.portfolio_images))
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artist not found",
        )

    profile = user.artist_profile

    return ArtistDetailResponse(
        id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        phone=user.phone,
        bio=profile.bio if profile else None,
        specialties=profile.specialties if profile else [],
        years_experience=profile.years_experience if profile else None,
        hourly_rate=profile.hourly_rate if profile else None,
        minimum_booking_hours=profile.minimum_booking_hours if profile else None,
        instagram_handle=profile.instagram_handle if profile else None,
        website_url=profile.website_url if profile else None,
        portfolio_images=[
            PortfolioImageResponse(
                id=img.id,
                image_url=img.image_url,
                thumbnail_url=img.thumbnail_url,
                title=img.title,
                description=img.description,
                style=img.style,
                placement=img.placement,
                display_order=img.display_order,
                created_at=img.created_at,
            )
            for img in (profile.portfolio_images if profile else [])
        ],
    )


@router.post("/me/portfolio", response_model=PortfolioImageResponse)
async def upload_portfolio_image(
    file: Annotated[UploadFile, File(...)],
    current_user: Annotated[User, Depends(require_artist_or_owner)],
    db: Annotated[AsyncSession, Depends(get_db)],
    title: str | None = None,
    description: str | None = None,
    style: str | None = None,
    placement: str | None = None,
):
    """
    Upload a new portfolio image.

    Requires artist or owner role.
    Max file size: 10MB.
    Allowed types: JPEG, PNG, GIF, WebP.
    """
    # Validate file type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_TYPES)}",
        )

    # Read and validate file size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024 * 1024)}MB",
        )

    # Ensure user has a profile
    result = await db.execute(
        select(User)
        .where(User.id == current_user.id)
        .options(selectinload(User.artist_profile).selectinload(ArtistProfile.portfolio_images))
    )
    user = result.scalar_one()

    profile = user.artist_profile
    if not profile:
        profile = ArtistProfile(user_id=user.id)
        db.add(profile)
        await db.flush()
        await db.refresh(profile)

    # Generate unique filename
    ext = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    if ext not in {".jpg", ".jpeg", ".png", ".gif", ".webp"}:
        ext = ".jpg"

    filename = f"{uuid.uuid4()}{ext}"
    file_path = PORTFOLIO_DIR / filename

    # Save file
    with open(file_path, "wb") as f:
        f.write(content)

    # Get next display order
    max_order = 0
    for img in profile.portfolio_images:
        if img.display_order > max_order:
            max_order = img.display_order

    # Create database record
    portfolio_image = PortfolioImage(
        artist_profile_id=profile.id,
        image_url=f"/uploads/portfolio/{filename}",
        thumbnail_url=None,  # Could generate thumbnails later
        title=title,
        description=description,
        style=style,
        placement=placement,
        display_order=max_order + 1,
    )
    db.add(portfolio_image)
    await db.commit()
    await db.refresh(portfolio_image)

    return PortfolioImageResponse(
        id=portfolio_image.id,
        image_url=portfolio_image.image_url,
        thumbnail_url=portfolio_image.thumbnail_url,
        title=portfolio_image.title,
        description=portfolio_image.description,
        style=portfolio_image.style,
        placement=portfolio_image.placement,
        display_order=portfolio_image.display_order,
        created_at=portfolio_image.created_at,
    )


@router.put("/me/portfolio/{image_id}", response_model=PortfolioImageResponse)
async def update_portfolio_image(
    image_id: uuid.UUID,
    update_data: PortfolioImageUpdate,
    current_user: Annotated[User, Depends(require_artist_or_owner)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Update portfolio image metadata.

    Requires artist or owner role.
    """
    # Get the image and verify ownership
    result = await db.execute(
        select(PortfolioImage)
        .join(ArtistProfile)
        .where(
            PortfolioImage.id == image_id,
            ArtistProfile.user_id == current_user.id,
        )
    )
    image = result.scalar_one_or_none()

    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio image not found",
        )

    # Update fields
    data = update_data.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(image, field, value)

    await db.commit()
    await db.refresh(image)

    return PortfolioImageResponse(
        id=image.id,
        image_url=image.image_url,
        thumbnail_url=image.thumbnail_url,
        title=image.title,
        description=image.description,
        style=image.style,
        placement=image.placement,
        display_order=image.display_order,
        created_at=image.created_at,
    )


@router.delete("/me/portfolio/{image_id}", response_model=MessageResponse)
async def delete_portfolio_image(
    image_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_artist_or_owner)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Delete a portfolio image.

    Requires artist or owner role.
    """
    # Get the image and verify ownership
    result = await db.execute(
        select(PortfolioImage)
        .join(ArtistProfile)
        .where(
            PortfolioImage.id == image_id,
            ArtistProfile.user_id == current_user.id,
        )
    )
    image = result.scalar_one_or_none()

    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio image not found",
        )

    # Delete file from disk
    file_path = Path("." + image.image_url)
    if file_path.exists():
        file_path.unlink()

    # Delete from database
    await db.delete(image)
    await db.commit()

    return MessageResponse(message="Portfolio image deleted successfully")


@router.put("/me/portfolio/reorder", response_model=list[PortfolioImageResponse])
async def reorder_portfolio(
    reorder_data: ReorderPortfolioRequest,
    current_user: Annotated[User, Depends(require_artist_or_owner)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Reorder portfolio images.

    Provide the image IDs in the desired order.
    Requires artist or owner role.
    """
    # Get all images for this user
    result = await db.execute(
        select(PortfolioImage)
        .join(ArtistProfile)
        .where(ArtistProfile.user_id == current_user.id)
    )
    images = {img.id: img for img in result.scalars().all()}

    # Validate all IDs belong to this user
    for idx, image_id in enumerate(reorder_data.image_ids):
        if image_id not in images:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Image {image_id} not found in your portfolio",
            )
        images[image_id].display_order = idx

    await db.commit()

    # Return reordered images
    ordered_images = sorted(images.values(), key=lambda x: x.display_order)
    return [
        PortfolioImageResponse(
            id=img.id,
            image_url=img.image_url,
            thumbnail_url=img.thumbnail_url,
            title=img.title,
            description=img.description,
            style=img.style,
            placement=img.placement,
            display_order=img.display_order,
            created_at=img.created_at,
        )
        for img in ordered_images
    ]
