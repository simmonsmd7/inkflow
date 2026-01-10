#!/usr/bin/env python3
"""
Seed script for InkFlow - creates realistic test data for stress testing.

Run with: python -m scripts.seed_data

Creates:
- 2 studios (main studio + satellite location)
- 1 owner, 4 artists, 1 receptionist per studio
- 50+ clients with varied booking histories
- 100+ bookings across all statuses
- Commission rules and calculated payouts
- Consent form templates and signed submissions
- Aftercare templates and sent instructions
- Message conversations with varied statuses
"""

import asyncio
import random
import secrets
import sys
from datetime import datetime, time, timedelta
from pathlib import Path
from uuid import UUID, uuid4

# Add the backend directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from passlib.context import CryptContext
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker, engine, Base
from app.models.user import User, UserRole
from app.models.studio import Studio
from app.models.artist import ArtistProfile, PortfolioImage
from app.models.client import Client
from app.models.booking import BookingRequest, BookingRequestStatus, TattooSize, BookingReferenceImage
from app.models.commission import (
    CommissionRule, CommissionType, CommissionTier, EarnedCommission,
    PayPeriod, PayPeriodStatus, TipPaymentMethod
)
from app.models.consent import ConsentFormTemplate, ConsentFormSubmission, ConsentAuditLog, ConsentAuditAction
from app.models.aftercare import (
    AftercareTemplate, AftercareSent, AftercareSentStatus, AftercareFollowUp,
    FollowUpType, FollowUpStatus, TattooType, TattooPlacement
)
from app.models.message import Conversation, Message, ConversationStatus, MessageChannel, MessageDirection, ReplyTemplate
from app.models.availability import ArtistAvailability

# Password hashing
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

# Default password for all test users
DEFAULT_PASSWORD = "TestPass123!"
HASHED_PASSWORD = None  # Will be set at runtime

# Sample data
FIRST_NAMES = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Quinn", "Sage", "Rowan", "Blake",
               "Jamie", "Drew", "Cameron", "Avery", "Skyler", "Reese", "Parker", "Emery", "Finley", "Hayden",
               "Jesse", "Dakota", "River", "Phoenix", "Eden", "Kai", "Nova", "Raven", "Storm", "Winter"]

LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
              "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
              "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson"]

ARTIST_SPECIALTIES = [
    ["Traditional", "Neo-Traditional", "Color"],
    ["Blackwork", "Geometric", "Dotwork"],
    ["Realism", "Portrait", "Black and Grey"],
    ["Japanese", "Irezumi", "Color"],
    ["Fine Line", "Minimalist", "Script"],
    ["Watercolor", "Abstract", "Color"],
    ["Tribal", "Polynesian", "Blackwork"],
    ["Biomechanical", "Horror", "Dark Art"],
]

DESIGN_IDEAS = [
    "Floral sleeve with roses and peonies",
    "Mountain landscape with pine trees",
    "Geometric wolf portrait",
    "Japanese koi fish with cherry blossoms",
    "Traditional sailor anchor",
    "Realistic lion portrait",
    "Minimalist constellation design",
    "Abstract watercolor butterfly",
    "Celtic knot band",
    "Skull with flowers",
    "Phoenix rising from flames",
    "Mandala design",
    "Quote in script font",
    "Compass with coordinates",
    "Family crest design",
    "Memorial portrait",
    "Cover-up for existing tattoo",
    "Matching couple tattoos",
    "Birth flower bouquet",
    "Biomech sleeve design",
]

PLACEMENTS = ["Upper Arm", "Forearm", "Shoulder", "Back", "Chest", "Ribs", "Thigh", "Calf", "Wrist", "Ankle",
              "Neck", "Hand", "Finger", "Hip", "Stomach", "Foot"]

QUOTE_NOTES = [
    "Great design! Looking forward to working on this piece.",
    "This will require multiple sessions. Deposit secures first session.",
    "Complex design - price reflects detail work required.",
    "Includes custom design time.",
    "Touch-up included if needed within 6 weeks.",
]


async def clear_existing_data(session: AsyncSession) -> None:
    """Clear all existing data from the database."""
    print("Clearing existing data...")

    # Delete in order of dependencies
    tables = [
        "healing_issue_reports",
        "aftercare_follow_ups",
        "aftercare_sent",
        "aftercare_templates",
        "consent_audit_logs",
        "consent_form_submissions",
        "consent_form_templates",
        "earned_commissions",
        "pay_periods",
        "commission_tiers",
        "commission_rules",
        "messages",
        "conversations",
        "reply_templates",
        "booking_reference_images",
        "booking_requests",
        "artist_availability",
        "artist_time_off",
        "portfolio_images",
        "artist_profiles",
        "clients",
        "studios",
        "users",
    ]

    for table in tables:
        try:
            await session.execute(text(f"DELETE FROM {table}"))
        except Exception as e:
            print(f"  Warning: Could not clear {table}: {e}")

    await session.commit()
    print("  Done clearing data.")


