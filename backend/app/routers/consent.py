"""Consent forms router for digital consent management."""

import secrets
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.consent import (
    ConsentAuditAction,
    ConsentAuditLog,
    ConsentFieldType,
    ConsentFormSubmission,
    ConsentFormTemplate,
)
from app.models.booking import BookingRequest
from app.models.studio import Studio
from app.models.user import User
from app.schemas.consent import (
    AgeVerificationStatus,
    ConsentAuditLogResponse,
    ConsentAuditLogsListResponse,
    ConsentFormTemplateCreate,
    ConsentFormTemplateResponse,
    ConsentFormTemplatesListResponse,
    ConsentFormTemplateSummary,
    ConsentFormTemplateUpdate,
    ConsentSubmissionPublicResponse,
    ConsentSubmissionResponse,
    ConsentSubmissionsListResponse,
    ConsentSubmissionSummary,
    CreateFromPrebuiltInput,
    FormFieldResponse,
    GuardianConsentInput,
    GuardianConsentResponse,
    PhotoIdUploadResponse,
    PrebuiltTemplateInfo,
    PrebuiltTemplatesListResponse,
    SubmitSigningInput,
    SubmitSigningResponse,
    VerifyAgeInput,
    VerifyAgeResponse,
    VerifyPhotoIdInput,
    VerifyPhotoIdResponse,
    VoidConsentInput,
    VoidConsentResponse,
)
from app.services.auth import get_current_user, require_role
from app.services.encryption import get_encryption_service

router = APIRouter(prefix="/consent", tags=["consent"])


# === Pre-built Templates ===

# Standard tattoo consent form fields
TATTOO_CONSENT_TEMPLATE = {
    "id": "tattoo-standard",
    "name": "Standard Tattoo Consent Form",
    "description": "A comprehensive consent form covering health, aftercare, and legal acknowledgments for tattoo procedures.",
    "header_text": """TATTOO CONSENT AND RELEASE FORM

Please read this document carefully before signing. Your signature indicates that you have read, understood, and agree to the terms set forth below.""",
    "footer_text": """By signing below, I acknowledge that I have been given the opportunity to ask questions about the tattoo procedure and that all my questions have been answered to my satisfaction.

I understand that the tattoo is permanent and that I am solely responsible for the design, spelling, placement, and size of the tattoo I have chosen.""",
    "requires_photo_id": True,
    "requires_signature": True,
    "age_requirement": 18,
    "fields": [
        {
            "id": "section_personal",
            "type": "heading",
            "label": "Personal Information",
            "required": False,
            "order": 1,
            "content": "Personal Information"
        },
        {
            "id": "full_legal_name",
            "type": "text",
            "label": "Full Legal Name",
            "required": True,
            "order": 2,
            "placeholder": "Enter your full legal name as it appears on your ID"
        },
        {
            "id": "date_of_birth",
            "type": "date",
            "label": "Date of Birth",
            "required": True,
            "order": 3,
            "help_text": "You must be 18 or older to receive a tattoo"
        },
        {
            "id": "emergency_contact",
            "type": "text",
            "label": "Emergency Contact Name & Phone",
            "required": True,
            "order": 4,
            "placeholder": "Name: (xxx) xxx-xxxx"
        },
        {
            "id": "section_health",
            "type": "heading",
            "label": "Health Information",
            "required": False,
            "order": 10,
            "content": "Health Information"
        },
        {
            "id": "health_intro",
            "type": "paragraph",
            "label": "",
            "required": False,
            "order": 11,
            "content": "Please answer the following health questions honestly. This information is kept confidential and is necessary for your safety."
        },
        {
            "id": "pregnant_nursing",
            "type": "radio",
            "label": "Are you pregnant or nursing?",
            "required": True,
            "order": 12,
            "options": ["Yes", "No", "Not Applicable"]
        },
        {
            "id": "blood_thinners",
            "type": "radio",
            "label": "Are you currently taking blood thinners or aspirin?",
            "required": True,
            "order": 13,
            "options": ["Yes", "No"]
        },
        {
            "id": "skin_conditions",
            "type": "radio",
            "label": "Do you have any skin conditions (eczema, psoriasis, etc.)?",
            "required": True,
            "order": 14,
            "options": ["Yes", "No"]
        },
        {
            "id": "skin_conditions_detail",
            "type": "textarea",
            "label": "If yes, please describe:",
            "required": False,
            "order": 15,
            "placeholder": "Describe any skin conditions..."
        },
        {
            "id": "allergies",
            "type": "radio",
            "label": "Do you have any allergies (latex, dyes, metals, etc.)?",
            "required": True,
            "order": 16,
            "options": ["Yes", "No"]
        },
        {
            "id": "allergies_detail",
            "type": "textarea",
            "label": "If yes, please list all allergies:",
            "required": False,
            "order": 17,
            "placeholder": "List any allergies..."
        },
        {
            "id": "heart_condition",
            "type": "radio",
            "label": "Do you have a heart condition or history of heart disease?",
            "required": True,
            "order": 18,
            "options": ["Yes", "No"]
        },
        {
            "id": "diabetes",
            "type": "radio",
            "label": "Do you have diabetes?",
            "required": True,
            "order": 19,
            "options": ["Yes", "No"]
        },
        {
            "id": "epilepsy",
            "type": "radio",
            "label": "Do you have epilepsy or a history of seizures?",
            "required": True,
            "order": 20,
            "options": ["Yes", "No"]
        },
        {
            "id": "hemophilia",
            "type": "radio",
            "label": "Do you have hemophilia or any bleeding disorder?",
            "required": True,
            "order": 21,
            "options": ["Yes", "No"]
        },
        {
            "id": "immune_disorder",
            "type": "radio",
            "label": "Do you have HIV, hepatitis, or any immune system disorder?",
            "required": True,
            "order": 22,
            "options": ["Yes", "No"]
        },
        {
            "id": "medications",
            "type": "textarea",
            "label": "List any medications you are currently taking:",
            "required": False,
            "order": 23,
            "placeholder": "List medications..."
        },
        {
            "id": "consumed_alcohol",
            "type": "radio",
            "label": "Have you consumed alcohol or drugs in the last 24 hours?",
            "required": True,
            "order": 24,
            "options": ["Yes", "No"]
        },
        {
            "id": "section_acknowledgments",
            "type": "heading",
            "label": "Acknowledgments",
            "required": False,
            "order": 30,
            "content": "Acknowledgments"
        },
        {
            "id": "ack_permanent",
            "type": "checkbox",
            "label": "I understand that a tattoo is a permanent change to my body and that I have been advised that complete removal is not always possible.",
            "required": True,
            "order": 31
        },
        {
            "id": "ack_risks",
            "type": "checkbox",
            "label": "I understand the risks involved with getting a tattoo, including but not limited to: infection, allergic reaction, scarring, and incomplete healing.",
            "required": True,
            "order": 32
        },
        {
            "id": "ack_aftercare",
            "type": "checkbox",
            "label": "I have been given aftercare instructions and understand that improper care may result in damage to my tattoo and potential health risks.",
            "required": True,
            "order": 33
        },
        {
            "id": "ack_sober",
            "type": "checkbox",
            "label": "I am not under the influence of alcohol or drugs at this time.",
            "required": True,
            "order": 34
        },
        {
            "id": "ack_design",
            "type": "checkbox",
            "label": "I have reviewed and approved the design, placement, and size of my tattoo. I understand that once the tattoo process begins, I am responsible for the final outcome.",
            "required": True,
            "order": 35
        },
        {
            "id": "ack_liability",
            "type": "checkbox",
            "label": "I release the tattoo artist and studio from any and all liability related to the tattoo procedure, healing process, and final result.",
            "required": True,
            "order": 36
        },
        {
            "id": "ack_age",
            "type": "checkbox",
            "label": "I confirm that I am at least 18 years of age and have provided valid government-issued photo identification.",
            "required": True,
            "order": 37
        },
        {
            "id": "section_signature",
            "type": "heading",
            "label": "Signature",
            "required": False,
            "order": 40,
            "content": "Signature"
        },
        {
            "id": "signature",
            "type": "signature",
            "label": "Client Signature",
            "required": True,
            "order": 41,
            "help_text": "Sign using your mouse or finger on touch devices"
        },
        {
            "id": "photo_id",
            "type": "photo_id",
            "label": "Photo ID",
            "required": True,
            "order": 42,
            "help_text": "Upload a clear photo of your government-issued ID"
        }
    ]
}

