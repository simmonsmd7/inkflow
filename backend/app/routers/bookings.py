"""Booking requests router."""

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from math import ceil
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
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
    BookingConfirmationResponse,
    BookingRequestCreate,
    BookingRequestResponse,
    BookingRequestsListResponse,
    BookingRequestSummary,
    BookingRequestUpdate,
    BookingSubmissionResponse,
    CancelInput,
    CancelResponse,
    CancelWithRefundInput,
    CancelWithRefundResponse,
    CheckoutSessionResponse,
    ClientNoShowHistory,
    ClientNoShowHistoryItem,
    ConfirmBookingInput,
    DepositPaymentInfo,
    MarkNoShowInput,
    NoShowResponse,
    ReferenceImageResponse,
    RefundInput,
    RefundResponse,
    RescheduleInput,
    RescheduleResponse,
    SendDepositRequestInput,
    SendDepositRequestResponse,
    StubPaymentConfirmation,
)
from app.schemas.commission import (
    CompleteBookingWithCommissionInput,
    CompleteBookingWithCommissionResponse,
    EarnedCommissionResponse,
)
from app.schemas.booking import BookingRequestStatus as SchemaStatus
from app.schemas.booking import TattooSize as SchemaSize
from app.services.aftercare_service import aftercare_service
from app.services.auth import get_current_user, require_role
from app.services.calendar import calendar_service
from app.services.commission_service import calculate_and_record_commission
from app.services.email import email_service
from app.services.stripe_service import stripe_service

settings = get_settings()

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
        deposit_requested_at=booking.deposit_requested_at,
        deposit_request_expires_at=booking.deposit_request_expires_at,
        deposit_paid_at=booking.deposit_paid_at,
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


@router.post(
    "/requests/{request_id}/send-deposit-request",
    response_model=SendDepositRequestResponse,
)
async def send_deposit_request(
    request_id: uuid.UUID,
    data: SendDepositRequestInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SendDepositRequestResponse:
    """Send a deposit request email to the client."""
    # Get booking request with studio info
    result = await db.execute(
        select(BookingRequest)
        .where(BookingRequest.id == request_id, BookingRequest.deleted_at.is_(None))
        .options(
            selectinload(BookingRequest.studio),
            selectinload(BookingRequest.assigned_artist),
            selectinload(BookingRequest.preferred_artist),
        )
    )
    booking = result.scalar_one_or_none()

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking request not found",
        )

    # Artists can only send deposit requests for their assigned bookings
    if current_user.role == UserRole.ARTIST:
        if booking.assigned_artist_id != current_user.id and booking.preferred_artist_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this booking request",
            )

    # Must have a quoted price first
    if not booking.quoted_price:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must set a quoted price before requesting a deposit",
        )

    # Can only send deposit request for quoted or reviewing status
    if booking.status not in [BookingRequestStatus.REVIEWING, BookingRequestStatus.QUOTED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot send deposit request for booking with status '{booking.status.value}'",
        )

    # Generate unique payment token
    payment_token = secrets.token_urlsafe(32)

    # Calculate expiry
    expires_at = datetime.utcnow() + timedelta(days=data.expires_in_days)

    # Update booking
    booking.deposit_amount = data.deposit_amount
    booking.deposit_payment_token = payment_token
    booking.deposit_requested_at = datetime.utcnow()
    booking.deposit_request_expires_at = expires_at
    booking.status = BookingRequestStatus.DEPOSIT_REQUESTED

    await db.commit()
    await db.refresh(booking)

    # Generate payment URL
    payment_url = f"{settings.frontend_url}/pay-deposit/{payment_token}"

    # Get artist name
    artist = booking.assigned_artist or booking.preferred_artist
    artist_name = artist.full_name if artist else None

    # Send email
    await email_service.send_deposit_request_email(
        to_email=booking.client_email,
        client_name=booking.client_name,
        studio_name=booking.studio.name,
        artist_name=artist_name,
        design_summary=booking.design_idea,
        quoted_price=booking.quoted_price,
        deposit_amount=data.deposit_amount,
        expires_at=expires_at.strftime("%B %d, %Y"),
        payment_url=payment_url,
        custom_message=data.message,
    )

    return SendDepositRequestResponse(
        message="Deposit request sent successfully",
        deposit_amount=data.deposit_amount,
        expires_at=expires_at,
        payment_url=payment_url,
    )