async def create_users(session: AsyncSession) -> dict[str, list[User]]:
    """Create staff users for both studios."""
    print("Creating users...")
    users = {"studio1": [], "studio2": []}

    # Studio 1 users
    owner1 = User(
        email="owner@inkflow-main.com",
        hashed_password=HASHED_PASSWORD,
        first_name="Marcus",
        last_name="Rivera",
        phone="+1-555-0101",
        role=UserRole.OWNER,
        is_active=True,
        is_verified=True,
    )
    session.add(owner1)
    users["studio1"].append(owner1)

    # Artists for studio 1
    for i in range(4):
        artist = User(
            email=f"artist{i+1}@inkflow-main.com",
            hashed_password=HASHED_PASSWORD,
            first_name=random.choice(FIRST_NAMES),
            last_name=random.choice(LAST_NAMES),
            phone=f"+1-555-01{10+i:02d}",
            role=UserRole.ARTIST,
            is_active=True,
            is_verified=True,
        )
        session.add(artist)
        users["studio1"].append(artist)

    # Receptionist for studio 1
    receptionist1 = User(
        email="reception@inkflow-main.com",
        hashed_password=HASHED_PASSWORD,
        first_name="Sofia",
        last_name="Chen",
        phone="+1-555-0150",
        role=UserRole.RECEPTIONIST,
        is_active=True,
        is_verified=True,
    )
    session.add(receptionist1)
    users["studio1"].append(receptionist1)

    # Studio 2 users
    owner2 = User(
        email="owner@inkflow-satellite.com",
        hashed_password=HASHED_PASSWORD,
        first_name="Elena",
        last_name="Kowalski",
        phone="+1-555-0201",
        role=UserRole.OWNER,
        is_active=True,
        is_verified=True,
    )
    session.add(owner2)
    users["studio2"].append(owner2)

    # Artists for studio 2
    for i in range(4):
        artist = User(
            email=f"artist{i+1}@inkflow-satellite.com",
            hashed_password=HASHED_PASSWORD,
            first_name=random.choice(FIRST_NAMES),
            last_name=random.choice(LAST_NAMES),
            phone=f"+1-555-02{10+i:02d}",
            role=UserRole.ARTIST,
            is_active=True,
            is_verified=True,
        )
        session.add(artist)
        users["studio2"].append(artist)

    # Receptionist for studio 2
    receptionist2 = User(
        email="reception@inkflow-satellite.com",
        hashed_password=HASHED_PASSWORD,
        first_name="Diego",
        last_name="Santos",
        phone="+1-555-0250",
        role=UserRole.RECEPTIONIST,
        is_active=True,
        is_verified=True,
    )
    session.add(receptionist2)
    users["studio2"].append(receptionist2)

    await session.flush()
    print(f"  Created {sum(len(u) for u in users.values())} users")
    return users


async def create_studios(session: AsyncSession, users: dict[str, list[User]]) -> dict[str, Studio]:
    """Create the two studios."""
    print("Creating studios...")

    business_hours = {
        "monday": {"open": "11:00", "close": "20:00", "closed": False},
        "tuesday": {"open": "11:00", "close": "20:00", "closed": False},
        "wednesday": {"open": "11:00", "close": "20:00", "closed": False},
        "thursday": {"open": "11:00", "close": "21:00", "closed": False},
        "friday": {"open": "11:00", "close": "21:00", "closed": False},
        "saturday": {"open": "10:00", "close": "18:00", "closed": False},
        "sunday": {"open": "12:00", "close": "17:00", "closed": False},
    }

    studio1 = Studio(
        name="InkFlow Main Studio",
        slug="inkflow-main",
        description="Premier tattoo studio in downtown. Specializing in custom work across all styles.",
        email="contact@inkflow-main.com",
        phone="+1-555-0100",
        website="https://inkflow-main.com",
        address_line1="123 Main Street",
        address_line2="Suite 100",
        city="Brooklyn",
        state="NY",
        postal_code="11201",
        country="US",
        timezone="America/New_York",
        business_hours=business_hours,
        owner_id=users["studio1"][0].id,
    )
    session.add(studio1)

    studio2 = Studio(
        name="InkFlow Satellite",
        slug="inkflow-satellite",
        description="Our satellite location bringing quality ink to the suburbs.",
        email="contact@inkflow-satellite.com",
        phone="+1-555-0200",
        website="https://inkflow-satellite.com",
        address_line1="456 Oak Avenue",
        city="Jersey City",
        state="NJ",
        postal_code="07302",
        country="US",
        timezone="America/New_York",
        business_hours=business_hours,
        owner_id=users["studio2"][0].id,
    )
    session.add(studio2)

    await session.flush()
    print(f"  Created 2 studios")
    return {"studio1": studio1, "studio2": studio2}