PREBUILT_TEMPLATES = {
    "tattoo-standard": TATTOO_CONSENT_TEMPLATE,
}


@router.get("/prebuilt", response_model=PrebuiltTemplatesListResponse)
async def list_prebuilt_templates() -> PrebuiltTemplatesListResponse:
    """List available pre-built consent form templates."""
    templates = [
        PrebuiltTemplateInfo(
            id=template_id,
            name=template["name"],
            description=template["description"],
            field_count=len(template["fields"]),
        )
        for template_id, template in PREBUILT_TEMPLATES.items()
    ]
    return PrebuiltTemplatesListResponse(templates=templates)


@router.post("/templates/from-prebuilt", response_model=ConsentFormTemplateResponse)
async def create_template_from_prebuilt(
    data: CreateFromPrebuiltInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["owner"])),
) -> ConsentFormTemplateResponse:
    """Create a consent form template from a pre-built option."""
    if data.prebuilt_id not in PREBUILT_TEMPLATES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pre-built template '{data.prebuilt_id}' not found",
        )

    prebuilt = PREBUILT_TEMPLATES[data.prebuilt_id]

    # Get user's studio
    studio_result = await db.execute(
        select(Studio).where(Studio.owner_id == current_user.id, Studio.deleted_at.is_(None))
    )
    studio = studio_result.scalar_one_or_none()
    if not studio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No studio found for this user",
        )

    # If setting as default, unset any existing default
    if data.is_default:
        await db.execute(
            select(ConsentFormTemplate)
            .where(
                ConsentFormTemplate.studio_id == studio.id,
                ConsentFormTemplate.is_default == True,
                ConsentFormTemplate.deleted_at.is_(None),
            )
        )
        existing_defaults = (
            await db.execute(
                select(ConsentFormTemplate).where(
                    ConsentFormTemplate.studio_id == studio.id,
                    ConsentFormTemplate.is_default == True,
                    ConsentFormTemplate.deleted_at.is_(None),
                )
            )
        ).scalars().all()
        for template in existing_defaults:
            template.is_default = False

    template = ConsentFormTemplate(
        studio_id=studio.id,
        name=data.name or prebuilt["name"],
        description=prebuilt["description"],
        header_text=prebuilt["header_text"],
        footer_text=prebuilt["footer_text"],
        requires_photo_id=prebuilt["requires_photo_id"],
        requires_signature=prebuilt["requires_signature"],
        age_requirement=prebuilt["age_requirement"],
        fields=prebuilt["fields"],
        is_active=True,
        is_default=data.is_default,
        created_by_id=current_user.id,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)

    return _template_to_response(template)


