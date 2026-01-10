"""Reminder endpoints for automated appointment reminders."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.booking import BookingRequest, BookingRequestStatus
from app.services.auth import get_current_user, require_role
from app.services.email import email_service
from app.services.sms import sms_service

router = APIRouter(prefix="/reminders", tags=["Reminders"])


class ReminderResult(BaseModel):
    """Result for a single reminder sent."""

    booking_id: str
    client_name: str
    client_email: str
    reminder_type: str  # "24h" or "2h"
    email_sent: bool
    sms_sent: bool
    error: str | None = None


class ProcessRemindersResponse(BaseModel):
    """Response from processing reminders."""

    processed_at: datetime
    reminders_24h_sent: int
    reminders_2h_sent: int
    total_processed: int
    results: list[ReminderResult]


class PendingReminder(BaseModel):
    """A pending reminder to be sent."""

    booking_id: str
    client_name: str
    client_email: str
    client_phone: str | None
    scheduled_date: datetime
    reminder_type: str  # "24h" or "2h"
    hours_until: float


class PendingRemindersResponse(BaseModel):
    """Response listing pending reminders."""

    checked_at: datetime
    pending_24h: list[PendingReminder]
    pending_2h: list[PendingReminder]
    total_pending: int


async def _get_studio_address(booking: BookingRequest) -> str | None:
    """Format studio address if available."""
    studio = booking.studio
    if not studio:
        return None

    parts = []
    if studio.address_line1:
        parts.append(studio.address_line1)
    if studio.address_line2:
        parts.append(studio.address_line2)
    if studio.city:
        city_line = studio.city
        if studio.state:
            city_line += f", {studio.state}"
        if studio.postal_code:
            city_line += f" {studio.postal_code}"
        parts.append(city_line)

    return ", ".join(parts) if parts else None


async def _send_reminder(
    booking: BookingRequest,
    hours_until: int,
    db: AsyncSession,
) -> ReminderResult:
    """Send a reminder for a booking."""
    reminder_type = "24h" if hours_until == 24 else "2h"

    # Get artist name
    artist_name = None
    if booking.assigned_artist:
        artist_name = f"{booking.assigned_artist.first_name} {booking.assigned_artist.last_name}"

    # Format date/time
    if booking.scheduled_date:
        scheduled_date = booking.scheduled_date.strftime("%A, %B %d, %Y")
        scheduled_time = booking.scheduled_date.strftime("%I:%M %p")
    else:
        scheduled_date = "TBD"
        scheduled_time = "TBD"

    studio_address = await _get_studio_address(booking)

    email_sent = False
    sms_sent = False
    error = None

    try:
        # Send email reminder
        email_sent = await email_service.send_appointment_reminder_email(
            to_email=booking.client_email,
            client_name=booking.client_name,
            studio_name=booking.studio.name if booking.studio else "InkFlow Studio",
            studio_address=studio_address,
            artist_name=artist_name,
            design_summary=booking.design_idea,
            placement=booking.placement,
            scheduled_date=scheduled_date,
            scheduled_time=scheduled_time,
            duration_hours=booking.scheduled_duration_hours or 2.0,
            hours_until=hours_until,
        )

        # Send SMS reminder if phone provided
        if booking.client_phone:
            sms_sent = await sms_service.send_appointment_reminder(
                to_phone=booking.client_phone,
                client_name=booking.client_name,
                studio_name=booking.studio.name if booking.studio else "InkFlow Studio",
                artist_name=artist_name,
                scheduled_date=scheduled_date,
                scheduled_time=scheduled_time,
                hours_until=hours_until,
            )

        # Update reminder sent timestamp
        now = datetime.now(timezone.utc)
        if hours_until == 24:
            booking.reminder_24h_sent_at = now
        else:
            booking.reminder_2h_sent_at = now

        await db.commit()

    except Exception as e:
        error = str(e)

    return ReminderResult(
        booking_id=str(booking.id),
        client_name=booking.client_name,
        client_email=booking.client_email,
        reminder_type=reminder_type,
        email_sent=email_sent,
        sms_sent=sms_sent,
        error=error,
    )


@router.post("/process", response_model=ProcessRemindersResponse)
async def process_reminders(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[None, Depends(require_role("owner"))],
) -> ProcessRemindersResponse:
    """
    Process and send pending reminders.

    This endpoint should be called periodically (e.g., every 15 minutes via cron).
    It will find all confirmed bookings that need reminders and send them.

    Reminders are sent:
    - 24 hours before the appointment
    - 2 hours before the appointment

    Requires owner role for manual triggering.
    """
    now = datetime.now(timezone.utc)
    results: list[ReminderResult] = []
    reminders_24h_sent = 0
    reminders_2h_sent = 0

    # Find bookings needing 24h reminder
    # Between 24 and 25 hours from now, and reminder not yet sent
    window_24h_start = now + timedelta(hours=24)
    window_24h_end = now + timedelta(hours=25)

    query_24h = (
        select(BookingRequest)
        .options(
            selectinload(BookingRequest.studio),
            selectinload(BookingRequest.assigned_artist),
        )
        .where(
            and_(
                BookingRequest.status == BookingRequestStatus.CONFIRMED,
                BookingRequest.scheduled_date >= window_24h_start,
                BookingRequest.scheduled_date < window_24h_end,
                BookingRequest.reminder_24h_sent_at.is_(None),
                BookingRequest.deleted_at.is_(None),
            )
        )
    )

    result_24h = await db.execute(query_24h)
    bookings_24h = result_24h.scalars().all()

    for booking in bookings_24h:
        reminder_result = await _send_reminder(booking, 24, db)
        results.append(reminder_result)
        if reminder_result.email_sent or reminder_result.sms_sent:
            reminders_24h_sent += 1

    # Find bookings needing 2h reminder
    # Between 2 and 3 hours from now, and reminder not yet sent
    window_2h_start = now + timedelta(hours=2)
    window_2h_end = now + timedelta(hours=3)

    query_2h = (
        select(BookingRequest)
        .options(
            selectinload(BookingRequest.studio),
            selectinload(BookingRequest.assigned_artist),
        )
        .where(
            and_(
                BookingRequest.status == BookingRequestStatus.CONFIRMED,
                BookingRequest.scheduled_date >= window_2h_start,
                BookingRequest.scheduled_date < window_2h_end,
                BookingRequest.reminder_2h_sent_at.is_(None),
                BookingRequest.deleted_at.is_(None),
            )
        )
    )

    result_2h = await db.execute(query_2h)
    bookings_2h = result_2h.scalars().all()

    for booking in bookings_2h:
        reminder_result = await _send_reminder(booking, 2, db)
        results.append(reminder_result)
        if reminder_result.email_sent or reminder_result.sms_sent:
            reminders_2h_sent += 1

    return ProcessRemindersResponse(
        processed_at=now,
        reminders_24h_sent=reminders_24h_sent,
        reminders_2h_sent=reminders_2h_sent,
        total_processed=len(results),
        results=results,
    )


@router.get("/pending", response_model=PendingRemindersResponse)
async def get_pending_reminders(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[None, Depends(require_role("owner"))],
) -> PendingRemindersResponse:
    """
    Get list of pending reminders that will be sent.

    This is useful for previewing what reminders will be sent on the next
    process cycle.

    Requires owner role.
    """
    now = datetime.now(timezone.utc)
    pending_24h: list[PendingReminder] = []
    pending_2h: list[PendingReminder] = []

    # Find bookings needing 24h reminder (within next 25 hours)
    window_24h_end = now + timedelta(hours=25)

    query_24h = (
        select(BookingRequest)
        .where(
            and_(
                BookingRequest.status == BookingRequestStatus.CONFIRMED,
                BookingRequest.scheduled_date <= window_24h_end,
                BookingRequest.scheduled_date > now,
                BookingRequest.reminder_24h_sent_at.is_(None),
                BookingRequest.deleted_at.is_(None),
            )
        )
        .order_by(BookingRequest.scheduled_date)
    )

    result_24h = await db.execute(query_24h)
    bookings_24h = result_24h.scalars().all()

    for booking in bookings_24h:
        if booking.scheduled_date:
            hours_until = (booking.scheduled_date - now).total_seconds() / 3600
            if hours_until >= 24:
                pending_24h.append(
                    PendingReminder(
                        booking_id=str(booking.id),
                        client_name=booking.client_name,
                        client_email=booking.client_email,
                        client_phone=booking.client_phone,
                        scheduled_date=booking.scheduled_date,
                        reminder_type="24h",
                        hours_until=hours_until,
                    )
                )

    # Find bookings needing 2h reminder (within next 3 hours)
    window_2h_end = now + timedelta(hours=3)

    query_2h = (
        select(BookingRequest)
        .where(
            and_(
                BookingRequest.status == BookingRequestStatus.CONFIRMED,
                BookingRequest.scheduled_date <= window_2h_end,
                BookingRequest.scheduled_date > now,
                BookingRequest.reminder_2h_sent_at.is_(None),
                BookingRequest.reminder_24h_sent_at.is_not(None),  # 24h should be sent first
                BookingRequest.deleted_at.is_(None),
            )
        )
        .order_by(BookingRequest.scheduled_date)
    )

    result_2h = await db.execute(query_2h)
    bookings_2h = result_2h.scalars().all()

    for booking in bookings_2h:
        if booking.scheduled_date:
            hours_until = (booking.scheduled_date - now).total_seconds() / 3600
            if hours_until >= 2 and hours_until < 24:
                pending_2h.append(
                    PendingReminder(
                        booking_id=str(booking.id),
                        client_name=booking.client_name,
                        client_email=booking.client_email,
                        client_phone=booking.client_phone,
                        scheduled_date=booking.scheduled_date,
                        reminder_type="2h",
                        hours_until=hours_until,
                    )
                )

    return PendingRemindersResponse(
        checked_at=now,
        pending_24h=pending_24h,
        pending_2h=pending_2h,
        total_pending=len(pending_24h) + len(pending_2h),
    )


@router.post("/test/{booking_id}", response_model=ReminderResult)
async def send_test_reminder(
    booking_id: uuid.UUID,
    reminder_type: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[None, Depends(require_role("owner"))],
) -> ReminderResult:
    """
    Send a test reminder for a specific booking.

    This is useful for testing reminder functionality without waiting
    for the scheduled time.

    Args:
        booking_id: UUID of the booking
        reminder_type: "24h" or "2h"

    Requires owner role.
    """
    from fastapi import HTTPException

    if reminder_type not in ["24h", "2h"]:
        raise HTTPException(
            status_code=400,
            detail="reminder_type must be '24h' or '2h'"
        )

    query = (
        select(BookingRequest)
        .options(
            selectinload(BookingRequest.studio),
            selectinload(BookingRequest.assigned_artist),
        )
        .where(
            and_(
                BookingRequest.id == booking_id,
                BookingRequest.deleted_at.is_(None),
            )
        )
    )

    result = await db.execute(query)
    booking = result.scalar_one_or_none()

    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    hours_until = 24 if reminder_type == "24h" else 2

    # Don't update the sent_at timestamp for test reminders
    # Just send the reminder
    reminder_result = await _send_reminder(booking, hours_until, db)

    return reminder_result
