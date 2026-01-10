"""Client portal router for authenticated clients."""

import secrets
from datetime import datetime, timezone
from math import ceil
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import BookingRequest, Studio, User
from app.models.client import Client
from app.models.consent import ConsentAuditAction, ConsentAuditLog, ConsentFormSubmission, ConsentFormTemplate
from app.schemas.client import (
    ClientBookingArtistInfo,
    ClientBookingDetail,
    ClientBookingsListResponse,
    ClientBookingStudioInfo,
    ClientBookingSummary,
)
from app.services.client_auth import get_current_client

router = APIRouter(prefix="/client/portal", tags=["Client Portal"])


def _build_booking_summary(
    booking: BookingRequest,
    artist: User | None = None,
    studio: Studio | None = None,
) -> ClientBookingSummary:
    """Build a booking summary from a booking request."""
    return ClientBookingSummary(
        id=booking.id,
        design_idea=booking.design_idea[:100] + "..." if len(booking.design_idea) > 100 else booking.design_idea,
        placement=booking.placement,
        size=booking.size.value,
        status=booking.status.value,
        quoted_price=booking.quoted_price,
        deposit_amount=booking.deposit_amount,
        deposit_paid_at=booking.deposit_paid_at,
        scheduled_date=booking.scheduled_date,
        scheduled_duration_hours=booking.scheduled_duration_hours,
        created_at=booking.created_at,
        artist=ClientBookingArtistInfo(
            id=artist.id,
            name=artist.full_name,
        ) if artist else None,
        studio=ClientBookingStudioInfo(
            id=studio.id,
            name=studio.name,
        ) if studio else None,
    )


def _build_booking_detail(
    booking: BookingRequest,
    artist: User | None = None,
    studio: Studio | None = None,
) -> ClientBookingDetail:
    """Build a detailed booking view from a booking request."""
    return ClientBookingDetail(
        id=booking.id,
        design_idea=booking.design_idea,
        placement=booking.placement,
        size=booking.size.value,
        status=booking.status.value,
        quoted_price=booking.quoted_price,
        deposit_amount=booking.deposit_amount,
        deposit_paid_at=booking.deposit_paid_at,
        scheduled_date=booking.scheduled_date,
        scheduled_duration_hours=booking.scheduled_duration_hours,
        created_at=booking.created_at,
        artist=ClientBookingArtistInfo(
            id=artist.id,
            name=artist.full_name,
        ) if artist else None,
        studio=ClientBookingStudioInfo(
            id=studio.id,
            name=studio.name,
        ) if studio else None,
        client_name=booking.client_name,
        client_email=booking.client_email,
        client_phone=booking.client_phone,
        is_cover_up=booking.is_cover_up,
        is_first_tattoo=booking.is_first_tattoo,
        color_preference=booking.color_preference,
        budget_range=booking.budget_range,
        additional_notes=booking.additional_notes,
        preferred_dates=booking.preferred_dates,
        quote_notes=booking.quote_notes,
        quoted_at=booking.quoted_at,
        cancelled_at=booking.cancelled_at,
        cancellation_reason=booking.cancellation_reason,
        deposit_forfeited=booking.deposit_forfeited,
        reschedule_count=booking.reschedule_count,
        updated_at=booking.updated_at,
    )