# === Template CRUD ===

@router.get("/templates", response_model=ConsentFormTemplatesListResponse)
async def list_templates(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "artist", "receptionist"])),
) -> ConsentFormTemplatesListResponse:
    """List consent form templates for the studio."""
    # Get user's studio
    studio = await _get_user_studio(db, current_user)

    query = select(ConsentFormTemplate).where(
        ConsentFormTemplate.studio_id == studio.id,
        ConsentFormTemplate.deleted_at.is_(None),
    )
    if active_only:
        query = query.where(ConsentFormTemplate.is_active == True)

    query = query.order_by(ConsentFormTemplate.is_default.desc(), ConsentFormTemplate.name)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Paginate
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    templates = result.scalars().all()

    return ConsentFormTemplatesListResponse(
        templates=[_template_to_summary(t) for t in templates],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/templates", response_model=ConsentFormTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    data: ConsentFormTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["owner"])),
) -> ConsentFormTemplateResponse:
    """Create a new consent form template."""
    studio = await _get_user_studio(db, current_user)

    # If setting as default, unset any existing default
    if data.is_default:
        existing_defaults = (
            await db.execute(
                select(ConsentFormTemplate).where(
                    ConsentFormTemplate.studio_id == studio.id,
                    ConsentFormTemplate.is_default == True,
                    ConsentFormTemplate.deleted_at.is_(None),
                )
            )
        ).scalars().all()
        for template in existing_defaults:
            template.is_default = False

    template = ConsentFormTemplate(
        studio_id=studio.id,
        name=data.name,
        description=data.description,
        header_text=data.header_text,
        footer_text=data.footer_text,
        requires_photo_id=data.requires_photo_id,
        requires_signature=data.requires_signature,
        age_requirement=data.age_requirement,
        fields=[f.model_dump() for f in data.fields],
        is_active=data.is_active,
        is_default=data.is_default,
        created_by_id=current_user.id,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)

    return _template_to_response(template)


@router.get("/templates/{template_id}", response_model=ConsentFormTemplateResponse)
async def get_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "artist", "receptionist"])),
) -> ConsentFormTemplateResponse:
    """Get a consent form template by ID."""
    studio = await _get_user_studio(db, current_user)

    template = await _get_template(db, template_id, studio.id)
    return _template_to_response(template)


@router.put("/templates/{template_id}", response_model=ConsentFormTemplateResponse)
async def update_template(
    template_id: uuid.UUID,
    data: ConsentFormTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["owner"])),
) -> ConsentFormTemplateResponse:
    """Update a consent form template. Creates a new version if fields changed."""
    studio = await _get_user_studio(db, current_user)
    template = await _get_template(db, template_id, studio.id)

    # Track if fields changed (requires version bump)
    fields_changed = data.fields is not None and data.fields != template.fields

    # Update fields
    if data.name is not None:
        template.name = data.name
    if data.description is not None:
        template.description = data.description
    if data.header_text is not None:
        template.header_text = data.header_text
    if data.footer_text is not None:
        template.footer_text = data.footer_text
    if data.requires_photo_id is not None:
        template.requires_photo_id = data.requires_photo_id
    if data.requires_signature is not None:
        template.requires_signature = data.requires_signature
    if data.age_requirement is not None:
        template.age_requirement = data.age_requirement
    if data.is_active is not None:
        template.is_active = data.is_active
    if data.fields is not None:
        template.fields = [f.model_dump() for f in data.fields]

    # Handle default flag
    if data.is_default is not None:
        if data.is_default and not template.is_default:
            # Unset other defaults
            existing_defaults = (
                await db.execute(
                    select(ConsentFormTemplate).where(
                        ConsentFormTemplate.studio_id == studio.id,
                        ConsentFormTemplate.is_default == True,
                        ConsentFormTemplate.id != template.id,
                        ConsentFormTemplate.deleted_at.is_(None),
                    )
                )
            ).scalars().all()
            for t in existing_defaults:
                t.is_default = False
        template.is_default = data.is_default

    # Bump version if fields changed
    if fields_changed:
        template.version += 1

    await db.commit()
    await db.refresh(template)

    return _template_to_response(template)


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["owner"])),
) -> None:
    """Soft delete a consent form template."""
    studio = await _get_user_studio(db, current_user)
    template = await _get_template(db, template_id, studio.id)

    template.deleted_at = datetime.utcnow()
    template.is_active = False
    template.is_default = False

    await db.commit()


# === Submission Endpoints ===

