"""Booking requests router."""

import os
import shutil
import uuid
from datetime import datetime
from math import ceil
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import (
    BookingReferenceImage,
    BookingRequest,
    BookingRequestStatus,
    Studio,
    User,
    UserRole,
)
from app.schemas.booking import (
    ArtistOptionResponse,
    BookingRequestCreate,
    BookingRequestResponse,
    BookingRequestsListResponse,
    BookingRequestSummary,
    BookingRequestUpdate,
    BookingSubmissionResponse,
    ReferenceImageResponse,
)
from app.schemas.booking import BookingRequestStatus as SchemaStatus
from app.schemas.booking import TattooSize as SchemaSize
from app.services.auth import get_current_user, require_role

router = APIRouter(prefix="/bookings", tags=["bookings"])

# Upload directory for reference images
UPLOAD_DIR = Path("uploads/references")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def get_file_extension(filename: str) -> str:
    """Get lowercase file extension."""
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


# ============================================================================
# PUBLIC ENDPOINTS (No auth required - for clients to submit requests)
# ============================================================================


@router.get("/studios/{studio_slug}/artists", response_model=list[ArtistOptionResponse])
async def get_studio_artists(
    studio_slug: str,
    db: AsyncSession = Depends(get_db),
) -> list[ArtistOptionResponse]:
    """Get list of artists for a studio (for booking form dropdown)."""
    # Find studio by slug
    result = await db.execute(
        select(Studio).where(Studio.slug == studio_slug, Studio.deleted_at.is_(None))
    )
    studio = result.scalar_one_or_none()
    if not studio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Studio not found",
        )

    # Get artists associated with this studio (for now, get all artists)
    # TODO: When studio-artist relationship is added, filter by studio
    result = await db.execute(
        select(User)
        .where(
            User.role.in_([UserRole.ARTIST, UserRole.OWNER]),
            User.is_active == True,
            User.deleted_at.is_(None),
        )
        .options(selectinload(User.artist_profile))
    )
    artists = result.scalars().all()

    return [
        ArtistOptionResponse(
            id=artist.id,
            name=artist.full_name,
            specialties=artist.artist_profile.specialties if artist.artist_profile else [],
        )
        for artist in artists
    ]