async def create_artist_profiles(session: AsyncSession, users: dict[str, list[User]]) -> None:
    """Create artist profiles with bios and specialties."""
    print("Creating artist profiles...")
    profiles_data = []

    for studio_key, user_list in users.items():
        # Skip owner (index 0) and receptionist (last)
        artists = [u for u in user_list if u.role == UserRole.ARTIST]

        for i, artist in enumerate(artists):
            specialties = random.choice(ARTIST_SPECIALTIES)
            profile = ArtistProfile(
                user_id=artist.id,
                bio=f"Passionate tattoo artist with {random.randint(3, 15)} years of experience. "
                    f"Specializing in {', '.join(specialties)}. "
                    f"Every piece is a unique collaboration with the client.",
                specialties=specialties,
                years_experience=random.randint(3, 15),
                hourly_rate=random.choice([15000, 17500, 20000, 22500, 25000]),  # $150-$250/hr in cents
                minimum_booking_hours=random.choice([2, 3, 4]),
                instagram_handle=f"@{artist.first_name.lower()}_ink",
            )
            session.add(profile)
            profiles_data.append((profile, artist, specialties))

    # Flush to get profile IDs
    await session.flush()

    # Now add portfolio images with valid profile IDs
    for profile, artist, specialties in profiles_data:
        for j in range(random.randint(3, 8)):
            img = PortfolioImage(
                artist_profile_id=profile.id,
                image_url=f"https://placeholder.com/portfolio/{artist.id}/{j}.jpg",
                title=f"Portfolio piece {j+1}",
                style=random.choice(specialties),
                placement=random.choice(PLACEMENTS),
                display_order=j,
            )
            session.add(img)

    await session.flush()
    print(f"  Created {len(profiles_data)} artist profiles with portfolio images")


async def create_availability(session: AsyncSession, users: dict[str, list[User]]) -> None:
    """Create availability slots for artists."""
    print("Creating artist availability...")
    count = 0

    days = [0, 1, 2, 3, 4, 5, 6]  # Monday through Sunday

    for studio_key, user_list in users.items():
        artists = [u for u in user_list if u.role == UserRole.ARTIST]

        for artist in artists:
            # Each artist works 5-6 days a week
            work_days = random.sample(days, random.randint(5, 6))

            for day in work_days:
                # Morning or afternoon start
                if day in [5, 6]:  # Weekend
                    start_hour = random.choice([10, 11, 12])
                    end_hour = random.choice([17, 18, 19])
                else:
                    start_hour = random.choice([10, 11, 12])
                    end_hour = random.choice([19, 20, 21])

                avail = ArtistAvailability(
                    user_id=artist.id,
                    day_of_week=day,
                    start_time=time(start_hour, 0),
                    end_time=time(end_hour, 0),
                    is_available=True,
                )
                session.add(avail)
                count += 1

    await session.flush()
    print(f"  Created {count} availability slots")


async def create_clients(session: AsyncSession, studios: dict[str, Studio]) -> list[Client]:
    """Create client accounts."""
    print("Creating clients...")
    clients = []

    for i in range(60):
        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)

        client = Client(
            email=f"client{i+1}@example.com",
            first_name=first_name,
            last_name=last_name,
            phone=f"+1-555-{random.randint(1000, 9999)}",
            password_hash=HASHED_PASSWORD,
            is_active=True,
            is_verified=random.choice([True, True, True, False]),  # 75% verified
            primary_studio_id=random.choice(list(studios.values())).id,
            date_of_birth=datetime.utcnow() - timedelta(days=random.randint(18*365, 55*365)),
        )
        session.add(client)
        clients.append(client)

    await session.flush()
    print(f"  Created {len(clients)} clients")
    return clients


async def create_commission_rules(
    session: AsyncSession,
    studios: dict[str, Studio],
    users: dict[str, list[User]]
) -> dict[str, list[CommissionRule]]:
    """Create commission rules for each studio."""
    print("Creating commission rules...")
    rules = {"studio1": [], "studio2": []}

    for studio_key, studio in studios.items():
        owner = users[studio_key][0]

        # Standard percentage rule
        standard = CommissionRule(
            name="Standard 60/40",
            description="Artist receives 60% of service total",
            commission_type=CommissionType.PERCENTAGE,
            percentage=60.0,
            is_default=True,
            is_active=True,
            studio_id=studio.id,
            created_by_id=owner.id,
        )
        session.add(standard)
        rules[studio_key].append(standard)

        # Senior artist rule
        senior = CommissionRule(
            name="Senior Artist 70/30",
            description="Senior artists receive 70% of service total",
            commission_type=CommissionType.PERCENTAGE,
            percentage=70.0,
            is_default=False,
            is_active=True,
            studio_id=studio.id,
            created_by_id=owner.id,
        )
        session.add(senior)
        rules[studio_key].append(senior)

        # Flat fee rule
        flat = CommissionRule(
            name="Flat Fee $100",
            description="Studio takes $100 flat fee per session",
            commission_type=CommissionType.FLAT_FEE,
            flat_fee_amount=10000,  # $100 in cents
            is_default=False,
            is_active=True,
            studio_id=studio.id,
            created_by_id=owner.id,
        )
        session.add(flat)
        rules[studio_key].append(flat)

    await session.flush()

    # Assign rules to artists
    for studio_key, user_list in users.items():
        artists = [u for u in user_list if u.role == UserRole.ARTIST]
        for i, artist in enumerate(artists):
            # First artist gets senior rate, others get standard
            if i == 0:
                artist.commission_rule_id = rules[studio_key][1].id  # Senior
            else:
                artist.commission_rule_id = rules[studio_key][0].id  # Standard

    await session.flush()
    print(f"  Created {sum(len(r) for r in rules.values())} commission rules")
    return rules


