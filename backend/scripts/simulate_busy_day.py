"""
Simulate a busy studio day with multiple concurrent activities.
Tests system behavior under realistic workload scenarios.
"""

import asyncio
import random
import secrets
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Add the backend directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, func

from app.database import async_session_maker, engine
from app.models.aftercare import AftercareSent, AftercareTemplate
from app.models.booking import BookingRequest, BookingRequestStatus, TattooSize
from app.models.commission import CommissionType, EarnedCommission
from app.models.consent import ConsentAuditAction, ConsentAuditLog, ConsentFormSubmission, ConsentFormTemplate
from app.models.message import Conversation, ConversationStatus, Message, MessageChannel, MessageDirection
from app.models.studio import Studio
from app.models.user import User, UserRole


async_session = async_session_maker

# Simulation data
CLIENT_NAMES = [
    "Alex Rivera", "Jordan Chen", "Taylor Kim", "Morgan Lee", "Casey Davis",
    "Riley Johnson", "Quinn Williams", "Jamie Brown", "Drew Martinez", "Avery Thompson",
    "Parker White", "Cameron Harris", "Reese Clark", "Skyler Lewis", "Charlie Young",
]

DESIGN_IDEAS = [
    "Traditional rose with geometric elements",
    "Japanese koi fish swimming upstream",
    "Minimalist botanical line work",
    "Blackwork mandala on forearm",
    "Watercolor hummingbird",
    "Neo-traditional wolf portrait",
    "Fine line constellation pattern",
    "Tribal sleeve continuation",
    "Realistic portrait of my dog",
    "Abstract expressionist piece",
    "Celtic knot armband",
    "Traditional sailor jerry anchor",
    "Surrealist landscape",
    "Quote in elegant script",
    "Day of the dead skull",
]

PLACEMENTS = [
    "Inner forearm", "Upper arm", "Shoulder", "Back", "Ribs",
    "Thigh", "Calf", "Ankle", "Wrist", "Behind ear",
]


