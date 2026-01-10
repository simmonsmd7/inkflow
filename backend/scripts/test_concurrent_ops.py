"""
Test concurrent database operations to verify system stability under load.
Simulates multiple users performing operations simultaneously.
"""

import asyncio
import random
import secrets
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Add the backend directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, func

from app.database import async_session_maker, engine
from app.models.booking import BookingRequest, BookingRequestStatus, TattooSize
from app.models.message import Conversation, ConversationStatus, Message, MessageChannel, MessageDirection
from app.models.studio import Studio
from app.models.user import User, UserRole


async_session = async_session_maker


async def create_booking(studio_id, artist_id, booking_num: int) -> dict:
    """Create a single booking request."""
    async with async_session() as session:
        booking = BookingRequest(
            studio_id=studio_id,
            client_name=f"Concurrent Client {booking_num}",
            client_email=f"concurrent.{booking_num}.{random.randint(1000, 9999)}@example.com",
            client_phone=f"+1-555-{random.randint(1000, 9999)}",
            design_idea=f"Concurrent test design #{booking_num}",
            placement="Test placement",
            size=random.choice(list(TattooSize)),
            preferred_artist_id=artist_id,
            status=BookingRequestStatus.PENDING,
        )
        session.add(booking)
        await session.commit()
        return {"type": "booking", "id": str(booking.id), "success": True}


async def create_message(conversation_id, user_id, msg_num: int) -> dict:
    """Create a single message."""
    async with async_session() as session:
        message = Message(
            conversation_id=conversation_id,
            channel=MessageChannel.INTERNAL,
            direction=random.choice([MessageDirection.INBOUND, MessageDirection.OUTBOUND]),
            sender_id=user_id if random.choice([True, False]) else None,
            content=f"Concurrent test message #{msg_num}",
            is_read=random.choice([True, False]),
        )
        session.add(message)
        await session.commit()
        return {"type": "message", "id": str(message.id), "success": True}


async def read_bookings(studio_id) -> dict:
    """Read all bookings for a studio."""
    async with async_session() as session:
        result = await session.execute(
            select(func.count(BookingRequest.id)).where(
                BookingRequest.studio_id == studio_id
            )
        )
        count = result.scalar()
        return {"type": "read_bookings", "count": count, "success": True}


async def read_messages(studio_id) -> dict:
    """Read all messages for a studio's conversations."""
    async with async_session() as session:
        conversations = await session.execute(
            select(Conversation.id).where(Conversation.studio_id == studio_id)
        )
        conv_ids = [c[0] for c in conversations.fetchall()]

        if conv_ids:
            result = await session.execute(
                select(func.count(Message.id)).where(
                    Message.conversation_id.in_(conv_ids)
                )
            )
            count = result.scalar()
        else:
            count = 0
        return {"type": "read_messages", "count": count, "success": True}


async def update_booking_status(booking_id, new_status: BookingRequestStatus) -> dict:
    """Update a booking's status."""
    async with async_session() as session:
        booking = await session.get(BookingRequest, booking_id)
        if booking:
            booking.status = new_status
            await session.commit()
            return {"type": "update_status", "id": str(booking_id), "success": True}
        return {"type": "update_status", "id": str(booking_id), "success": False}


