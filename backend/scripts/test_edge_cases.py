"""
Test edge cases and boundary conditions in the InkFlow system.
Validates proper handling of unusual but valid scenarios.
"""

import asyncio
import secrets
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

# Add the backend directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, func, delete
from sqlalchemy.exc import IntegrityError

from app.database import async_session_maker, engine
from app.models.aftercare import AftercareSent, AftercareTemplate
from app.models.booking import BookingRequest, BookingRequestStatus, TattooSize
from app.models.commission import CommissionRule, CommissionType, EarnedCommission, PayPeriod, PayPeriodStatus
from app.models.consent import ConsentFormSubmission, ConsentFormTemplate
from app.models.message import Conversation, ConversationStatus, Message, MessageChannel, MessageDirection
from app.models.studio import Studio
from app.models.user import User, UserRole


async_session = async_session_maker


class EdgeCaseTestResult:
    """Track test results."""

    def __init__(self, name: str):
        self.name = name
        self.passed = 0
        self.failed = 0
        self.errors: list[str] = []

    def record_pass(self, description: str) -> None:
        self.passed += 1
        print(f"    [PASS] {description}")

    def record_fail(self, description: str, error: str = "") -> None:
        self.failed += 1
        self.errors.append(f"{description}: {error}")
        print(f"    [FAIL] {description} - {error}")

    def summary(self) -> str:
        return f"{self.name}: {self.passed} passed, {self.failed} failed"


async def test_booking_edge_cases(studio_id, artist_id) -> EdgeCaseTestResult:
    """Test booking-related edge cases."""
    result = EdgeCaseTestResult("Booking Edge Cases")

    async with async_session() as session:
        # Test 1: Minimum valid booking (required fields only)
        try:
            booking = BookingRequest(
                studio_id=studio_id,
                client_name="Min Client",
                client_email="min@example.com",
                design_idea="Simple design",
                placement="Arm",
                size=TattooSize.SMALL,
                status=BookingRequestStatus.PENDING,
            )
            session.add(booking)
            await session.flush()
            result.record_pass("Minimum valid booking")
        except Exception as e:
            result.record_fail("Minimum valid booking", str(e))

        # Test 2: Maximum price boundary
        try:
            booking = BookingRequest(
                studio_id=studio_id,
                client_name="Max Price Client",
                client_email="maxprice@example.com",
                design_idea="Expensive piece",
                placement="Back",
                size=TattooSize.EXTRA_LARGE,
                quoted_price=99999999,  # ~$1M in cents
                status=BookingRequestStatus.QUOTED,
            )
            session.add(booking)
            await session.flush()
            result.record_pass("Maximum price boundary (999999.99)")
        except Exception as e:
            result.record_fail("Maximum price boundary", str(e))

        # Test 3: Zero deposit amount
        try:
            booking = BookingRequest(
                studio_id=studio_id,
                client_name="Zero Deposit Client",
                client_email="zerodeposit@example.com",
                design_idea="No deposit piece",
                placement="Wrist",
                size=TattooSize.TINY,
                quoted_price=10000,
                deposit_amount=0,
                status=BookingRequestStatus.QUOTED,
            )
            session.add(booking)
            await session.flush()
            result.record_pass("Zero deposit amount")
        except Exception as e:
            result.record_fail("Zero deposit amount", str(e))

        # Test 4: Very long design description
        try:
            long_description = "A" * 5000  # Very long description
            booking = BookingRequest(
                studio_id=studio_id,
                client_name="Long Description Client",
                client_email="longdesc@example.com",
                design_idea=long_description,
                placement="Full sleeve",
                size=TattooSize.EXTRA_LARGE,
                status=BookingRequestStatus.PENDING,
            )
            session.add(booking)
            await session.flush()
            result.record_pass("Very long design description (5000 chars)")
        except Exception as e:
            result.record_fail("Very long design description", str(e))

        # Test 5: Special characters in client name
        try:
            booking = BookingRequest(
                studio_id=studio_id,
                client_name="José García-López 中文 日本語",
                client_email="special@example.com",
                design_idea="International client",
                placement="Shoulder",
                size=TattooSize.MEDIUM,
                status=BookingRequestStatus.PENDING,
            )
            session.add(booking)
            await session.flush()
            result.record_pass("Special characters in client name")
        except Exception as e:
            result.record_fail("Special characters in client name", str(e))

        # Test 6: All status transitions
        status_transitions = [
            (BookingRequestStatus.PENDING, BookingRequestStatus.QUOTED),
            (BookingRequestStatus.QUOTED, BookingRequestStatus.CONFIRMED),
            (BookingRequestStatus.CONFIRMED, BookingRequestStatus.DEPOSIT_PAID),
            (BookingRequestStatus.DEPOSIT_PAID, BookingRequestStatus.COMPLETED),
        ]

        for from_status, to_status in status_transitions:
            try:
                booking = BookingRequest(
                    studio_id=studio_id,
                    client_name=f"Status Test {from_status.value}",
                    client_email=f"status.{from_status.value}@example.com",
                    design_idea="Status test",
                    placement="Arm",
                    size=TattooSize.SMALL,
                    status=from_status,
                )
                session.add(booking)
                await session.flush()
                booking.status = to_status
                await session.flush()
                result.record_pass(f"Status transition {from_status.value} -> {to_status.value}")
            except Exception as e:
                result.record_fail(f"Status transition {from_status.value} -> {to_status.value}", str(e))

        await session.rollback()

    return result