@router.post(
    "/requests/{request_id}/confirm",
    response_model=BookingConfirmationResponse,
)
async def confirm_booking(
    request_id: uuid.UUID,
    data: ConfirmBookingInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookingConfirmationResponse:
    """Confirm a booking with a scheduled date and send confirmation with calendar invite."""
    # Get booking request with relationships
    result = await db.execute(
        select(BookingRequest)
        .where(BookingRequest.id == request_id, BookingRequest.deleted_at.is_(None))
        .options(
            selectinload(BookingRequest.studio),
            selectinload(BookingRequest.assigned_artist),
            selectinload(BookingRequest.preferred_artist),
        )
    )
    booking = result.scalar_one_or_none()

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking request not found",
        )

    # Artists can only confirm their assigned bookings
    if current_user.role == UserRole.ARTIST:
        if booking.assigned_artist_id != current_user.id and booking.preferred_artist_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this booking request",
            )

    # Can only confirm bookings that have deposit paid
    if booking.status != BookingRequestStatus.DEPOSIT_PAID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot confirm booking with status '{booking.status.value}'. Deposit must be paid first.",
        )

    # Update booking
    booking.scheduled_date = data.scheduled_date
    booking.scheduled_duration_hours = data.scheduled_duration_hours
    booking.status = BookingRequestStatus.CONFIRMED

    await db.commit()
    await db.refresh(booking)

    # Send confirmation email with calendar invite
    confirmation_email_sent = False
    if data.send_confirmation_email:
        # Get artist name
        artist = booking.assigned_artist or booking.preferred_artist
        artist_name = artist.full_name if artist else None

        # Build studio address
        studio = booking.studio
        studio_address = None
        if studio.address_line1:
            address_parts = [studio.address_line1]
            if studio.address_line2:
                address_parts.append(studio.address_line2)
            if studio.city and studio.state:
                address_parts.append(f"{studio.city}, {studio.state} {studio.postal_code or ''}")
            studio_address = ", ".join(address_parts)

        # Generate calendar invite
        calendar_ics = calendar_service.generate_tattoo_appointment_ics(
            booking_id=str(booking.id),
            client_name=booking.client_name,
            client_email=booking.client_email,
            studio_name=studio.name,
            studio_address=studio_address,
            studio_email=studio.email,
            artist_name=artist_name,
            design_summary=booking.design_idea,
            placement=booking.placement,
            scheduled_date=data.scheduled_date,
            duration_hours=data.scheduled_duration_hours,
        )

        # Format date and time for email
        scheduled_date_str = data.scheduled_date.strftime("%B %d, %Y")
        scheduled_time_str = data.scheduled_date.strftime("%I:%M %p")

        # Send email
        confirmation_email_sent = await email_service.send_booking_confirmation_email(
            to_email=booking.client_email,
            client_name=booking.client_name,
            studio_name=studio.name,
            studio_address=studio_address,
            artist_name=artist_name,
            design_summary=booking.design_idea,
            placement=booking.placement,
            scheduled_date=scheduled_date_str,
            scheduled_time=scheduled_time_str,
            duration_hours=data.scheduled_duration_hours,
            calendar_ics=calendar_ics.encode("utf-8"),
        )

    return BookingConfirmationResponse(
        message="Booking confirmed successfully",
        request_id=booking.id,
        status="confirmed",
        scheduled_date=booking.scheduled_date,
        scheduled_duration_hours=booking.scheduled_duration_hours,
        confirmation_email_sent=confirmation_email_sent,
    )


