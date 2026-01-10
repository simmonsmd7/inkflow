#!/usr/bin/env python3
"""Debug script to simulate the exact consent list_templates API flow."""

import asyncio
import sys
import traceback

sys.path.insert(0, "/Users/marksimmons/tattooproject/backend")

from sqlalchemy import select, func
from app.database import async_session_maker
from app.models.user import User
from app.models.studio import Studio
from app.models.consent import ConsentFormTemplate


async def main():
    print("=== Simulating list_templates API flow ===\n")

    try:
        async with async_session_maker() as db:
            # Step 1: Get user (simulating require_role)
            print("Step 1: Get current user...")
            result = await db.execute(
                select(User).where(User.email == "owner@inkflow-main.com")
            )
            user = result.scalar_one_or_none()
            if not user:
                print("ERROR: User not found")
                return
            print(f"  User: {user.email} (role: {user.role})")

            # Step 2: Get studio (simulating _get_user_studio)
            print("\nStep 2: Get user's studio...")
            result = await db.execute(
                select(Studio).where(
                    Studio.owner_id == user.id,
                    Studio.deleted_at.is_(None)
                )
            )
            studio = result.scalar_one_or_none()
            if not studio:
                print("ERROR: Studio not found")
                return
            print(f"  Studio: {studio.name} (id: {studio.id})")

            # Step 3: Build query (simulating list_templates)
            print("\nStep 3: Query templates...")
            query = select(ConsentFormTemplate).where(
                ConsentFormTemplate.studio_id == studio.id,
                ConsentFormTemplate.deleted_at.is_(None),
                ConsentFormTemplate.is_active == True,
            )
            query = query.order_by(
                ConsentFormTemplate.is_default.desc(),
                ConsentFormTemplate.name
            )

            # Step 4: Count
            print("\nStep 4: Count total...")
            count_query = select(func.count()).select_from(query.subquery())
            total = (await db.execute(count_query)).scalar() or 0
            print(f"  Total templates: {total}")

            # Step 5: Fetch templates
            print("\nStep 5: Fetch templates...")
            page = 1
            page_size = 10
            query = query.offset((page - 1) * page_size).limit(page_size)
            result = await db.execute(query)
            templates = result.scalars().all()
            print(f"  Templates fetched: {len(templates)}")

            # Step 6: Convert to summary (simulating _template_to_summary)
            print("\nStep 6: Convert to summary response...")
            summaries = []
            for t in templates:
                print(f"\n  Processing template: {t.name}")
                print(f"    id: {t.id}")
                print(f"    name: {t.name}")
                print(f"    description: {t.description}")
                print(f"    version: {t.version}")
                print(f"    is_active: {t.is_active}")
                print(f"    is_default: {t.is_default}")
                print(f"    requires_photo_id: {t.requires_photo_id}")
                print(f"    requires_signature: {t.requires_signature}")
                print(f"    fields type: {type(t.fields)}")
                print(f"    fields: {t.fields}")
                field_count = len(t.fields) if t.fields else 0
                print(f"    field_count: {field_count}")
                print(f"    use_count: {t.use_count}")
                print(f"    last_used_at: {t.last_used_at}")
                print(f"    created_at: {t.created_at}")
                print(f"    updated_at: {t.updated_at}")

                summary = {
                    "id": str(t.id),
                    "name": t.name,
                    "description": t.description,
                    "version": t.version,
                    "is_active": t.is_active,
                    "is_default": t.is_default,
                    "requires_photo_id": t.requires_photo_id,
                    "requires_signature": t.requires_signature,
                    "field_count": field_count,
                    "use_count": t.use_count,
                    "last_used_at": str(t.last_used_at) if t.last_used_at else None,
                    "created_at": str(t.created_at),
                    "updated_at": str(t.updated_at),
                }
                summaries.append(summary)
                print(f"    Summary created: OK")

            # Step 7: Build final response
            print("\nStep 7: Build final response...")
            response = {
                "templates": summaries,
                "total": total,
                "page": page,
                "page_size": page_size,
            }
            print(f"  Response: {response}")

            print("\n=== ALL STEPS COMPLETED SUCCESSFULLY ===")

    except Exception as e:
        print(f"\n!!! EXCEPTION CAUGHT !!!")
        print(f"Type: {type(e).__name__}")
        print(f"Message: {e}")
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