@router.get("/submissions", response_model=ConsentSubmissionsListResponse)
async def list_submissions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    client_email: Optional[str] = Query(None),
    booking_request_id: Optional[uuid.UUID] = Query(None),
    include_voided: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "artist", "receptionist"])),
) -> ConsentSubmissionsListResponse:
    """List consent form submissions for the studio."""
    studio = await _get_user_studio(db, current_user)

    query = select(ConsentFormSubmission).where(ConsentFormSubmission.studio_id == studio.id)

    if not include_voided:
        query = query.where(ConsentFormSubmission.is_voided == False)
    if client_email:
        query = query.where(ConsentFormSubmission.client_email.ilike(f"%{client_email}%"))
    if booking_request_id:
        query = query.where(ConsentFormSubmission.booking_request_id == booking_request_id)

    query = query.order_by(ConsentFormSubmission.submitted_at.desc())

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Paginate
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    submissions = result.scalars().all()

    return ConsentSubmissionsListResponse(
        submissions=[_submission_to_summary(s) for s in submissions],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/submissions/{submission_id}", response_model=ConsentSubmissionResponse)
async def get_submission(
    submission_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "artist", "receptionist"])),
) -> ConsentSubmissionResponse:
    """Get a consent form submission by ID."""
    studio = await _get_user_studio(db, current_user)
    submission = await _get_submission(db, submission_id, studio.id)

    # Log audit
    await _create_audit_log(
        db,
        submission.id,
        ConsentAuditAction.VIEWED,
        current_user.id,
        current_user.full_name,
        request,
    )

    return _submission_to_response(submission)


@router.post("/submissions/{submission_id}/verify-photo-id", response_model=VerifyPhotoIdResponse)
async def verify_photo_id(
    submission_id: uuid.UUID,
    data: VerifyPhotoIdInput,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "artist"])),
) -> VerifyPhotoIdResponse:
    """Mark a submission's photo ID as verified."""
    studio = await _get_user_studio(db, current_user)
    submission = await _get_submission(db, submission_id, studio.id)

    if not submission.photo_id_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No photo ID has been uploaded for this submission",
        )

    submission.photo_id_verified = True
    submission.photo_id_verified_at = datetime.utcnow()
    submission.photo_id_verified_by_id = current_user.id

    # Log audit
    await _create_audit_log(
        db,
        submission.id,
        ConsentAuditAction.VERIFIED,
        current_user.id,
        current_user.full_name,
        request,
        notes=data.notes,
    )

    await db.commit()
    await db.refresh(submission)

    return VerifyPhotoIdResponse(
        verified=True,
        verified_at=submission.photo_id_verified_at,
        verified_by_id=current_user.id,
        verified_by_name=current_user.full_name,
    )


@router.get("/submissions/{submission_id}/age-status", response_model=AgeVerificationStatus)
async def get_age_verification_status(
    submission_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "artist", "receptionist"])),
) -> AgeVerificationStatus:
    """Get age verification status for a submission."""
    studio = await _get_user_studio(db, current_user)
    submission = await _get_submission(db, submission_id, studio.id)

    # Get template age requirement
    age_requirement = 18  # Default
    if submission.template_id:
        template_result = await db.execute(
            select(ConsentFormTemplate).where(ConsentFormTemplate.id == submission.template_id)
        )
        template = template_result.scalar_one_or_none()
        if template:
            age_requirement = template.age_requirement

    # Determine if underage
    is_underage = False
    needs_guardian_consent = False
    if submission.age_at_signing is not None:
        is_underage = submission.age_at_signing < age_requirement
        # For minors aged 16-17 (or within 2 years of requirement), allow guardian consent
        if is_underage and submission.age_at_signing >= age_requirement - 2:
            needs_guardian_consent = True

    return AgeVerificationStatus(
        age_verified=submission.age_verified,
        age_at_signing=submission.age_at_signing,
        age_requirement=age_requirement,
        is_underage=is_underage,
        client_date_of_birth=submission.client_date_of_birth,
        needs_guardian_consent=needs_guardian_consent and not submission.has_guardian_consent,
    )


@router.post("/submissions/{submission_id}/verify-age", response_model=VerifyAgeResponse)
async def verify_age(
    submission_id: uuid.UUID,
    data: VerifyAgeInput,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "artist"])),
) -> VerifyAgeResponse:
    """Manually verify or update age verification status for a submission."""
    studio = await _get_user_studio(db, current_user)
    submission = await _get_submission(db, submission_id, studio.id)

    # Update age verification
    submission.age_verified = data.age_verified
    submission.age_verified_at = datetime.utcnow()
    submission.age_verified_by_id = current_user.id
    submission.age_verification_notes = data.notes

    # Update age if provided
    if data.age_at_signing is not None:
        submission.age_at_signing = data.age_at_signing

    # Update date of birth if provided
    if data.client_date_of_birth is not None:
        submission.client_date_of_birth = data.client_date_of_birth
        # Recalculate age
        today = datetime.utcnow()
        dob = data.client_date_of_birth
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        submission.age_at_signing = age

    # Log audit
    action_notes = f"Age verification: {data.age_verified}"
    if data.notes:
        action_notes += f" - {data.notes}"
    await _create_audit_log(
        db,
        submission.id,
        ConsentAuditAction.AGE_VERIFIED,
        current_user.id,
        current_user.full_name,
        request,
        notes=action_notes,
    )

    await db.commit()
    await db.refresh(submission)

    return VerifyAgeResponse(
        age_verified=submission.age_verified,
        age_at_signing=submission.age_at_signing,
        verified_at=submission.age_verified_at,
        verified_by_id=current_user.id,
        verified_by_name=current_user.full_name,
        notes=data.notes,
    )