@router.post(
    "/requests/{request_id}/reschedule",
    response_model=RescheduleResponse,
)
async def reschedule_booking(
    request_id: uuid.UUID,
    data: RescheduleInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RescheduleResponse:
    """Reschedule a confirmed booking to a new date/time."""
    # Get booking request with relationships
    result = await db.execute(
        select(BookingRequest)
        .where(BookingRequest.id == request_id, BookingRequest.deleted_at.is_(None))
        .options(
            selectinload(BookingRequest.studio),
            selectinload(BookingRequest.assigned_artist),
            selectinload(BookingRequest.preferred_artist),
        )
    )
    booking = result.scalar_one_or_none()

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking request not found",
        )

    # Artists can only reschedule their assigned bookings
    if current_user.role == UserRole.ARTIST:
        if booking.assigned_artist_id != current_user.id and booking.preferred_artist_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this booking request",
            )

    # Can only reschedule confirmed bookings
    if booking.status != BookingRequestStatus.CONFIRMED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reschedule booking with status '{booking.status.value}'. Must be confirmed.",
        )

    # Must have an existing scheduled date
    if not booking.scheduled_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Booking has no scheduled date to reschedule from.",
        )

    # Store old date for email and response
    old_scheduled_date = booking.scheduled_date

    # Store original date if first reschedule
    if booking.reschedule_count == 0:
        booking.original_scheduled_date = old_scheduled_date

    # Update booking
    booking.scheduled_date = data.new_date
    if data.new_duration_hours:
        booking.scheduled_duration_hours = data.new_duration_hours
    booking.reschedule_count += 1
    booking.last_rescheduled_at = datetime.now(timezone.utc)
    booking.last_reschedule_reason = data.reason

    await db.commit()
    await db.refresh(booking)

    # Send notification email
    notification_sent = False
    if data.notify_client:
        # Get artist name
        artist = booking.assigned_artist or booking.preferred_artist
        artist_name = artist.full_name if artist else None

        # Build studio address
        studio = booking.studio
        studio_address = None
        if studio.address_line1:
            address_parts = [studio.address_line1]
            if studio.address_line2:
                address_parts.append(studio.address_line2)
            if studio.city and studio.state:
                address_parts.append(f"{studio.city}, {studio.state} {studio.postal_code or ''}")
            studio_address = ", ".join(address_parts)

        # Generate updated calendar invite
        calendar_ics = calendar_service.generate_tattoo_appointment_ics(
            booking_id=str(booking.id),
            client_name=booking.client_name,
            client_email=booking.client_email,
            studio_name=studio.name,
            studio_address=studio_address,
            studio_email=studio.email,
            artist_name=artist_name,
            design_summary=booking.design_idea,
            placement=booking.placement,
            scheduled_date=data.new_date,
            duration_hours=booking.scheduled_duration_hours or 2.0,
        )

        # Format dates for email
        old_date_str = old_scheduled_date.strftime("%B %d, %Y")
        old_time_str = old_scheduled_date.strftime("%I:%M %p")
        new_date_str = data.new_date.strftime("%B %d, %Y")
        new_time_str = data.new_date.strftime("%I:%M %p")

        # Send email
        notification_sent = await email_service.send_reschedule_notification_email(
            to_email=booking.client_email,
            client_name=booking.client_name,
            studio_name=studio.name,
            studio_address=studio_address,
            artist_name=artist_name,
            design_summary=booking.design_idea,
            old_date=old_date_str,
            old_time=old_time_str,
            new_date=new_date_str,
            new_time=new_time_str,
            duration_hours=booking.scheduled_duration_hours or 2.0,
            reason=data.reason,
            calendar_ics=calendar_ics.encode("utf-8"),
        )

    return RescheduleResponse(
        message="Booking rescheduled successfully",
        request_id=booking.id,
        old_date=old_scheduled_date,
        new_date=data.new_date,
        reschedule_count=booking.reschedule_count,
        notification_sent=notification_sent,
    )


@router.post(
    "/requests/{request_id}/cancel",
    response_model=CancelResponse,
)
async def cancel_booking(
    request_id: uuid.UUID,
    data: CancelInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CancelResponse:
    """Cancel a booking request."""
    # Get booking request with relationships
    result = await db.execute(
        select(BookingRequest)
        .where(BookingRequest.id == request_id, BookingRequest.deleted_at.is_(None))
        .options(
            selectinload(BookingRequest.studio),
            selectinload(BookingRequest.assigned_artist),
            selectinload(BookingRequest.preferred_artist),
        )
    )
    booking = result.scalar_one_or_none()

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking request not found",
        )

    # Artists can only cancel their assigned bookings
    if current_user.role == UserRole.ARTIST:
        if booking.assigned_artist_id != current_user.id and booking.preferred_artist_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this booking request",
            )

    # Cannot cancel already cancelled or completed bookings
    if booking.status in [BookingRequestStatus.CANCELLED, BookingRequestStatus.COMPLETED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel booking with status '{booking.status.value}'",
        )

    # Update booking
    now = datetime.now(timezone.utc)
    booking.status = BookingRequestStatus.CANCELLED
    booking.cancelled_at = now
    booking.cancelled_by = data.cancelled_by
    booking.cancellation_reason = data.reason
    booking.deposit_forfeited = data.forfeit_deposit

    await db.commit()
    await db.refresh(booking)

    # Send notification email
    notification_sent = False
    if data.notify_client:
        # Get artist name
        artist = booking.assigned_artist or booking.preferred_artist
        artist_name = artist.full_name if artist else None

        # Format scheduled date for email
        scheduled_date_str = None
        if booking.scheduled_date:
            scheduled_date_str = booking.scheduled_date.strftime("%B %d, %Y at %I:%M %p")

        # Send email
        notification_sent = await email_service.send_cancellation_notification_email(
            to_email=booking.client_email,
            client_name=booking.client_name,
            studio_name=booking.studio.name,
            artist_name=artist_name,
            design_summary=booking.design_idea,
            scheduled_date=scheduled_date_str,
            cancelled_by=data.cancelled_by,
            reason=data.reason,
            deposit_amount=booking.deposit_amount,
            deposit_forfeited=data.forfeit_deposit,
        )

    return CancelResponse(
        message="Booking cancelled successfully",
        request_id=booking.id,
        status="cancelled",
        cancelled_at=booking.cancelled_at,
        cancelled_by=booking.cancelled_by,
        deposit_forfeited=booking.deposit_forfeited,
        deposit_amount=booking.deposit_amount,
        notification_sent=notification_sent,
    )


