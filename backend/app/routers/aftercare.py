"""Aftercare router for managing aftercare templates and sent instructions."""

import secrets
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.aftercare import (
    AftercareFollowUp,
    AftercareSent,
    AftercareSentStatus,
    AftercareTemplate,
    FollowUpStatus,
    FollowUpType,
    HealingIssueReport,
    HealingIssueSeverity,
    HealingIssueStatus,
    TattooPlacement,
    TattooType,
)
from app.models.booking import BookingRequest
from app.models.studio import Studio
from app.models.user import User, UserRole
from app.schemas.aftercare import (
    AftercareSendInput,
    AftercareSentListResponse,
    AftercareSentResponse,
    AftercareSentSummary,
    AftercareExtraData,
    AftercareTemplateCreate,
    AftercareTemplateListResponse,
    AftercareTemplateResponse,
    AftercareTemplateSummary,
    AftercareTemplateUpdate,
    ClientAftercareView,
    FollowUpSummary,
    HealingIssueCreate,
    HealingIssueListResponse,
    HealingIssueResponse,
    HealingIssueSummary,
    HealingIssueUpdate,
    ReportIssueInput,
)
from app.services.auth import get_current_user, require_role

router = APIRouter(prefix="/aftercare", tags=["aftercare"])


# === Pre-built Aftercare Templates ===