async def create_test_booking(session, studio_id, artist_id, name_suffix: str) -> uuid4:
    """Create a test booking and return its ID."""
    booking = BookingRequest(
        studio_id=studio_id,
        client_name=f"Commission Test {name_suffix}",
        client_email=f"commission.{name_suffix}@example.com",
        design_idea=f"Commission edge case test {name_suffix}",
        placement="Test",
        size=TattooSize.SMALL,
        status=BookingRequestStatus.COMPLETED,
        assigned_artist_id=artist_id,
    )
    session.add(booking)
    await session.flush()
    return booking.id


async def test_commission_edge_cases(studio_id, artist_id) -> EdgeCaseTestResult:
    """Test commission-related edge cases."""
    result = EdgeCaseTestResult("Commission Edge Cases")

    async with async_session() as session:
        # Each commission requires a unique booking_request_id (not null + unique constraint)
        # This is correct business logic - commissions must be tied to bookings

        # Test 1: Zero service total
        try:
            booking_id = await create_test_booking(session, studio_id, artist_id, "zero_service")
            commission = EarnedCommission(
                studio_id=studio_id,
                artist_id=artist_id,
                booking_request_id=booking_id,
                commission_rule_name="Zero Test",
                commission_type=CommissionType.PERCENTAGE,
                service_total=0,
                studio_commission=0,
                artist_payout=0,
                tips_amount=0,
                tip_artist_share=0,
                tip_studio_share=0,
                calculation_details="Zero service",
                completed_at=datetime.now(timezone.utc),
            )
            session.add(commission)
            await session.flush()
            result.record_pass("Zero service total commission")
        except Exception as e:
            result.record_fail("Zero service total commission", str(e))

        # Test 2: 100% studio commission
        try:
            booking_id = await create_test_booking(session, studio_id, artist_id, "100_studio")
            commission = EarnedCommission(
                studio_id=studio_id,
                artist_id=artist_id,
                booking_request_id=booking_id,
                commission_rule_name="100% Studio",
                commission_type=CommissionType.PERCENTAGE,
                service_total=50000,
                studio_commission=50000,  # 100% to studio
                artist_payout=0,
                tips_amount=10000,
                tip_artist_share=10000,
                tip_studio_share=0,
                calculation_details="100% studio commission",
                completed_at=datetime.now(timezone.utc),
            )
            session.add(commission)
            await session.flush()
            result.record_pass("100% studio commission")
        except Exception as e:
            result.record_fail("100% studio commission", str(e))

        # Test 3: 100% artist commission (0% studio)
        try:
            booking_id = await create_test_booking(session, studio_id, artist_id, "100_artist")
            commission = EarnedCommission(
                studio_id=studio_id,
                artist_id=artist_id,
                booking_request_id=booking_id,
                commission_rule_name="100% Artist",
                commission_type=CommissionType.PERCENTAGE,
                service_total=50000,
                studio_commission=0,  # 0% to studio
                artist_payout=50000,
                tips_amount=10000,
                tip_artist_share=10000,
                tip_studio_share=0,
                calculation_details="100% artist commission",
                completed_at=datetime.now(timezone.utc),
            )
            session.add(commission)
            await session.flush()
            result.record_pass("100% artist commission (0% studio)")
        except Exception as e:
            result.record_fail("100% artist commission", str(e))

        # Test 4: Large tip amount
        try:
            booking_id = await create_test_booking(session, studio_id, artist_id, "big_tip")
            commission = EarnedCommission(
                studio_id=studio_id,
                artist_id=artist_id,
                booking_request_id=booking_id,
                commission_rule_name="Big Tip",
                commission_type=CommissionType.PERCENTAGE,
                service_total=10000,
                studio_commission=4000,
                artist_payout=56000,  # 6000 service + 50000 tip
                tips_amount=50000,  # Tip larger than service
                tip_artist_share=50000,
                tip_studio_share=0,
                calculation_details="Tip exceeds service",
                completed_at=datetime.now(timezone.utc),
            )
            session.add(commission)
            await session.flush()
            result.record_pass("Tip amount exceeds service total")
        except Exception as e:
            result.record_fail("Tip amount exceeds service total", str(e))

        # Test 5: Flat fee commission type
        try:
            booking_id = await create_test_booking(session, studio_id, artist_id, "flat_fee")
            commission = EarnedCommission(
                studio_id=studio_id,
                artist_id=artist_id,
                booking_request_id=booking_id,
                commission_rule_name="Flat Fee",
                commission_type=CommissionType.FLAT_FEE,
                service_total=50000,
                studio_commission=10000,  # Fixed $100 fee
                artist_payout=40000,
                tips_amount=5000,
                tip_artist_share=5000,
                tip_studio_share=0,
                calculation_details="Flat fee: $100",
                completed_at=datetime.now(timezone.utc),
            )
            session.add(commission)
            await session.flush()
            result.record_pass("Flat fee commission type")
        except Exception as e:
            result.record_fail("Flat fee commission type", str(e))

        # Test 6: Tiered commission type
        try:
            booking_id = await create_test_booking(session, studio_id, artist_id, "tiered")
            commission = EarnedCommission(
                studio_id=studio_id,
                artist_id=artist_id,
                booking_request_id=booking_id,
                commission_rule_name="Tiered",
                commission_type=CommissionType.TIERED,
                service_total=100000,
                studio_commission=35000,  # 35% average on tiered
                artist_payout=65000,
                tips_amount=0,
                tip_artist_share=0,
                tip_studio_share=0,
                calculation_details="Tiered: 40% first $500, 30% above",
                completed_at=datetime.now(timezone.utc),
            )
            session.add(commission)
            await session.flush()
            result.record_pass("Tiered commission type")
        except Exception as e:
            result.record_fail("Tiered commission type", str(e))

        await session.rollback()

    return result


