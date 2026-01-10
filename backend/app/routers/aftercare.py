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


# === Send Aftercare Endpoints ===

def sent_to_summary(sent: AftercareSent) -> AftercareSentSummary:
    """Convert sent model to summary schema."""
    return AftercareSentSummary(
        id=sent.id,
        template_name=sent.template_name,
        client_name=sent.client_name,
        client_email=sent.client_email,
        appointment_date=sent.appointment_date,
        status=sent.status.value,
        sent_at=sent.sent_at,
        delivered_at=sent.delivered_at,
        view_count=sent.view_count,
        created_at=sent.created_at,
    )


def sent_to_response(sent: AftercareSent) -> AftercareSentResponse:
    """Convert sent model to full response schema."""
    return AftercareSentResponse(
        id=sent.id,
        template_name=sent.template_name,
        client_name=sent.client_name,
        client_email=sent.client_email,
        appointment_date=sent.appointment_date,
        status=sent.status.value,
        sent_at=sent.sent_at,
        delivered_at=sent.delivered_at,
        view_count=sent.view_count,
        created_at=sent.created_at,
        template_id=sent.template_id,
        instructions_snapshot=sent.instructions_snapshot,
        booking_request_id=sent.booking_request_id,
        artist_id=sent.artist_id,
        client_phone=sent.client_phone,
        tattoo_type=sent.tattoo_type.value if sent.tattoo_type else None,
        placement=sent.placement.value if sent.placement else None,
        tattoo_description=sent.tattoo_description,
        sent_via=sent.sent_via,
        first_viewed_at=sent.first_viewed_at,
        access_token=sent.access_token,
    )


@router.post("/send", response_model=AftercareSentResponse, status_code=status.HTTP_201_CREATED)
async def send_aftercare_instructions(
    data: AftercareSendInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.ARTIST])),
):
    """
    Manually send aftercare instructions to a client.

    Can be linked to a booking request or sent independently.
    """
    from app.services.aftercare_service import send_aftercare_for_booking, find_best_template, send_aftercare
    from app.config import get_settings

    studio = await get_user_studio(current_user, db)
    settings = get_settings()

    # Get the template
    stmt = select(AftercareTemplate).where(
        AftercareTemplate.id == data.template_id,
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

    # If linked to a booking, use that flow
    if data.booking_request_id:
        sent = await send_aftercare_for_booking(
            db=db,
            booking_id=data.booking_request_id,
            template_id=data.template_id,
            send_via=data.send_via,
            schedule_follow_ups=data.schedule_follow_ups,
        )
        if not sent:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not send aftercare for this booking"
            )
        return sent_to_response(sent)

    # Otherwise, create a manual send record
    access_token = secrets.token_urlsafe(32)

    sent_record = AftercareSent(
        template_id=template.id,
        template_name=template.name,
        instructions_snapshot=template.instructions_html,
        studio_id=studio.id,
        booking_request_id=None,
        artist_id=current_user.id,
        client_name=data.client_name,
        client_email=data.client_email,
        client_phone=data.client_phone,
        tattoo_type=TattooType(data.tattoo_type) if data.tattoo_type else None,
        placement=TattooPlacement(data.placement) if data.placement else None,
        tattoo_description=data.tattoo_description,
        appointment_date=data.appointment_date,
        status=AftercareSentStatus.PENDING,
        sent_via=data.send_via,
        access_token=access_token,
    )

    db.add(sent_record)

    # Update template usage
    template.use_count += 1
    template.last_used_at = datetime.utcnow()

    await db.commit()
    await db.refresh(sent_record)

    # Send the email/SMS
    from app.services.email import email_service
    from app.services.sms import sms_service

    view_url = f"{settings.frontend_url}/aftercare/{access_token}"

    email_sent = False
    sms_sent = False

    if data.send_via in ("email", "both"):
        email_sent = await email_service.send_aftercare_email(
            to_email=data.client_email,
            client_name=data.client_name,
            studio_name=studio.name,
            artist_name=current_user.full_name,
            instructions_html=template.instructions_html,
            instructions_plain=template.instructions_plain,
            view_url=view_url,
            extra_data=template.extra_data,
        )

    if data.send_via in ("sms", "both") and data.client_phone:
        sms_message = f"Hi {data.client_name}! Your aftercare instructions from {studio.name} are ready. View them here: {view_url}"
        sms_sent = await sms_service.send_sms(data.client_phone, sms_message)

    # Update status
    now = datetime.utcnow()
    if (data.send_via == "email" and email_sent) or \
       (data.send_via == "sms" and sms_sent) or \
       (data.send_via == "both" and (email_sent or sms_sent)):
        sent_record.status = AftercareSentStatus.SENT
        sent_record.sent_at = now
    else:
        sent_record.status = AftercareSentStatus.FAILED
        sent_record.failure_reason = f"Failed to send via {data.send_via}"

    # Schedule follow-ups if requested and send succeeded
    if data.schedule_follow_ups and sent_record.status == AftercareSentStatus.SENT:
        from app.services.aftercare_service import generate_follow_up_messages

        follow_up_messages = generate_follow_up_messages(
            client_name=data.client_name,
            studio_name=studio.name,
            artist_name=current_user.full_name,
            appointment_date=sent_record.appointment_date,
            view_url=view_url,
        )

        for msg in follow_up_messages:
            follow_up = AftercareFollowUp(
                aftercare_sent_id=sent_record.id,
                follow_up_type=msg["type"],
                scheduled_for=msg["scheduled_for"],
                subject=msg["subject"],
                message_html=msg["message_html"],
                message_plain=msg["message_plain"],
                status=FollowUpStatus.SCHEDULED,
                send_via="email",
            )
            db.add(follow_up)

    await db.commit()
    await db.refresh(sent_record)

    return sent_to_response(sent_record)


@router.get("/sent", response_model=AftercareSentListResponse)
async def list_sent_aftercare(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    client_email: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List sent aftercare records for the studio."""
    studio = await get_user_studio(current_user, db)

    stmt = select(AftercareSent).where(
        AftercareSent.studio_id == studio.id,
    )

    if status_filter:
        stmt = stmt.where(AftercareSent.status == AftercareSentStatus(status_filter))

    if client_email:
        stmt = stmt.where(AftercareSent.client_email.ilike(f"%{client_email}%"))

    # Count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    # Paginate
    stmt = stmt.order_by(AftercareSent.created_at.desc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(stmt)
    sent_records = result.scalars().all()

    return AftercareSentListResponse(
        items=[sent_to_summary(s) for s in sent_records],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/sent/{sent_id}", response_model=AftercareSentResponse)
async def get_sent_aftercare(
    sent_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific sent aftercare record."""
    studio = await get_user_studio(current_user, db)

    stmt = select(AftercareSent).where(
        AftercareSent.id == sent_id,
        AftercareSent.studio_id == studio.id,
    )
    result = await db.execute(stmt)
    sent_record = result.scalar_one_or_none()

    if not sent_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sent aftercare record not found"
        )

    return sent_to_response(sent_record)