async def create_bookings(
    session: AsyncSession,
    studios: dict[str, Studio],
    users: dict[str, list[User]],
    clients: list[Client],
) -> list[BookingRequest]:
    """Create booking requests across all statuses."""
    print("Creating bookings...")
    bookings = []

    # Status distribution for realistic data
    status_weights = [
        (BookingRequestStatus.PENDING, 8),
        (BookingRequestStatus.REVIEWING, 5),
        (BookingRequestStatus.QUOTED, 10),
        (BookingRequestStatus.DEPOSIT_REQUESTED, 8),
        (BookingRequestStatus.DEPOSIT_PAID, 12),
        (BookingRequestStatus.CONFIRMED, 20),
        (BookingRequestStatus.COMPLETED, 30),
        (BookingRequestStatus.NO_SHOW, 3),
        (BookingRequestStatus.REJECTED, 2),
        (BookingRequestStatus.CANCELLED, 7),
    ]
    statuses = []
    for status, weight in status_weights:
        statuses.extend([status] * weight)

    for i in range(120):
        studio_key = random.choice(["studio1", "studio2"])
        studio = studios[studio_key]
        artists = [u for u in users[studio_key] if u.role == UserRole.ARTIST]
        client = random.choice(clients)
        status = random.choice(statuses)

        # Timestamps based on status
        created_days_ago = random.randint(1, 90)
        created_at = datetime.utcnow() - timedelta(days=created_days_ago)

        booking = BookingRequest(
            client_name=client.full_name,
            client_email=client.email,
            client_phone=client.phone,
            design_idea=random.choice(DESIGN_IDEAS),
            placement=random.choice(PLACEMENTS),
            size=random.choice(list(TattooSize)),
            is_cover_up=random.random() < 0.15,
            is_first_tattoo=random.random() < 0.25,
            color_preference=random.choice(["Color", "Black and Grey", "No preference"]),
            budget_range=random.choice(["$200-500", "$500-1000", "$1000-2000", "$2000+"]),
            studio_id=studio.id,
            preferred_artist_id=random.choice(artists).id if random.random() > 0.3 else None,
            status=status,
            created_at=created_at,
        )

        # Add quote info for quoted+ statuses
        if status not in [BookingRequestStatus.PENDING, BookingRequestStatus.REVIEWING, BookingRequestStatus.REJECTED]:
            booking.quoted_price = random.choice([25000, 35000, 50000, 75000, 100000, 150000])
            booking.deposit_amount = int(booking.quoted_price * 0.3)
            booking.estimated_hours = random.choice([2.0, 3.0, 4.0, 5.0, 6.0, 8.0])
            booking.quote_notes = random.choice(QUOTE_NOTES)
            booking.quoted_at = created_at + timedelta(hours=random.randint(4, 48))
            booking.assigned_artist_id = booking.preferred_artist_id or random.choice(artists).id

        # Add deposit info for deposit_paid+ statuses
        if status in [BookingRequestStatus.DEPOSIT_PAID, BookingRequestStatus.CONFIRMED,
                      BookingRequestStatus.COMPLETED, BookingRequestStatus.NO_SHOW]:
            booking.deposit_payment_token = secrets.token_urlsafe(32)
            booking.deposit_requested_at = booking.quoted_at + timedelta(hours=1)
            booking.deposit_paid_at = booking.deposit_requested_at + timedelta(hours=random.randint(1, 72))
            booking.deposit_stripe_payment_intent_id = f"pi_test_{secrets.token_hex(12)}"

        # Add scheduling for confirmed+ statuses
        if status in [BookingRequestStatus.CONFIRMED, BookingRequestStatus.COMPLETED, BookingRequestStatus.NO_SHOW]:
            # Schedule for future or past depending on status
            if status == BookingRequestStatus.CONFIRMED:
                days_ahead = random.randint(1, 30)
                booking.scheduled_date = datetime.utcnow() + timedelta(days=days_ahead)
            else:
                days_ago = random.randint(1, 60)
                booking.scheduled_date = datetime.utcnow() - timedelta(days=days_ago)
            booking.scheduled_duration_hours = booking.estimated_hours

        # Handle cancellations
        if status == BookingRequestStatus.CANCELLED:
            booking.cancelled_at = created_at + timedelta(days=random.randint(1, 7))
            booking.cancelled_by = random.choice(["client", "artist", "studio"])
            booking.cancellation_reason = random.choice([
                "Schedule conflict",
                "Changed mind about design",
                "Financial reasons",
                "Found another artist",
                "Personal emergency",
            ])
            booking.deposit_forfeited = random.random() < 0.3

        # Handle no-shows
        if status == BookingRequestStatus.NO_SHOW:
            booking.no_show_at = booking.scheduled_date + timedelta(hours=1)
            booking.no_show_marked_by_id = booking.assigned_artist_id
            booking.deposit_forfeited = True

        session.add(booking)
        bookings.append(booking)

    await session.flush()
    print(f"  Created {len(bookings)} bookings")
    return bookings