@router.post(
    "/requests/{request_id}/complete",
    response_model=CompleteBookingWithCommissionResponse,
)
async def complete_booking(
    request_id: uuid.UUID,
    data: CompleteBookingWithCommissionInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CompleteBookingWithCommissionResponse:
    """
    Complete a booking appointment and automatically calculate commission.

    This endpoint:
    1. Marks the booking as completed
    2. Calculates the artist's commission based on their assigned commission rule
    3. Records the earned commission for payroll tracking
    """
    # Get booking request with relationships
    result = await db.execute(
        select(BookingRequest)
        .where(BookingRequest.id == request_id, BookingRequest.deleted_at.is_(None))
        .options(
            selectinload(BookingRequest.studio),
            selectinload(BookingRequest.assigned_artist),
            selectinload(BookingRequest.preferred_artist),
        )
    )
    booking = result.scalar_one_or_none()

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking request not found",
        )

    # Artists can only complete their assigned bookings
    if current_user.role == UserRole.ARTIST:
        if booking.assigned_artist_id != current_user.id and booking.preferred_artist_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this booking request",
            )

    # Can only complete confirmed bookings
    if booking.status != BookingRequestStatus.CONFIRMED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot complete booking with status '{booking.status.value}'. Must be confirmed.",
        )

    # Must have a quoted price (or final price provided)
    service_total = data.final_price if data.final_price is not None else booking.quoted_price
    if not service_total or service_total <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Booking must have a quoted price or you must provide a final price",
        )

    # Must have an assigned artist for commission calculation
    if not booking.assigned_artist_id and not booking.preferred_artist_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Booking must have an assigned artist for commission calculation",
        )

    # Ensure there's an assigned artist (prefer assigned over preferred)
    if not booking.assigned_artist_id and booking.preferred_artist_id:
        booking.assigned_artist_id = booking.preferred_artist_id

    # Update final price if provided
    if data.final_price is not None:
        booking.quoted_price = data.final_price

    # Add completion notes if provided
    if data.completion_notes:
        if booking.internal_notes:
            booking.internal_notes += f"\n\n[Completion Notes]: {data.completion_notes}"
        else:
            booking.internal_notes = f"[Completion Notes]: {data.completion_notes}"

    # Mark as completed
    booking.status = BookingRequestStatus.COMPLETED

    await db.commit()
    await db.refresh(booking, ["assigned_artist"])

    # Calculate and record commission
    earned_commission = await calculate_and_record_commission(
        db=db,
        booking=booking,
        tips_amount=data.tips_amount,
        tip_payment_method=data.tip_payment_method,
        final_price=data.final_price,
    )

    if not earned_commission:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not calculate commission. Ensure the artist has a commission rule assigned or the studio has a default rule.",
        )

    await db.commit()

    # Automatically send aftercare instructions (P7.2)
    # This runs asynchronously and doesn't block the response
    # If no template is found, it gracefully logs and continues
    try:
        aftercare_sent = await aftercare_service.send_for_booking(
            db=db,
            booking_id=booking.id,
            send_via="email",
            schedule_follow_ups=True,
        )
        if aftercare_sent:
            # Log success (would show in stub mode)
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"Aftercare instructions sent for booking {booking.id} to {booking.client_email}")
    except Exception as e:
        # Don't fail the completion if aftercare sending fails
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Failed to send aftercare for booking {booking.id}: {e}")

    return CompleteBookingWithCommissionResponse(
        message="Booking completed and commission calculated",
        booking_id=booking.id,
        status="completed",
        commission=EarnedCommissionResponse(
            id=earned_commission.id,
            booking_request_id=earned_commission.booking_request_id,
            artist_id=earned_commission.artist_id,
            studio_id=earned_commission.studio_id,
            commission_rule_id=earned_commission.commission_rule_id,
            commission_rule_name=earned_commission.commission_rule_name,
            commission_type=earned_commission.commission_type,
            service_total=earned_commission.service_total,
            studio_commission=earned_commission.studio_commission,
            artist_payout=earned_commission.artist_payout,
            tips_amount=earned_commission.tips_amount,
            tip_payment_method=earned_commission.tip_payment_method,
            tip_artist_share=earned_commission.tip_artist_share,
            tip_studio_share=earned_commission.tip_studio_share,
            calculation_details=earned_commission.calculation_details,
            completed_at=earned_commission.completed_at,
            created_at=earned_commission.created_at,
        ),
    )