PREBUILT_TEMPLATES = {
    "standard": {
        "name": "Standard Aftercare Instructions",
        "description": "General aftercare instructions suitable for most tattoos.",
        "tattoo_type": None,
        "placement": None,
        "instructions_html": """
<h2>Tattoo Aftercare Instructions</h2>

<h3>First 24 Hours</h3>
<ul>
    <li>Leave the bandage on for 2-4 hours, or as directed by your artist</li>
    <li>When you remove the bandage, gently wash the tattoo with lukewarm water and fragrance-free soap</li>
    <li>Pat dry with a clean paper towel - do not rub</li>
    <li>Apply a thin layer of recommended ointment (Aquaphor, A&D, or as directed)</li>
</ul>

<h3>Days 1-14: Healing Phase</h3>
<ul>
    <li>Wash your tattoo 2-3 times daily with fragrance-free soap</li>
    <li>Apply a thin layer of unscented lotion or ointment after washing</li>
    <li>Do NOT scratch, pick, or peel any flaking skin</li>
    <li>Avoid soaking the tattoo - no baths, pools, hot tubs, or ocean</li>
    <li>Keep the tattoo out of direct sunlight</li>
    <li>Wear loose, breathable clothing over the tattoo</li>
</ul>

<h3>Weeks 2-4: Final Healing</h3>
<ul>
    <li>Continue moisturizing as the skin fully heals</li>
    <li>The tattoo may appear slightly dull during this phase - this is normal</li>
    <li>Once fully healed, always apply SPF 30+ sunscreen when exposed to sun</li>
</ul>

<h3>Warning Signs - Contact Us If You Experience:</h3>
<ul>
    <li>Excessive redness or swelling after 48 hours</li>
    <li>Pus or discharge (not normal plasma weeping)</li>
    <li>Fever or chills</li>
    <li>Red streaks extending from the tattoo</li>
    <li>Unusual or worsening pain</li>
</ul>
""",
        "instructions_plain": """TATTOO AFTERCARE INSTRUCTIONS

FIRST 24 HOURS
- Leave the bandage on for 2-4 hours, or as directed by your artist
- When you remove the bandage, gently wash the tattoo with lukewarm water and fragrance-free soap
- Pat dry with a clean paper towel - do not rub
- Apply a thin layer of recommended ointment (Aquaphor, A&D, or as directed)

DAYS 1-14: HEALING PHASE
- Wash your tattoo 2-3 times daily with fragrance-free soap
- Apply a thin layer of unscented lotion or ointment after washing
- Do NOT scratch, pick, or peel any flaking skin
- Avoid soaking the tattoo - no baths, pools, hot tubs, or ocean
- Keep the tattoo out of direct sunlight
- Wear loose, breathable clothing over the tattoo

WEEKS 2-4: FINAL HEALING
- Continue moisturizing as the skin fully heals
- The tattoo may appear slightly dull during this phase - this is normal
- Once fully healed, always apply SPF 30+ sunscreen when exposed to sun

WARNING SIGNS - CONTACT US IF YOU EXPERIENCE:
- Excessive redness or swelling after 48 hours
- Pus or discharge (not normal plasma weeping)
- Fever or chills
- Red streaks extending from the tattoo
- Unusual or worsening pain
""",
        "extra_data": {
            "days_covered": 28,
            "key_points": [
                "Keep clean and moisturized",
                "Don't scratch or pick",
                "Avoid sun and water submersion",
                "Wear loose clothing"
            ],
            "products_recommended": [
                "Aquaphor (first few days)",
                "Unscented lotion (after day 3-4)",
                "Fragrance-free soap"
            ],
            "products_to_avoid": [
                "Scented lotions or soaps",
                "Alcohol-based products",
                "Petroleum jelly (Vaseline)",
                "Neosporin or antibiotic ointments"
            ],
            "warning_signs": [
                "Excessive redness or swelling after 48 hours",
                "Pus or discharge",
                "Fever or chills",
                "Red streaks from tattoo",
                "Unusual pain"
            ]
        }
    },
    "fine_line": {
        "name": "Fine Line Tattoo Aftercare",
        "description": "Specialized aftercare for delicate fine line and single-needle tattoos.",
        "tattoo_type": "fine_line",
        "placement": None,
        "instructions_html": """
<h2>Fine Line Tattoo Aftercare</h2>

<p><strong>Fine line tattoos require extra gentle care during healing.</strong></p>

<h3>First 24 Hours</h3>
<ul>
    <li>Leave the bandage on for 2-3 hours</li>
    <li>Gently wash with lukewarm water and mild, fragrance-free soap</li>
    <li>Apply a very thin layer of ointment - less is more with fine line work</li>
</ul>

<h3>Days 1-10: Gentle Healing</h3>
<ul>
    <li>Wash gently 2x daily - do not scrub</li>
    <li>Apply minimal ointment/lotion - over-moisturizing can blur fine lines</li>
    <li>Absolutely no picking or scratching - fine lines are delicate</li>
    <li>Avoid tight clothing that might rub against the tattoo</li>
</ul>

<h3>Important Notes for Fine Line Tattoos</h3>
<ul>
    <li>Fine line tattoos may appear to fade during healing - this is normal</li>
    <li>Some lines may need touch-up after healing - this is common</li>
    <li>Sun exposure will fade fine lines faster - always use sunscreen once healed</li>
</ul>
""",
        "instructions_plain": """FINE LINE TATTOO AFTERCARE

Fine line tattoos require extra gentle care during healing.

FIRST 24 HOURS
- Leave the bandage on for 2-3 hours
- Gently wash with lukewarm water and mild, fragrance-free soap
- Apply a very thin layer of ointment - less is more with fine line work

DAYS 1-10: GENTLE HEALING
- Wash gently 2x daily - do not scrub
- Apply minimal ointment/lotion - over-moisturizing can blur fine lines
- Absolutely no picking or scratching - fine lines are delicate
- Avoid tight clothing that might rub against the tattoo

IMPORTANT NOTES FOR FINE LINE TATTOOS
- Fine line tattoos may appear to fade during healing - this is normal
- Some lines may need touch-up after healing - this is common
- Sun exposure will fade fine lines faster - always use sunscreen once healed
""",
        "extra_data": {
            "days_covered": 14,
            "key_points": [
                "Less product is better",
                "Extra gentle handling",
                "Touch-ups are normal",
                "Protect from sun"
            ],
            "products_recommended": [
                "Thin layer of Aquaphor",
                "Light unscented lotion"
            ],
            "products_to_avoid": [
                "Heavy creams",
                "Petroleum jelly"
            ],
            "warning_signs": [
                "Blurring of lines",
                "Excessive scabbing",
                "Signs of infection"
            ]
        }
    },
    "hand_finger": {
        "name": "Hand & Finger Tattoo Aftercare",
        "description": "Special care instructions for hand, finger, and palm tattoos.",
        "tattoo_type": None,
        "placement": "hand",
        "instructions_html": """
<h2>Hand & Finger Tattoo Aftercare</h2>

<p><strong>Hand and finger tattoos require extra attention due to constant use and exposure.</strong></p>

<h3>First 24 Hours</h3>
<ul>
    <li>Leave bandage on for 2-3 hours</li>
    <li>Wash very gently - hands get dirty quickly</li>
    <li>Apply a thin layer of ointment</li>
    <li>Try to limit hand washing to essentials today</li>
</ul>

<h3>Days 1-14: Active Care</h3>
<ul>
    <li>Wash tattoo after every hand wash (you'll be washing a lot)</li>
    <li>Reapply ointment/lotion frequently - hands dry out quickly</li>
    <li>Avoid harsh soaps and hand sanitizers directly on tattoo</li>
    <li>Wear gloves for cleaning, dishes, or dirty work</li>
    <li>Avoid gym/lifting for the first week if possible</li>
</ul>

<h3>Important Notes</h3>
<ul>
    <li>Hand/finger tattoos fade faster than other areas due to skin regeneration</li>
    <li>Touch-ups are common and often expected - usually offered free within first year</li>
    <li>Some areas (sides of fingers, palms) may not hold ink well</li>
    <li>Be patient - these take longer to heal due to constant use</li>
</ul>
""",
        "instructions_plain": """HAND & FINGER TATTOO AFTERCARE

Hand and finger tattoos require extra attention due to constant use and exposure.

FIRST 24 HOURS
- Leave bandage on for 2-3 hours
- Wash very gently - hands get dirty quickly
- Apply a thin layer of ointment
- Try to limit hand washing to essentials today

DAYS 1-14: ACTIVE CARE
- Wash tattoo after every hand wash
- Reapply ointment/lotion frequently - hands dry out quickly
- Avoid harsh soaps and hand sanitizers directly on tattoo
- Wear gloves for cleaning, dishes, or dirty work
- Avoid gym/lifting for the first week if possible

IMPORTANT NOTES
- Hand/finger tattoos fade faster due to skin regeneration
- Touch-ups are common and often expected
- Some areas (sides of fingers, palms) may not hold ink well
- Be patient - these take longer to heal
""",
        "extra_data": {
            "days_covered": 21,
            "key_points": [
                "Frequent moisturizing",
                "Wear gloves for dirty work",
                "Touch-ups are normal",
                "Avoid hand sanitizer on tattoo"
            ],
            "products_recommended": [
                "Gentle hand soap",
                "Travel-size lotion for reapplication"
            ],
            "products_to_avoid": [
                "Hand sanitizer",
                "Harsh dish soap",
                "Industrial cleaners"
            ],
            "warning_signs": [
                "Cracking or splitting skin",
                "Ink falling out excessively",
                "Signs of infection"
            ]
        }
    },
    "color": {
        "name": "Color Tattoo Aftercare",
        "description": "Care instructions to preserve vibrant colors in color tattoos.",
        "tattoo_type": "traditional",
        "placement": None,
        "instructions_html": """
<h2>Color Tattoo Aftercare</h2>

<p><strong>Color tattoos require careful aftercare to maintain vibrant colors during healing.</strong></p>

<h3>First 24 Hours</h3>
<ul>
    <li>Leave bandage on for 3-4 hours (color work may ooze more)</li>
    <li>Wash gently - you may see colored plasma, this is normal</li>
    <li>Apply ointment as directed</li>
</ul>

<h3>Days 1-14: Color Preservation</h3>
<ul>
    <li>Keep moisturized - dry skin can pull out color</li>
    <li>Absolutely no sun exposure - UV fades colors quickly</li>
    <li>No picking! Picking can remove color from specific areas</li>
    <li>Avoid swimming - chlorine can affect color</li>
</ul>

<h3>Long-Term Color Care</h3>
<ul>
    <li>Always use SPF 50+ on healed tattoo when in sun</li>
    <li>Consider tattoo-specific sunscreen products</li>
    <li>Light colors (yellow, white, pink) may need touch-ups</li>
    <li>Keep skin moisturized to maintain vibrancy</li>
</ul>
""",
        "instructions_plain": """COLOR TATTOO AFTERCARE

Color tattoos require careful aftercare to maintain vibrant colors during healing.

FIRST 24 HOURS
- Leave bandage on for 3-4 hours (color work may ooze more)
- Wash gently - you may see colored plasma, this is normal
- Apply ointment as directed

DAYS 1-14: COLOR PRESERVATION
- Keep moisturized - dry skin can pull out color
- Absolutely no sun exposure - UV fades colors quickly
- No picking! Picking can remove color from specific areas
- Avoid swimming - chlorine can affect color

LONG-TERM COLOR CARE
- Always use SPF 50+ on healed tattoo when in sun
- Consider tattoo-specific sunscreen products
- Light colors (yellow, white, pink) may need touch-ups
- Keep skin moisturized to maintain vibrancy
""",
        "extra_data": {
            "days_covered": 28,
            "key_points": [
                "Avoid sun exposure",
                "Stay moisturized",
                "No picking colors",
                "Use high SPF sunscreen"
            ],
            "products_recommended": [
                "SPF 50+ sunscreen",
                "Tattoo-specific aftercare products"
            ],
            "products_to_avoid": [
                "Chlorinated water",
                "Tanning beds"
            ],
            "warning_signs": [
                "Colors looking very dull",
                "Excessive scabbing over color",
                "Patchy color loss"
            ]
        }
    }
}