async def create_earned_commissions(
    session: AsyncSession,
    studios: dict[str, Studio],
    users: dict[str, list[User]],
    bookings: list[BookingRequest],
    rules: dict[str, list[CommissionRule]],
) -> list[EarnedCommission]:
    """Create earned commissions for completed bookings."""
    print("Creating earned commissions...")
    commissions = []

    completed_bookings = [b for b in bookings if b.status == BookingRequestStatus.COMPLETED]

    for booking in completed_bookings:
        if not booking.assigned_artist_id or not booking.quoted_price:
            continue

        # Find the studio key and rule
        studio_key = "studio1" if booking.studio_id == studios["studio1"].id else "studio2"
        rule = rules[studio_key][0]  # Use default rule

        # Calculate commission
        service_total = booking.quoted_price
        if rule.commission_type == CommissionType.PERCENTAGE:
            artist_payout = int(service_total * (rule.percentage / 100))
        else:
            artist_payout = service_total - rule.flat_fee_amount
        studio_commission = service_total - artist_payout

        # Random tips
        tips = random.choice([0, 0, 0, 2000, 3000, 5000, 7500, 10000])

        commission = EarnedCommission(
            booking_request_id=booking.id,
            artist_id=booking.assigned_artist_id,
            studio_id=booking.studio_id,
            commission_rule_id=rule.id,
            commission_rule_name=rule.name,
            commission_type=rule.commission_type,
            service_total=service_total,
            studio_commission=studio_commission,
            artist_payout=artist_payout,
            tips_amount=tips,
            tip_payment_method=TipPaymentMethod.CARD if tips > 0 else None,
            tip_artist_share=tips,
            tip_studio_share=0,
            calculation_details=f"{rule.name}: {rule.percentage}% to artist",
            completed_at=booking.scheduled_date,
        )
        session.add(commission)
        commissions.append(commission)

    await session.flush()
    print(f"  Created {len(commissions)} earned commissions")
    return commissions


async def create_pay_periods(
    session: AsyncSession,
    studios: dict[str, Studio],
    commissions: list[EarnedCommission],
) -> list[PayPeriod]:
    """Create pay periods and assign commissions."""
    print("Creating pay periods...")
    pay_periods = []

    for studio_key, studio in studios.items():
        studio_commissions = [c for c in commissions if c.studio_id == studio.id]

        # Create past pay periods
        for i in range(4):  # Last 4 pay periods
            start = datetime.utcnow() - timedelta(days=14 * (i + 1))
            end = start + timedelta(days=14)

            period = PayPeriod(
                studio_id=studio.id,
                start_date=start,
                end_date=end,
                status=PayPeriodStatus.PAID if i > 0 else PayPeriodStatus.CLOSED,
                paid_at=end + timedelta(days=2) if i > 0 else None,
            )
            session.add(period)
            await session.flush()

            # Assign some commissions to this period
            period_commissions = [
                c for c in studio_commissions
                if c.completed_at and start <= c.completed_at <= end
            ]
            for comm in period_commissions:
                comm.pay_period_id = period.id

            # Update period totals
            period.total_service = sum(c.service_total for c in period_commissions)
            period.total_studio_commission = sum(c.studio_commission for c in period_commissions)
            period.total_artist_payout = sum(c.artist_payout for c in period_commissions)
            period.total_tips = sum(c.tips_amount for c in period_commissions)
            period.commission_count = len(period_commissions)

            pay_periods.append(period)

        # Create current open pay period
        current = PayPeriod(
            studio_id=studio.id,
            start_date=datetime.utcnow() - timedelta(days=7),
            end_date=datetime.utcnow() + timedelta(days=7),
            status=PayPeriodStatus.OPEN,
        )
        session.add(current)
        pay_periods.append(current)

    await session.flush()
    print(f"  Created {len(pay_periods)} pay periods")
    return pay_periods


