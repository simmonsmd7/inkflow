#!/usr/bin/env python3
"""
Migration script to add refund fields to the booking_requests table.

Run this script to add the refund tracking columns without losing existing data.
For a fresh database, these columns are created automatically by init_db().

Usage:
    cd backend
    python scripts/migrate_add_refund_fields.py
"""

import asyncio
import sys
from pathlib import Path

# Add the backend directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from app.database import engine


async def add_refund_columns():
    """Add refund tracking columns to booking_requests table."""

    columns_to_add = [
        ("refund_amount", "INTEGER"),
        ("refund_stripe_id", "VARCHAR(255)"),
        ("refunded_at", "TIMESTAMP WITH TIME ZONE"),
        ("refund_reason", "TEXT"),
        ("refund_initiated_by_id", "UUID REFERENCES users(id) ON DELETE SET NULL"),
    ]

    async with engine.begin() as conn:
        # Check which columns already exist (PostgreSQL query)
        result = await conn.execute(
            text(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'booking_requests'
                """
            )
        )
        existing_columns = {row[0] for row in result.fetchall()}

        for column_name, column_type in columns_to_add:
            if column_name in existing_columns:
                print(f"  Column '{column_name}' already exists, skipping...")
                continue

            try:
                await conn.execute(
                    text(f"ALTER TABLE booking_requests ADD COLUMN {column_name} {column_type}")
                )
                print(f"  Added column '{column_name}' ({column_type})")
            except Exception as e:
                print(f"  Error adding column '{column_name}': {e}")

        print("\nMigration complete!")


async def main():
    print("Adding refund fields to booking_requests table...\n")
    await add_refund_columns()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