async def simulate_busy_day() -> None:
    """Simulate a busy day at the studio."""
    print("=" * 60)
    print("InkFlow Busy Studio Day Simulation")
    print("=" * 60)
    print()

    async with async_session() as session:
        # Get studio and artists
        studio = (await session.execute(
            select(Studio).where(Studio.slug == "inkflow-main")
        )).scalar_one_or_none()

        if not studio:
            print("ERROR: Studio 'inkflow-main' not found. Run seed_data.py first!")
            return

        artists = (await session.execute(
            select(User).where(
                User.role == UserRole.ARTIST,
                User.email.like("%inkflow-main%")
            )
        )).scalars().all()

        if not artists:
            print("ERROR: No artists found. Run seed_data.py first!")
            return

        consent_template = (await session.execute(
            select(ConsentFormTemplate).where(
                ConsentFormTemplate.studio_id == studio.id,
                ConsentFormTemplate.is_active == True,
            )
        )).scalars().first()

        aftercare_template = (await session.execute(
            select(AftercareTemplate).where(
                AftercareTemplate.studio_id == studio.id,
                AftercareTemplate.is_active == True,
            )
        )).scalars().first()

        print(f"Studio: {studio.name}")
        print(f"Artists available: {len(artists)}")
        print()

        # Track metrics
        metrics = {
            "new_bookings": 0,
            "completed_sessions": 0,
            "consent_forms": 0,
            "aftercare_sent": 0,
            "messages": 0,
            "commissions": 0,
            "total_revenue": 0,
        }

        # Simulate morning rush - new booking requests
        print("=== MORNING: New Booking Requests ===")
        print()
        for i in range(5):
            client_name = random.choice(CLIENT_NAMES)
            design = random.choice(DESIGN_IDEAS)
            placement = random.choice(PLACEMENTS)
            size = random.choice(list(TattooSize))
            artist = random.choice(artists)

            booking = BookingRequest(
                studio_id=studio.id,
                client_name=client_name,
                client_email=f"busyday.{i}@example.com",
                client_phone=f"+1-555-{random.randint(1000, 9999)}",
                design_idea=design,
                placement=placement,
                size=size,
                is_cover_up=random.choice([True, False]),
                is_first_tattoo=random.choice([True, False]),
                color_preference=random.choice(["Black and grey", "Full color", "Minimal color"]),
                budget_range=random.choice(["$200-$400", "$400-$800", "$800-$1500"]),
                preferred_artist_id=artist.id,
                status=BookingRequestStatus.PENDING,
            )
            session.add(booking)
            await session.flush()

            # Create conversation
            conversation = Conversation(
                studio_id=studio.id,
                booking_request_id=booking.id,
                client_name=booking.client_name,
                client_email=booking.client_email,
                subject=f"Booking Request: {design[:30]}...",
                status=ConversationStatus.UNREAD,
                unread_count=1,
            )
            session.add(conversation)
            await session.flush()

            message = Message(
                conversation_id=conversation.id,
                channel=MessageChannel.INTERNAL,
                direction=MessageDirection.INBOUND,
                content=f"Hi! I'm interested in getting {design.lower()}. Looking forward to hearing from you!",
                is_read=False,
            )
            session.add(message)

            metrics["new_bookings"] += 1
            metrics["messages"] += 1
            print(f"  [{i+1}] New booking: {client_name} - {design[:35]}...")

        print()

        # Simulate mid-morning - artists reviewing and quoting
        print("=== MID-MORNING: Artist Reviews & Quotes ===")
        print()
        pending_bookings = (await session.execute(
            select(BookingRequest).where(
                BookingRequest.studio_id == studio.id,
                BookingRequest.status == BookingRequestStatus.PENDING,
            ).limit(8)
        )).scalars().all()

        for booking in pending_bookings[:3]:
            artist = random.choice(artists)
            booking.status = BookingRequestStatus.QUOTED
            booking.assigned_artist_id = artist.id
            booking.quoted_price = random.randint(30000, 150000)
            booking.deposit_amount = int(booking.quoted_price * 0.2)
            booking.estimated_hours = random.randint(2, 8)
            booking.quoted_at = datetime.now(timezone.utc)

            # Update conversation
            conv = (await session.execute(
                select(Conversation).where(Conversation.booking_request_id == booking.id)
            )).scalar_one_or_none()
            if conv:
                conv.assigned_to_id = artist.id
                conv.status = ConversationStatus.PENDING

                msg = Message(
                    conversation_id=conv.id,
                    channel=MessageChannel.INTERNAL,
                    direction=MessageDirection.OUTBOUND,
                    sender_id=artist.id,
                    sender_name=artist.full_name,
                    content=f"Thanks for reaching out! I'd love to work on this piece. Quote: ${booking.quoted_price/100:.2f}",
                    is_read=True,
                )
                session.add(msg)
                metrics["messages"] += 1

            print(f"  Quoted: {booking.client_name} - ${booking.quoted_price/100:.2f}")

        print()

        # Simulate afternoon - completed sessions
        print("=== AFTERNOON: Completed Sessions ===")
        print()
        confirmed_bookings = (await session.execute(
            select(BookingRequest).where(
                BookingRequest.studio_id == studio.id,
                BookingRequest.status.in_([
                    BookingRequestStatus.CONFIRMED,
                    BookingRequestStatus.DEPOSIT_PAID,
                ])
            ).limit(5)
        )).scalars().all()

        for booking in confirmed_bookings[:3]:
            booking.status = BookingRequestStatus.COMPLETED
            artist = (await session.execute(
                select(User).where(User.id == booking.assigned_artist_id)
            )).scalar_one_or_none()

            if not artist:
                artist = random.choice(artists)
                booking.assigned_artist_id = artist.id

            price = booking.quoted_price or random.randint(30000, 150000)
            tips = random.randint(2000, 10000)
            studio_rate = 40
            studio_commission = int(price * studio_rate / 100)
            artist_payout = price - studio_commission + tips

            commission = EarnedCommission(
                studio_id=studio.id,
                artist_id=artist.id,
                booking_request_id=booking.id,
                commission_rule_name="Standard Commission",
                commission_type=CommissionType.PERCENTAGE,
                service_total=price,
                studio_commission=studio_commission,
                artist_payout=artist_payout,
                tips_amount=tips,
                tip_artist_share=tips,
                tip_studio_share=0,
                calculation_details=f"Service: ${price/100:.2f}, Tip: ${tips/100:.2f}, Studio cut: ${studio_commission/100:.2f}",
                completed_at=datetime.now(timezone.utc),
            )
            session.add(commission)
            metrics["commissions"] += 1
            metrics["total_revenue"] += price
            metrics["completed_sessions"] += 1

            # Sign consent form
            if consent_template:
                consent = ConsentFormSubmission(
                    template_id=consent_template.id,
                    template_name=consent_template.name,
                    template_version=consent_template.version,
                    template_fields_snapshot=consent_template.fields,
                    studio_id=studio.id,
                    booking_request_id=booking.id,
                    client_name=booking.client_name,
                    client_email=booking.client_email,
                    responses={"all_fields": True},
                    signature_data="base64_signature_data",
                    signature_timestamp=datetime.now(timezone.utc),
                    submitted_at=datetime.now(timezone.utc),
                    access_token=secrets.token_urlsafe(32),
                    age_verified=True,
                    age_at_signing=random.randint(21, 55),
                )
                session.add(consent)
                await session.flush()
                metrics["consent_forms"] += 1

                audit = ConsentAuditLog(
                    submission_id=consent.id,
                    action=ConsentAuditAction.CREATED,
                    is_client_access=True,
                )
                session.add(audit)

            # Send aftercare
            if aftercare_template:
                aftercare = AftercareSent(
                    studio_id=studio.id,
                    booking_request_id=booking.id,
                    template_id=aftercare_template.id,
                    template_name=aftercare_template.name,
                    instructions_snapshot=aftercare_template.instructions_plain or "Standard aftercare",
                    artist_id=artist.id,
                    client_name=booking.client_name,
                    client_email=booking.client_email,
                    appointment_date=datetime.now(timezone.utc),
                    sent_via="email",
                    sent_at=datetime.now(timezone.utc),
                    access_token=secrets.token_urlsafe(32),
                )
                session.add(aftercare)
                metrics["aftercare_sent"] += 1

            print(f"  Completed: {booking.client_name} - ${price/100:.2f} (+ ${tips/100:.2f} tip)")

        print()

        # Simulate evening - follow-up messages
        print("=== EVENING: Follow-up Messages ===")
        print()
        active_conversations = (await session.execute(
            select(Conversation).where(
                Conversation.studio_id == studio.id,
                Conversation.status.in_([ConversationStatus.UNREAD, ConversationStatus.PENDING])
            ).limit(5)
        )).scalars().all()

        for conv in active_conversations[:3]:
            artist = random.choice(artists)
            msg = Message(
                conversation_id=conv.id,
                channel=MessageChannel.INTERNAL,
                direction=MessageDirection.OUTBOUND,
                sender_id=artist.id,
                sender_name=artist.full_name,
                content="Thanks for your patience! We'll get back to you soon with more details.",
                is_read=True,
            )
            session.add(msg)
            conv.unread_count = max(0, conv.unread_count - 1)
            metrics["messages"] += 1
            print(f"  Reply sent to: {conv.client_name}")

        print()

        # Commit all changes
        await session.commit()

        # Print summary
        print("=" * 60)
        print("Busy Day Simulation Complete!")
        print("=" * 60)
        print()
        print("Daily Metrics:")
        print(f"  New bookings:       {metrics['new_bookings']}")
        print(f"  Completed sessions: {metrics['completed_sessions']}")
        print(f"  Consent forms:      {metrics['consent_forms']}")
        print(f"  Aftercare sent:     {metrics['aftercare_sent']}")
        print(f"  Messages:           {metrics['messages']}")
        print(f"  Commissions:        {metrics['commissions']}")
        print(f"  Total revenue:      ${metrics['total_revenue']/100:.2f}")
        print()

        # Verify database state
        print("Database Verification:")
        total_bookings = (await session.execute(
            select(func.count(BookingRequest.id))
        )).scalar()
        total_messages = (await session.execute(
            select(func.count(Message.id))
        )).scalar()
        total_commissions = (await session.execute(
            select(func.count(EarnedCommission.id))
        )).scalar()

        print(f"  Total bookings in DB:    {total_bookings}")
        print(f"  Total messages in DB:    {total_messages}")
        print(f"  Total commissions in DB: {total_commissions}")
        print()
        print("All simulated operations completed successfully!")


async def main() -> None:
    """Main entry point."""
    await simulate_busy_day()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
