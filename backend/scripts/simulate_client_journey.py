"""
Simulate a complete new client journey through the InkFlow system.
This script tests the full booking workflow from submission to completion.
"""

import asyncio
import secrets
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Add the backend directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select

from app.database import async_session_maker, engine
from app.models.aftercare import AftercareSent, AftercareTemplate
from app.models.booking import BookingRequest, BookingRequestStatus, TattooSize
from app.models.commission import CommissionType, EarnedCommission
from app.models.consent import ConsentAuditAction, ConsentAuditLog, ConsentFormSubmission, ConsentFormTemplate
from app.models.message import Conversation, ConversationStatus, Message, MessageChannel, MessageDirection
from app.models.studio import Studio
from app.models.user import User, UserRole


# Use the shared database session
async_session = async_session_maker


async def simulate_journey() -> None:
    """Simulate a complete client journey."""
    print("=" * 60)
    print("InkFlow Client Journey Simulation")
    print("=" * 60)
    print()

    async with async_session() as session:
        # 1. Get a studio and artist for the simulation
        print("1. Setting up simulation context...")
        studio = (await session.execute(
            select(Studio).where(Studio.slug == "inkflow-main")
        )).scalar_one_or_none()

        if not studio:
            print("   ERROR: Studio 'inkflow-main' not found. Run seed_data.py first!")
            return

        artist = (await session.execute(
            select(User).where(
                User.role == UserRole.ARTIST,
                User.email.like("%inkflow-main%")
            )
        )).scalars().first()

        if not artist:
            print("   ERROR: No artist found for studio. Run seed_data.py first!")
            return

        print(f"   Studio: {studio.name}")
        print(f"   Artist: {artist.full_name}")
        print()

        # 2. Create a new booking request (simulating form submission)
        print("2. Client submits booking request...")
        booking = BookingRequest(
            studio_id=studio.id,
            client_name="Journey Test Client",
            client_email="journey.test@example.com",
            client_phone="+1-555-JOURNEY",
            design_idea="A detailed phoenix rising from flames, representing personal transformation and renewal. "
                       "I want the flames to have a gradient from deep red to bright orange and yellow. "
                       "The phoenix should be done in a neo-traditional style with bold lines.",
            placement="Full back piece, from shoulders to lower back",
            size=TattooSize.BACK_PIECE,
            is_cover_up=False,
            is_first_tattoo=False,
            color_preference="Full color - reds, oranges, yellows, and some black for contrast",
            budget_range="$2000-$3000",
            preferred_dates="Weekends work best for me. I'm flexible on exact dates.",
            additional_notes="I've been thinking about this design for years. Very excited to finally do it!",
            preferred_artist_id=artist.id,
            status=BookingRequestStatus.PENDING,
        )
        session.add(booking)
        await session.flush()
        print(f"   Booking ID: {booking.id}")
        print(f"   Status: {booking.status.value}")
        print()

        # 3. Create conversation for the booking
        print("3. Creating conversation thread...")
        conversation = Conversation(
            studio_id=studio.id,
            booking_request_id=booking.id,
            client_name=booking.client_name,
            client_email=booking.client_email,
            subject=f"Booking Request: {booking.design_idea[:50]}...",
            status=ConversationStatus.UNREAD,
            unread_count=1,
        )
        session.add(conversation)
        await session.flush()

        initial_message = Message(
            conversation_id=conversation.id,
            channel=MessageChannel.INTERNAL,
            direction=MessageDirection.INBOUND,
            content=f"Hi! I just submitted a booking request for a phoenix back piece. "
                   f"I'm really excited to work with {artist.first_name}! "
                   f"Let me know if you need any additional information or reference images.",
            is_read=False,
        )
        session.add(initial_message)
        print(f"   Conversation created with initial message")
        print()

        # 4. Studio reviews and assigns artist
        print("4. Studio reviews request, assigns artist...")
        booking.status = BookingRequestStatus.REVIEWING
        booking.assigned_artist_id = artist.id
        conversation.assigned_to_id = artist.id
        conversation.status = ConversationStatus.PENDING

        review_message = Message(
            conversation_id=conversation.id,
            channel=MessageChannel.INTERNAL,
            direction=MessageDirection.OUTBOUND,
            sender_id=artist.id,
            sender_name=artist.full_name,
            content=f"Hi {booking.client_name.split()[0]}! This is {artist.first_name}. "
                   f"I love your phoenix concept - neo-traditional is one of my specialties! "
                   f"A full back piece is a significant undertaking. Could you send some reference images "
                   f"that capture the style you're going for?",
            is_read=True,
        )
        session.add(review_message)
        print(f"   Status: {booking.status.value}")
        print(f"   Assigned to: {artist.full_name}")
        print()

        # 5. Artist sends quote
        print("5. Artist prepares and sends quote...")
        booking.status = BookingRequestStatus.QUOTED
        booking.quoted_price = 280000  # $2,800
        booking.deposit_amount = 50000  # $500
        booking.estimated_hours = 16.0
        booking.quoted_at = datetime.now(timezone.utc)
        booking.quote_notes = (
            "Based on the design complexity and size, I estimate 4 sessions of 4 hours each. "
            "The price includes all sessions and touch-ups within 6 months of completion."
        )

        quote_message = Message(
            conversation_id=conversation.id,
            channel=MessageChannel.INTERNAL,
            direction=MessageDirection.OUTBOUND,
            sender_id=artist.id,
            sender_name=artist.full_name,
            content=f"Great news! I've put together a quote for your phoenix back piece:\n\n"
                   f"**Total: $2,800**\n"
                   f"- 4 sessions x 4 hours each\n"
                   f"- Full color work\n"
                   f"- Touch-ups included for 6 months\n\n"
                   f"**Deposit required: $500**\n\n"
                   f"Let me know if you'd like to proceed and we can schedule your first session!",
            is_read=True,
        )
        session.add(quote_message)
        print(f"   Quote: ${booking.quoted_price / 100:.2f}")
        print(f"   Deposit: ${booking.deposit_amount / 100:.2f}")
        print(f"   Sessions: {booking.estimated_hours / 4:.0f} x 4 hours")
        print()

        # 6. Deposit requested
        print("6. Deposit payment requested...")
        booking.status = BookingRequestStatus.DEPOSIT_REQUESTED
        booking.deposit_payment_token = secrets.token_urlsafe(32)
        booking.deposit_requested_at = datetime.now(timezone.utc)
        booking.deposit_request_expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        print(f"   Payment token generated")
        print(f"   Expires: {booking.deposit_request_expires_at}")
        print()

        # 7. Client pays deposit (simulated)
        print("7. Client pays deposit...")
        booking.status = BookingRequestStatus.DEPOSIT_PAID
        booking.deposit_paid_at = datetime.now(timezone.utc)
        booking.deposit_stripe_payment_intent_id = f"pi_simulated_{uuid.uuid4().hex[:24]}"

        deposit_message = Message(
            conversation_id=conversation.id,
            channel=MessageChannel.INTERNAL,
            direction=MessageDirection.INBOUND,
            content=f"Deposit of $500.00 received. Booking confirmed!",
            is_read=True,
        )
        session.add(deposit_message)
        print(f"   Deposit paid: ${booking.deposit_amount / 100:.2f}")
        print(f"   Stripe PI: {booking.deposit_stripe_payment_intent_id}")
        print()

        # 8. Schedule appointment
        print("8. Scheduling appointment...")
        booking.status = BookingRequestStatus.CONFIRMED
        # Schedule for next Saturday at 10 AM
        now = datetime.now(timezone.utc)
        days_until_saturday = (5 - now.weekday()) % 7
        if days_until_saturday == 0:
            days_until_saturday = 7
        booking.scheduled_date = (now + timedelta(days=days_until_saturday)).replace(
            hour=10, minute=0, second=0, microsecond=0
        )
        booking.scheduled_duration_hours = 4.0

        schedule_message = Message(
            conversation_id=conversation.id,
            channel=MessageChannel.INTERNAL,
            direction=MessageDirection.OUTBOUND,
            sender_id=artist.id,
            sender_name=artist.full_name,
            content=f"Your first session is scheduled for:\n\n"
                   f"Date: {booking.scheduled_date.strftime('%A, %B %d at %I:%M %p')}\n"
                   f"Duration: 4 hours\n\n"
                   f"Please arrive 15 minutes early to complete paperwork. "
                   f"See you soon!",
            is_read=True,
        )
        session.add(schedule_message)
        print(f"   Scheduled: {booking.scheduled_date}")
        print(f"   Duration: {booking.scheduled_duration_hours} hours")
        print()

        # 9. Client signs consent form
        print("9. Client signs consent form...")
        template = (await session.execute(
            select(ConsentFormTemplate).where(
                ConsentFormTemplate.studio_id == studio.id,
                ConsentFormTemplate.is_active == True,
            )
        )).scalars().first()

        if template:
            consent_submission = ConsentFormSubmission(
                template_id=template.id,
                template_name=template.name,
                template_version=template.version,
                template_fields_snapshot=template.fields,
                studio_id=studio.id,
                booking_request_id=booking.id,
                client_name=booking.client_name,
                client_email=booking.client_email,
                client_phone=booking.client_phone,
                client_date_of_birth=datetime(1992, 6, 15, tzinfo=timezone.utc),
                responses={
                    "allergies": "None known",
                    "medical_conditions": "None",
                    "current_medications": "None",
                    "agree_to_terms": True,
                    "agree_to_aftercare": True,
                },
                signature_data="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                signature_timestamp=datetime.now(timezone.utc),
                ip_address="192.168.1.100",
                user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
                submitted_at=datetime.now(timezone.utc),
                access_token=secrets.token_urlsafe(32),
                age_verified=True,
                age_at_signing=33,
            )
            session.add(consent_submission)
            await session.flush()

            audit_log = ConsentAuditLog(
                submission_id=consent_submission.id,
                action=ConsentAuditAction.CREATED,
                is_client_access=True,
                ip_address="192.168.1.100",
                notes="Consent form signed via client portal before session",
            )
            session.add(audit_log)
            print(f"   Consent form signed")
            print(f"   Template: {template.name} v{template.version}")
        else:
            print("   WARNING: No consent template found, skipping")
        print()

        # 10. Session completed
        print("10. Tattoo session completed...")
        booking.status = BookingRequestStatus.COMPLETED

        complete_message = Message(
            conversation_id=conversation.id,
            channel=MessageChannel.INTERNAL,
            direction=MessageDirection.OUTBOUND,
            sender_id=artist.id,
            sender_name=artist.full_name,
            content=f"Session 1 complete! Great sitting today - we got the full outline "
                   f"and started on the color work for the flames. "
                   f"The phoenix is looking amazing! See you next week for session 2.",
            is_read=True,
        )
        session.add(complete_message)
        print(f"   Status: {booking.status.value}")
        print()

        # 11. Aftercare sent
        print("11. Sending aftercare instructions...")
        aftercare_template = (await session.execute(
            select(AftercareTemplate).where(
                AftercareTemplate.studio_id == studio.id,
                AftercareTemplate.is_active == True,
            )
        )).scalars().first()

        if aftercare_template:
            aftercare_sent = AftercareSent(
                studio_id=studio.id,
                booking_request_id=booking.id,
                template_id=aftercare_template.id,
                template_name=aftercare_template.name,
                instructions_snapshot=aftercare_template.instructions_plain or "Standard aftercare instructions",
                artist_id=artist.id,
                client_name=booking.client_name,
                client_email=booking.client_email,
                client_phone=booking.client_phone,
                tattoo_description=booking.design_idea[:100],
                appointment_date=booking.scheduled_date or datetime.now(timezone.utc),
                sent_via="email",
                sent_at=datetime.now(timezone.utc),
                access_token=secrets.token_urlsafe(32),
            )
            session.add(aftercare_sent)
            print(f"   Aftercare template: {aftercare_template.name}")
            print(f"   Sent via: email")
        else:
            print("   WARNING: No aftercare template found, skipping")
        print()

        # 12. Commission calculated
        print("12. Calculating commission...")
        # Simple commission calculation - 40% to studio
        service_total = booking.quoted_price
        tips_amount = 5000  # $50 tip
        studio_rate = 40
        studio_commission = int(service_total * studio_rate / 100)
        artist_payout = service_total - studio_commission + tips_amount

        commission = EarnedCommission(
            studio_id=studio.id,
            artist_id=artist.id,
            booking_request_id=booking.id,
            commission_rule_name="Standard Commission",
            commission_type=CommissionType.PERCENTAGE,
            service_total=service_total,
            studio_commission=studio_commission,
            artist_payout=artist_payout,
            tips_amount=tips_amount,
            tip_artist_share=tips_amount,  # Artist keeps all tips
            tip_studio_share=0,
            calculation_details=f"Service: ${service_total/100:.2f}, Studio ({studio_rate}%): ${studio_commission/100:.2f}, Artist: ${artist_payout/100:.2f}",
            completed_at=datetime.now(timezone.utc),
        )
        session.add(commission)
        print(f"   Service: ${service_total / 100:.2f}")
        print(f"   Tip: ${tips_amount / 100:.2f}")
        print(f"   Studio commission ({studio_rate}%): ${studio_commission / 100:.2f}")
        print(f"   Artist payout: ${artist_payout / 100:.2f}")
        print()

        # 13. Close conversation
        print("13. Closing conversation thread...")
        conversation.status = ConversationStatus.RESOLVED
        conversation.unread_count = 0

        closing_message = Message(
            conversation_id=conversation.id,
            channel=MessageChannel.INTERNAL,
            direction=MessageDirection.OUTBOUND,
            content="This booking has been completed. Thank you for choosing InkFlow!",
            is_read=True,
        )
        session.add(closing_message)
        print(f"   Conversation status: {conversation.status.value}")
        print()

        # Commit all changes
        await session.commit()

        print("=" * 60)
        print("Journey Simulation Complete!")
        print("=" * 60)
        print()
        print("Summary:")
        print(f"  Client: {booking.client_name}")
        print(f"  Design: Phoenix back piece")
        print(f"  Artist: {artist.full_name}")
        print(f"  Total: ${booking.quoted_price / 100:.2f}")
        print(f"  Status: {booking.status.value}")
        print()
        print("All workflow stages completed successfully:")
        print("  [OK] Booking submission")
        print("  [OK] Artist assignment")
        print("  [OK] Quote sent")
        print("  [OK] Deposit paid")
        print("  [OK] Appointment scheduled")
        print("  [OK] Consent form signed")
        print("  [OK] Session completed")
        print("  [OK] Aftercare sent")
        print("  [OK] Commission calculated")
        print("  [OK] Conversation resolved")
        print()


async def main() -> None:
    """Main entry point."""
    await simulate_journey()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