async def create_consent_templates(
    session: AsyncSession,
    studios: dict[str, Studio],
    users: dict[str, list[User]],
) -> dict[str, ConsentFormTemplate]:
    """Create consent form templates."""
    print("Creating consent form templates...")
    templates = {}

    default_fields = [
        {"id": str(uuid4()), "type": "heading", "label": "Client Information", "order": 0, "content": "Please provide your information"},
        {"id": str(uuid4()), "type": "text", "label": "Full Legal Name", "required": True, "order": 1},
        {"id": str(uuid4()), "type": "date", "label": "Date of Birth", "required": True, "order": 2},
        {"id": str(uuid4()), "type": "text", "label": "Address", "required": True, "order": 3},
        {"id": str(uuid4()), "type": "text", "label": "Emergency Contact Name", "required": True, "order": 4},
        {"id": str(uuid4()), "type": "text", "label": "Emergency Contact Phone", "required": True, "order": 5},
        {"id": str(uuid4()), "type": "heading", "label": "Health Information", "order": 6, "content": "Please answer honestly"},
        {"id": str(uuid4()), "type": "checkbox", "label": "I am not under the influence of drugs or alcohol", "required": True, "order": 7},
        {"id": str(uuid4()), "type": "checkbox", "label": "I do not have any blood-borne diseases", "required": True, "order": 8},
        {"id": str(uuid4()), "type": "checkbox", "label": "I am not pregnant", "required": True, "order": 9},
        {"id": str(uuid4()), "type": "textarea", "label": "List any allergies or medical conditions", "required": False, "order": 10},
        {"id": str(uuid4()), "type": "heading", "label": "Acknowledgment", "order": 11, "content": "Please read and acknowledge"},
        {"id": str(uuid4()), "type": "checkbox", "label": "I understand tattoos are permanent", "required": True, "order": 12},
        {"id": str(uuid4()), "type": "checkbox", "label": "I understand the aftercare instructions", "required": True, "order": 13},
        {"id": str(uuid4()), "type": "checkbox", "label": "I consent to this procedure", "required": True, "order": 14},
        {"id": str(uuid4()), "type": "signature", "label": "Client Signature", "required": True, "order": 15},
        {"id": str(uuid4()), "type": "photo_id", "label": "Photo ID", "required": True, "order": 16},
    ]

    for studio_key, studio in studios.items():
        owner = users[studio_key][0]

        template = ConsentFormTemplate(
            studio_id=studio.id,
            name="Standard Tattoo Consent Form",
            description="Standard consent form for all tattoo procedures",
            version=1,
            is_active=True,
            is_default=True,
            fields=default_fields,
            header_text="TATTOO CONSENT AND RELEASE FORM\n\nPlease read carefully before signing.",
            footer_text="By signing this form, I acknowledge that I have read and understood all of the above.",
            requires_photo_id=True,
            requires_signature=True,
            age_requirement=18,
            created_by_id=owner.id,
        )
        session.add(template)
        templates[studio_key] = template

    await session.flush()
    print(f"  Created {len(templates)} consent form templates")
    return templates


async def create_consent_submissions(
    session: AsyncSession,
    studios: dict[str, Studio],
    bookings: list[BookingRequest],
    templates: dict[str, ConsentFormTemplate],
) -> list[ConsentFormSubmission]:
    """Create consent form submissions for completed/confirmed bookings."""
    print("Creating consent form submissions...")
    submissions = []

    eligible_bookings = [
        b for b in bookings
        if b.status in [BookingRequestStatus.COMPLETED, BookingRequestStatus.CONFIRMED]
    ]

    for booking in eligible_bookings[:50]:  # Limit to 50 for performance
        studio_key = "studio1" if booking.studio_id == studios["studio1"].id else "studio2"
        template = templates[studio_key]

        submission = ConsentFormSubmission(
            template_id=template.id,
            template_name=template.name,
            template_version=template.version,
            template_fields_snapshot=template.fields,
            studio_id=booking.studio_id,
            booking_request_id=booking.id,
            client_name=booking.client_name,
            client_email=booking.client_email,
            client_phone=booking.client_phone,
            client_date_of_birth=datetime.utcnow() - timedelta(days=random.randint(18*365, 50*365)),
            responses={
                "full_legal_name": booking.client_name,
                "allergies": random.choice(["None", "Latex", "None", "None"]),
            },
            signature_data="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            signature_timestamp=booking.scheduled_date - timedelta(hours=1) if booking.scheduled_date else datetime.utcnow(),
            age_verified=True,
            age_at_signing=random.randint(18, 50),
            access_token=secrets.token_urlsafe(32),
            submitted_at=booking.scheduled_date - timedelta(hours=1) if booking.scheduled_date else datetime.utcnow(),
        )
        session.add(submission)
        submissions.append(submission)

    await session.flush()
    print(f"  Created {len(submissions)} consent submissions")
    return submissions