# ============================================================================
# PUBLIC DEPOSIT ENDPOINTS (For clients to view and pay deposits)
# ============================================================================


@router.get("/deposit/{token}", response_model=DepositPaymentInfo)
async def get_deposit_info(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> DepositPaymentInfo:
    """Get deposit payment information by token (public)."""
    result = await db.execute(
        select(BookingRequest)
        .where(
            BookingRequest.deposit_payment_token == token,
            BookingRequest.deleted_at.is_(None),
        )
        .options(
            selectinload(BookingRequest.studio),
            selectinload(BookingRequest.assigned_artist),
            selectinload(BookingRequest.preferred_artist),
        )
    )
    booking = result.scalar_one_or_none()

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deposit request not found or has expired",
        )

    # Check if already paid
    if booking.status == BookingRequestStatus.DEPOSIT_PAID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This deposit has already been paid",
        )

    # Check if cancelled or rejected
    if booking.status in [BookingRequestStatus.CANCELLED, BookingRequestStatus.REJECTED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This booking request has been cancelled",
        )

    # Check expiry
    is_expired = False
    if booking.deposit_request_expires_at:
        is_expired = datetime.now(timezone.utc) > booking.deposit_request_expires_at

    # Get artist name
    artist = booking.assigned_artist or booking.preferred_artist
    artist_name = artist.full_name if artist else None

    return DepositPaymentInfo(
        request_id=booking.id,
        client_name=booking.client_name,
        studio_name=booking.studio.name,
        artist_name=artist_name,
        design_summary=booking.design_idea[:200] + "..." if len(booking.design_idea) > 200 else booking.design_idea,
        quoted_price=booking.quoted_price,
        deposit_amount=booking.deposit_amount or 0,
        expires_at=booking.deposit_request_expires_at or datetime.now(timezone.utc),
        is_expired=is_expired,
        quote_notes=booking.quote_notes,
    )


@router.post("/deposit/{token}/create-checkout", response_model=CheckoutSessionResponse)
async def create_checkout_session(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> CheckoutSessionResponse:
    """Create a Stripe checkout session for deposit payment (public)."""
    result = await db.execute(
        select(BookingRequest)
        .where(
            BookingRequest.deposit_payment_token == token,
            BookingRequest.deleted_at.is_(None),
        )
        .options(selectinload(BookingRequest.studio))
    )
    booking = result.scalar_one_or_none()

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deposit request not found",
        )

    # Check if already paid
    if booking.status == BookingRequestStatus.DEPOSIT_PAID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This deposit has already been paid",
        )

    # Check expiry
    if booking.deposit_request_expires_at:
        if datetime.now(timezone.utc) > booking.deposit_request_expires_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This deposit request has expired",
            )

    # Create checkout session
    session_data = await stripe_service.create_checkout_session(
        amount_cents=booking.deposit_amount or 0,
        currency="usd",
        client_name=booking.client_name,
        client_email=booking.client_email,
        studio_name=booking.studio.name,
        booking_request_id=str(booking.id),
        deposit_token=token,
        success_url=f"{settings.frontend_url}/pay-deposit/{token}/success",
        cancel_url=f"{settings.frontend_url}/pay-deposit/{token}",
    )

    return CheckoutSessionResponse(
        stub_mode=session_data.get("stub_mode", False),
        session_id=session_data.get("session_id", ""),
        checkout_url=session_data.get("checkout_url", ""),
        message=session_data.get("message"),
    )


