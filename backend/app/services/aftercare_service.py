"""Aftercare service for sending and scheduling aftercare instructions."""

import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.aftercare import (
    AftercareFollowUp,
    AftercareSent,
    AftercareSentStatus,
    AftercareTemplate,
    FollowUpStatus,
    FollowUpType,
    TattooPlacement,
    TattooType,
)
from app.models.booking import BookingRequest
from app.models.studio import Studio
from app.models.user import User
from app.services.email import email_service
from app.services.sms import sms_service

logger = logging.getLogger(__name__)


# Default follow-up schedule (days after appointment)
DEFAULT_FOLLOW_UPS = [
    {"type": FollowUpType.DAY_3, "days": 3, "subject": "How's your tattoo healing?"},
    {"type": FollowUpType.WEEK_1, "days": 7, "subject": "One week check-in - How's your tattoo?"},
    {"type": FollowUpType.WEEK_4, "days": 28, "subject": "Your tattoo should be healed - Time for sunscreen!"},
]


async def find_best_template(
    db: AsyncSession,
    studio_id: uuid.UUID,
    tattoo_type: Optional[TattooType] = None,
    placement: Optional[TattooPlacement] = None,
) -> Optional[AftercareTemplate]:
    """
    Find the best matching aftercare template for a booking.

    Priority:
    1. Exact match on both tattoo_type and placement
    2. Match on tattoo_type only
    3. Match on placement only
    4. Default template (is_default=True)
    5. Any active template
    """
    # Try exact match first
    if tattoo_type and placement:
        stmt = select(AftercareTemplate).where(
            AftercareTemplate.studio_id == studio_id,
            AftercareTemplate.tattoo_type == tattoo_type,
            AftercareTemplate.placement == placement,
            AftercareTemplate.is_active == True,
            AftercareTemplate.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        template = result.scalar_one_or_none()
        if template:
            return template

    # Try tattoo_type match
    if tattoo_type:
        stmt = select(AftercareTemplate).where(
            AftercareTemplate.studio_id == studio_id,
            AftercareTemplate.tattoo_type == tattoo_type,
            AftercareTemplate.placement.is_(None),
            AftercareTemplate.is_active == True,
            AftercareTemplate.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        template = result.scalar_one_or_none()
        if template:
            return template

    # Try placement match
    if placement:
        stmt = select(AftercareTemplate).where(
            AftercareTemplate.studio_id == studio_id,
            AftercareTemplate.placement == placement,
            AftercareTemplate.tattoo_type.is_(None),
            AftercareTemplate.is_active == True,
            AftercareTemplate.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        template = result.scalar_one_or_none()
        if template:
            return template

    # Try default template
    stmt = select(AftercareTemplate).where(
        AftercareTemplate.studio_id == studio_id,
        AftercareTemplate.is_default == True,
        AftercareTemplate.is_active == True,
        AftercareTemplate.deleted_at.is_(None),
    )
    result = await db.execute(stmt)
    template = result.scalar_one_or_none()
    if template:
        return template

    # Fall back to any active template
    stmt = select(AftercareTemplate).where(
        AftercareTemplate.studio_id == studio_id,
        AftercareTemplate.is_active == True,
        AftercareTemplate.deleted_at.is_(None),
    ).order_by(AftercareTemplate.use_count.desc()).limit(1)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


def generate_follow_up_messages(
    client_name: str,
    studio_name: str,
    artist_name: Optional[str],
    appointment_date: datetime,
    view_url: str,
) -> list[dict]:
    """Generate follow-up message content for each scheduled follow-up."""
    messages = []

    for follow_up in DEFAULT_FOLLOW_UPS:
        scheduled_for = appointment_date + timedelta(days=follow_up["days"])

        if follow_up["type"] == FollowUpType.DAY_3:
            message_plain = f"""Hi {client_name},

It's been 3 days since your tattoo session! How's your tattoo healing?

By now, you may notice some peeling or flaking - this is completely normal. Remember:
- Keep washing gently 2-3 times a day
- Apply a thin layer of unscented lotion
- Don't pick or scratch at any flaking skin
- Stay out of pools, hot tubs, and direct sun

If you have any concerns about your healing, don't hesitate to reach out!

View your full aftercare instructions: {view_url}

Best,
{studio_name}"""

            message_html = f"""
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #1a1a1a;">Day 3 Check-In</h2>
    <p>Hi {client_name},</p>
    <p>It's been 3 days since your tattoo session! How's your tattoo healing?</p>
    <p>By now, you may notice some peeling or flaking - this is <strong>completely normal</strong>. Remember:</p>
    <ul>
        <li>Keep washing gently 2-3 times a day</li>
        <li>Apply a thin layer of unscented lotion</li>
        <li>Don't pick or scratch at any flaking skin</li>
        <li>Stay out of pools, hot tubs, and direct sun</li>
    </ul>
    <p>If you have any concerns about your healing, don't hesitate to reach out!</p>
    <p style="text-align: center; margin: 30px 0;">
        <a href="{view_url}" style="background-color: #e11d48; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            View Aftercare Instructions
        </a>
    </p>
    <p style="color: #666;">Best,<br>{studio_name}</p>
</div>"""

        elif follow_up["type"] == FollowUpType.WEEK_1:
            message_plain = f"""Hi {client_name},

It's been one week since your tattoo appointment! Your tattoo should be well into the healing process now.

At this stage:
- The surface should be mostly healed
- Colors may look a bit dull - this is normal and will brighten up
- Continue moisturizing daily
- Avoid sun exposure and swimming for another week or two

Any questions or concerns? Just reply to this email.

View your aftercare instructions: {view_url}

Best,
{studio_name}"""

            message_html = f"""
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #1a1a1a;">One Week Check-In</h2>
    <p>Hi {client_name},</p>
    <p>It's been one week since your tattoo appointment! Your tattoo should be well into the healing process now.</p>
    <p>At this stage:</p>
    <ul>
        <li>The surface should be mostly healed</li>
        <li>Colors may look a bit dull - this is normal and will brighten up</li>
        <li>Continue moisturizing daily</li>
        <li>Avoid sun exposure and swimming for another week or two</li>
    </ul>
    <p>Any questions or concerns? Just reply to this email.</p>
    <p style="text-align: center; margin: 30px 0;">
        <a href="{view_url}" style="background-color: #e11d48; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            View Aftercare Instructions
        </a>
    </p>
    <p style="color: #666;">Best,<br>{studio_name}</p>
</div>"""

        elif follow_up["type"] == FollowUpType.WEEK_4:
            message_plain = f"""Hi {client_name},

It's been 4 weeks since your tattoo session - congratulations, your tattoo should be fully healed!

Now that your tattoo is healed:
- You can resume all normal activities including swimming
- ALWAYS apply SPF 30+ sunscreen when your tattoo is exposed to the sun
- Keep your skin moisturized for the best color retention
- If you notice any touch-up needs, let us know within the first year

We'd love to see how it turned out! Feel free to tag us on social media.

Need a touch-up? Just reply to this email to schedule.

Thanks for choosing {studio_name}!

Best,
{studio_name}"""

            message_html = f"""
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #1a1a1a;">Congrats - Your Tattoo is Healed!</h2>
    <p>Hi {client_name},</p>
    <p>It's been 4 weeks since your tattoo session - congratulations, your tattoo should be fully healed!</p>
    <p>Now that your tattoo is healed:</p>
    <ul>
        <li>You can resume all normal activities including swimming</li>
        <li><strong>ALWAYS</strong> apply SPF 30+ sunscreen when your tattoo is exposed to the sun</li>
        <li>Keep your skin moisturized for the best color retention</li>
        <li>If you notice any touch-up needs, let us know within the first year</li>
    </ul>
    <p>We'd love to see how it turned out! Feel free to tag us on social media.</p>
    <p><strong>Need a touch-up?</strong> Just reply to this email to schedule.</p>
    <p style="color: #666;">Thanks for choosing {studio_name}!</p>
    <p style="color: #666;">Best,<br>{studio_name}</p>
</div>"""

        messages.append({
            "type": follow_up["type"],
            "scheduled_for": scheduled_for,
            "subject": follow_up["subject"],
            "message_html": message_html,
            "message_plain": message_plain,
        })

    return messages


async def send_aftercare(
    db: AsyncSession,
    booking: BookingRequest,
    template: AftercareTemplate,
    send_via: str = "email",
    schedule_follow_ups: bool = True,
    artist_id: Optional[uuid.UUID] = None,
) -> AftercareSent:
    """
    Send aftercare instructions for a completed booking.

    Args:
        db: Database session
        booking: The completed booking request
        template: The aftercare template to use
        send_via: How to send - "email", "sms", or "both"
        schedule_follow_ups: Whether to schedule follow-up messages
        artist_id: The artist who performed the tattoo

    Returns:
        The created AftercareSent record
    """
    # Generate access token for client viewing
    access_token = secrets.token_urlsafe(32)

    # Get studio info
    studio = booking.studio
    artist = booking.assigned_artist or booking.preferred_artist

    # Determine tattoo type and placement from booking
    # These would ideally come from the booking, but we'll use template defaults if not set
    tattoo_type = template.tattoo_type
    placement = template.placement

    # Create the sent record
    aftercare_sent = AftercareSent(
        template_id=template.id,
        template_name=template.name,
        instructions_snapshot=template.instructions_html,
        studio_id=studio.id,
        booking_request_id=booking.id,
        artist_id=artist_id or (artist.id if artist else None),
        client_name=booking.client_name,
        client_email=booking.client_email,
        client_phone=booking.client_phone,
        tattoo_type=tattoo_type,
        placement=placement,
        tattoo_description=booking.design_idea[:200] if booking.design_idea else None,
        appointment_date=booking.scheduled_date or datetime.now(timezone.utc),
        status=AftercareSentStatus.PENDING,
        sent_via=send_via,
        access_token=access_token,
    )

    db.add(aftercare_sent)

    # Update template usage
    template.use_count += 1
    template.last_used_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(aftercare_sent)

    # Send the aftercare email/SMS
    from app.config import get_settings
    settings = get_settings()
    view_url = f"{settings.frontend_url}/aftercare/{access_token}"

    email_sent = False
    sms_sent = False

    if send_via in ("email", "both"):
        email_sent = await email_service.send_aftercare_email(
            to_email=booking.client_email,
            client_name=booking.client_name,
            studio_name=studio.name,
            artist_name=artist.full_name if artist else None,
            instructions_html=template.instructions_html,
            instructions_plain=template.instructions_plain,
            view_url=view_url,
            extra_data=template.extra_data,
        )

    if send_via in ("sms", "both") and booking.client_phone:
        sms_message = f"Hi {booking.client_name}! Your aftercare instructions from {studio.name} are ready. View them here: {view_url}"
        sms_sent = await sms_service.send_sms(booking.client_phone, sms_message)

    # Update status based on send result
    now = datetime.now(timezone.utc)
    if (send_via == "email" and email_sent) or \
       (send_via == "sms" and sms_sent) or \
       (send_via == "both" and (email_sent or sms_sent)):
        aftercare_sent.status = AftercareSentStatus.SENT
        aftercare_sent.sent_at = now
    else:
        aftercare_sent.status = AftercareSentStatus.FAILED
        aftercare_sent.failure_reason = "Failed to send via " + send_via

    # Schedule follow-up messages if requested
    if schedule_follow_ups and aftercare_sent.status == AftercareSentStatus.SENT:
        follow_up_messages = generate_follow_up_messages(
            client_name=booking.client_name,
            studio_name=studio.name,
            artist_name=artist.full_name if artist else None,
            appointment_date=aftercare_sent.appointment_date,
            view_url=view_url,
        )

        for msg in follow_up_messages:
            follow_up = AftercareFollowUp(
                aftercare_sent_id=aftercare_sent.id,
                follow_up_type=msg["type"],
                scheduled_for=msg["scheduled_for"],
                subject=msg["subject"],
                message_html=msg["message_html"],
                message_plain=msg["message_plain"],
                status=FollowUpStatus.SCHEDULED,
                send_via="email",  # Follow-ups are email by default
            )
            db.add(follow_up)

    await db.commit()
    await db.refresh(aftercare_sent)

    return aftercare_sent


async def send_aftercare_for_booking(
    db: AsyncSession,
    booking_id: uuid.UUID,
    template_id: Optional[uuid.UUID] = None,
    send_via: str = "email",
    schedule_follow_ups: bool = True,
) -> Optional[AftercareSent]:
    """
    Send aftercare for a booking, automatically finding the best template if not specified.

    Returns None if no template is found or booking doesn't exist.
    """
    # Get the booking with relationships
    stmt = select(BookingRequest).where(
        BookingRequest.id == booking_id,
        BookingRequest.deleted_at.is_(None),
    ).options(
        selectinload(BookingRequest.studio),
        selectinload(BookingRequest.assigned_artist),
        selectinload(BookingRequest.preferred_artist),
    )
    result = await db.execute(stmt)
    booking = result.scalar_one_or_none()

    if not booking:
        logger.warning(f"Booking {booking_id} not found for aftercare")
        return None

    # Check if aftercare already sent
    stmt = select(AftercareSent).where(
        AftercareSent.booking_request_id == booking_id,
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        logger.info(f"Aftercare already sent for booking {booking_id}")
        return existing

    # Get template
    if template_id:
        stmt = select(AftercareTemplate).where(
            AftercareTemplate.id == template_id,
            AftercareTemplate.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        template = result.scalar_one_or_none()
    else:
        # Find best matching template
        template = await find_best_template(
            db=db,
            studio_id=booking.studio_id,
            tattoo_type=None,  # Could be derived from booking in future
            placement=None,    # Could be derived from booking in future
        )

    if not template:
        logger.warning(f"No aftercare template found for booking {booking_id}")
        return None

    # Send the aftercare
    return await send_aftercare(
        db=db,
        booking=booking,
        template=template,
        send_via=send_via,
        schedule_follow_ups=schedule_follow_ups,
        artist_id=booking.assigned_artist_id or booking.preferred_artist_id,
    )


# Singleton-style accessor
class AftercareService:
    """Aftercare service wrapper."""

    async def send_for_booking(
        self,
        db: AsyncSession,
        booking_id: uuid.UUID,
        template_id: Optional[uuid.UUID] = None,
        send_via: str = "email",
        schedule_follow_ups: bool = True,
    ) -> Optional[AftercareSent]:
        return await send_aftercare_for_booking(
            db=db,
            booking_id=booking_id,
            template_id=template_id,
            send_via=send_via,
            schedule_follow_ups=schedule_follow_ups,
        )

    async def find_template(
        self,
        db: AsyncSession,
        studio_id: uuid.UUID,
        tattoo_type: Optional[TattooType] = None,
        placement: Optional[TattooPlacement] = None,
    ) -> Optional[AftercareTemplate]:
        return await find_best_template(db, studio_id, tattoo_type, placement)


aftercare_service = AftercareService()