@router.post(
    "/studios/{studio_slug}/submit",
    response_model=BookingSubmissionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_booking_request(
    studio_slug: str,
    data: BookingRequestCreate,
    db: AsyncSession = Depends(get_db),
) -> BookingSubmissionResponse:
    """Submit a new booking request (public endpoint for clients)."""
    # Find studio by slug
    result = await db.execute(
        select(Studio).where(Studio.slug == studio_slug, Studio.deleted_at.is_(None))
    )
    studio = result.scalar_one_or_none()
    if not studio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Studio not found",
        )

    # Validate preferred artist if provided
    if data.preferred_artist_id:
        result = await db.execute(
            select(User).where(
                User.id == data.preferred_artist_id,
                User.role.in_([UserRole.ARTIST, UserRole.OWNER]),
                User.is_active == True,
                User.deleted_at.is_(None),
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected artist not found",
            )

    # Create booking request
    booking = BookingRequest(
        client_name=data.client_name,
        client_email=data.client_email,
        client_phone=data.client_phone,
        design_idea=data.design_idea,
        placement=data.placement,
        size=data.size.value,  # Convert enum to string
        is_cover_up=data.is_cover_up,
        is_first_tattoo=data.is_first_tattoo,
        color_preference=data.color_preference,
        budget_range=data.budget_range,
        additional_notes=data.additional_notes,
        preferred_artist_id=data.preferred_artist_id,
        preferred_dates=data.preferred_dates,
        studio_id=studio.id,
        status=BookingRequestStatus.PENDING,
    )

    db.add(booking)
    await db.commit()
    await db.refresh(booking)

    return BookingSubmissionResponse(
        message="Your booking request has been submitted! We'll review it and get back to you soon.",
        request_id=booking.id,
        status="pending",
    )


@router.post(
    "/requests/{request_id}/images",
    response_model=ReferenceImageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_reference_image(
    request_id: uuid.UUID,
    file: UploadFile = File(...),
    notes: str | None = Query(None, max_length=500),
    db: AsyncSession = Depends(get_db),
) -> ReferenceImageResponse:
    """Upload a reference image for a booking request (public endpoint)."""
    # Find booking request
    result = await db.execute(
        select(BookingRequest)
        .where(BookingRequest.id == request_id, BookingRequest.deleted_at.is_(None))
        .options(selectinload(BookingRequest.reference_images))
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking request not found",
        )

    # Only allow uploads for pending requests
    if booking.status != BookingRequestStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add images to a processed booking request",
        )

    # Limit number of reference images
    if len(booking.reference_images) >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum of 5 reference images allowed",
        )

    # Validate file
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file provided",
        )

    ext = get_file_extension(file.filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Check file size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB",
        )

    # Save file
    file_id = uuid.uuid4()
    filename = f"{file_id}.{ext}"
    file_path = UPLOAD_DIR / filename

    with open(file_path, "wb") as f:
        f.write(content)

    # Create database record
    display_order = len(booking.reference_images)
    image = BookingReferenceImage(
        booking_request_id=request_id,
        image_url=f"/uploads/references/{filename}",
        original_filename=file.filename,
        display_order=display_order,
        notes=notes,
    )

    db.add(image)
    await db.commit()
    await db.refresh(image)

    return ReferenceImageResponse(
        id=image.id,
        image_url=image.image_url,
        thumbnail_url=image.thumbnail_url,
        original_filename=image.original_filename,
        display_order=image.display_order,
        notes=image.notes,
        created_at=image.created_at,
    )


# ============================================================================
# AUTHENTICATED ENDPOINTS (For artists/staff to manage requests)
# ============================================================================


