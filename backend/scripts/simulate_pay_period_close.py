"""
Simulate closing a pay period with commission aggregation and payout calculations.
Tests the full pay period workflow.
"""

import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Add the backend directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, func, and_

from app.database import async_session_maker, engine
from app.models.commission import EarnedCommission, PayPeriod, PayPeriodStatus
from app.models.studio import Studio
from app.models.user import User, UserRole


async_session = async_session_maker


async def simulate_pay_period_close() -> None:
    """Simulate closing a pay period."""
    print("=" * 60)
    print("InkFlow Pay Period Close Simulation")
    print("=" * 60)
    print()

    async with async_session() as session:
        # Get studio
        studio = (await session.execute(
            select(Studio).where(Studio.slug == "inkflow-main")
        )).scalar_one_or_none()

        if not studio:
            print("ERROR: Studio 'inkflow-main' not found. Run seed_data.py first!")
            return

        print(f"Studio: {studio.name}")
        print()

        # Find an open pay period or create one
        print("1. Finding open pay period...")
        open_period = (await session.execute(
            select(PayPeriod).where(
                PayPeriod.studio_id == studio.id,
                PayPeriod.status == PayPeriodStatus.OPEN,
            ).order_by(PayPeriod.start_date.desc())
        )).scalar_one_or_none()

        if not open_period:
            print("   No open pay period found. Creating one...")
            # Create a pay period for the last 2 weeks
            end_date = datetime.now(timezone.utc)
            start_date = end_date - timedelta(days=14)

            open_period = PayPeriod(
                studio_id=studio.id,
                start_date=start_date,
                end_date=end_date,
                status=PayPeriodStatus.OPEN,
            )
            session.add(open_period)
            await session.flush()
            print(f"   Created period: {start_date.date()} to {end_date.date()}")
        else:
            print(f"   Found period: {open_period.start_date.date()} to {open_period.end_date.date()}")

        print()

        # Get all unassigned commissions in the date range
        print("2. Gathering commissions for period...")
        unassigned_commissions = (await session.execute(
            select(EarnedCommission).where(
                EarnedCommission.studio_id == studio.id,
                EarnedCommission.pay_period_id == None,
                EarnedCommission.completed_at >= open_period.start_date,
                EarnedCommission.completed_at <= open_period.end_date,
            )
        )).scalars().all()

        print(f"   Found {len(unassigned_commissions)} unassigned commissions")

        # Assign commissions to the pay period
        for commission in unassigned_commissions:
            commission.pay_period_id = open_period.id

        print()

        # Calculate totals by artist
        print("3. Calculating payouts by artist...")
        print()

        artists = (await session.execute(
            select(User).where(
                User.role == UserRole.ARTIST,
                User.email.like("%inkflow-main%")
            )
        )).scalars().all()

        period_totals = {
            "service_total": 0,
            "studio_commission": 0,
            "artist_payout": 0,
            "tips_total": 0,
            "commission_count": 0,
        }

        for artist in artists:
            # Get commissions for this artist in this period
            artist_commissions = (await session.execute(
                select(EarnedCommission).where(
                    EarnedCommission.artist_id == artist.id,
                    EarnedCommission.pay_period_id == open_period.id,
                )
            )).scalars().all()

            if not artist_commissions:
                continue

            # Calculate totals
            service_total = sum(c.service_total for c in artist_commissions)
            studio_commission = sum(c.studio_commission for c in artist_commissions)
            artist_payout = sum(c.artist_payout for c in artist_commissions)
            tips_total = sum(c.tips_amount for c in artist_commissions)

            period_totals["service_total"] += service_total
            period_totals["studio_commission"] += studio_commission
            period_totals["artist_payout"] += artist_payout
            period_totals["tips_total"] += tips_total
            period_totals["commission_count"] += len(artist_commissions)

            print(f"   {artist.full_name}:")
            print(f"      Sessions: {len(artist_commissions)}")
            print(f"      Service total: ${service_total / 100:.2f}")
            print(f"      Tips: ${tips_total / 100:.2f}")
            print(f"      Studio cut: ${studio_commission / 100:.2f}")
            print(f"      Artist payout: ${artist_payout / 100:.2f}")
            print()

        # Update pay period totals
        print("4. Updating pay period totals...")
        open_period.total_service = period_totals["service_total"]
        open_period.total_studio_commission = period_totals["studio_commission"]
        open_period.total_artist_payout = period_totals["artist_payout"]
        open_period.total_tips = period_totals["tips_total"]
        open_period.commission_count = period_totals["commission_count"]

        print(f"   Total service: ${period_totals['service_total'] / 100:.2f}")
        print(f"   Total tips: ${period_totals['tips_total'] / 100:.2f}")
        print(f"   Total studio commission: ${period_totals['studio_commission'] / 100:.2f}")
        print(f"   Total artist payouts: ${period_totals['artist_payout'] / 100:.2f}")
        print(f"   Commission count: {period_totals['commission_count']}")
        print()

        # Close the pay period
        print("5. Closing pay period...")
        open_period.status = PayPeriodStatus.CLOSED
        open_period.closed_at = datetime.now(timezone.utc)

        # Commit all changes
        await session.commit()

        print(f"   Pay period closed at: {open_period.closed_at}")
        print()

        # Verify final state
        print("=" * 60)
        print("Pay Period Close Complete!")
        print("=" * 60)
        print()

        # Check all pay periods
        all_periods = (await session.execute(
            select(PayPeriod).where(
                PayPeriod.studio_id == studio.id
            ).order_by(PayPeriod.start_date.desc())
        )).scalars().all()

        print("Pay Period Summary:")
        print()
        for period in all_periods[:5]:  # Show last 5
            status_emoji = "[CLOSED]" if period.status == PayPeriodStatus.CLOSED else "[OPEN]"
            print(f"  {status_emoji} {period.start_date.date()} to {period.end_date.date()}")
            print(f"           Service: ${period.total_service / 100:.2f} | "
                  f"Tips: ${period.total_tips / 100:.2f} | "
                  f"Sessions: {period.commission_count}")
            print()

        print("All pay period operations completed successfully!")


async def main() -> None:
    """Main entry point."""
    await simulate_pay_period_close()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