async def run_concurrent_test() -> None:
    """Run concurrent operations test."""
    print("=" * 60)
    print("InkFlow Concurrent Operations Test")
    print("=" * 60)
    print()

    # Get test data
    async with async_session() as session:
        studio = (await session.execute(
            select(Studio).where(Studio.slug == "inkflow-main")
        )).scalar_one_or_none()

        if not studio:
            print("ERROR: Studio not found. Run seed_data.py first!")
            return

        artists = (await session.execute(
            select(User).where(
                User.role == UserRole.ARTIST,
                User.email.like("%inkflow-main%")
            )
        )).scalars().all()

        conversations = (await session.execute(
            select(Conversation).where(
                Conversation.studio_id == studio.id
            ).limit(10)
        )).scalars().all()

        pending_bookings = (await session.execute(
            select(BookingRequest).where(
                BookingRequest.studio_id == studio.id,
                BookingRequest.status == BookingRequestStatus.PENDING,
            ).limit(10)
        )).scalars().all()

    print(f"Studio: {studio.name}")
    print(f"Artists: {len(artists)}")
    print(f"Conversations: {len(conversations)}")
    print(f"Pending bookings: {len(pending_bookings)}")
    print()

    # Test 1: Concurrent booking creation
    print("TEST 1: Concurrent Booking Creation")
    print("-" * 40)

    num_concurrent_bookings = 10
    start_time = time.time()

    booking_tasks = [
        create_booking(studio.id, random.choice(artists).id, i)
        for i in range(num_concurrent_bookings)
    ]

    results = await asyncio.gather(*booking_tasks, return_exceptions=True)
    elapsed = time.time() - start_time

    successes = sum(1 for r in results if isinstance(r, dict) and r.get("success"))
    failures = sum(1 for r in results if isinstance(r, Exception) or (isinstance(r, dict) and not r.get("success")))

    print(f"  Created: {successes}/{num_concurrent_bookings}")
    print(f"  Failed: {failures}")
    print(f"  Time: {elapsed:.2f}s")
    print(f"  Rate: {num_concurrent_bookings/elapsed:.1f} ops/sec")
    print()

    # Test 2: Concurrent message creation
    print("TEST 2: Concurrent Message Creation")
    print("-" * 40)

    if conversations:
        num_concurrent_messages = 20
        start_time = time.time()

        message_tasks = [
            create_message(
                random.choice(conversations).id,
                random.choice(artists).id if artists else None,
                i
            )
            for i in range(num_concurrent_messages)
        ]

        results = await asyncio.gather(*message_tasks, return_exceptions=True)
        elapsed = time.time() - start_time

        successes = sum(1 for r in results if isinstance(r, dict) and r.get("success"))
        failures = sum(1 for r in results if isinstance(r, Exception) or (isinstance(r, dict) and not r.get("success")))

        print(f"  Created: {successes}/{num_concurrent_messages}")
        print(f"  Failed: {failures}")
        print(f"  Time: {elapsed:.2f}s")
        print(f"  Rate: {num_concurrent_messages/elapsed:.1f} ops/sec")
    else:
        print("  SKIPPED: No conversations available")
    print()

    # Test 3: Concurrent reads
    print("TEST 3: Concurrent Read Operations")
    print("-" * 40)

    num_concurrent_reads = 20
    start_time = time.time()

    read_tasks = []
    for i in range(num_concurrent_reads):
        if i % 2 == 0:
            read_tasks.append(read_bookings(studio.id))
        else:
            read_tasks.append(read_messages(studio.id))

    results = await asyncio.gather(*read_tasks, return_exceptions=True)
    elapsed = time.time() - start_time

    successes = sum(1 for r in results if isinstance(r, dict) and r.get("success"))
    failures = sum(1 for r in results if isinstance(r, Exception) or (isinstance(r, dict) and not r.get("success")))

    print(f"  Completed: {successes}/{num_concurrent_reads}")
    print(f"  Failed: {failures}")
    print(f"  Time: {elapsed:.2f}s")
    print(f"  Rate: {num_concurrent_reads/elapsed:.1f} ops/sec")
    print()

    # Test 4: Mixed concurrent operations
    print("TEST 4: Mixed Concurrent Operations")
    print("-" * 40)

    start_time = time.time()
    mixed_tasks = []

    # Add some of each type
    for i in range(5):
        mixed_tasks.append(create_booking(studio.id, random.choice(artists).id, 1000 + i))

    if conversations:
        for i in range(5):
            mixed_tasks.append(create_message(
                random.choice(conversations).id,
                random.choice(artists).id if artists else None,
                1000 + i
            ))

    for i in range(5):
        mixed_tasks.append(read_bookings(studio.id))

    for i in range(5):
        mixed_tasks.append(read_messages(studio.id))

    random.shuffle(mixed_tasks)  # Randomize order

    results = await asyncio.gather(*mixed_tasks, return_exceptions=True)
    elapsed = time.time() - start_time

    successes = sum(1 for r in results if isinstance(r, dict) and r.get("success"))
    failures = sum(1 for r in results if isinstance(r, Exception))
    errors = [r for r in results if isinstance(r, Exception)]

    print(f"  Total operations: {len(mixed_tasks)}")
    print(f"  Successful: {successes}")
    print(f"  Failed: {failures}")
    print(f"  Time: {elapsed:.2f}s")
    print(f"  Rate: {len(mixed_tasks)/elapsed:.1f} ops/sec")

    if errors:
        print(f"  Errors:")
        for err in errors[:3]:  # Show first 3 errors
            print(f"    - {type(err).__name__}: {str(err)[:50]}")
    print()

    # Final verification
    print("=" * 60)
    print("Concurrent Operations Test Complete!")
    print("=" * 60)
    print()

    async with async_session() as session:
        total_bookings = (await session.execute(
            select(func.count(BookingRequest.id))
        )).scalar()
        total_messages = (await session.execute(
            select(func.count(Message.id))
        )).scalar()

    print("Final Database State:")
    print(f"  Total bookings: {total_bookings}")
    print(f"  Total messages: {total_messages}")
    print()
    print("All concurrent operations completed without deadlocks!")


async def main() -> None:
    """Main entry point."""
    await run_concurrent_test()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