async def test_message_edge_cases(studio_id, artist_id) -> EdgeCaseTestResult:
    """Test message and conversation edge cases."""
    result = EdgeCaseTestResult("Message Edge Cases")

    async with async_session() as session:
        # Create a test conversation
        try:
            conversation = Conversation(
                studio_id=studio_id,
                client_name="Edge Test Client",
                client_email="edge@example.com",
                subject="Edge case test",
                status=ConversationStatus.UNREAD,
                unread_count=0,
            )
            session.add(conversation)
            await session.flush()
            conv_id = conversation.id
            result.record_pass("Create test conversation")
        except Exception as e:
            result.record_fail("Create test conversation", str(e))
            return result

        # Test 1: Empty message content
        try:
            message = Message(
                conversation_id=conv_id,
                channel=MessageChannel.INTERNAL,
                direction=MessageDirection.INBOUND,
                content="",  # Empty content
                is_read=False,
            )
            session.add(message)
            await session.flush()
            result.record_pass("Empty message content")
        except Exception as e:
            result.record_fail("Empty message content", str(e))

        # Test 2: Very long message
        try:
            long_content = "Lorem ipsum " * 1000  # ~12000 chars
            message = Message(
                conversation_id=conv_id,
                channel=MessageChannel.INTERNAL,
                direction=MessageDirection.INBOUND,
                content=long_content,
                is_read=False,
            )
            session.add(message)
            await session.flush()
            result.record_pass("Very long message (~12000 chars)")
        except Exception as e:
            result.record_fail("Very long message", str(e))

        # Test 3: Message with emoji and special chars
        try:
            message = Message(
                conversation_id=conv_id,
                channel=MessageChannel.INTERNAL,
                direction=MessageDirection.OUTBOUND,
                sender_id=artist_id,
                content="Thanks! 🎨✨ We'll create something amazing! 日本語テスト",
                is_read=True,
            )
            session.add(message)
            await session.flush()
            result.record_pass("Message with emoji and Unicode")
        except Exception as e:
            result.record_fail("Message with emoji and Unicode", str(e))

        # Test 4: All message channels
        for channel in MessageChannel:
            try:
                message = Message(
                    conversation_id=conv_id,
                    channel=channel,
                    direction=MessageDirection.INBOUND,
                    content=f"Test {channel.value} channel",
                    is_read=False,
                )
                session.add(message)
                await session.flush()
                result.record_pass(f"Message channel: {channel.value}")
            except Exception as e:
                result.record_fail(f"Message channel: {channel.value}", str(e))

        # Test 5: High unread count
        try:
            conversation.unread_count = 9999
            await session.flush()
            result.record_pass("High unread count (9999)")
        except Exception as e:
            result.record_fail("High unread count", str(e))

        await session.rollback()

    return result