async def create_aftercare_templates(
    session: AsyncSession,
    studios: dict[str, Studio],
    users: dict[str, list[User]],
) -> dict[str, AftercareTemplate]:
    """Create aftercare instruction templates."""
    print("Creating aftercare templates...")
    templates = {}

    instructions_html = """
    <h2>Tattoo Aftercare Instructions</h2>
    <h3>First 24 Hours</h3>
    <ul>
        <li>Leave the bandage on for 2-4 hours</li>
        <li>Gently wash with lukewarm water and unscented soap</li>
        <li>Pat dry with a clean paper towel</li>
        <li>Apply a thin layer of recommended ointment</li>
    </ul>
    <h3>Days 2-14</h3>
    <ul>
        <li>Wash 2-3 times daily</li>
        <li>Apply unscented lotion when dry</li>
        <li>Do not scratch or pick at scabs</li>
        <li>Avoid direct sunlight</li>
        <li>No swimming or soaking</li>
    </ul>
    <h3>Warning Signs</h3>
    <p>Contact us immediately if you experience:</p>
    <ul>
        <li>Excessive redness or swelling after 48 hours</li>
        <li>Pus or unusual discharge</li>
        <li>Fever or chills</li>
        <li>Red streaks extending from the tattoo</li>
    </ul>
    """

    instructions_plain = """
    TATTOO AFTERCARE INSTRUCTIONS

    FIRST 24 HOURS:
    - Leave the bandage on for 2-4 hours
    - Gently wash with lukewarm water and unscented soap
    - Pat dry with a clean paper towel
    - Apply a thin layer of recommended ointment

    DAYS 2-14:
    - Wash 2-3 times daily
    - Apply unscented lotion when dry
    - Do not scratch or pick at scabs
    - Avoid direct sunlight
    - No swimming or soaking

    WARNING SIGNS - Contact us if you experience:
    - Excessive redness or swelling after 48 hours
    - Pus or unusual discharge
    - Fever or chills
    - Red streaks extending from the tattoo
    """

    for studio_key, studio in studios.items():
        owner = users[studio_key][0]

        template = AftercareTemplate(
            studio_id=studio.id,
            name="Standard Aftercare Instructions",
            description="Default aftercare instructions for all tattoo types",
            instructions_html=instructions_html,
            instructions_plain=instructions_plain,
            extra_data={
                "days_covered": 14,
                "key_points": ["Keep clean", "Don't scratch", "Avoid sun", "No swimming"],
                "products_recommended": ["Aquaphor", "Unscented lotion"],
                "products_to_avoid": ["Alcohol-based products", "Scented lotions"],
                "warning_signs": ["Excessive redness", "Pus", "Fever"],
            },
            is_active=True,
            is_default=True,
            created_by_id=owner.id,
        )
        session.add(template)
        templates[studio_key] = template

    await session.flush()
    print(f"  Created {len(templates)} aftercare templates")
    return templates


async def create_aftercare_sent(
    session: AsyncSession,
    studios: dict[str, Studio],
    bookings: list[BookingRequest],
    templates: dict[str, AftercareTemplate],
) -> list[AftercareSent]:
    """Create sent aftercare records for completed bookings."""
    print("Creating aftercare sent records...")
    records = []

    completed_bookings = [b for b in bookings if b.status == BookingRequestStatus.COMPLETED]

    for booking in completed_bookings[:40]:
        studio_key = "studio1" if booking.studio_id == studios["studio1"].id else "studio2"
        template = templates[studio_key]

        sent = AftercareSent(
            template_id=template.id,
            template_name=template.name,
            instructions_snapshot=template.instructions_plain,
            studio_id=booking.studio_id,
            booking_request_id=booking.id,
            artist_id=booking.assigned_artist_id,
            client_name=booking.client_name,
            client_email=booking.client_email,
            client_phone=booking.client_phone,
            appointment_date=booking.scheduled_date,
            status=AftercareSentStatus.DELIVERED,
            sent_via="email",
            sent_at=booking.scheduled_date + timedelta(hours=2),
            delivered_at=booking.scheduled_date + timedelta(hours=2, minutes=5),
            access_token=secrets.token_urlsafe(32),
            view_count=random.randint(0, 5),
        )
        session.add(sent)
        records.append(sent)

    await session.flush()

    # Create follow-ups for some records
    for sent in records[:20]:
        for follow_up_type, days in [(FollowUpType.DAY_3, 3), (FollowUpType.WEEK_1, 7)]:
            follow_up = AftercareFollowUp(
                aftercare_sent_id=sent.id,
                follow_up_type=follow_up_type,
                scheduled_for=sent.appointment_date + timedelta(days=days),
                subject=f"How is your tattoo healing? ({follow_up_type.value})",
                message_html="<p>Just checking in on your new tattoo!</p>",
                message_plain="Just checking in on your new tattoo!",
                status=FollowUpStatus.SENT,
                sent_at=sent.appointment_date + timedelta(days=days),
            )
            session.add(follow_up)

    await session.flush()
    print(f"  Created {len(records)} aftercare sent records with follow-ups")
    return records


