"""Webhooks router for external service integrations."""

import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Form, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_context
from app.models.booking import BookingRequest, BookingRequestStatus
from app.models.message import (
    Conversation,
    ConversationStatus,
    Message,
    MessageChannel,
    MessageDirection,
)
from app.services.stripe_service import stripe_service

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


def _extract_thread_token(to_address: str) -> str | None:
    """
    Extract thread token from reply-to address.

    Expected format: reply+{token}@domain.com
    """
    match = re.search(r"reply\+([a-zA-Z0-9_-]+)@", to_address)
    if match:
        return match.group(1)
    return None


def _extract_plain_text_from_email(text: str, html: str | None) -> str:
    """
    Extract the reply content from email, removing quoted text.

    Tries to find the new message content before common reply markers.
    """
    content = text or ""

    # Common reply markers to strip quoted content
    reply_markers = [
        r"\n--\s*\n",  # -- signature
        r"\nOn .+ wrote:\s*\n",  # On [date] [person] wrote:
        r"\n>{1,}",  # Quoted lines starting with >
        r"\n_{10,}",  # Outlook style ______
        r"\nFrom:.+\nSent:.+\nTo:",  # Outlook forward header
        r"\n-{5,}\s*Original Message",  # ----- Original Message -----
        r"\n\*From:\*",  # Bold From: in some clients
    ]

    # Find the earliest marker and truncate there
    min_pos = len(content)
    for pattern in reply_markers:
        match = re.search(pattern, content, re.IGNORECASE)
        if match and match.start() < min_pos:
            min_pos = match.start()

    # Truncate at the marker if found
    if min_pos < len(content):
        content = content[:min_pos]

    # Clean up whitespace
    content = content.strip()

    return content


@router.post("/inbound-email")
async def receive_inbound_email(
    to: str = Form(...),
    from_email: str = Form(..., alias="from"),
    subject: str = Form(""),
    text: str = Form(""),
    html: str = Form(""),
    headers: str = Form(""),
    envelope: str = Form(""),
) -> dict:
    """
    Receive inbound emails from SendGrid Inbound Parse.

    This webhook is called by SendGrid when an email is received at
    the configured domain (e.g., reply+{token}@inkflow.io).

    The thread token in the To address is used to route the email
    to the correct conversation.
    """
    # Extract thread token from To address
    thread_token = _extract_thread_token(to)

    if not thread_token:
        # No valid thread token - can't route this email
        # Return 200 so SendGrid doesn't retry
        return {
            "status": "ignored",
            "reason": "no_thread_token",
            "message": "No thread token found in recipient address",
        }

    # Extract the actual message content (without quoted replies)
    content = _extract_plain_text_from_email(text, html)

    if not content:
        return {
            "status": "ignored",
            "reason": "empty_content",
            "message": "No message content found",
        }

    # Find the conversation by thread token
    async with get_db_context() as db:
        query = select(Conversation).where(
            Conversation.email_thread_token == thread_token
        )
        result = await db.execute(query)
        conversation = result.scalar_one_or_none()

        if not conversation:
            return {
                "status": "ignored",
                "reason": "conversation_not_found",
                "message": f"No conversation found for thread token",
            }

        now = datetime.now(timezone.utc)

        # Extract sender name from email (format: "Name <email@example.com>")
        sender_name = conversation.client_name
        from_match = re.match(r'^"?([^"<]+)"?\s*<', from_email)
        if from_match:
            sender_name = from_match.group(1).strip()

        # Extract Message-ID from headers if present
        email_message_id = None
        email_in_reply_to = None
        if headers:
            msg_id_match = re.search(r"Message-ID:\s*<([^>]+)>", headers, re.IGNORECASE)
            if msg_id_match:
                email_message_id = f"<{msg_id_match.group(1)}>"

            reply_to_match = re.search(r"In-Reply-To:\s*<([^>]+)>", headers, re.IGNORECASE)
            if reply_to_match:
                email_in_reply_to = f"<{reply_to_match.group(1)}>"

        # Create the inbound message
        message = Message(
            conversation_id=conversation.id,
            content=content,
            channel=MessageChannel.EMAIL,
            direction=MessageDirection.INBOUND,
            sender_name=sender_name,
            is_read=False,
            email_message_id=email_message_id,
            email_in_reply_to=email_in_reply_to,
            email_subject=subject or None,
            delivered_at=now,
        )
        db.add(message)

        # Update conversation
        conversation.last_message_at = now
        conversation.last_message_preview = content[:200] if content else None
        conversation.unread_count = (conversation.unread_count or 0) + 1

        # Mark as unread if it was resolved
        if conversation.status == ConversationStatus.RESOLVED:
            conversation.status = ConversationStatus.UNREAD

        await db.commit()

        return {
            "status": "success",
            "message_id": str(message.id),
            "conversation_id": str(conversation.id),
        }


@router.post("/inbound-email/test")
async def test_inbound_email_endpoint() -> dict:
    """
    Test endpoint to verify inbound email webhook is accessible.

    Returns a simple success response for health checking.
    """
    return {
        "status": "ok",
        "message": "Inbound email webhook is active",
    }


def _normalize_phone_number(phone: str) -> str:
    """
    Normalize phone number for comparison.

    Removes common formatting and ensures consistent format.
    """
    # Remove all non-digit characters except leading +
    digits = re.sub(r"[^\d+]", "", phone)

    # If it starts with +1, normalize to just digits without +
    if digits.startswith("+1"):
        digits = digits[2:]
    elif digits.startswith("+"):
        digits = digits[1:]
    elif digits.startswith("1") and len(digits) == 11:
        digits = digits[1:]

    return digits


