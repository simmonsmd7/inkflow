"""
Verify system performance metrics.
Tests API response times, database query performance, and throughput.
"""

import asyncio
import statistics
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Add the backend directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, func, text

from app.database import async_session_maker, engine
from app.models.aftercare import AftercareSent, AftercareTemplate
from app.models.booking import BookingRequest, BookingRequestStatus
from app.models.commission import EarnedCommission, PayPeriod
from app.models.consent import ConsentFormSubmission
from app.models.message import Conversation, Message
from app.models.studio import Studio
from app.models.user import User, UserRole


async_session = async_session_maker


class PerformanceMetrics:
    """Track performance metrics."""

    def __init__(self, name: str):
        self.name = name
        self.times: list[float] = []

    def record(self, duration_ms: float) -> None:
        self.times.append(duration_ms)

    @property
    def count(self) -> int:
        return len(self.times)

    @property
    def min_time(self) -> float:
        return min(self.times) if self.times else 0

    @property
    def max_time(self) -> float:
        return max(self.times) if self.times else 0

    @property
    def avg_time(self) -> float:
        return statistics.mean(self.times) if self.times else 0

    @property
    def median_time(self) -> float:
        return statistics.median(self.times) if self.times else 0

    @property
    def p95_time(self) -> float:
        if len(self.times) < 20:
            return self.max_time
        sorted_times = sorted(self.times)
        idx = int(len(sorted_times) * 0.95)
        return sorted_times[idx]

    def summary(self) -> str:
        return (
            f"{self.name}:\n"
            f"  Count: {self.count}\n"
            f"  Min: {self.min_time:.2f}ms | "
            f"Max: {self.max_time:.2f}ms | "
            f"Avg: {self.avg_time:.2f}ms | "
            f"Median: {self.median_time:.2f}ms | "
            f"P95: {self.p95_time:.2f}ms"
        )

    def check_threshold(self, threshold_ms: float) -> tuple[bool, str]:
        """Check if p95 is below threshold."""
        passed = self.p95_time <= threshold_ms
        status = "[PASS]" if passed else "[FAIL]"
        return passed, f"{status} {self.name}: P95 {self.p95_time:.2f}ms (threshold: {threshold_ms}ms)"


async def measure_query(session, query, iterations: int = 10) -> list[float]:
    """Measure query execution time."""
    times = []
    for _ in range(iterations):
        start = time.perf_counter()
        await session.execute(query)
        end = time.perf_counter()
        times.append((end - start) * 1000)  # Convert to ms
    return times


async def test_simple_queries(studio_id) -> list[PerformanceMetrics]:
    """Test simple single-table queries."""
    metrics = []

    async with async_session() as session:
        # Count queries
        m = PerformanceMetrics("Count bookings")
        for t in await measure_query(
            session,
            select(func.count(BookingRequest.id)).where(BookingRequest.studio_id == studio_id),
            iterations=20
        ):
            m.record(t)
        metrics.append(m)

        # Simple select
        m = PerformanceMetrics("Select studio by slug")
        for t in await measure_query(
            session,
            select(Studio).where(Studio.slug == "inkflow-main"),
            iterations=20
        ):
            m.record(t)
        metrics.append(m)

        # Select with limit
        m = PerformanceMetrics("Select 10 bookings")
        for t in await measure_query(
            session,
            select(BookingRequest).where(BookingRequest.studio_id == studio_id).limit(10),
            iterations=20
        ):
            m.record(t)
        metrics.append(m)

        # Select with enum filter
        m = PerformanceMetrics("Select pending bookings")
        for t in await measure_query(
            session,
            select(BookingRequest).where(
                BookingRequest.studio_id == studio_id,
                BookingRequest.status == BookingRequestStatus.PENDING,
            ).limit(10),
            iterations=20
        ):
            m.record(t)
        metrics.append(m)

    return metrics