# === Public Client View Endpoints ===

@router.get("/view/{access_token}", response_model=ClientAftercareView)
async def view_aftercare_instructions(
    access_token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint for clients to view their aftercare instructions.

    No authentication required - access is via secure token.
    """
    stmt = select(AftercareSent).where(
        AftercareSent.access_token == access_token,
    ).options(
        selectinload(AftercareSent.follow_ups),
    )
    result = await db.execute(stmt)
    sent_record = result.scalar_one_or_none()

    if not sent_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aftercare instructions not found"
        )

    # Track view
    if sent_record.first_viewed_at is None:
        sent_record.first_viewed_at = datetime.utcnow()
        if sent_record.status == AftercareSentStatus.SENT:
            sent_record.status = AftercareSentStatus.DELIVERED
            sent_record.delivered_at = datetime.utcnow()
    sent_record.view_count += 1
    await db.commit()

    # Build follow-ups list
    follow_ups = [
        FollowUpSummary(
            id=fu.id,
            aftercare_sent_id=fu.aftercare_sent_id,
            follow_up_type=fu.follow_up_type.value,
            scheduled_for=fu.scheduled_for,
            status=fu.status.value,
            sent_at=fu.sent_at,
            created_at=fu.created_at,
        )
        for fu in sent_record.follow_ups
    ]

    # Parse extra_data from instructions if available (stored in template)
    extra_data = None
    if sent_record.template_id:
        template_stmt = select(AftercareTemplate).where(
            AftercareTemplate.id == sent_record.template_id,
        )
        template_result = await db.execute(template_stmt)
        template = template_result.scalar_one_or_none()
        if template and template.extra_data:
            extra_data = AftercareExtraData(**template.extra_data)

    return ClientAftercareView(
        id=sent_record.id,
        client_name=sent_record.client_name,
        appointment_date=sent_record.appointment_date,
        tattoo_type=sent_record.tattoo_type.value if sent_record.tattoo_type else None,
        placement=sent_record.placement.value if sent_record.placement else None,
        tattoo_description=sent_record.tattoo_description,
        instructions_html=sent_record.instructions_snapshot,
        extra_data=extra_data,
        follow_ups=follow_ups,
        can_report_issue=True,
    )


# === Follow-Up Management Endpoints ===

from app.schemas.aftercare import (
    CancelFollowUpResponse,
    FollowUpListResponse,
    FollowUpResponse,
    FollowUpUpdate,
    FollowUpWithClientInfo,
    PendingFollowUpsResponse,
    ProcessFollowUpsResult,
    SendFollowUpInput,
    SendFollowUpResponse,
)


def follow_up_to_summary(fu: AftercareFollowUp) -> FollowUpSummary:
    """Convert follow-up model to summary schema."""
    return FollowUpSummary(
        id=fu.id,
        aftercare_sent_id=fu.aftercare_sent_id,
        follow_up_type=fu.follow_up_type.value,
        scheduled_for=fu.scheduled_for,
        status=fu.status.value,
        sent_at=fu.sent_at,
        created_at=fu.created_at,
    )


def follow_up_to_response(fu: AftercareFollowUp) -> FollowUpResponse:
    """Convert follow-up model to full response schema."""
    return FollowUpResponse(
        id=fu.id,
        aftercare_sent_id=fu.aftercare_sent_id,
        follow_up_type=fu.follow_up_type.value,
        scheduled_for=fu.scheduled_for,
        status=fu.status.value,
        sent_at=fu.sent_at,
        created_at=fu.created_at,
        subject=fu.subject,
        message_html=fu.message_html,
        message_plain=fu.message_plain,
        send_via=fu.send_via,
        delivered_at=fu.delivered_at,
        failure_reason=fu.failure_reason,
    )


def follow_up_with_client_info(
    fu: AftercareFollowUp,
    sent: AftercareSent,
    studio_name: str | None = None,
) -> FollowUpWithClientInfo:
    """Convert follow-up model to response with client info."""
    return FollowUpWithClientInfo(
        id=fu.id,
        aftercare_sent_id=fu.aftercare_sent_id,
        follow_up_type=fu.follow_up_type.value,
        scheduled_for=fu.scheduled_for,
        status=fu.status.value,
        sent_at=fu.sent_at,
        created_at=fu.created_at,
        subject=fu.subject,
        message_html=fu.message_html,
        message_plain=fu.message_plain,
        send_via=fu.send_via,
        delivered_at=fu.delivered_at,
        failure_reason=fu.failure_reason,
        client_name=sent.client_name,
        client_email=sent.client_email,
        appointment_date=sent.appointment_date,
        studio_name=studio_name,
    )


@router.get("/follow-ups", response_model=FollowUpListResponse)
async def list_follow_ups(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    follow_up_type: Optional[str] = Query(default=None),
    aftercare_sent_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List follow-up messages for the studio."""
    studio = await get_user_studio(current_user, db)

    # Build query with join to aftercare_sent for studio filtering
    stmt = (
        select(AftercareFollowUp)
        .join(AftercareSent, AftercareFollowUp.aftercare_sent_id == AftercareSent.id)
        .where(AftercareSent.studio_id == studio.id)
    )

    if status_filter:
        stmt = stmt.where(AftercareFollowUp.status == FollowUpStatus(status_filter))

    if follow_up_type:
        stmt = stmt.where(AftercareFollowUp.follow_up_type == FollowUpType(follow_up_type))

    if aftercare_sent_id:
        stmt = stmt.where(AftercareFollowUp.aftercare_sent_id == aftercare_sent_id)

    # Count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    # Paginate
    stmt = stmt.order_by(AftercareFollowUp.scheduled_for.asc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(stmt)
    follow_ups = result.scalars().all()

    return FollowUpListResponse(
        items=[follow_up_to_summary(fu) for fu in follow_ups],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/follow-ups/pending", response_model=PendingFollowUpsResponse)
async def get_pending_follow_ups(
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get follow-ups that are scheduled and ready to send.

    Returns follow-ups where scheduled_for <= now and status is 'scheduled'.
    """
    studio = await get_user_studio(current_user, db)
    now = datetime.utcnow()

    stmt = (
        select(AftercareFollowUp)
        .join(AftercareSent, AftercareFollowUp.aftercare_sent_id == AftercareSent.id)
        .where(
            AftercareSent.studio_id == studio.id,
            AftercareFollowUp.status == FollowUpStatus.SCHEDULED,
            AftercareFollowUp.scheduled_for <= now,
        )
        .options(selectinload(AftercareFollowUp.aftercare_sent))
        .order_by(AftercareFollowUp.scheduled_for.asc())
        .limit(limit)
    )

    result = await db.execute(stmt)
    follow_ups = result.scalars().all()

    items = []
    for fu in follow_ups:
        sent = fu.aftercare_sent
        # Get studio name
        studio_stmt = select(Studio).where(Studio.id == sent.studio_id)
        studio_result = await db.execute(studio_stmt)
        studio_record = studio_result.scalar_one_or_none()

        items.append(follow_up_with_client_info(
            fu,
            sent,
            studio_name=studio_record.name if studio_record else None,
        ))

    return PendingFollowUpsResponse(items=items, total=len(items))


@router.post("/follow-ups/process", response_model=ProcessFollowUpsResult)
async def process_scheduled_follow_ups(
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.OWNER])),
):
    """
    Process and send all scheduled follow-ups that are due.

    This endpoint is designed to be called by a cron job or scheduler.
    It finds all follow-ups where scheduled_for <= now and sends them.
    """
    from app.services.email import email_service
    from app.services.sms import sms_service

    studio = await get_user_studio(current_user, db)
    now = datetime.utcnow()

    # Get pending follow-ups
    stmt = (
        select(AftercareFollowUp)
        .join(AftercareSent, AftercareFollowUp.aftercare_sent_id == AftercareSent.id)
        .where(
            AftercareSent.studio_id == studio.id,
            AftercareFollowUp.status == FollowUpStatus.SCHEDULED,
            AftercareFollowUp.scheduled_for <= now,
        )
        .options(selectinload(AftercareFollowUp.aftercare_sent))
        .order_by(AftercareFollowUp.scheduled_for.asc())
        .limit(limit)
    )

    result = await db.execute(stmt)
    follow_ups = result.scalars().all()

    processed = 0
    sent_count = 0
    failed_count = 0
    details = []

    for fu in follow_ups:
        processed += 1
        sent = fu.aftercare_sent
        success = False

        try:
            if fu.send_via == "email":
                success = await email_service.send_email(
                    to_email=sent.client_email,
                    subject=fu.subject,
                    html_content=fu.message_html,
                    plain_content=fu.message_plain,
                )
            elif fu.send_via == "sms" and sent.client_phone:
                success = await sms_service.send_sms(
                    to_phone=sent.client_phone,
                    message=fu.message_plain[:1500],
                )

            if success:
                fu.status = FollowUpStatus.SENT
                fu.sent_at = datetime.utcnow()
                sent_count += 1
                details.append({
                    "id": str(fu.id),
                    "type": fu.follow_up_type.value,
                    "client_email": sent.client_email,
                    "status": "sent",
                })
            else:
                fu.status = FollowUpStatus.FAILED
                fu.failure_reason = "Send operation returned false"
                failed_count += 1
                details.append({
                    "id": str(fu.id),
                    "type": fu.follow_up_type.value,
                    "client_email": sent.client_email,
                    "status": "failed",
                    "reason": "Send operation failed",
                })
        except Exception as e:
            fu.status = FollowUpStatus.FAILED
            fu.failure_reason = str(e)
            failed_count += 1
            details.append({
                "id": str(fu.id),
                "type": fu.follow_up_type.value,
                "client_email": sent.client_email,
                "status": "failed",
                "reason": str(e),
            })

    await db.commit()

    return ProcessFollowUpsResult(
        processed=processed,
        sent=sent_count,
        failed=failed_count,
        details=details,
    )


@router.get("/follow-ups/{follow_up_id}", response_model=FollowUpResponse)
async def get_follow_up(
    follow_up_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific follow-up message."""
    studio = await get_user_studio(current_user, db)

    stmt = (
        select(AftercareFollowUp)
        .join(AftercareSent, AftercareFollowUp.aftercare_sent_id == AftercareSent.id)
        .where(
            AftercareFollowUp.id == follow_up_id,
            AftercareSent.studio_id == studio.id,
        )
    )
    result = await db.execute(stmt)
    follow_up = result.scalar_one_or_none()

    if not follow_up:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Follow-up not found"
        )

    return follow_up_to_response(follow_up)


@router.patch("/follow-ups/{follow_up_id}", response_model=FollowUpResponse)
async def update_follow_up(
    follow_up_id: str,
    update_data: FollowUpUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.ARTIST])),
):
    """
    Update a scheduled follow-up.

    Can only update follow-ups that are still in 'scheduled' status.
    """
    studio = await get_user_studio(current_user, db)

    stmt = (
        select(AftercareFollowUp)
        .join(AftercareSent, AftercareFollowUp.aftercare_sent_id == AftercareSent.id)
        .where(
            AftercareFollowUp.id == follow_up_id,
            AftercareSent.studio_id == studio.id,
        )
    )
    result = await db.execute(stmt)
    follow_up = result.scalar_one_or_none()

    if not follow_up:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Follow-up not found"
        )

    if follow_up.status != FollowUpStatus.SCHEDULED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot update follow-up with status '{follow_up.status.value}'"
        )

    # Apply updates
    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(follow_up, field, value)

    await db.commit()
    await db.refresh(follow_up)

    return follow_up_to_response(follow_up)