async def create_conversations(
    session: AsyncSession,
    studios: dict[str, Studio],
    users: dict[str, list[User]],
    bookings: list[BookingRequest],
) -> list[Conversation]:
    """Create message conversations."""
    print("Creating conversations...")
    conversations = []

    status_dist = [ConversationStatus.UNREAD] * 3 + [ConversationStatus.PENDING] * 4 + [ConversationStatus.RESOLVED] * 8

    for booking in bookings[:60]:
        studio_key = "studio1" if booking.studio_id == studios["studio1"].id else "studio2"
        artists = [u for u in users[studio_key] if u.role == UserRole.ARTIST]

        conv = Conversation(
            client_name=booking.client_name,
            client_email=booking.client_email,
            client_phone=booking.client_phone,
            studio_id=booking.studio_id,
            booking_request_id=booking.id,
            assigned_to_id=random.choice(artists).id if random.random() > 0.3 else None,
            status=random.choice(status_dist),
            subject=f"Booking inquiry: {booking.design_idea[:50]}",
            last_message_at=booking.created_at + timedelta(hours=random.randint(1, 72)),
            unread_count=random.randint(0, 3) if random.random() > 0.5 else 0,
            email_thread_token=secrets.token_urlsafe(32),
        )
        session.add(conv)
        conversations.append(conv)

    await session.flush()

    # Add messages to conversations
    message_templates = [
        "Hi! I'm interested in getting a tattoo. Can you help?",
        "Thanks for reaching out! I'd love to discuss your design idea.",
        "What's your availability like for next month?",
        "I can do any weekday after 4pm.",
        "Perfect! Let me check my calendar and get back to you.",
        "Here's the deposit information. Please let me know if you have questions.",
        "Just paid the deposit. Looking forward to the appointment!",
        "Great! See you on the scheduled date. Don't forget to eat before coming in.",
    ]

    for conv in conversations:
        num_messages = random.randint(2, 6)
        for i in range(num_messages):
            is_inbound = i % 2 == 0
            msg = Message(
                conversation_id=conv.id,
                content=random.choice(message_templates),
                channel=MessageChannel.INTERNAL,
                direction=MessageDirection.INBOUND if is_inbound else MessageDirection.OUTBOUND,
                sender_id=conv.assigned_to_id if not is_inbound and conv.assigned_to_id else None,
                sender_name=conv.client_name if is_inbound else "Studio",
                is_read=random.random() > 0.3,
                created_at=conv.created_at + timedelta(hours=i * random.randint(1, 24)),
            )
            session.add(msg)

    await session.flush()
    print(f"  Created {len(conversations)} conversations with messages")
    return conversations


async def create_reply_templates(
    session: AsyncSession,
    studios: dict[str, Studio],
    users: dict[str, list[User]],
) -> None:
    """Create quick reply templates."""
    print("Creating reply templates...")

    templates_data = [
        ("Greeting", "greeting", "Hi there! Thanks for reaching out to us. How can I help you today?"),
        ("Deposit Request", "booking", "To secure your appointment, we require a 30% deposit. You can pay securely through our booking system."),
        ("Aftercare", "aftercare", "Thanks for getting tattooed with us! Remember to keep it clean, avoid sun exposure, and follow the aftercare instructions we sent."),
        ("Availability", "booking", "I'm available Tuesday through Saturday, 11am to 7pm. What works best for you?"),
        ("Touch-up", "aftercare", "Touch-ups are free within 6 weeks of your original appointment. Just send us some photos and we'll schedule you in."),
    ]

    for studio_key, studio in studios.items():
        owner = users[studio_key][0]

        for name, category, content in templates_data:
            template = ReplyTemplate(
                name=name,
                content=content,
                category=category,
                created_by_id=owner.id,
                studio_id=studio.id,
                use_count=random.randint(0, 50),
            )
            session.add(template)

    await session.flush()
    print(f"  Created {len(templates_data) * 2} reply templates")


async def main():
    """Main seeding function."""
    global HASHED_PASSWORD

    print("\n" + "=" * 60)
    print("InkFlow Seed Script")
    print("=" * 60 + "\n")

    # Pre-hash the password (expensive operation)
    print("Hashing default password...")
    HASHED_PASSWORD = hash_password(DEFAULT_PASSWORD)
    print(f"  Default password for all test users: {DEFAULT_PASSWORD}\n")

    async with async_session_maker() as session:
        try:
            # Clear existing data
            await clear_existing_data(session)

            # Create all data
            users = await create_users(session)
            studios = await create_studios(session, users)
            await create_artist_profiles(session, users)
            await create_availability(session, users)
            clients = await create_clients(session, studios)
            rules = await create_commission_rules(session, studios, users)
            bookings = await create_bookings(session, studios, users, clients)
            commissions = await create_earned_commissions(session, studios, users, bookings, rules)
            await create_pay_periods(session, studios, commissions)
            consent_templates = await create_consent_templates(session, studios, users)
            await create_consent_submissions(session, studios, bookings, consent_templates)
            aftercare_templates = await create_aftercare_templates(session, studios, users)
            await create_aftercare_sent(session, studios, bookings, aftercare_templates)
            await create_conversations(session, studios, users, bookings)
            await create_reply_templates(session, studios, users)

            await session.commit()

            print("\n" + "=" * 60)
            print("Seeding complete!")
            print("=" * 60)
            print(f"\nTest Login Credentials:")
            print(f"  Owner (Studio 1): owner@inkflow-main.com / {DEFAULT_PASSWORD}")
            print(f"  Owner (Studio 2): owner@inkflow-satellite.com / {DEFAULT_PASSWORD}")
            print(f"  Artist: artist1@inkflow-main.com / {DEFAULT_PASSWORD}")
            print(f"  Client: client1@example.com / {DEFAULT_PASSWORD}")
            print()

        except Exception as e:
            await session.rollback()
            print(f"\nError during seeding: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(main())