@router.get("/bookings", response_model=ClientBookingsListResponse)
async def get_my_bookings(
    current_client: Client = Depends(get_current_client),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(10, ge=1, le=50, description="Items per page"),
    status_filter: str | None = Query(None, description="Filter by status"),
) -> ClientBookingsListResponse:
    """
    Get the current client's booking history.

    Returns all bookings associated with the client's email address,
    sorted by creation date (newest first).
    """
    # Build base query - find bookings by client email
    base_query = (
        select(BookingRequest)
        .where(
            BookingRequest.client_email == current_client.email,
            BookingRequest.deleted_at.is_(None),
        )
        .options(
            selectinload(BookingRequest.assigned_artist),
            selectinload(BookingRequest.studio),
        )
    )

    # Apply status filter if provided
    if status_filter:
        base_query = base_query.where(BookingRequest.status == status_filter)

    # Count total matching records
    count_query = select(func.count()).select_from(
        base_query.subquery()
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Calculate pagination
    pages = ceil(total / per_page) if total > 0 else 1
    offset = (page - 1) * per_page

    # Get paginated results
    paginated_query = (
        base_query
        .order_by(BookingRequest.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    result = await db.execute(paginated_query)
    bookings = result.scalars().all()

    # Build response
    booking_summaries = [
        _build_booking_summary(
            booking,
            artist=booking.assigned_artist,
            studio=booking.studio,
        )
        for booking in bookings
    ]

    return ClientBookingsListResponse(
        bookings=booking_summaries,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
    )


@router.get("/bookings/{booking_id}", response_model=ClientBookingDetail)
async def get_my_booking(
    booking_id: UUID,
    current_client: Client = Depends(get_current_client),
    db: AsyncSession = Depends(get_db),
) -> ClientBookingDetail:
    """
    Get details of a specific booking for the current client.

    Only returns the booking if it belongs to the client's email.
    """
    # Find the booking
    query = (
        select(BookingRequest)
        .where(
            BookingRequest.id == booking_id,
            BookingRequest.client_email == current_client.email,
            BookingRequest.deleted_at.is_(None),
        )
        .options(
            selectinload(BookingRequest.assigned_artist),
            selectinload(BookingRequest.studio),
        )
    )
    result = await db.execute(query)
    booking = result.scalar_one_or_none()

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found",
        )

    return _build_booking_detail(
        booking,
        artist=booking.assigned_artist,
        studio=booking.studio,
    )


@router.get("/bookings/stats/summary")
async def get_my_booking_stats(
    current_client: Client = Depends(get_current_client),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Get booking statistics summary for the current client.
    """
    # Count bookings by status
    query = (
        select(
            BookingRequest.status,
            func.count(BookingRequest.id).label("count"),
        )
        .where(
            BookingRequest.client_email == current_client.email,
            BookingRequest.deleted_at.is_(None),
        )
        .group_by(BookingRequest.status)
    )
    result = await db.execute(query)
    status_counts = {row.status.value: row.count for row in result.all()}

    # Calculate totals
    total = sum(status_counts.values())
    completed = status_counts.get("completed", 0)
    upcoming = status_counts.get("confirmed", 0) + status_counts.get("deposit_paid", 0)
    pending = status_counts.get("pending", 0) + status_counts.get("reviewing", 0) + status_counts.get("quoted", 0) + status_counts.get("deposit_requested", 0)
    cancelled = status_counts.get("cancelled", 0) + status_counts.get("rejected", 0)

    # Calculate total spent (from completed bookings)
    spent_query = (
        select(func.sum(BookingRequest.quoted_price))
        .where(
            BookingRequest.client_email == current_client.email,
            BookingRequest.status == "completed",
            BookingRequest.deleted_at.is_(None),
        )
    )
    spent_result = await db.execute(spent_query)
    total_spent = spent_result.scalar() or 0

    return {
        "total_bookings": total,
        "completed": completed,
        "upcoming": upcoming,
        "pending": pending,
        "cancelled": cancelled,
        "total_spent_cents": total_spent,
        "status_breakdown": status_counts,
    }


# ============ Consent Form Schemas ============


class ClientConsentPendingBooking(BaseModel):
    """A booking that needs a consent form signed."""

    id: UUID
    design_idea: str
    placement: str
    size: str
    status: str
    scheduled_date: datetime | None
    artist_name: str | None
    studio_id: UUID
    studio_name: str
    template_id: UUID | None
    template_name: str | None


class ClientConsentPendingResponse(BaseModel):
    """Response with pending consent forms."""

    bookings: list[ClientConsentPendingBooking]
    total: int


class ClientSignedConsentSummary(BaseModel):
    """Summary of a signed consent form."""

    id: UUID
    template_name: str
    submitted_at: datetime
    booking_id: UUID | None
    booking_design_idea: str | None
    booking_scheduled_date: datetime | None
    studio_name: str
    has_signature: bool
    access_token: str


class ClientSignedConsentsResponse(BaseModel):
    """Response with signed consent forms."""

    submissions: list[ClientSignedConsentSummary]
    total: int
    page: int
    per_page: int
    pages: int


class ClientConsentFormField(BaseModel):
    """A field in the consent form."""

    id: str
    type: str
    label: str
    required: bool
    order: int
    placeholder: str | None = None
    help_text: str | None = None
    options: list[str] | None = None
    content: str | None = None


class ClientConsentTemplateResponse(BaseModel):
    """Consent form template for client signing."""

    id: UUID
    name: str
    description: str | None
    header_text: str | None
    footer_text: str | None
    requires_photo_id: bool
    requires_signature: bool
    age_requirement: int
    fields: list[ClientConsentFormField]


class ClientConsentSignInput(BaseModel):
    """Input for signing a consent form."""

    booking_id: UUID
    template_id: UUID
    client_name: str = Field(..., min_length=1, max_length=200)
    client_phone: str | None = Field(None, max_length=50)
    date_of_birth: str | None = None  # YYYY-MM-DD format
    responses: dict[str, Any]
    signature_data: str = Field(..., min_length=1)


class ClientConsentSignResponse(BaseModel):
    """Response after signing a consent form."""

    submission_id: UUID
    access_token: str
    message: str


# ============ Consent Form Endpoints ============


@router.get("/consent/pending", response_model=ClientConsentPendingResponse)
async def get_pending_consent_forms(
    current_client: Client = Depends(get_current_client),
    db: AsyncSession = Depends(get_db),
) -> ClientConsentPendingResponse:
    """
    Get bookings that need consent forms signed.

    Returns upcoming/confirmed bookings for the client that don't have
    a signed consent form yet.
    """
    # Find bookings for this client that:
    # 1. Are in a status that needs consent (confirmed, deposit_paid)
    # 2. Don't have a consent submission yet
    consent_statuses = ["confirmed", "deposit_paid"]

    # Subquery to find booking IDs that already have consent submissions
    signed_bookings_subquery = (
        select(ConsentFormSubmission.booking_request_id)
        .where(
            ConsentFormSubmission.client_email == current_client.email,
            ConsentFormSubmission.is_voided.is_(False),
            ConsentFormSubmission.booking_request_id.isnot(None),
        )
        .scalar_subquery()
    )

    # Get bookings that need consent
    query = (
        select(BookingRequest)
        .where(
            BookingRequest.client_email == current_client.email,
            BookingRequest.status.in_(consent_statuses),
            BookingRequest.deleted_at.is_(None),
            BookingRequest.id.notin_(signed_bookings_subquery),
        )
        .options(
            selectinload(BookingRequest.assigned_artist),
            selectinload(BookingRequest.studio).selectinload(Studio.consent_templates),
        )
        .order_by(BookingRequest.scheduled_date.asc().nulls_last())
    )

    result = await db.execute(query)
    bookings = result.scalars().all()

    pending_list = []
    for booking in bookings:
        # Find the default consent template for this studio
        default_template = None
        if booking.studio and booking.studio.consent_templates:
            for template in booking.studio.consent_templates:
                if template.is_active and template.is_default and not template.deleted_at:
                    default_template = template
                    break
            # If no default, use first active template
            if not default_template:
                for template in booking.studio.consent_templates:
                    if template.is_active and not template.deleted_at:
                        default_template = template
                        break

        pending_list.append(
            ClientConsentPendingBooking(
                id=booking.id,
                design_idea=booking.design_idea[:100] + "..." if len(booking.design_idea) > 100 else booking.design_idea,
                placement=booking.placement,
                size=booking.size.value,
                status=booking.status.value,
                scheduled_date=booking.scheduled_date,
                artist_name=booking.assigned_artist.full_name if booking.assigned_artist else None,
                studio_id=booking.studio_id,
                studio_name=booking.studio.name if booking.studio else "Unknown Studio",
                template_id=default_template.id if default_template else None,
                template_name=default_template.name if default_template else None,
            )
        )

    return ClientConsentPendingResponse(
        bookings=pending_list,
        total=len(pending_list),
    )


@router.get("/consent/signed", response_model=ClientSignedConsentsResponse)
async def get_signed_consent_forms(
    current_client: Client = Depends(get_current_client),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(10, ge=1, le=50, description="Items per page"),
) -> ClientSignedConsentsResponse:
    """
    Get previously signed consent forms for the client.
    """
    # Base query
    base_query = (
        select(ConsentFormSubmission)
        .where(
            ConsentFormSubmission.client_email == current_client.email,
            ConsentFormSubmission.is_voided.is_(False),
        )
        .options(
            selectinload(ConsentFormSubmission.studio),
            selectinload(ConsentFormSubmission.booking_request),
        )
    )

    # Count total
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Calculate pagination
    pages = ceil(total / per_page) if total > 0 else 1
    offset = (page - 1) * per_page

    # Get paginated results
    paginated_query = (
        base_query
        .order_by(ConsentFormSubmission.submitted_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    result = await db.execute(paginated_query)
    submissions = result.scalars().all()

    submission_list = [
        ClientSignedConsentSummary(
            id=sub.id,
            template_name=sub.template_name,
            submitted_at=sub.submitted_at,
            booking_id=sub.booking_request_id,
            booking_design_idea=sub.booking_request.design_idea[:50] + "..." if sub.booking_request and len(sub.booking_request.design_idea) > 50 else (sub.booking_request.design_idea if sub.booking_request else None),
            booking_scheduled_date=sub.booking_request.scheduled_date if sub.booking_request else None,
            studio_name=sub.studio.name if sub.studio else "Unknown Studio",
            has_signature=sub.signature_data is not None,
            access_token=sub.access_token,
        )
        for sub in submissions
    ]

    return ClientSignedConsentsResponse(
        submissions=submission_list,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
    )


@router.get("/consent/template/{booking_id}", response_model=ClientConsentTemplateResponse)
async def get_consent_template_for_booking(
    booking_id: UUID,
    current_client: Client = Depends(get_current_client),
    db: AsyncSession = Depends(get_db),
) -> ClientConsentTemplateResponse:
    """
    Get the consent form template for a specific booking.
    """
    # Verify the booking belongs to this client
    booking_query = (
        select(BookingRequest)
        .where(
            BookingRequest.id == booking_id,
            BookingRequest.client_email == current_client.email,
            BookingRequest.deleted_at.is_(None),
        )
        .options(selectinload(BookingRequest.studio))
    )
    result = await db.execute(booking_query)
    booking = result.scalar_one_or_none()

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found",
        )

    # Check if already signed
    existing_query = select(ConsentFormSubmission).where(
        ConsentFormSubmission.booking_request_id == booking_id,
        ConsentFormSubmission.is_voided.is_(False),
    )
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Consent form already signed for this booking",
        )

    # Get the default consent template for this studio
    template_query = (
        select(ConsentFormTemplate)
        .where(
            ConsentFormTemplate.studio_id == booking.studio_id,
            ConsentFormTemplate.is_active.is_(True),
            ConsentFormTemplate.deleted_at.is_(None),
        )
        .order_by(
            ConsentFormTemplate.is_default.desc(),
            ConsentFormTemplate.created_at.asc(),
        )
    )
    template_result = await db.execute(template_query)
    template = template_result.scalars().first()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No consent form template configured for this studio",
        )

    # Convert fields
    fields = [
        ClientConsentFormField(
            id=f.get("id", ""),
            type=f.get("type", "text"),
            label=f.get("label", ""),
            required=f.get("required", False),
            order=f.get("order", 0),
            placeholder=f.get("placeholder"),
            help_text=f.get("help_text"),
            options=f.get("options"),
            content=f.get("content"),
        )
        for f in (template.fields or [])
    ]

    return ClientConsentTemplateResponse(
        id=template.id,
        name=template.name,
        description=template.description,
        header_text=template.header_text,
        footer_text=template.footer_text,
        requires_photo_id=template.requires_photo_id,
        requires_signature=template.requires_signature,
        age_requirement=template.age_requirement,
        fields=sorted(fields, key=lambda f: f.order),
    )


@router.post("/consent/sign", response_model=ClientConsentSignResponse)
async def sign_consent_form(
    data: ClientConsentSignInput,
    request: Request,
    current_client: Client = Depends(get_current_client),
    db: AsyncSession = Depends(get_db),
) -> ClientConsentSignResponse:
    """
    Sign a consent form for a booking.
    """
    # Verify the booking belongs to this client
    booking_query = (
        select(BookingRequest)
        .where(
            BookingRequest.id == data.booking_id,
            BookingRequest.client_email == current_client.email,
            BookingRequest.deleted_at.is_(None),
        )
    )
    result = await db.execute(booking_query)
    booking = result.scalar_one_or_none()

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found",
        )

    # Check if already signed
    existing_query = select(ConsentFormSubmission).where(
        ConsentFormSubmission.booking_request_id == data.booking_id,
        ConsentFormSubmission.is_voided.is_(False),
    )
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Consent form already signed for this booking",
        )

    # Get the template
    template_query = select(ConsentFormTemplate).where(
        ConsentFormTemplate.id == data.template_id,
        ConsentFormTemplate.is_active.is_(True),
        ConsentFormTemplate.deleted_at.is_(None),
    )
    template_result = await db.execute(template_query)
    template = template_result.scalar_one_or_none()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consent template not found or inactive",
        )

    # Validate age if required
    client_dob = None
    age_at_signing = None
    if data.date_of_birth:
        try:
            client_dob = datetime.strptime(data.date_of_birth, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            today = datetime.now(timezone.utc)
            age_at_signing = today.year - client_dob.year
            if (today.month, today.day) < (client_dob.month, client_dob.day):
                age_at_signing -= 1

            if template.age_requirement and age_at_signing < template.age_requirement:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"You must be at least {template.age_requirement} years old",
                )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date of birth format. Use YYYY-MM-DD",
            )

    # Generate access token
    access_token = secrets.token_urlsafe(32)

    # Get client IP
    client_ip = request.client.host if request.client else None

    # Create the submission
    now = datetime.now(timezone.utc)
    submission = ConsentFormSubmission(
        template_id=template.id,
        template_name=template.name,
        template_version=template.version,
        template_fields_snapshot=template.fields,
        studio_id=template.studio_id,
        booking_request_id=data.booking_id,
        client_name=data.client_name,
        client_email=current_client.email,
        client_phone=data.client_phone,
        client_date_of_birth=client_dob,
        responses=data.responses,
        signature_data=data.signature_data,
        signature_timestamp=now,
        ip_address=client_ip,
        submitted_at=now,
        access_token=access_token,
        age_at_signing=age_at_signing,
        age_verified=age_at_signing is not None and age_at_signing >= (template.age_requirement or 0),
    )

    db.add(submission)
    await db.flush()

    # Update template usage stats
    template.use_count += 1
    template.last_used_at = now

    # Create audit log
    audit_log = ConsentAuditLog(
        submission_id=submission.id,
        action=ConsentAuditAction.CREATED,
        is_client_access=True,
        ip_address=client_ip,
        notes="Signed via client portal",
    )
    db.add(audit_log)

    await db.commit()

    return ClientConsentSignResponse(
        submission_id=submission.id,
        access_token=access_token,
        message="Consent form signed successfully",
    )