@router.post("/follow-ups/{follow_up_id}/send", response_model=SendFollowUpResponse)
async def send_follow_up_now(
    follow_up_id: str,
    data: SendFollowUpInput | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.ARTIST])),
):
    """
    Manually send a follow-up message immediately.

    Can send scheduled follow-ups early or resend failed ones.
    """
    from app.services.email import email_service
    from app.services.sms import sms_service

    studio = await get_user_studio(current_user, db)

    stmt = (
        select(AftercareFollowUp)
        .join(AftercareSent, AftercareFollowUp.aftercare_sent_id == AftercareSent.id)
        .where(
            AftercareFollowUp.id == follow_up_id,
            AftercareSent.studio_id == studio.id,
        )
        .options(selectinload(AftercareFollowUp.aftercare_sent))
    )
    result = await db.execute(stmt)
    follow_up = result.scalar_one_or_none()

    if not follow_up:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Follow-up not found"
        )

    if follow_up.status not in (FollowUpStatus.SCHEDULED, FollowUpStatus.FAILED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot send follow-up with status '{follow_up.status.value}'"
        )

    sent = follow_up.aftercare_sent
    send_via = data.send_via if data and data.send_via else follow_up.send_via
    success = False

    try:
        if send_via == "email":
            success = await email_service.send_email(
                to_email=sent.client_email,
                subject=follow_up.subject,
                html_content=follow_up.message_html,
                plain_content=follow_up.message_plain,
            )
        elif send_via == "sms" and sent.client_phone:
            success = await sms_service.send_sms(
                to_phone=sent.client_phone,
                message=follow_up.message_plain[:1500],
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot send via SMS - no phone number on record"
            )
    except Exception as e:
        follow_up.status = FollowUpStatus.FAILED
        follow_up.failure_reason = str(e)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send: {str(e)}"
        )

    if success:
        follow_up.status = FollowUpStatus.SENT
        follow_up.sent_at = datetime.utcnow()
        follow_up.failure_reason = None
        await db.commit()

        return SendFollowUpResponse(
            id=follow_up.id,
            status=follow_up.status.value,
            sent_at=follow_up.sent_at,
            message=f"Follow-up sent successfully via {send_via}",
        )
    else:
        follow_up.status = FollowUpStatus.FAILED
        follow_up.failure_reason = "Send operation returned false"
        await db.commit()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send follow-up"
        )