@router.post("/submissions/{submission_id}/guardian-consent", response_model=GuardianConsentResponse)
async def add_guardian_consent(
    submission_id: uuid.UUID,
    data: GuardianConsentInput,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "artist"])),
) -> GuardianConsentResponse:
    """Add guardian consent for a minor's consent form submission."""
    studio = await _get_user_studio(db, current_user)
    submission = await _get_submission(db, submission_id, studio.id)

    if submission.has_guardian_consent:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Guardian consent has already been recorded for this submission",
        )

    # Encrypt guardian signature
    encryption_service = get_encryption_service()
    encrypted_signature = encryption_service.encrypt(data.guardian_signature_data)

    # Update submission with guardian consent
    submission.has_guardian_consent = True
    submission.guardian_name = data.guardian_name
    submission.guardian_relationship = data.guardian_relationship
    submission.guardian_phone = data.guardian_phone
    submission.guardian_email = data.guardian_email
    submission.guardian_signature_data = encrypted_signature
    submission.guardian_consent_at = datetime.utcnow()

    # Mark as age verified if guardian consent is provided
    submission.age_verified = True
    submission.age_verified_at = datetime.utcnow()
    submission.age_verified_by_id = current_user.id
    submission.age_verification_notes = f"Guardian consent provided by {data.guardian_name} ({data.guardian_relationship})"

    # Log audit
    await _create_audit_log(
        db,
        submission.id,
        ConsentAuditAction.GUARDIAN_CONSENT,
        current_user.id,
        current_user.full_name,
        request,
        notes=f"Guardian: {data.guardian_name} ({data.guardian_relationship})",
    )

    await db.commit()
    await db.refresh(submission)

    return GuardianConsentResponse(
        success=True,
        guardian_name=data.guardian_name,
        guardian_relationship=data.guardian_relationship,
        consented_at=submission.guardian_consent_at,
        message="Guardian consent recorded successfully",
    )


@router.post("/submissions/{submission_id}/void", response_model=VoidConsentResponse)
async def void_submission(
    submission_id: uuid.UUID,
    data: VoidConsentInput,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["owner"])),
) -> VoidConsentResponse:
    """Void a consent form submission."""
    studio = await _get_user_studio(db, current_user)
    submission = await _get_submission(db, submission_id, studio.id)

    if submission.is_voided:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This submission has already been voided",
        )

    submission.is_voided = True
    submission.voided_at = datetime.utcnow()
    submission.voided_by_id = current_user.id
    submission.voided_reason = data.reason

    # Log audit
    await _create_audit_log(
        db,
        submission.id,
        ConsentAuditAction.VOIDED,
        current_user.id,
        current_user.full_name,
        request,
        notes=data.reason,
    )

    await db.commit()
    await db.refresh(submission)

    return VoidConsentResponse(
        voided=True,
        voided_at=submission.voided_at,
        voided_by_id=current_user.id,
        voided_by_name=current_user.full_name,
        reason=data.reason,
    )


@router.get("/submissions/{submission_id}/audit-log", response_model=ConsentAuditLogsListResponse)
async def get_submission_audit_log(
    submission_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["owner"])),
) -> ConsentAuditLogsListResponse:
    """Get audit log for a consent form submission."""
    studio = await _get_user_studio(db, current_user)
    await _get_submission(db, submission_id, studio.id)  # Verify access

    query = (
        select(ConsentAuditLog)
        .where(ConsentAuditLog.submission_id == submission_id)
        .order_by(ConsentAuditLog.created_at.desc())
    )

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    logs = result.scalars().all()

    return ConsentAuditLogsListResponse(
        logs=[_audit_log_to_response(log) for log in logs],
        total=total,
        page=page,
        page_size=page_size,
    )


# === Public Signing Endpoints ===

@router.get("/sign/{studio_slug}/{template_id}", response_model=ConsentFormTemplateResponse)
async def get_template_for_signing(
    studio_slug: str,
    template_id: str,
    db: AsyncSession = Depends(get_db),
) -> ConsentFormTemplateResponse:
    """Get a consent form template for public signing (no auth required).

    Accepts either a UUID template ID or "default" to get the studio's default template.
    """
    result = await db.execute(
        select(Studio).where(Studio.slug == studio_slug, Studio.deleted_at.is_(None))
    )
    studio = result.scalar_one_or_none()
    if not studio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Studio not found")

    # Handle "default" keyword to get the default template
    if template_id.lower() == "default":
        result = await db.execute(
            select(ConsentFormTemplate).where(
                ConsentFormTemplate.studio_id == studio.id,
                ConsentFormTemplate.is_default == True,
                ConsentFormTemplate.is_active == True,
                ConsentFormTemplate.deleted_at.is_(None),
            )
        )
        template = result.scalar_one_or_none()
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No default template found for this studio. Please contact the studio for a valid consent form link."
            )
    else:
        # Validate as UUID
        try:
            template_uuid = uuid.UUID(template_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid template ID. Must be a valid UUID or 'default'"
            )
        template = await _get_template(db, template_uuid, studio.id)
        if not template.is_active:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found or inactive")

    return _template_to_response(template)


