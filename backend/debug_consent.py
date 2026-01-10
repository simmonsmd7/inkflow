#!/usr/bin/env python3
"""Debug script to test consent API and see actual errors."""

import asyncio
import sys
import traceback

sys.path.insert(0, "/Users/marksimmons/tattooproject/backend")

from app.database import async_session_maker
from app.models.user import User
from app.models.studio import Studio
from app.models.consent import ConsentFormTemplate
from sqlalchemy import select


async def main():
    async with async_session_maker() as db:
        # Get the owner user
        result = await db.execute(
            select(User).where(User.email == "owner@inkflow-main.com")
        )
        user = result.scalar_one_or_none()
        print(f"User: {user.email if user else 'NOT FOUND'}")
        print(f"User ID: {user.id if user else 'N/A'}")
        print(f"User role: {user.role if user else 'N/A'}")

        if user:
            # Get studio owned by user
            result = await db.execute(
                select(Studio).where(Studio.owner_id == user.id)
            )
            studio = result.scalar_one_or_none()
            print(f"\nStudio: {studio.name if studio else 'NOT FOUND'}")
            print(f"Studio ID: {studio.id if studio else 'N/A'}")

            if studio:
                # Get consent templates for this studio
                result = await db.execute(
                    select(ConsentFormTemplate).where(
                        ConsentFormTemplate.studio_id == studio.id
                    )
                )
                templates = result.scalars().all()
                print(f"\nTemplates found: {len(templates)}")
                for t in templates:
                    print(f"  - {t.name} (v{t.version})")
                    # Check if template has all required fields
                    print(f"    is_active: {t.is_active}")
                    print(f"    content: {t.content[:50] if t.content else 'None'}...")
                    print(f"    fields: {t.fields}")


if __name__ == "__main__":
    asyncio.run(main())