@router.post("/follow-ups/{follow_up_id}/cancel", response_model=CancelFollowUpResponse)
async def cancel_follow_up(
    follow_up_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.ARTIST])),
):
    """
    Cancel a scheduled follow-up.

    Can only cancel follow-ups that are still in 'scheduled' status.
    """
    studio = await get_user_studio(current_user, db)

    stmt = (
        select(AftercareFollowUp)
        .join(AftercareSent, AftercareFollowUp.aftercare_sent_id == AftercareSent.id)
        .where(
            AftercareFollowUp.id == follow_up_id,
            AftercareSent.studio_id == studio.id,
        )
    )
    result = await db.execute(stmt)
    follow_up = result.scalar_one_or_none()

    if not follow_up:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Follow-up not found"
        )

    if follow_up.status != FollowUpStatus.SCHEDULED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel follow-up with status '{follow_up.status.value}'"
        )

    follow_up.status = FollowUpStatus.CANCELLED
    await db.commit()

    return CancelFollowUpResponse(
        id=follow_up.id,
        status=follow_up.status.value,
        message="Follow-up cancelled successfully",
    )


# === Healing Issue Report Endpoints ===

def healing_issue_to_summary(issue: HealingIssueReport) -> HealingIssueSummary:
    """Convert healing issue model to summary schema."""
    return HealingIssueSummary(
        id=issue.id,
        aftercare_sent_id=issue.aftercare_sent_id,
        description=issue.description,
        severity=issue.severity.value,
        symptoms=issue.symptoms or [],
        days_since_appointment=issue.days_since_appointment,
        status=issue.status.value,
        created_at=issue.created_at,
    )


def healing_issue_to_response(issue: HealingIssueReport) -> HealingIssueResponse:
    """Convert healing issue model to full response schema."""
    return HealingIssueResponse(
        id=issue.id,
        aftercare_sent_id=issue.aftercare_sent_id,
        description=issue.description,
        severity=issue.severity.value,
        symptoms=issue.symptoms or [],
        days_since_appointment=issue.days_since_appointment,
        status=issue.status.value,
        created_at=issue.created_at,
        studio_id=issue.studio_id,
        photo_urls=issue.photo_urls or [],
        resolved_at=issue.resolved_at,
        resolution_notes=issue.resolution_notes,
        responded_by_id=issue.responded_by_id,
        responded_at=issue.responded_at,
        staff_notes=issue.staff_notes,
        touch_up_requested=issue.touch_up_requested,
        touch_up_booking_id=issue.touch_up_booking_id,
    )


@router.post("/healing-issues/report/{access_token}", response_model=HealingIssueResponse, status_code=status.HTTP_201_CREATED)
async def report_healing_issue(
    access_token: str,
    issue_data: ReportIssueInput,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint for clients to report a healing issue.

    No authentication required - access is via secure aftercare access token.
    """
    from app.services.email import email_service

    # Find the aftercare record by token
    stmt = select(AftercareSent).where(
        AftercareSent.access_token == access_token,
    ).options(
        selectinload(AftercareSent.studio),
        selectinload(AftercareSent.artist),
    )
    result = await db.execute(stmt)
    sent_record = result.scalar_one_or_none()

    if not sent_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aftercare record not found"
        )

    # Calculate days since appointment
    now = datetime.utcnow()
    days_since = (now - sent_record.appointment_date.replace(tzinfo=None)).days

    # Create the healing issue report
    issue = HealingIssueReport(
        aftercare_sent_id=sent_record.id,
        studio_id=sent_record.studio_id,
        description=issue_data.description,
        severity=HealingIssueSeverity(issue_data.severity),
        symptoms=issue_data.symptoms,
        days_since_appointment=max(0, days_since),
        status=HealingIssueStatus.REPORTED,
        photo_urls=[],
    )

    db.add(issue)
    await db.commit()
    await db.refresh(issue)

    # Send notification email to studio/artist
    studio = sent_record.studio
    artist = sent_record.artist

    if studio:
        # Get studio owner email for notification
        owner_stmt = select(User).where(User.id == studio.owner_id)
        owner_result = await db.execute(owner_stmt)
        owner = owner_result.scalar_one_or_none()

        notify_email = artist.email if artist else (owner.email if owner else None)

        if notify_email:
            severity_colors = {
                "minor": "#10B981",  # green
                "moderate": "#F59E0B",  # amber
                "concerning": "#F97316",  # orange
                "urgent": "#EF4444",  # red
            }
            severity_color = severity_colors.get(issue_data.severity, "#6B7280")

            await email_service.send_email(
                to_email=notify_email,
                subject=f"[{issue_data.severity.upper()}] Healing Issue Reported - {sent_record.client_name}",
                html_content=f"""
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: {severity_color};">Healing Issue Reported</h2>
                        <p>A client has reported a healing issue that needs your attention.</p>

                        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <p><strong>Client:</strong> {sent_record.client_name}</p>
                            <p><strong>Email:</strong> {sent_record.client_email}</p>
                            <p><strong>Phone:</strong> {sent_record.client_phone or 'Not provided'}</p>
                            <p><strong>Appointment Date:</strong> {sent_record.appointment_date.strftime('%B %d, %Y')}</p>
                            <p><strong>Days Since:</strong> {days_since} days</p>
                        </div>

                        <div style="background: #FEF3C7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid {severity_color};">
                            <p><strong>Severity:</strong> <span style="color: {severity_color}; font-weight: bold;">{issue_data.severity.upper()}</span></p>
                            <p><strong>Symptoms:</strong> {', '.join(issue_data.symptoms) if issue_data.symptoms else 'None specified'}</p>
                            <p><strong>Description:</strong></p>
                            <p style="white-space: pre-wrap;">{issue_data.description}</p>
                        </div>

                        <p>Please log in to InkFlow to review and respond to this issue.</p>
                    </div>
                """,
                plain_content=f"""
HEALING ISSUE REPORTED

Client: {sent_record.client_name}
Email: {sent_record.client_email}
Phone: {sent_record.client_phone or 'Not provided'}
Appointment Date: {sent_record.appointment_date.strftime('%B %d, %Y')}
Days Since: {days_since} days

Severity: {issue_data.severity.upper()}
Symptoms: {', '.join(issue_data.symptoms) if issue_data.symptoms else 'None specified'}

Description:
{issue_data.description}

Please log in to InkFlow to review and respond to this issue.
                """,
            )

    return healing_issue_to_response(issue)


@router.post("/healing-issues/{issue_id}/photos", response_model=HealingIssueResponse)
async def upload_healing_issue_photo(
    issue_id: str,
    access_token: str = Query(..., description="Aftercare access token"),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a photo to a healing issue report.

    This endpoint accepts multipart form data with the photo file.
    Authentication is via the aftercare access token.
    """
    import os
    from fastapi import UploadFile, File

    # This is a placeholder - actual file upload needs the file parameter
    # We'll implement this properly with a separate endpoint structure
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Photo upload endpoint - use the full upload endpoint"
    )