@router.post("/sign/{studio_slug}", response_model=SubmitSigningResponse)
async def submit_signed_consent(
    studio_slug: str,
    data: SubmitSigningInput,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> SubmitSigningResponse:
    """Submit a signed consent form (public, no auth required)."""
    # Get studio
    result = await db.execute(
        select(Studio).where(Studio.slug == studio_slug, Studio.deleted_at.is_(None))
    )
    studio = result.scalar_one_or_none()
    if not studio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Studio not found")

    # Get template
    template = await _get_template(db, data.template_id, studio.id)
    if not template.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Template is not active")

    # Validate booking request if provided
    booking_request = None
    if data.booking_request_id:
        result = await db.execute(
            select(BookingRequest).where(
                BookingRequest.id == data.booking_request_id,
                BookingRequest.studio_id == studio.id,
            )
        )
        booking_request = result.scalar_one_or_none()
        if not booking_request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking request not found",
            )

    # Calculate age if date of birth provided
    age_at_signing = None
    age_verified = False
    if data.client_date_of_birth:
        today = datetime.utcnow()
        dob = data.client_date_of_birth
        age_at_signing = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        age_verified = age_at_signing >= template.age_requirement

    # Generate access token
    access_token = secrets.token_urlsafe(32)

    # Get client IP and user agent
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    # Encrypt signature data if provided
    encrypted_signature = None
    if data.signature_data:
        encryption_service = get_encryption_service()
        encrypted_signature = encryption_service.encrypt(data.signature_data)

    # Create submission
    submission = ConsentFormSubmission(
        template_id=template.id,
        template_name=template.name,
        template_version=template.version,
        template_fields_snapshot=template.fields,
        studio_id=studio.id,
        booking_request_id=data.booking_request_id,
        client_name=data.client_name,
        client_email=data.client_email,
        client_phone=data.client_phone,
        client_date_of_birth=data.client_date_of_birth,
        responses=data.responses,
        signature_data=encrypted_signature,  # Store encrypted signature
        signature_timestamp=datetime.utcnow() if data.signature_data else None,
        age_verified=age_verified,
        age_at_signing=age_at_signing,
        ip_address=client_ip,
        user_agent=user_agent[:500] if user_agent else None,
        access_token=access_token,
    )
    db.add(submission)

    # Update template usage stats
    template.use_count += 1
    template.last_used_at = datetime.utcnow()

    await db.commit()
    await db.refresh(submission)

    # Create audit log
    await _create_audit_log(
        db,
        submission.id,
        ConsentAuditAction.CREATED,
        None,
        data.client_name,
        request,
        is_client_access=True,
    )

    return SubmitSigningResponse(
        submission_id=submission.id,
        access_token=access_token,
        message="Consent form submitted successfully",
    )


@router.post("/upload/{access_token}/photo-id", response_model=PhotoIdUploadResponse)
async def upload_photo_id_public(
    access_token: str,
    file: UploadFile = File(...),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
) -> PhotoIdUploadResponse:
    """Upload a photo ID for a consent form submission (public, token-based)."""
    # Find submission by access token
    result = await db.execute(
        select(ConsentFormSubmission).where(ConsentFormSubmission.access_token == access_token)
    )
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    # Don't allow upload if submission is voided
    if submission.is_voided:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot upload photo ID to a voided submission",
        )

    # Don't allow re-upload if already verified
    if submission.photo_id_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Photo ID has already been verified",
        )

    # Validate file type
    allowed_types = {"image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Allowed: JPEG, PNG, GIF, WebP",
        )

    # Validate file size (5MB max)
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 5MB",
        )

    # Encrypt and save file
    encryption_service = get_encryption_service()
    ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "jpg"
    filename = f"{submission.id}_photo_id.{ext}.enc"  # Add .enc extension for encrypted files
    upload_dir = Path("uploads/photo_ids")
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_path = upload_dir / filename
    encryption_service.encrypt_and_save(content, file_path)

    submission.photo_id_url = f"/uploads/photo_ids/{filename}"
    await db.commit()

    return PhotoIdUploadResponse(
        photo_id_url=submission.photo_id_url,
        message="Photo ID uploaded and encrypted successfully",
    )


@router.get("/view/{access_token}", response_model=ConsentSubmissionPublicResponse)
async def get_submission_by_token(
    access_token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> ConsentSubmissionPublicResponse:
    """Get a consent form submission by access token (public, no auth required)."""
    result = await db.execute(
        select(ConsentFormSubmission).where(ConsentFormSubmission.access_token == access_token)
    )
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    # Log audit
    await _create_audit_log(
        db,
        submission.id,
        ConsentAuditAction.VIEWED,
        None,
        None,
        request,
        is_client_access=True,
    )

    return ConsentSubmissionPublicResponse(
        id=submission.id,
        template_name=submission.template_name,
        client_name=submission.client_name,
        responses=submission.responses,
        signature_timestamp=submission.signature_timestamp,
        submitted_at=submission.submitted_at,
        is_voided=submission.is_voided,
    )


@router.post("/submissions/{submission_id}/photo-id", response_model=PhotoIdUploadResponse)
async def upload_photo_id(
    submission_id: uuid.UUID,
    file: UploadFile = File(...),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
) -> PhotoIdUploadResponse:
    """Upload a photo ID for a consent form submission (staff only)."""
    # Find submission
    result = await db.execute(
        select(ConsentFormSubmission).where(ConsentFormSubmission.id == submission_id)
    )
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    # Require authentication for this endpoint (staff access)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Use /upload/{access_token}/photo-id for public uploads.",
        )

    # Validate file type
    allowed_types = {"image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Allowed: JPEG, PNG, GIF, WebP",
        )

    # Validate file size (5MB max)
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 5MB",
        )

    # Encrypt and save file
    encryption_service = get_encryption_service()
    ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "jpg"
    filename = f"{submission.id}_photo_id.{ext}.enc"  # Add .enc extension for encrypted files
    upload_dir = Path("uploads/photo_ids")
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_path = upload_dir / filename
    encryption_service.encrypt_and_save(content, file_path)

    submission.photo_id_url = f"/uploads/photo_ids/{filename}"
    await db.commit()

    return PhotoIdUploadResponse(
        photo_id_url=submission.photo_id_url,
        message="Photo ID uploaded and encrypted successfully",
    )