# === Helper Functions ===

async def get_user_studio(user: User, db: AsyncSession) -> Studio:
    """Get the studio associated with the user."""
    # For owner, get their owned studio
    if user.role == UserRole.OWNER:
        stmt = select(Studio).where(Studio.owner_id == user.id, Studio.deleted_at.is_(None))
        result = await db.execute(stmt)
        studio = result.scalar_one_or_none()
        if not studio:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No studio found for this user"
            )
        return studio

    # For artists/receptionists, need to find their studio through profile or assignment
    # For simplicity, we'll get the first active studio (can be refined later)
    stmt = select(Studio).where(Studio.deleted_at.is_(None)).limit(1)
    result = await db.execute(stmt)
    studio = result.scalar_one_or_none()
    if not studio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No studio found"
        )
    return studio


def template_to_summary(template: AftercareTemplate) -> AftercareTemplateSummary:
    """Convert template model to summary schema."""
    return AftercareTemplateSummary(
        id=template.id,
        name=template.name,
        description=template.description,
        tattoo_type=template.tattoo_type.value if template.tattoo_type else None,
        placement=template.placement.value if template.placement else None,
        is_active=template.is_active,
        is_default=template.is_default,
        use_count=template.use_count,
        last_used_at=template.last_used_at,
        created_at=template.created_at,
    )