@router.post("/deposit/{token}/confirm-stub", response_model=StubPaymentConfirmation)
async def confirm_stub_payment(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> StubPaymentConfirmation:
    """Confirm a stub payment (for testing without Stripe configured)."""
    if stripe_service.is_configured:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stub payments not available when Stripe is configured",
        )

    result = await db.execute(
        select(BookingRequest).where(
            BookingRequest.deposit_payment_token == token,
            BookingRequest.deleted_at.is_(None),
        )
    )
    booking = result.scalar_one_or_none()

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deposit request not found",
        )

    # Check if already paid
    if booking.status == BookingRequestStatus.DEPOSIT_PAID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This deposit has already been paid",
        )

    # Mark as paid
    booking.status = BookingRequestStatus.DEPOSIT_PAID
    booking.deposit_paid_at = datetime.now(timezone.utc)
    booking.deposit_stripe_payment_intent_id = f"stub_pi_{token[:16]}"

    await db.commit()
    await db.refresh(booking)

    print(f"[STRIPE STUB] Payment confirmed for booking {booking.id}")
    print(f"  Amount: ${(booking.deposit_amount or 0) / 100:.2f}")
    print(f"  Client: {booking.client_name} ({booking.client_email})")

    return StubPaymentConfirmation(
        message="Payment confirmed (stub mode)",
        status="deposit_paid",
        deposit_paid_at=booking.deposit_paid_at,
    )


# ============================================================================
# NO-SHOW ENDPOINTS (Authenticated - for marking no-shows and tracking)
# ============================================================================


@router.post(
    "/requests/{request_id}/no-show",
    response_model=NoShowResponse,
)
async def mark_no_show(
    request_id: uuid.UUID,
    data: MarkNoShowInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NoShowResponse:
    """Mark a booking as a no-show when client doesn't show up."""
    # Get booking request with relationships
    result = await db.execute(
        select(BookingRequest)
        .where(BookingRequest.id == request_id, BookingRequest.deleted_at.is_(None))
        .options(
            selectinload(BookingRequest.studio),
            selectinload(BookingRequest.assigned_artist),
            selectinload(BookingRequest.preferred_artist),
        )
    )
    booking = result.scalar_one_or_none()

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking request not found",
        )

    # Artists can only mark no-shows for their assigned bookings
    if current_user.role == UserRole.ARTIST:
        if booking.assigned_artist_id != current_user.id and booking.preferred_artist_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this booking request",
            )

    # Can only mark confirmed bookings as no-show
    if booking.status != BookingRequestStatus.CONFIRMED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot mark booking with status '{booking.status.value}' as no-show. Must be confirmed.",
        )

    # Update booking
    now = datetime.now(timezone.utc)
    booking.status = BookingRequestStatus.NO_SHOW
    booking.no_show_at = now
    booking.no_show_marked_by_id = current_user.id
    booking.no_show_notes = data.notes
    booking.deposit_forfeited = data.forfeit_deposit

    await db.commit()
    await db.refresh(booking)

    # Send notification email
    notification_sent = False
    if data.notify_client:
        # Get artist name
        artist = booking.assigned_artist or booking.preferred_artist
        artist_name = artist.full_name if artist else None

        # Format scheduled date for email
        scheduled_date_str = "Not specified"
        if booking.scheduled_date:
            scheduled_date_str = booking.scheduled_date.strftime("%B %d, %Y at %I:%M %p")

        # Send email
        notification_sent = await email_service.send_noshow_notification_email(
            to_email=booking.client_email,
            client_name=booking.client_name,
            studio_name=booking.studio.name,
            artist_name=artist_name,
            design_summary=booking.design_idea,
            scheduled_date=scheduled_date_str,
            deposit_amount=booking.deposit_amount,
            deposit_forfeited=data.forfeit_deposit,
            notes=data.notes,
        )

    return NoShowResponse(
        message="Booking marked as no-show",
        request_id=booking.id,
        status="no_show",
        no_show_at=booking.no_show_at,
        deposit_forfeited=booking.deposit_forfeited,
        deposit_amount=booking.deposit_amount,
        notification_sent=notification_sent,
    )