@router.post("/healing-issues/{issue_id}/upload-photo")
async def upload_healing_photo(
    issue_id: str,
    access_token: str = Query(..., description="Aftercare access token"),
    file: "UploadFile" = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a photo to document a healing issue.

    Accepts image files (JPEG, PNG, WebP) up to 10MB.
    Photos are stored securely and linked to the healing issue.
    """
    from fastapi import UploadFile, File
    import os
    import uuid as uuid_module

    # Verify access token
    stmt = select(AftercareSent).where(AftercareSent.access_token == access_token)
    result = await db.execute(stmt)
    sent_record = result.scalar_one_or_none()

    if not sent_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid access token"
        )

    # Find the healing issue
    issue_stmt = select(HealingIssueReport).where(
        HealingIssueReport.id == issue_id,
        HealingIssueReport.aftercare_sent_id == sent_record.id,
    )
    issue_result = await db.execute(issue_stmt)
    issue = issue_result.scalar_one_or_none()

    if not issue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Healing issue not found"
        )

    if file is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file provided"
        )

    # Validate file type
    allowed_types = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Allowed: JPEG, PNG, WebP"
        )

    # Read file content
    content = await file.read()

    # Check file size (10MB max)
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 10MB"
        )

    # Generate filename and save
    ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "jpg"
    filename = f"{uuid_module.uuid4()}.{ext}"

    # Ensure upload directory exists
    upload_dir = "uploads/healing_issues"
    os.makedirs(upload_dir, exist_ok=True)

    file_path = os.path.join(upload_dir, filename)
    with open(file_path, "wb") as f:
        f.write(content)

    # Add to issue's photo_urls
    photo_url = f"/uploads/healing_issues/{filename}"
    current_photos = issue.photo_urls or []
    current_photos.append(photo_url)
    issue.photo_urls = current_photos

    await db.commit()
    await db.refresh(issue)

    return {"message": "Photo uploaded successfully", "photo_url": photo_url}


@router.get("/healing-issues", response_model=HealingIssueListResponse)
async def list_healing_issues(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    severity_filter: Optional[str] = Query(default=None, alias="severity"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List healing issue reports for the studio."""
    studio = await get_user_studio(current_user, db)

    stmt = select(HealingIssueReport).where(
        HealingIssueReport.studio_id == studio.id,
    )

    if status_filter:
        stmt = stmt.where(HealingIssueReport.status == HealingIssueStatus(status_filter))

    if severity_filter:
        stmt = stmt.where(HealingIssueReport.severity == HealingIssueSeverity(severity_filter))

    # Count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    # Paginate - show newest first, urgent issues at top
    stmt = stmt.order_by(
        # Urgent first
        (HealingIssueReport.severity == HealingIssueSeverity.URGENT).desc(),
        (HealingIssueReport.severity == HealingIssueSeverity.CONCERNING).desc(),
        HealingIssueReport.created_at.desc(),
    )
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(stmt)
    issues = result.scalars().all()

    return HealingIssueListResponse(
        items=[healing_issue_to_summary(i) for i in issues],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/healing-issues/{issue_id}", response_model=HealingIssueResponse)
async def get_healing_issue(
    issue_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific healing issue report."""
    studio = await get_user_studio(current_user, db)

    stmt = select(HealingIssueReport).where(
        HealingIssueReport.id == issue_id,
        HealingIssueReport.studio_id == studio.id,
    )
    result = await db.execute(stmt)
    issue = result.scalar_one_or_none()

    if not issue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Healing issue not found"
        )

    return healing_issue_to_response(issue)


@router.patch("/healing-issues/{issue_id}", response_model=HealingIssueResponse)
async def update_healing_issue(
    issue_id: str,
    update_data: HealingIssueUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.ARTIST])),
):
    """Update a healing issue report (status, notes, etc.)."""
    studio = await get_user_studio(current_user, db)

    stmt = select(HealingIssueReport).where(
        HealingIssueReport.id == issue_id,
        HealingIssueReport.studio_id == studio.id,
    )
    result = await db.execute(stmt)
    issue = result.scalar_one_or_none()

    if not issue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Healing issue not found"
        )

    # Apply updates
    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        if field == "status" and value is not None:
            new_status = HealingIssueStatus(value)
            setattr(issue, field, new_status)
            # Track resolved_at
            if new_status == HealingIssueStatus.RESOLVED:
                issue.resolved_at = datetime.utcnow()
        else:
            setattr(issue, field, value)

    # Track who responded
    if issue.responded_by_id is None:
        issue.responded_by_id = current_user.id
        issue.responded_at = datetime.utcnow()

    await db.commit()
    await db.refresh(issue)

    return healing_issue_to_response(issue)


@router.post("/healing-issues/{issue_id}/acknowledge", response_model=HealingIssueResponse)
async def acknowledge_healing_issue(
    issue_id: str,
    staff_notes: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.ARTIST])),
):
    """
    Acknowledge a reported healing issue.

    This marks the issue as being reviewed by staff.
    """
    from app.services.email import email_service

    studio = await get_user_studio(current_user, db)

    stmt = select(HealingIssueReport).where(
        HealingIssueReport.id == issue_id,
        HealingIssueReport.studio_id == studio.id,
    ).options(
        selectinload(HealingIssueReport.aftercare_sent),
    )
    result = await db.execute(stmt)
    issue = result.scalar_one_or_none()

    if not issue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Healing issue not found"
        )

    if issue.status != HealingIssueStatus.REPORTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Issue already has status '{issue.status.value}'"
        )

    # Update status
    issue.status = HealingIssueStatus.ACKNOWLEDGED
    issue.responded_by_id = current_user.id
    issue.responded_at = datetime.utcnow()
    if staff_notes:
        issue.staff_notes = staff_notes

    await db.commit()
    await db.refresh(issue)

    # Send acknowledgment email to client
    sent_record = issue.aftercare_sent
    if sent_record:
        await email_service.send_email(
            to_email=sent_record.client_email,
            subject=f"Your healing concern has been received - {studio.name}",
            html_content=f"""
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>We've Received Your Healing Concern</h2>
                    <p>Hi {sent_record.client_name},</p>
                    <p>Thank you for reporting your concern. Our team at {studio.name} has reviewed your submission and will be in touch soon with guidance.</p>

                    {f'<div style="background: #F3F4F6; padding: 15px; border-radius: 8px; margin: 20px 0;"><strong>Initial Response:</strong><p style="margin: 10px 0 0 0;">{staff_notes}</p></div>' if staff_notes else ''}

                    <p><strong>What to do in the meantime:</strong></p>
                    <ul>
                        <li>Continue following the aftercare instructions provided</li>
                        <li>Keep the area clean and moisturized</li>
                        <li>Avoid scratching or picking at the tattoo</li>
                        <li>If symptoms worsen significantly, please seek medical attention</li>
                    </ul>

                    <p>If you have any additional concerns or your symptoms change, please reply to this email or contact us directly.</p>

                    <p>Best regards,<br>{current_user.full_name}<br>{studio.name}</p>
                </div>
            """,
            plain_content=f"""
We've Received Your Healing Concern

Hi {sent_record.client_name},

Thank you for reporting your concern. Our team at {studio.name} has reviewed your submission and will be in touch soon with guidance.

{f'Initial Response: {staff_notes}' if staff_notes else ''}

What to do in the meantime:
- Continue following the aftercare instructions provided
- Keep the area clean and moisturized
- Avoid scratching or picking at the tattoo
- If symptoms worsen significantly, please seek medical attention

If you have any additional concerns or your symptoms change, please reply to this email or contact us directly.

Best regards,
{current_user.full_name}
{studio.name}
            """,
        )

    return healing_issue_to_response(issue)


@router.post("/healing-issues/{issue_id}/resolve", response_model=HealingIssueResponse)
async def resolve_healing_issue(
    issue_id: str,
    resolution_notes: str,
    request_touch_up: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.ARTIST])),
):
    """
    Mark a healing issue as resolved.

    Optionally flag for touch-up scheduling.
    """
    from app.services.email import email_service

    studio = await get_user_studio(current_user, db)

    stmt = select(HealingIssueReport).where(
        HealingIssueReport.id == issue_id,
        HealingIssueReport.studio_id == studio.id,
    ).options(
        selectinload(HealingIssueReport.aftercare_sent),
    )
    result = await db.execute(stmt)
    issue = result.scalar_one_or_none()

    if not issue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Healing issue not found"
        )

    if issue.status == HealingIssueStatus.RESOLVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Issue is already resolved"
        )

    # Update status
    issue.status = HealingIssueStatus.RESOLVED
    issue.resolved_at = datetime.utcnow()
    issue.resolution_notes = resolution_notes
    issue.touch_up_requested = request_touch_up

    if issue.responded_by_id is None:
        issue.responded_by_id = current_user.id
        issue.responded_at = datetime.utcnow()

    await db.commit()
    await db.refresh(issue)

    # Send resolution email to client
    sent_record = issue.aftercare_sent
    if sent_record:
        touch_up_message = """
            <p style="margin-top: 15px; padding: 15px; background: #FEF3C7; border-radius: 8px;">
                <strong>Touch-up Recommended:</strong> Based on our assessment, we recommend scheduling a touch-up session once your tattoo is fully healed. Please contact us when you're ready to book.
            </p>
        """ if request_touch_up else ""

        await email_service.send_email(
            to_email=sent_record.client_email,
            subject=f"Update on your healing concern - {studio.name}",
            html_content=f"""
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Your Healing Concern Has Been Resolved</h2>
                    <p>Hi {sent_record.client_name},</p>
                    <p>We wanted to follow up on the healing concern you reported.</p>

                    <div style="background: #D1FAE5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <strong>Resolution Notes:</strong>
                        <p style="margin: 10px 0 0 0; white-space: pre-wrap;">{resolution_notes}</p>
                    </div>

                    {touch_up_message}

                    <p>If you have any further questions or concerns, don't hesitate to reach out.</p>

                    <p>Best regards,<br>{current_user.full_name}<br>{studio.name}</p>
                </div>
            """,
            plain_content=f"""
Your Healing Concern Has Been Resolved

Hi {sent_record.client_name},

We wanted to follow up on the healing concern you reported.

Resolution Notes:
{resolution_notes}

{'Touch-up Recommended: Based on our assessment, we recommend scheduling a touch-up session once your tattoo is fully healed. Please contact us when you are ready to book.' if request_touch_up else ''}

If you have any further questions or concerns, don't hesitate to reach out.

Best regards,
{current_user.full_name}
{studio.name}
            """,
        )

    return healing_issue_to_response(issue)


@router.get("/healing-issues/by-aftercare/{access_token}", response_model=list[HealingIssueSummary])
async def get_issues_by_aftercare(
    access_token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint to get healing issues for a specific aftercare record.

    Used by clients to see their reported issues and status.
    """
    # Find the aftercare record by token
    stmt = select(AftercareSent).where(
        AftercareSent.access_token == access_token,
    )
    result = await db.execute(stmt)
    sent_record = result.scalar_one_or_none()

    if not sent_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aftercare record not found"
        )

    # Get all issues for this aftercare
    issues_stmt = select(HealingIssueReport).where(
        HealingIssueReport.aftercare_sent_id == sent_record.id,
    ).order_by(HealingIssueReport.created_at.desc())

    issues_result = await db.execute(issues_stmt)
    issues = issues_result.scalars().all()

    return [healing_issue_to_summary(i) for i in issues]


# === Touch-up Scheduling Endpoints ===

from app.schemas.aftercare import (
    ClientTouchUpRequestInput,
    ClientTouchUpRequestResponse,
    HealingIssueWithTouchUp,
    TouchUpBookingInfo,
    TouchUpRequestInput,
    TouchUpResponse,
    TouchUpScheduleInput,
)
from app.models.booking import BookingRequest, BookingRequestStatus, TattooSize


def get_touch_up_booking_info(booking: BookingRequest, user: User | None = None) -> TouchUpBookingInfo:
    """Convert booking to touch-up booking info."""
    artist_name = None
    if booking.assigned_artist:
        artist_name = booking.assigned_artist.full_name
    elif user:
        artist_name = user.full_name

    return TouchUpBookingInfo(
        booking_id=booking.id,
        reference_id=booking.reference_id,
        status=booking.status.value,
        scheduled_date=booking.scheduled_date,
        artist_name=artist_name,
        is_free_touch_up=booking.quoted_price == 0 or booking.quoted_price is None,
        created_at=booking.created_at,
    )


@router.get("/healing-issues/{issue_id}/touch-up", response_model=HealingIssueWithTouchUp)
async def get_healing_issue_with_touch_up(
    issue_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get a healing issue with its touch-up booking information.
    """
    studio = await get_user_studio(current_user, db)

    stmt = select(HealingIssueReport).where(
        HealingIssueReport.id == issue_id,
        HealingIssueReport.studio_id == studio.id,
    ).options(
        selectinload(HealingIssueReport.touch_up_booking).selectinload(BookingRequest.assigned_artist),
    )
    result = await db.execute(stmt)
    issue = result.scalar_one_or_none()

    if not issue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Healing issue not found"
        )

    # Build response
    base_response = healing_issue_to_response(issue)
    touch_up_booking = None

    if issue.touch_up_booking:
        touch_up_booking = get_touch_up_booking_info(issue.touch_up_booking)

    return HealingIssueWithTouchUp(
        **base_response.model_dump(),
        touch_up_booking=touch_up_booking,
    )


@router.post("/healing-issues/{issue_id}/schedule-touch-up", response_model=TouchUpResponse)
async def schedule_touch_up(
    issue_id: str,
    data: TouchUpScheduleInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.ARTIST])),
):
    """
    Schedule a touch-up appointment for a healing issue.

    Creates a new booking request linked to the healing issue.
    """
    from app.services.email import email_service
    from app.services.calendar import generate_tattoo_appointment_ics
    from app.config import get_settings

    studio = await get_user_studio(current_user, db)
    settings = get_settings()

    # Get the healing issue with aftercare record
    stmt = select(HealingIssueReport).where(
        HealingIssueReport.id == issue_id,
        HealingIssueReport.studio_id == studio.id,
    ).options(
        selectinload(HealingIssueReport.aftercare_sent),
    )
    result = await db.execute(stmt)
    issue = result.scalar_one_or_none()

    if not issue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Healing issue not found"
        )

    if issue.touch_up_booking_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Touch-up already scheduled for this issue"
        )

    sent_record = issue.aftercare_sent
    if not sent_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No aftercare record found for this issue"
        )

    # Get original booking for context if available
    original_booking = None
    if sent_record.booking_request_id:
        original_stmt = select(BookingRequest).where(
            BookingRequest.id == sent_record.booking_request_id
        )
        original_result = await db.execute(original_stmt)
        original_booking = original_result.scalar_one_or_none()

    # Determine artist
    artist_id = data.artist_id
    if not artist_id and sent_record.artist_id:
        artist_id = sent_record.artist_id
    if not artist_id:
        artist_id = current_user.id

    # Generate reference ID for touch-up
    import secrets
    reference_id = f"TU-{secrets.token_hex(4).upper()}"

    # Create the touch-up booking request
    touch_up_booking = BookingRequest(
        studio_id=studio.id,
        client_name=sent_record.client_name,
        client_email=sent_record.client_email,
        client_phone=sent_record.client_phone,
        design_idea=f"Touch-up for healing issue (Original: {sent_record.tattoo_description or 'tattoo'})",
        placement=original_booking.placement if original_booking else sent_record.placement.value if sent_record.placement else None,
        size=TattooSize.TINY,  # Touch-ups are typically small
        is_cover_up=False,
        is_first_tattoo=False,
        additional_notes=f"Touch-up scheduled from healing issue.\n\nHealing Issue Description:\n{issue.description}\n\nNotes: {data.notes or 'N/A'}",
        preferred_artist_id=artist_id,
        assigned_artist_id=artist_id,
        status=BookingRequestStatus.CONFIRMED,
        quoted_price=0 if data.is_free_touch_up else None,
        deposit_amount=0,
        estimated_hours=data.duration_hours,
        scheduled_date=data.scheduled_date,
        scheduled_duration_hours=data.duration_hours,
        reference_id=reference_id,
        internal_notes=f"Touch-up from healing issue {issue_id}. Free: {data.is_free_touch_up}",
    )

    db.add(touch_up_booking)
    await db.flush()  # Get the ID

    # Link healing issue to the booking
    issue.touch_up_booking_id = touch_up_booking.id
    issue.touch_up_requested = True

    await db.commit()
    await db.refresh(touch_up_booking)

    # Send confirmation email if requested
    client_notified = False
    if data.send_confirmation:
        # Get artist name
        artist_name = current_user.full_name
        if artist_id != current_user.id:
            artist_stmt = select(User).where(User.id == artist_id)
            artist_result = await db.execute(artist_stmt)
            artist = artist_result.scalar_one_or_none()
            if artist:
                artist_name = artist.full_name

        # Generate calendar invite
        ics_content = generate_tattoo_appointment_ics(
            client_name=sent_record.client_name,
            client_email=sent_record.client_email,
            artist_name=artist_name,
            studio_name=studio.name,
            studio_address=f"{studio.address_line1 or ''}, {studio.city or ''}, {studio.state or ''}" if studio.address_line1 else "See studio website for address",
            scheduled_date=data.scheduled_date,
            duration_hours=data.duration_hours,
            design_description="Touch-up appointment",
        )

        touch_up_text = "complimentary touch-up" if data.is_free_touch_up else "touch-up"

        email_sent = await email_service.send_email(
            to_email=sent_record.client_email,
            subject=f"Your Touch-up Appointment is Confirmed - {studio.name}",
            html_content=f"""
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #10B981;">Touch-up Appointment Confirmed</h2>
                    <p>Hi {sent_record.client_name},</p>
                    <p>Great news! Your {touch_up_text} appointment has been scheduled.</p>

                    <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Reference:</strong> {reference_id}</p>
                        <p><strong>Date:</strong> {data.scheduled_date.strftime('%A, %B %d, %Y')}</p>
                        <p><strong>Time:</strong> {data.scheduled_date.strftime('%I:%M %p')}</p>
                        <p><strong>Duration:</strong> {data.duration_hours} hour(s)</p>
                        <p><strong>Artist:</strong> {artist_name}</p>
                        <p><strong>Studio:</strong> {studio.name}</p>
                        {f'<p><strong>Price:</strong> Complimentary</p>' if data.is_free_touch_up else ''}
                    </div>

                    <p>A calendar invite is attached to this email.</p>

                    <p><strong>Before your appointment:</strong></p>
                    <ul>
                        <li>Ensure your tattoo is fully healed before the touch-up</li>
                        <li>Keep the area moisturized</li>
                        <li>Avoid sun exposure on the tattoo</li>
                    </ul>

                    <p>If you need to reschedule, please contact us as soon as possible.</p>

                    <p>See you soon!<br>{studio.name}</p>
                </div>
            """,
            plain_content=f"""
Touch-up Appointment Confirmed

Hi {sent_record.client_name},

Great news! Your {touch_up_text} appointment has been scheduled.

Reference: {reference_id}
Date: {data.scheduled_date.strftime('%A, %B %d, %Y')}
Time: {data.scheduled_date.strftime('%I:%M %p')}
Duration: {data.duration_hours} hour(s)
Artist: {artist_name}
Studio: {studio.name}
{'Price: Complimentary' if data.is_free_touch_up else ''}

Before your appointment:
- Ensure your tattoo is fully healed before the touch-up
- Keep the area moisturized
- Avoid sun exposure on the tattoo

If you need to reschedule, please contact us as soon as possible.

See you soon!
{studio.name}
            """,
            attachments=[{
                "filename": "touch-up-appointment.ics",
                "content": ics_content,
                "content_type": "text/calendar",
            }] if ics_content else None,
        )
        client_notified = email_sent

    return TouchUpResponse(
        healing_issue_id=issue.id,
        booking_id=touch_up_booking.id,
        reference_id=reference_id,
        message="Touch-up appointment scheduled successfully",
        client_notified=client_notified,
    )


@router.post("/touch-up/request/{access_token}", response_model=ClientTouchUpRequestResponse)
async def client_request_touch_up(
    access_token: str,
    data: ClientTouchUpRequestInput,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint for clients to request a touch-up via their aftercare access token.

    This creates a healing issue marked for touch-up, which the studio can then schedule.
    """
    from app.services.email import email_service

    # Find the aftercare record by token
    stmt = select(AftercareSent).where(
        AftercareSent.access_token == access_token,
    ).options(
        selectinload(AftercareSent.studio),
        selectinload(AftercareSent.artist),
    )
    result = await db.execute(stmt)
    sent_record = result.scalar_one_or_none()

    if not sent_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aftercare record not found"
        )

    studio = sent_record.studio
    if not studio:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Studio not found"
        )

    # Calculate days since appointment
    now = datetime.utcnow()
    days_since = (now - sent_record.appointment_date.replace(tzinfo=None)).days

    # Create a healing issue marked for touch-up
    issue = HealingIssueReport(
        aftercare_sent_id=sent_record.id,
        studio_id=sent_record.studio_id,
        description=f"Touch-up Request: {data.reason}",
        severity=HealingIssueSeverity.MINOR,  # Touch-up requests are not urgent
        symptoms=["touch_up_needed"],
        days_since_appointment=max(0, days_since),
        status=HealingIssueStatus.REPORTED,
        photo_urls=[],
        touch_up_requested=True,
        staff_notes=f"Preferred dates: {', '.join(data.preferred_dates) if data.preferred_dates else 'Not specified'}\nAdditional notes: {data.additional_notes or 'None'}",
    )

    db.add(issue)
    await db.commit()
    await db.refresh(issue)

    # Notify studio
    notify_email = sent_record.artist.email if sent_record.artist else None
    if not notify_email and studio.owner_id:
        owner_stmt = select(User).where(User.id == studio.owner_id)
        owner_result = await db.execute(owner_stmt)
        owner = owner_result.scalar_one_or_none()
        if owner:
            notify_email = owner.email

    if notify_email:
        await email_service.send_email(
            to_email=notify_email,
            subject=f"Touch-up Request - {sent_record.client_name}",
            html_content=f"""
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #3B82F6;">Touch-up Request Received</h2>
                    <p>A client has requested a touch-up appointment.</p>

                    <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Client:</strong> {sent_record.client_name}</p>
                        <p><strong>Email:</strong> {sent_record.client_email}</p>
                        <p><strong>Phone:</strong> {sent_record.client_phone or 'Not provided'}</p>
                        <p><strong>Original Appointment:</strong> {sent_record.appointment_date.strftime('%B %d, %Y')}</p>
                        <p><strong>Days Since:</strong> {days_since} days</p>
                    </div>

                    <div style="background: #FEF3C7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Reason for Touch-up:</strong></p>
                        <p style="white-space: pre-wrap;">{data.reason}</p>
                        <p><strong>Preferred Dates:</strong> {', '.join(data.preferred_dates) if data.preferred_dates else 'Flexible'}</p>
                        {f'<p><strong>Additional Notes:</strong> {data.additional_notes}</p>' if data.additional_notes else ''}
                    </div>

                    <p>Please log in to InkFlow to schedule the touch-up appointment.</p>
                </div>
            """,
            plain_content=f"""
Touch-up Request Received

A client has requested a touch-up appointment.

Client: {sent_record.client_name}
Email: {sent_record.client_email}
Phone: {sent_record.client_phone or 'Not provided'}
Original Appointment: {sent_record.appointment_date.strftime('%B %d, %Y')}
Days Since: {days_since} days

Reason for Touch-up:
{data.reason}

Preferred Dates: {', '.join(data.preferred_dates) if data.preferred_dates else 'Flexible'}
Additional Notes: {data.additional_notes or 'None'}

Please log in to InkFlow to schedule the touch-up appointment.
            """,
        )

    return ClientTouchUpRequestResponse(
        request_id=issue.id,
        message="Your touch-up request has been submitted. The studio will contact you soon to schedule your appointment.",
        studio_name=studio.name,
        expected_contact_within="24-48 hours",
    )


@router.get("/touch-up/pending", response_model=list[HealingIssueSummary])
async def get_pending_touch_ups(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all healing issues that need touch-ups but haven't been scheduled yet.
    """
    studio = await get_user_studio(current_user, db)

    stmt = select(HealingIssueReport).where(
        HealingIssueReport.studio_id == studio.id,
        HealingIssueReport.touch_up_requested == True,
        HealingIssueReport.touch_up_booking_id.is_(None),
    ).order_by(HealingIssueReport.created_at.asc())

    result = await db.execute(stmt)
    issues = result.scalars().all()

    return [healing_issue_to_summary(i) for i in issues]


@router.delete("/healing-issues/{issue_id}/touch-up", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_touch_up(
    issue_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.ARTIST])),
):
    """
    Unlink a touch-up booking from a healing issue.

    Does NOT delete the booking - just removes the association.
    """
    studio = await get_user_studio(current_user, db)

    stmt = select(HealingIssueReport).where(
        HealingIssueReport.id == issue_id,
        HealingIssueReport.studio_id == studio.id,
    )
    result = await db.execute(stmt)
    issue = result.scalar_one_or_none()

    if not issue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Healing issue not found"
        )

    if not issue.touch_up_booking_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No touch-up booking linked to this issue"
        )

    issue.touch_up_booking_id = None
    # Keep touch_up_requested = True so it shows as needing scheduling
    await db.commit()