async def test_join_queries(studio_id) -> list[PerformanceMetrics]:
    """Test queries with joins."""
    metrics = []

    async with async_session() as session:
        # Conversation with messages count (subquery)
        m = PerformanceMetrics("Conversation list with message count")
        for t in await measure_query(
            session,
            select(
                Conversation,
                func.count(Message.id).label("message_count")
            ).outerjoin(Message).where(
                Conversation.studio_id == studio_id
            ).group_by(Conversation.id).limit(10),
            iterations=20
        ):
            m.record(t)
        metrics.append(m)

        # Booking with artist (join)
        m = PerformanceMetrics("Bookings with artist join")
        for t in await measure_query(
            session,
            select(BookingRequest, User).outerjoin(
                User, BookingRequest.assigned_artist_id == User.id
            ).where(
                BookingRequest.studio_id == studio_id
            ).limit(10),
            iterations=20
        ):
            m.record(t)
        metrics.append(m)

        # Commission aggregation by artist
        m = PerformanceMetrics("Commission totals by artist")
        for t in await measure_query(
            session,
            select(
                EarnedCommission.artist_id,
                func.sum(EarnedCommission.service_total).label("total_service"),
                func.sum(EarnedCommission.artist_payout).label("total_payout"),
                func.count(EarnedCommission.id).label("session_count"),
            ).where(
                EarnedCommission.studio_id == studio_id
            ).group_by(EarnedCommission.artist_id),
            iterations=20
        ):
            m.record(t)
        metrics.append(m)

    return metrics


async def test_complex_queries(studio_id) -> list[PerformanceMetrics]:
    """Test complex analytical queries."""
    metrics = []

    async with async_session() as session:
        # Dashboard summary (multiple aggregations)
        m = PerformanceMetrics("Dashboard booking summary")
        for t in await measure_query(
            session,
            select(
                BookingRequest.status,
                func.count(BookingRequest.id).label("count"),
                func.sum(BookingRequest.quoted_price).label("total_quoted"),
            ).where(
                BookingRequest.studio_id == studio_id
            ).group_by(BookingRequest.status),
            iterations=20
        ):
            m.record(t)
        metrics.append(m)

        # Recent activity (order by + limit)
        m = PerformanceMetrics("Recent conversations (ordered)")
        for t in await measure_query(
            session,
            select(Conversation).where(
                Conversation.studio_id == studio_id
            ).order_by(Conversation.updated_at.desc()).limit(20),
            iterations=20
        ):
            m.record(t)
        metrics.append(m)

        # Pay period with commission totals
        m = PerformanceMetrics("Pay period with commission totals")
        for t in await measure_query(
            session,
            select(
                PayPeriod,
                func.sum(EarnedCommission.service_total).label("calc_total"),
            ).outerjoin(
                EarnedCommission, EarnedCommission.pay_period_id == PayPeriod.id
            ).where(
                PayPeriod.studio_id == studio_id
            ).group_by(PayPeriod.id).limit(5),
            iterations=20
        ):
            m.record(t)
        metrics.append(m)

    return metrics


async def test_concurrent_read_performance(studio_id) -> PerformanceMetrics:
    """Test concurrent read performance."""
    m = PerformanceMetrics("Concurrent reads (20 parallel)")

    async def read_task():
        async with async_session() as session:
            await session.execute(
                select(BookingRequest).where(
                    BookingRequest.studio_id == studio_id
                ).limit(10)
            )

    # Run 5 rounds of 20 concurrent reads
    for _ in range(5):
        start = time.perf_counter()
        await asyncio.gather(*[read_task() for _ in range(20)])
        end = time.perf_counter()
        m.record((end - start) * 1000)  # Total time for 20 reads

    return m


async def test_write_performance(studio_id, artist_id) -> PerformanceMetrics:
    """Test write (insert) performance."""
    m = PerformanceMetrics("Single row insert")

    async with async_session() as session:
        for i in range(20):
            start = time.perf_counter()
            booking = BookingRequest(
                studio_id=studio_id,
                client_name=f"Perf Test {i}",
                client_email=f"perf.{i}@example.com",
                design_idea="Performance test",
                placement="Test",
                size="SMALL",
                status=BookingRequestStatus.PENDING,
            )
            session.add(booking)
            await session.flush()
            end = time.perf_counter()
            m.record((end - start) * 1000)

        # Rollback to not persist test data
        await session.rollback()

    return m