@router.get("/clients/{email}/no-show-history", response_model=ClientNoShowHistory)
async def get_client_no_show_history(
    email: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClientNoShowHistory:
    """Get no-show history for a client by email address."""
    # Normalize email
    email = email.lower().strip()

    # Get total bookings for this client
    total_result = await db.execute(
        select(func.count())
        .select_from(BookingRequest)
        .where(
            func.lower(BookingRequest.client_email) == email,
            BookingRequest.deleted_at.is_(None),
        )
    )
    total_bookings = total_result.scalar() or 0

    # Get no-show bookings
    noshow_query = (
        select(BookingRequest)
        .where(
            func.lower(BookingRequest.client_email) == email,
            BookingRequest.status == BookingRequestStatus.NO_SHOW,
            BookingRequest.deleted_at.is_(None),
        )
        .order_by(BookingRequest.no_show_at.desc())
    )
    noshow_result = await db.execute(noshow_query)
    noshow_bookings = noshow_result.scalars().all()

    # Calculate no-show rate and total forfeited deposits
    no_show_count = len(noshow_bookings)
    no_show_rate = (no_show_count / total_bookings * 100) if total_bookings > 0 else 0.0
    total_forfeited = sum(
        (b.deposit_amount or 0) for b in noshow_bookings if b.deposit_forfeited
    )

    # Build response
    no_shows = [
        ClientNoShowHistoryItem(
            request_id=b.id,
            scheduled_date=b.scheduled_date,
            no_show_at=b.no_show_at or b.updated_at,
            deposit_forfeited=b.deposit_forfeited,
            deposit_amount=b.deposit_amount,
            design_idea=b.design_idea[:100] + "..." if len(b.design_idea) > 100 else b.design_idea,
            studio_id=b.studio_id,
        )
        for b in noshow_bookings
    ]

    return ClientNoShowHistory(
        client_email=email,
        total_bookings=total_bookings,
        no_show_count=no_show_count,
        no_show_rate=round(no_show_rate, 1),
        total_forfeited_deposits=total_forfeited,
        no_shows=no_shows,
    )


# ============================================================================
# REFUND ENDPOINTS
# ============================================================================


@router.post(
    "/requests/{request_id}/refund",
    response_model=RefundResponse,
)
async def issue_refund(
    request_id: uuid.UUID,
    data: RefundInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RefundResponse:
    """
    Issue a refund for a booking.

    Can only refund bookings where:
    - Status is CANCELLED or NO_SHOW
    - Deposit was paid (deposit_stripe_payment_intent_id exists)
    - No refund has already been issued
    """
    # Get booking request with relationships
    result = await db.execute(
        select(BookingRequest)
        .where(BookingRequest.id == request_id, BookingRequest.deleted_at.is_(None))
        .options(
            selectinload(BookingRequest.studio),
        )
    )
    booking = result.scalar_one_or_none()

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking request not found",
        )

    # Only owners can issue refunds
    if current_user.role != UserRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only studio owners can issue refunds",
        )

    # Can only refund cancelled or no-show bookings
    if booking.status not in [BookingRequestStatus.CANCELLED, BookingRequestStatus.NO_SHOW]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot refund booking with status '{booking.status.value}'. Must be cancelled or no-show.",
        )

    # Check that deposit was paid
    if not booking.deposit_stripe_payment_intent_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot refund - no payment was recorded for this booking",
        )

    # Check that refund hasn't already been issued
    if booking.refunded_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Refund has already been issued for this booking",
        )

    # Determine refund amount
    if data.refund_type == "partial":
        if not data.refund_amount_cents:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="refund_amount_cents is required for partial refunds",
            )
        refund_amount = data.refund_amount_cents
        if refund_amount > (booking.deposit_amount or 0):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Refund amount cannot exceed original deposit of ${(booking.deposit_amount or 0) / 100:.2f}",
            )
    else:
        # Full refund
        refund_amount = booking.deposit_amount or 0

    # Issue refund via Stripe
    refund_result = await stripe_service.create_refund(
        payment_intent_id=booking.deposit_stripe_payment_intent_id,
        amount_cents=refund_amount if data.refund_type == "partial" else None,
        reason="requested_by_customer",
    )

    if refund_result.get("error"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process refund: {refund_result.get('message')}",
        )

    # Update booking with refund info
    now = datetime.now(timezone.utc)
    booking.refund_amount = refund_amount
    booking.refund_stripe_id = refund_result.get("refund_id")
    booking.refunded_at = now
    booking.refund_reason = data.reason
    booking.refund_initiated_by_id = current_user.id
    booking.deposit_forfeited = False  # Clear forfeited flag since we're refunding

    await db.commit()
    await db.refresh(booking)

    # Send refund confirmation email
    notification_sent = False
    if data.notify_client:
        notification_sent = await email_service.send_refund_confirmation_email(
            to_email=booking.client_email,
            client_name=booking.client_name,
            studio_name=booking.studio.name,
            refund_amount=refund_amount,
            original_deposit=booking.deposit_amount or 0,
            reason=data.reason,
            is_partial=data.refund_type == "partial",
        )

    return RefundResponse(
        message="Refund processed successfully",
        request_id=booking.id,
        refund_amount=refund_amount,
        refund_stripe_id=booking.refund_stripe_id or "",
        refunded_at=booking.refunded_at,
        refund_reason=data.reason,
        notification_sent=notification_sent,
        stub_mode=refund_result.get("stub_mode", False),
    )