@router.get("/requests", response_model=BookingRequestsListResponse)
async def list_booking_requests(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status_filter: SchemaStatus | None = Query(None, alias="status"),
    artist_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookingRequestsListResponse:
    """List booking requests (authenticated - artists see assigned, owners see all)."""
    # Build query
    query = select(BookingRequest).where(BookingRequest.deleted_at.is_(None))

    # Filter by role
    if current_user.role == UserRole.ARTIST:
        # Artists see requests assigned to them or requesting them
        query = query.where(
            (BookingRequest.assigned_artist_id == current_user.id)
            | (BookingRequest.preferred_artist_id == current_user.id)
        )
    elif artist_id:
        # Owners can filter by artist
        query = query.where(
            (BookingRequest.assigned_artist_id == artist_id)
            | (BookingRequest.preferred_artist_id == artist_id)
        )

    # Filter by status
    if status_filter:
        query = query.where(BookingRequest.status == status_filter.value)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Paginate
    offset = (page - 1) * per_page
    query = (
        query.options(selectinload(BookingRequest.reference_images))
        .order_by(BookingRequest.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )

    result = await db.execute(query)
    requests = result.scalars().all()

    return BookingRequestsListResponse(
        requests=[
            BookingRequestSummary(
                id=req.id,
                client_name=req.client_name,
                client_email=req.client_email,
                design_idea=req.design_idea[:200] + "..." if len(req.design_idea) > 200 else req.design_idea,
                placement=req.placement,
                size=req.size,
                status=req.status,
                preferred_artist_id=req.preferred_artist_id,
                assigned_artist_id=req.assigned_artist_id,
                quoted_price=req.quoted_price,
                scheduled_date=req.scheduled_date,
                reference_image_count=len(req.reference_images),
                created_at=req.created_at,
            )
            for req in requests
        ],
        total=total,
        page=page,
        per_page=per_page,
        pages=ceil(total / per_page) if total > 0 else 1,
    )


@router.get("/requests/{request_id}", response_model=BookingRequestResponse)
async def get_booking_request(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookingRequestResponse:
    """Get a specific booking request (authenticated)."""
    result = await db.execute(
        select(BookingRequest)
        .where(BookingRequest.id == request_id, BookingRequest.deleted_at.is_(None))
        .options(selectinload(BookingRequest.reference_images))
    )
    booking = result.scalar_one_or_none()

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking request not found",
        )

    # Artists can only view requests assigned to them or preferring them
    if current_user.role == UserRole.ARTIST:
        if booking.assigned_artist_id != current_user.id and booking.preferred_artist_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this booking request",
            )

    return BookingRequestResponse(
        id=booking.id,
        client_name=booking.client_name,
        client_email=booking.client_email,
        client_phone=booking.client_phone,
        design_idea=booking.design_idea,
        placement=booking.placement,
        size=booking.size,
        is_cover_up=booking.is_cover_up,
        is_first_tattoo=booking.is_first_tattoo,
        color_preference=booking.color_preference,
        budget_range=booking.budget_range,
        additional_notes=booking.additional_notes,
        studio_id=booking.studio_id,
        preferred_artist_id=booking.preferred_artist_id,
        assigned_artist_id=booking.assigned_artist_id,
        status=booking.status,
        quoted_price=booking.quoted_price,
        deposit_amount=booking.deposit_amount,
        estimated_hours=booking.estimated_hours,
        quote_notes=booking.quote_notes,
        quoted_at=booking.quoted_at,
        preferred_dates=booking.preferred_dates,
        scheduled_date=booking.scheduled_date,
        scheduled_duration_hours=booking.scheduled_duration_hours,
        internal_notes=booking.internal_notes,
        reference_images=[
            ReferenceImageResponse(
                id=img.id,
                image_url=img.image_url,
                thumbnail_url=img.thumbnail_url,
                original_filename=img.original_filename,
                display_order=img.display_order,
                notes=img.notes,
                created_at=img.created_at,
            )
            for img in booking.reference_images
        ],
        created_at=booking.created_at,
        updated_at=booking.updated_at,
    )


@router.patch("/requests/{request_id}", response_model=BookingRequestResponse)
async def update_booking_request(
    request_id: uuid.UUID,
    data: BookingRequestUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookingRequestResponse:
    """Update a booking request (authenticated - for quotes, status changes, etc.)."""
    result = await db.execute(
        select(BookingRequest)
        .where(BookingRequest.id == request_id, BookingRequest.deleted_at.is_(None))
        .options(selectinload(BookingRequest.reference_images))
    )
    booking = result.scalar_one_or_none()

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking request not found",
        )

    # Artists can only update requests assigned to them or preferring them
    if current_user.role == UserRole.ARTIST:
        if booking.assigned_artist_id != current_user.id and booking.preferred_artist_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this booking request",
            )

    # Update fields
    update_data = data.model_dump(exclude_unset=True)

    # Track quote timestamp
    if "quoted_price" in update_data and update_data["quoted_price"] is not None:
        if booking.quoted_price != update_data["quoted_price"]:
            booking.quoted_at = datetime.utcnow()

    for field, value in update_data.items():
        if field == "status" and value:
            value = value.value  # Convert enum to string
        setattr(booking, field, value)

    await db.commit()
    await db.refresh(booking)

    # Return updated booking
    return await get_booking_request(request_id, db, current_user)


@router.delete("/requests/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_booking_request(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.OWNER)),
) -> None:
    """Soft delete a booking request (owner only)."""
    result = await db.execute(
        select(BookingRequest).where(
            BookingRequest.id == request_id, BookingRequest.deleted_at.is_(None)
        )
    )
    booking = result.scalar_one_or_none()

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking request not found",
        )

    booking.deleted_at = datetime.utcnow()
    await db.commit()