def template_to_response(template: AftercareTemplate) -> AftercareTemplateResponse:
    """Convert template model to full response schema."""
    return AftercareTemplateResponse(
        id=template.id,
        name=template.name,
        description=template.description,
        tattoo_type=template.tattoo_type.value if template.tattoo_type else None,
        placement=template.placement.value if template.placement else None,
        is_active=template.is_active,
        is_default=template.is_default,
        use_count=template.use_count,
        last_used_at=template.last_used_at,
        created_at=template.created_at,
        instructions_html=template.instructions_html,
        instructions_plain=template.instructions_plain,
        extra_data=AftercareExtraData(**template.extra_data) if template.extra_data else None,
        created_by_id=template.created_by_id,
        updated_at=template.updated_at,
    )


# === Pre-built Template Endpoints ===

@router.get("/prebuilt", response_model=dict)
async def list_prebuilt_templates(
    current_user: User = Depends(get_current_user),
):
    """List available pre-built aftercare templates."""
    templates = []
    for key, template in PREBUILT_TEMPLATES.items():
        templates.append({
            "id": key,
            "name": template["name"],
            "description": template["description"],
            "tattoo_type": template["tattoo_type"],
            "placement": template["placement"],
        })
    return {"templates": templates}


@router.post("/prebuilt/{template_id}/create", response_model=AftercareTemplateResponse)
async def create_from_prebuilt(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.ARTIST])),
):
    """Create a template from a pre-built template."""
    if template_id not in PREBUILT_TEMPLATES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pre-built template '{template_id}' not found"
        )

    prebuilt = PREBUILT_TEMPLATES[template_id]
    studio = await get_user_studio(current_user, db)

    # Create template from prebuilt
    template = AftercareTemplate(
        studio_id=studio.id,
        name=prebuilt["name"],
        description=prebuilt["description"],
        tattoo_type=TattooType(prebuilt["tattoo_type"]) if prebuilt["tattoo_type"] else None,
        placement=TattooPlacement(prebuilt["placement"]) if prebuilt["placement"] else None,
        instructions_html=prebuilt["instructions_html"],
        instructions_plain=prebuilt["instructions_plain"],
        extra_data=prebuilt["extra_data"],
        is_active=True,
        is_default=False,
        created_by_id=current_user.id,
    )

    db.add(template)
    await db.commit()
    await db.refresh(template)

    return template_to_response(template)


# === Template CRUD Endpoints ===