# === Secure Data Access Endpoints ===

@router.get("/submissions/{submission_id}/photo-id/decrypt")
async def get_decrypted_photo_id(
    submission_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "artist"])),
):
    """Get decrypted photo ID for a submission (staff only).

    Returns the decrypted image file for viewing/verification.
    """
    from fastapi.responses import Response

    studio = await _get_user_studio(db, current_user)
    submission = await _get_submission(db, submission_id, studio.id)

    if not submission.photo_id_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No photo ID uploaded for this submission",
        )

    # Get file path from URL
    file_path = Path(submission.photo_id_url.lstrip("/"))
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo ID file not found",
        )

    # Decrypt the file
    encryption_service = get_encryption_service()
    try:
        decrypted_content = encryption_service.decrypt_file_to_bytes(file_path)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to decrypt photo ID",
        ) from e

    # Log audit
    await _create_audit_log(
        db,
        submission.id,
        ConsentAuditAction.VIEWED,
        current_user.id,
        current_user.full_name,
        request,
        notes="Decrypted photo ID viewed",
    )

    # Determine content type from filename (before .enc)
    original_ext = file_path.stem.split(".")[-1].lower() if "." in file_path.stem else "jpg"
    content_type_map = {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "gif": "image/gif",
        "webp": "image/webp",
    }
    content_type = content_type_map.get(original_ext, "image/jpeg")

    return Response(
        content=decrypted_content,
        media_type=content_type,
        headers={"Content-Disposition": f"inline; filename=photo_id.{original_ext}"},
    )


@router.get("/submissions/{submission_id}/signature/decrypt")
async def get_decrypted_signature(
    submission_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "artist", "receptionist"])),
):
    """Get decrypted signature data for a submission (staff only).

    Returns the decrypted base64 signature data.
    """
    studio = await _get_user_studio(db, current_user)
    submission = await _get_submission(db, submission_id, studio.id)

    if not submission.signature_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No signature data for this submission",
        )

    # Decrypt the signature data
    encryption_service = get_encryption_service()
    try:
        decrypted_signature = encryption_service.decrypt(submission.signature_data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to decrypt signature data",
        ) from e

    # Log audit
    await _create_audit_log(
        db,
        submission.id,
        ConsentAuditAction.VIEWED,
        current_user.id,
        current_user.full_name,
        request,
        notes="Decrypted signature viewed",
    )

    return {"signature_data": decrypted_signature}


# === Helper Functions ===

async def _get_user_studio(db: AsyncSession, user: User) -> Studio:
    """Get the studio for a user.

    For owners, gets their owned studio.
    For artists/receptionists, gets the first active studio (single-studio mode).
    """
    from app.models.user import UserRole

    # For owner, get their owned studio
    if user.role == UserRole.OWNER:
        result = await db.execute(
            select(Studio).where(Studio.owner_id == user.id, Studio.deleted_at.is_(None))
        )
        studio = result.scalar_one_or_none()
        if not studio:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No studio found for this user",
            )
        return studio

    # For artists/receptionists, get the first active studio
    result = await db.execute(
        select(Studio).where(Studio.deleted_at.is_(None)).limit(1)
    )
    studio = result.scalar_one_or_none()
    if not studio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No studio found",
        )
    return studio