@router.post("/inbound-sms")
async def receive_inbound_sms(
    From: str = Form(...),  # Sender's phone number
    To: str = Form(...),  # Our Twilio phone number
    Body: str = Form(""),  # Message content
    MessageSid: str = Form(""),  # Twilio message SID
    AccountSid: str = Form(""),  # Twilio account SID
    NumMedia: str = Form("0"),  # Number of media attachments
) -> dict:
    """
    Receive inbound SMS from Twilio.

    This webhook is called by Twilio when an SMS is received on
    the configured Twilio phone number.

    The sender's phone number is matched to existing conversations
    to route the message appropriately.
    """
    content = Body.strip()

    if not content:
        # Return TwiML with no response for empty messages
        return {"status": "ignored", "reason": "empty_content"}

    sender_phone = From
    normalized_sender = _normalize_phone_number(sender_phone)

    # Find conversation by client phone number
    async with get_db_context() as db:
        # Try to find an existing conversation with this phone number
        # We normalize both sides for matching
        query = select(Conversation).where(
            Conversation.client_phone.isnot(None)
        )
        result = await db.execute(query)
        conversations = result.scalars().all()

        # Find matching conversation by normalized phone
        matching_conversation = None
        for conv in conversations:
            if conv.client_phone:
                normalized_client = _normalize_phone_number(conv.client_phone)
                if normalized_client == normalized_sender:
                    matching_conversation = conv
                    break

        if not matching_conversation:
            # No existing conversation - we could create one, but for now just log
            return {
                "status": "ignored",
                "reason": "no_matching_conversation",
                "message": f"No conversation found for phone {sender_phone}",
            }

        now = datetime.now(timezone.utc)

        # Create the inbound message
        message = Message(
            conversation_id=matching_conversation.id,
            content=content,
            channel=MessageChannel.SMS,
            direction=MessageDirection.INBOUND,
            sender_name=matching_conversation.client_name,
            external_id=MessageSid,
            is_read=False,
            delivered_at=now,
        )
        db.add(message)

        # Update conversation
        matching_conversation.last_message_at = now
        matching_conversation.last_message_preview = content[:200] if content else None
        matching_conversation.unread_count = (matching_conversation.unread_count or 0) + 1

        # Mark as unread if it was resolved
        if matching_conversation.status == ConversationStatus.RESOLVED:
            matching_conversation.status = ConversationStatus.UNREAD

        await db.commit()

        return {
            "status": "success",
            "message_id": str(message.id),
            "conversation_id": str(matching_conversation.id),
        }


@router.post("/inbound-sms/test")
async def test_inbound_sms_endpoint() -> dict:
    """
    Test endpoint to verify inbound SMS webhook is accessible.

    Returns a simple success response for health checking.
    """
    return {
        "status": "ok",
        "message": "Inbound SMS webhook is active",
    }


@router.post("/stripe")
async def handle_stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="Stripe-Signature"),
) -> dict:
    """
    Handle Stripe webhook events.

    This endpoint receives events from Stripe, including:
    - checkout.session.completed: Payment was successful
    - payment_intent.succeeded: Payment intent completed

    The webhook signature is verified to ensure the request is from Stripe.
    """
    # Get raw body for signature verification
    payload = await request.body()

    # Verify the webhook signature
    event = stripe_service.construct_webhook_event(payload, stripe_signature or "")

    if event is None:
        # If Stripe is not configured or signature invalid, return 400
        if not stripe_service.is_configured:
            return {"status": "ignored", "reason": "stripe_not_configured"}
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature",
        )

    # Handle checkout.session.completed event
    if event.type == "checkout.session.completed":
        session = event.data.object

        # Extract booking info from session metadata
        payment_info = stripe_service.handle_payment_success(session)
        booking_request_id = payment_info.get("booking_request_id")
        payment_intent_id = payment_info.get("payment_intent_id")

        if not booking_request_id:
            return {
                "status": "ignored",
                "reason": "no_booking_request_id",
                "event_type": event.type,
            }

        # Update the booking status
        async with get_db_context() as db:
            try:
                booking_uuid = uuid.UUID(booking_request_id)
            except ValueError:
                return {
                    "status": "error",
                    "reason": "invalid_booking_request_id",
                }

            result = await db.execute(
                select(BookingRequest).where(
                    BookingRequest.id == booking_uuid,
                    BookingRequest.deleted_at.is_(None),
                )
            )
            booking = result.scalar_one_or_none()

            if not booking:
                return {
                    "status": "error",
                    "reason": "booking_not_found",
                    "booking_request_id": booking_request_id,
                }

            # Only update if still in DEPOSIT_REQUESTED status
            if booking.status == BookingRequestStatus.DEPOSIT_REQUESTED:
                booking.status = BookingRequestStatus.DEPOSIT_PAID
                booking.deposit_paid_at = datetime.now(timezone.utc)
                booking.deposit_stripe_payment_intent_id = payment_intent_id

                await db.commit()

                return {
                    "status": "success",
                    "event_type": event.type,
                    "booking_request_id": booking_request_id,
                    "new_status": "deposit_paid",
                }
            else:
                return {
                    "status": "ignored",
                    "reason": "booking_not_in_deposit_requested_status",
                    "current_status": booking.status.value,
                }

    # Return success for other event types (we don't need to process them)
    return {
        "status": "ignored",
        "reason": "unhandled_event_type",
        "event_type": event.type,
    }


@router.post("/stripe/test")
async def test_stripe_webhook_endpoint() -> dict:
    """
    Test endpoint to verify Stripe webhook is accessible.

    Returns a simple success response for health checking.
    """
    return {
        "status": "ok",
        "message": "Stripe webhook is active",
        "stripe_configured": stripe_service.is_configured,
    }