async def test_pay_period_edge_cases(studio_id) -> EdgeCaseTestResult:
    """Test pay period edge cases."""
    result = EdgeCaseTestResult("Pay Period Edge Cases")

    async with async_session() as session:
        # Test 1: Single day pay period
        try:
            today = datetime.now(timezone.utc)
            period = PayPeriod(
                studio_id=studio_id,
                start_date=today,
                end_date=today,  # Same day
                status=PayPeriodStatus.OPEN,
            )
            session.add(period)
            await session.flush()
            result.record_pass("Single day pay period")
        except Exception as e:
            result.record_fail("Single day pay period", str(e))

        # Test 2: Very long pay period (1 year)
        try:
            start = datetime.now(timezone.utc)
            end = start + timedelta(days=365)
            period = PayPeriod(
                studio_id=studio_id,
                start_date=start,
                end_date=end,
                status=PayPeriodStatus.OPEN,
            )
            session.add(period)
            await session.flush()
            result.record_pass("One year pay period")
        except Exception as e:
            result.record_fail("One year pay period", str(e))

        # Test 3: Zero totals pay period
        try:
            period = PayPeriod(
                studio_id=studio_id,
                start_date=datetime.now(timezone.utc),
                end_date=datetime.now(timezone.utc) + timedelta(days=14),
                status=PayPeriodStatus.CLOSED,
                total_service=0,
                total_studio_commission=0,
                total_artist_payout=0,
                total_tips=0,
                commission_count=0,
                closed_at=datetime.now(timezone.utc),
            )
            session.add(period)
            await session.flush()
            result.record_pass("Zero totals closed pay period")
        except Exception as e:
            result.record_fail("Zero totals closed pay period", str(e))

        # Test 4: Large totals
        try:
            period = PayPeriod(
                studio_id=studio_id,
                start_date=datetime.now(timezone.utc),
                end_date=datetime.now(timezone.utc) + timedelta(days=14),
                status=PayPeriodStatus.CLOSED,
                total_service=99999999,  # ~$1M
                total_studio_commission=40000000,
                total_artist_payout=59999999,
                total_tips=20000000,
                commission_count=1000,
                closed_at=datetime.now(timezone.utc),
            )
            session.add(period)
            await session.flush()
            result.record_pass("Large totals pay period (~$1M)")
        except Exception as e:
            result.record_fail("Large totals pay period", str(e))

        await session.rollback()

    return result