async def _get_template(db: AsyncSession, template_id: uuid.UUID, studio_id: uuid.UUID) -> ConsentFormTemplate:
    """Get a template by ID, ensuring it belongs to the studio."""
    result = await db.execute(
        select(ConsentFormTemplate).where(
            ConsentFormTemplate.id == template_id,
            ConsentFormTemplate.studio_id == studio_id,
            ConsentFormTemplate.deleted_at.is_(None),
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return template


async def _get_submission(
    db: AsyncSession, submission_id: uuid.UUID, studio_id: uuid.UUID
) -> ConsentFormSubmission:
    """Get a submission by ID, ensuring it belongs to the studio."""
    result = await db.execute(
        select(ConsentFormSubmission).where(
            ConsentFormSubmission.id == submission_id,
            ConsentFormSubmission.studio_id == studio_id,
        )
    )
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    return submission


async def _create_audit_log(
    db: AsyncSession,
    submission_id: uuid.UUID,
    action: ConsentAuditAction,
    performed_by_id: Optional[uuid.UUID],
    performed_by_name: Optional[str],
    request: Request,
    is_client_access: bool = False,
    notes: Optional[str] = None,
) -> None:
    """Create an audit log entry."""
    log = ConsentAuditLog(
        submission_id=submission_id,
        action=action,
        performed_by_id=performed_by_id,
        performed_by_name=performed_by_name,
        is_client_access=is_client_access,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "")[:500],
        notes=notes,
    )
    db.add(log)
    await db.commit()


def _template_to_summary(template: ConsentFormTemplate) -> ConsentFormTemplateSummary:
    """Convert template to summary response."""
    return ConsentFormTemplateSummary(
        id=template.id,
        name=template.name,
        description=template.description,
        version=template.version,
        is_active=template.is_active,
        is_default=template.is_default,
        requires_photo_id=template.requires_photo_id,
        requires_signature=template.requires_signature,
        field_count=len(template.fields) if template.fields else 0,
        use_count=template.use_count,
        last_used_at=template.last_used_at,
        created_at=template.created_at,
        updated_at=template.updated_at,
    )


def _template_to_response(template: ConsentFormTemplate) -> ConsentFormTemplateResponse:
    """Convert template to full response."""
    return ConsentFormTemplateResponse(
        id=template.id,
        studio_id=template.studio_id,
        name=template.name,
        description=template.description,
        header_text=template.header_text,
        footer_text=template.footer_text,
        requires_photo_id=template.requires_photo_id,
        requires_signature=template.requires_signature,
        age_requirement=template.age_requirement,
        version=template.version,
        is_active=template.is_active,
        is_default=template.is_default,
        fields=[FormFieldResponse(**f) for f in (template.fields or [])],
        use_count=template.use_count,
        last_used_at=template.last_used_at,
        created_by_id=template.created_by_id,
        created_at=template.created_at,
        updated_at=template.updated_at,
    )


def _submission_to_summary(submission: ConsentFormSubmission) -> ConsentSubmissionSummary:
    """Convert submission to summary response."""
    return ConsentSubmissionSummary(
        id=submission.id,
        template_name=submission.template_name,
        template_version=submission.template_version,
        client_name=submission.client_name,
        client_email=submission.client_email,
        submitted_at=submission.submitted_at,
        has_signature=submission.signature_data is not None,
        has_photo_id=submission.photo_id_url is not None,
        photo_id_verified=submission.photo_id_verified,
        age_verified=submission.age_verified,
        age_at_signing=submission.age_at_signing,
        has_guardian_consent=submission.has_guardian_consent,
        is_voided=submission.is_voided,
        booking_request_id=submission.booking_request_id,
        created_at=submission.created_at,
    )


def _submission_to_response(submission: ConsentFormSubmission) -> ConsentSubmissionResponse:
    """Convert submission to full response.

    Note: signature_data contains encrypted data and is not included directly.
    Use the /submissions/{id}/signature/decrypt endpoint to retrieve decrypted signatures.
    Photo ID files are encrypted at rest and accessible via /submissions/{id}/photo-id/decrypt.
    """
    return ConsentSubmissionResponse(
        id=submission.id,
        template_id=submission.template_id,
        template_name=submission.template_name,
        template_version=submission.template_version,
        template_fields_snapshot=[FormFieldResponse(**f) for f in submission.template_fields_snapshot],
        studio_id=submission.studio_id,
        booking_request_id=submission.booking_request_id,
        client_name=submission.client_name,
        client_email=submission.client_email,
        client_phone=submission.client_phone,
        client_date_of_birth=submission.client_date_of_birth,
        responses=submission.responses,
        signature_data="[ENCRYPTED]" if submission.signature_data else None,  # Don't expose encrypted data
        signature_timestamp=submission.signature_timestamp,
        photo_id_url=submission.photo_id_url,  # URL still shown for reference, but file is encrypted
        photo_id_verified=submission.photo_id_verified,
        photo_id_verified_at=submission.photo_id_verified_at,
        age_verified=submission.age_verified,
        age_at_signing=submission.age_at_signing,
        age_verified_at=submission.age_verified_at,
        age_verified_by_id=submission.age_verified_by_id,
        age_verification_notes=submission.age_verification_notes,
        has_guardian_consent=submission.has_guardian_consent,
        guardian_name=submission.guardian_name,
        guardian_relationship=submission.guardian_relationship,
        guardian_phone=submission.guardian_phone,
        guardian_email=submission.guardian_email,
        guardian_consent_at=submission.guardian_consent_at,
        ip_address=submission.ip_address,
        submitted_at=submission.submitted_at,
        access_token=submission.access_token,
        is_voided=submission.is_voided,
        voided_at=submission.voided_at,
        voided_reason=submission.voided_reason,
        created_at=submission.created_at,
    )


def _audit_log_to_response(log: ConsentAuditLog) -> ConsentAuditLogResponse:
    """Convert audit log to response."""
    return ConsentAuditLogResponse(
        id=log.id,
        submission_id=log.submission_id,
        action=log.action.value,
        performed_by_id=log.performed_by_id,
        performed_by_name=log.performed_by_name,
        is_client_access=log.is_client_access,
        ip_address=log.ip_address,
        notes=log.notes,
        created_at=log.created_at,
    )