async def test_database_health() -> dict:
    """Test basic database health metrics."""
    async with async_session() as session:
        # Test connection
        result = await session.execute(text("SELECT 1"))
        assert result.scalar() == 1

        # Get table sizes
        tables_query = text("""
            SELECT
                relname as table_name,
                n_live_tup as row_count
            FROM pg_stat_user_tables
            ORDER BY n_live_tup DESC
            LIMIT 10
        """)
        result = await session.execute(tables_query)
        tables = {row[0]: row[1] for row in result.fetchall()}

        # Get database size
        size_query = text("SELECT pg_database_size(current_database())")
        result = await session.execute(size_query)
        db_size = result.scalar()

        return {
            "connection": "OK",
            "tables": tables,
            "db_size_mb": round(db_size / (1024 * 1024), 2) if db_size else 0,
        }


async def run_performance_verification() -> None:
    """Run all performance verification tests."""
    print("=" * 60)
    print("InkFlow Performance Verification")
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

        studio_id = studio.id
        artist_id = artist.id if artist else None

    print(f"Testing with Studio: {studio.name}")
    print()

    # 1. Database Health
    print("=" * 60)
    print("DATABASE HEALTH")
    print("=" * 60)
    health = await test_database_health()
    print(f"  Connection: {health['connection']}")
    print(f"  Database Size: {health['db_size_mb']} MB")
    print(f"  Table Row Counts:")
    for table, count in health["tables"].items():
        print(f"    {table}: {count} rows")
    print()

    # 2. Simple Queries
    print("=" * 60)
    print("SIMPLE QUERY PERFORMANCE")
    print("=" * 60)
    all_metrics = []

    simple_metrics = await test_simple_queries(studio_id)
    for m in simple_metrics:
        print(m.summary())
        print()
    all_metrics.extend(simple_metrics)

    # 3. Join Queries
    print("=" * 60)
    print("JOIN QUERY PERFORMANCE")
    print("=" * 60)
    join_metrics = await test_join_queries(studio_id)
    for m in join_metrics:
        print(m.summary())
        print()
    all_metrics.extend(join_metrics)

    # 4. Complex Queries
    print("=" * 60)
    print("COMPLEX QUERY PERFORMANCE")
    print("=" * 60)
    complex_metrics = await test_complex_queries(studio_id)
    for m in complex_metrics:
        print(m.summary())
        print()
    all_metrics.extend(complex_metrics)

    # 5. Concurrent Reads
    print("=" * 60)
    print("CONCURRENT READ PERFORMANCE")
    print("=" * 60)
    concurrent_metric = await test_concurrent_read_performance(studio_id)
    print(concurrent_metric.summary())
    print()
    all_metrics.append(concurrent_metric)

    # 6. Write Performance
    print("=" * 60)
    print("WRITE PERFORMANCE")
    print("=" * 60)
    write_metric = await test_write_performance(studio_id, artist_id)
    print(write_metric.summary())
    print()
    all_metrics.append(write_metric)

    # Performance Thresholds
    print("=" * 60)
    print("PERFORMANCE THRESHOLDS CHECK")
    print("=" * 60)
    print()

    thresholds = {
        "Count bookings": 50,
        "Select studio by slug": 20,
        "Select 10 bookings": 50,
        "Select pending bookings": 50,
        "Conversation list with message count": 100,
        "Bookings with artist join": 100,
        "Commission totals by artist": 100,
        "Dashboard booking summary": 100,
        "Recent conversations (ordered)": 100,
        "Pay period with commission totals": 150,
        "Concurrent reads (20 parallel)": 500,  # Total for 20 reads
        "Single row insert": 50,
    }

    passed = 0
    failed = 0

    for m in all_metrics:
        threshold = thresholds.get(m.name, 100)  # Default 100ms
        is_pass, msg = m.check_threshold(threshold)
        print(f"  {msg}")
        if is_pass:
            passed += 1
        else:
            failed += 1

    print()
    print("=" * 60)
    print("PERFORMANCE VERIFICATION SUMMARY")
    print("=" * 60)
    print()
    print(f"  Passed: {passed}/{passed + failed}")
    print(f"  Failed: {failed}/{passed + failed}")
    print()

    if failed == 0:
        print("All performance thresholds met!")
    else:
        print(f"WARNING: {failed} performance thresholds exceeded!")


async def main() -> None:
    """Main entry point."""
    await run_performance_verification()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