@router.post(
    "/requests/{request_id}/cancel-with-refund",
    response_model=CancelWithRefundResponse,
)
async def cancel_booking_with_refund(
    request_id: uuid.UUID,
    data: CancelWithRefundInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CancelWithRefundResponse:
    """
    Cancel a booking and immediately issue a refund.

    Only works for bookings where deposit has been paid (status DEPOSIT_PAID or CONFIRMED).
    """
    # Get booking request with relationships
    result = await db.execute(
        select(BookingRequest)
        .where(BookingRequest.id == request_id, BookingRequest.deleted_at.is_(None))
        .options(
            selectinload(BookingRequest.studio),
            selectinload(BookingRequest.assigned_artist),
            selectinload(BookingRequest.preferred_artist),
        )
    )
    booking = result.scalar_one_or_none()

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking request not found",
        )

    # Only owners can cancel with refund
    if current_user.role != UserRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only studio owners can cancel with refund",
        )

    # Can only cancel-with-refund for deposit_paid or confirmed bookings
    if booking.status not in [BookingRequestStatus.DEPOSIT_PAID, BookingRequestStatus.CONFIRMED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel with refund for status '{booking.status.value}'. Must be deposit_paid or confirmed.",
        )

    # Check that deposit was paid
    if not booking.deposit_stripe_payment_intent_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot refund - no payment was recorded for this booking",
        )

    # Determine refund amount
    if data.refund_type == "partial":
        if not data.refund_amount_cents:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="refund_amount_cents is required for partial refunds",
            )
        refund_amount = data.refund_amount_cents
        if refund_amount > (booking.deposit_amount or 0):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Refund amount cannot exceed original deposit of ${(booking.deposit_amount or 0) / 100:.2f}",
            )
    else:
        # Full refund
        refund_amount = booking.deposit_amount or 0

    # Issue refund via Stripe
    refund_result = await stripe_service.create_refund(
        payment_intent_id=booking.deposit_stripe_payment_intent_id,
        amount_cents=refund_amount if data.refund_type == "partial" else None,
        reason="requested_by_customer",
    )

    if refund_result.get("error"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process refund: {refund_result.get('message')}",
        )

    # Update booking status to cancelled with refund info
    now = datetime.now(timezone.utc)
    booking.status = BookingRequestStatus.CANCELLED
    booking.cancelled_at = now
    booking.cancelled_by = data.cancelled_by
    booking.cancellation_reason = data.reason
    booking.deposit_forfeited = False  # Not forfeited - we're refunding
    booking.refund_amount = refund_amount
    booking.refund_stripe_id = refund_result.get("refund_id")
    booking.refunded_at = now
    booking.refund_reason = data.reason
    booking.refund_initiated_by_id = current_user.id

    await db.commit()
    await db.refresh(booking)

    # Send cancellation notification email
    cancellation_notification_sent = False
    if data.notify_client:
        artist = booking.assigned_artist or booking.preferred_artist
        artist_name = artist.full_name if artist else None
        scheduled_date_str = None
        if booking.scheduled_date:
            scheduled_date_str = booking.scheduled_date.strftime("%B %d, %Y at %I:%M %p")

        cancellation_notification_sent = await email_service.send_cancellation_notification_email(
            to_email=booking.client_email,
            client_name=booking.client_name,
            studio_name=booking.studio.name,
            artist_name=artist_name,
            design_summary=booking.design_idea,
            scheduled_date=scheduled_date_str,
            cancelled_by=data.cancelled_by,
            reason=data.reason,
            deposit_amount=booking.deposit_amount,
            deposit_forfeited=False,  # Not forfeited - refunding
        )

    # Send refund confirmation email
    refund_notification_sent = False
    if data.notify_client:
        refund_notification_sent = await email_service.send_refund_confirmation_email(
            to_email=booking.client_email,
            client_name=booking.client_name,
            studio_name=booking.studio.name,
            refund_amount=refund_amount,
            original_deposit=booking.deposit_amount or 0,
            reason=data.reason,
            is_partial=data.refund_type == "partial",
        )

    return CancelWithRefundResponse(
        message="Booking cancelled and refund processed successfully",
        request_id=booking.id,
        status="cancelled",
        cancelled_at=booking.cancelled_at,
        cancelled_by=booking.cancelled_by or "studio",
        refund_amount=refund_amount,
        refund_stripe_id=booking.refund_stripe_id or "",
        refunded_at=booking.refunded_at,
        cancellation_notification_sent=cancellation_notification_sent,
        refund_notification_sent=refund_notification_sent,
        stub_mode=refund_result.get("stub_mode", False),
    )