async def test_consent_edge_cases(studio_id) -> EdgeCaseTestResult:
    """Test consent form edge cases."""
    result = EdgeCaseTestResult("Consent Form Edge Cases")

    async with async_session() as session:
        # Get or create a consent template
        template = (await session.execute(
            select(ConsentFormTemplate).where(
                ConsentFormTemplate.studio_id == studio_id,
                ConsentFormTemplate.is_active == True,
            )
        )).scalars().first()

        if not template:
            result.record_fail("No active consent template found", "Skipping consent tests")
            return result

        # Test 1: Minimum age (18)
        try:
            submission = ConsentFormSubmission(
                template_id=template.id,
                template_name=template.name,
                template_version=template.version,
                template_fields_snapshot=template.fields,
                studio_id=studio_id,
                client_name="Young Client",
                client_email="young@example.com",
                responses={"accepted": True},
                signature_data="base64_sig",
                signature_timestamp=datetime.now(timezone.utc),
                submitted_at=datetime.now(timezone.utc),
                access_token=secrets.token_urlsafe(32),
                age_verified=True,
                age_at_signing=18,  # Minimum age
            )
            session.add(submission)
            await session.flush()
            result.record_pass("Minimum age consent (18)")
        except Exception as e:
            result.record_fail("Minimum age consent", str(e))

        # Test 2: Maximum reasonable age
        try:
            submission = ConsentFormSubmission(
                template_id=template.id,
                template_name=template.name,
                template_version=template.version,
                template_fields_snapshot=template.fields,
                studio_id=studio_id,
                client_name="Elder Client",
                client_email="elder@example.com",
                responses={"accepted": True},
                signature_data="base64_sig",
                signature_timestamp=datetime.now(timezone.utc),
                submitted_at=datetime.now(timezone.utc),
                access_token=secrets.token_urlsafe(32),
                age_verified=True,
                age_at_signing=99,
            )
            session.add(submission)
            await session.flush()
            result.record_pass("Maximum age consent (99)")
        except Exception as e:
            result.record_fail("Maximum age consent", str(e))

        # Test 3: Complex responses JSON
        try:
            complex_responses = {
                "medical_conditions": ["diabetes", "allergies"],
                "allergies": "latex, certain inks",
                "medications": ["insulin", "antihistamines"],
                "acknowledgements": {
                    "risks": True,
                    "aftercare": True,
                    "no_refunds": True,
                },
                "emergency_contact": {
                    "name": "Jane Doe",
                    "phone": "+1-555-1234",
                    "relationship": "spouse",
                },
            }
            submission = ConsentFormSubmission(
                template_id=template.id,
                template_name=template.name,
                template_version=template.version,
                template_fields_snapshot=template.fields,
                studio_id=studio_id,
                client_name="Complex Client",
                client_email="complex@example.com",
                responses=complex_responses,
                signature_data="base64_sig",
                signature_timestamp=datetime.now(timezone.utc),
                submitted_at=datetime.now(timezone.utc),
                access_token=secrets.token_urlsafe(32),
                age_verified=True,
                age_at_signing=35,
            )
            session.add(submission)
            await session.flush()
            result.record_pass("Complex JSON responses")
        except Exception as e:
            result.record_fail("Complex JSON responses", str(e))

        await session.rollback()

    return result