@router.get("/templates", response_model=AftercareTemplateListResponse)
async def list_templates(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    is_active: Optional[bool] = None,
    tattoo_type: Optional[str] = None,
    placement: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List aftercare templates for the studio."""
    studio = await get_user_studio(current_user, db)

    # Build query
    stmt = select(AftercareTemplate).where(
        AftercareTemplate.studio_id == studio.id,
        AftercareTemplate.deleted_at.is_(None),
    )

    if is_active is not None:
        stmt = stmt.where(AftercareTemplate.is_active == is_active)

    if tattoo_type:
        stmt = stmt.where(AftercareTemplate.tattoo_type == TattooType(tattoo_type))

    if placement:
        stmt = stmt.where(AftercareTemplate.placement == TattooPlacement(placement))

    # Get total count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    # Apply pagination
    stmt = stmt.order_by(AftercareTemplate.is_default.desc(), AftercareTemplate.name)
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(stmt)
    templates = result.scalars().all()

    return AftercareTemplateListResponse(
        items=[template_to_summary(t) for t in templates],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.post("/templates", response_model=AftercareTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    template_in: AftercareTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.ARTIST])),
):
    """Create a new aftercare template."""
    studio = await get_user_studio(current_user, db)

    # If setting as default, unset other defaults
    if template_in.is_default:
        stmt = select(AftercareTemplate).where(
            AftercareTemplate.studio_id == studio.id,
            AftercareTemplate.is_default == True,
            AftercareTemplate.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        for existing in result.scalars().all():
            existing.is_default = False

    template = AftercareTemplate(
        studio_id=studio.id,
        name=template_in.name,
        description=template_in.description,
        tattoo_type=TattooType(template_in.tattoo_type) if template_in.tattoo_type else None,
        placement=TattooPlacement(template_in.placement) if template_in.placement else None,
        instructions_html=template_in.instructions_html,
        instructions_plain=template_in.instructions_plain,
        extra_data=template_in.extra_data.model_dump() if template_in.extra_data else None,
        is_active=template_in.is_active,
        is_default=template_in.is_default,
        created_by_id=current_user.id,
    )

    db.add(template)
    await db.commit()
    await db.refresh(template)

    return template_to_response(template)


@router.get("/templates/{template_id}", response_model=AftercareTemplateResponse)
async def get_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific aftercare template."""
    studio = await get_user_studio(current_user, db)

    stmt = select(AftercareTemplate).where(
        AftercareTemplate.id == template_id,
        AftercareTemplate.studio_id == studio.id,
        AftercareTemplate.deleted_at.is_(None),
    )
    result = await db.execute(stmt)
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )

    return template_to_response(template)


@router.patch("/templates/{template_id}", response_model=AftercareTemplateResponse)
async def update_template(
    template_id: str,
    template_in: AftercareTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.ARTIST])),
):
    """Update an aftercare template."""
    studio = await get_user_studio(current_user, db)

    stmt = select(AftercareTemplate).where(
        AftercareTemplate.id == template_id,
        AftercareTemplate.studio_id == studio.id,
        AftercareTemplate.deleted_at.is_(None),
    )
    result = await db.execute(stmt)
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )

    # If setting as default, unset other defaults
    if template_in.is_default:
        unset_stmt = select(AftercareTemplate).where(
            AftercareTemplate.studio_id == studio.id,
            AftercareTemplate.is_default == True,
            AftercareTemplate.id != template.id,
            AftercareTemplate.deleted_at.is_(None),
        )
        unset_result = await db.execute(unset_stmt)
        for existing in unset_result.scalars().all():
            existing.is_default = False

    # Update fields
    update_data = template_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "tattoo_type" and value is not None:
            setattr(template, field, TattooType(value))
        elif field == "placement" and value is not None:
            setattr(template, field, TattooPlacement(value))
        elif field == "extra_data" and value is not None:
            setattr(template, field, value.model_dump() if hasattr(value, 'model_dump') else value)
        else:
            setattr(template, field, value)

    await db.commit()
    await db.refresh(template)

    return template_to_response(template)


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.OWNER])),
):
    """Soft delete an aftercare template."""
    studio = await get_user_studio(current_user, db)

    stmt = select(AftercareTemplate).where(
        AftercareTemplate.id == template_id,
        AftercareTemplate.studio_id == studio.id,
        AftercareTemplate.deleted_at.is_(None),
    )
    result = await db.execute(stmt)
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )

    template.deleted_at = datetime.utcnow()
    await db.commit()


# === Tattoo Type and Placement Lists ===

@router.get("/tattoo-types")
async def list_tattoo_types():
    """List available tattoo types."""
    return {"types": [t.value for t in TattooType]}


@router.get("/placements")
async def list_placements():
    """List available body placements."""
    return {"placements": [p.value for p in TattooPlacement]}