async def test_date_edge_cases(studio_id, artist_id) -> EdgeCaseTestResult:
    """Test date/time edge cases."""
    result = EdgeCaseTestResult("Date/Time Edge Cases")

    async with async_session() as session:
        # Test 1: Midnight boundary (using commission with booking)
        try:
            booking_id = await create_test_booking(session, studio_id, artist_id, "midnight")
            midnight = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
            commission = EarnedCommission(
                studio_id=studio_id,
                artist_id=artist_id,
                booking_request_id=booking_id,
                commission_rule_name="Midnight Test",
                commission_type=CommissionType.PERCENTAGE,
                service_total=10000,
                studio_commission=4000,
                artist_payout=6000,
                tips_amount=0,
                tip_artist_share=0,
                tip_studio_share=0,
                calculation_details="Midnight test",
                completed_at=midnight,
            )
            session.add(commission)
            await session.flush()
            result.record_pass("Midnight boundary timestamp")
        except Exception as e:
            result.record_fail("Midnight boundary", str(e))

        # Test 2: Far future date (using pay period)
        try:
            far_future = datetime.now(timezone.utc) + timedelta(days=3650)  # 10 years
            period = PayPeriod(
                studio_id=studio_id,
                start_date=far_future,
                end_date=far_future + timedelta(days=14),
                status=PayPeriodStatus.OPEN,
            )
            session.add(period)
            await session.flush()
            result.record_pass("Far future date (10 years)")
        except Exception as e:
            result.record_fail("Far future date", str(e))

        # Test 3: Microsecond precision
        try:
            booking_id = await create_test_booking(session, studio_id, artist_id, "precision")
            precise_time = datetime.now(timezone.utc)
            commission = EarnedCommission(
                studio_id=studio_id,
                artist_id=artist_id,
                booking_request_id=booking_id,
                commission_rule_name="Precision Test",
                commission_type=CommissionType.PERCENTAGE,
                service_total=10000,
                studio_commission=4000,
                artist_payout=6000,
                tips_amount=0,
                tip_artist_share=0,
                tip_studio_share=0,
                calculation_details="Microsecond precision",
                completed_at=precise_time,
            )
            session.add(commission)
            await session.flush()

            # Verify microseconds preserved
            retrieved = await session.get(EarnedCommission, commission.id)
            if retrieved and retrieved.completed_at.microsecond == precise_time.microsecond:
                result.record_pass("Microsecond precision preserved")
            else:
                result.record_fail("Microsecond precision", "Microseconds not preserved")
        except Exception as e:
            result.record_fail("Microsecond precision", str(e))

        await session.rollback()

    return result


async def run_all_edge_case_tests() -> None:
    """Run all edge case tests."""
    print("=" * 60)
    print("InkFlow Edge Case Tests")
    print("=" * 60)
    print()

    # Get test data
    async with async_session() as session:
        studio = (await session.execute(
            select(Studio).where(Studio.slug == "inkflow-main")
        )).scalar_one_or_none()

        if not studio:
            print("ERROR: Studio 'inkflow-main' not found. Run seed_data.py first!")
            return

        artist = (await session.execute(
            select(User).where(
                User.role == UserRole.ARTIST,
                User.email.like("%inkflow-main%")
            )
        )).scalars().first()

        if not artist:
            print("ERROR: No artists found. Run seed_data.py first!")
            return

        studio_id = studio.id
        artist_id = artist.id

    print(f"Testing with Studio: {studio.name}")
    print(f"Testing with Artist: {artist.full_name}")
    print()

    # Run all test categories
    all_results: list[EdgeCaseTestResult] = []

    print("=" * 60)
    print("BOOKING EDGE CASES")
    print("=" * 60)
    result = await test_booking_edge_cases(studio_id, artist_id)
    all_results.append(result)
    print()

    print("=" * 60)
    print("COMMISSION EDGE CASES")
    print("=" * 60)
    result = await test_commission_edge_cases(studio_id, artist_id)
    all_results.append(result)
    print()

    print("=" * 60)
    print("MESSAGE EDGE CASES")
    print("=" * 60)
    result = await test_message_edge_cases(studio_id, artist_id)
    all_results.append(result)
    print()

    print("=" * 60)
    print("PAY PERIOD EDGE CASES")
    print("=" * 60)
    result = await test_pay_period_edge_cases(studio_id)
    all_results.append(result)
    print()

    print("=" * 60)
    print("CONSENT FORM EDGE CASES")
    print("=" * 60)
    result = await test_consent_edge_cases(studio_id)
    all_results.append(result)
    print()

    print("=" * 60)
    print("DATE/TIME EDGE CASES")
    print("=" * 60)
    result = await test_date_edge_cases(studio_id, artist_id)
    all_results.append(result)
    print()

    # Print summary
    print("=" * 60)
    print("EDGE CASE TEST SUMMARY")
    print("=" * 60)
    print()

    total_passed = sum(r.passed for r in all_results)
    total_failed = sum(r.failed for r in all_results)

    for result in all_results:
        status = "[PASS]" if result.failed == 0 else "[FAIL]"
        print(f"  {status} {result.summary()}")
        if result.errors:
            for error in result.errors:
                print(f"        - {error}")

    print()
    print(f"Total: {total_passed} passed, {total_failed} failed")
    print()

    if total_failed == 0:
        print("All edge case tests passed!")
    else:
        print(f"WARNING: {total_failed} tests failed!")


async def main() -> None:
    """Main entry point."""
    await run_all_edge_case_tests()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
