"""Pydantic schemas for consent forms."""

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

# Field types literal
ConsentFieldType = Literal[
    "text", "textarea", "checkbox", "signature", "date",
    "select", "radio", "photo_id", "heading", "paragraph"
]

# Audit actions literal
ConsentAuditAction = Literal[
    "created", "viewed", "downloaded", "verified", "voided", "exported"
]


# === Form Field Schemas ===

class FormFieldBase(BaseModel):
    """Base schema for a form field definition."""

    id: str = Field(..., description="Unique identifier for this field")
    type: ConsentFieldType = Field(..., description="Type of form field")
    label: str = Field(..., max_length=200, description="Display label for the field")
    required: bool = Field(default=False, description="Whether this field is required")
    order: int = Field(default=0, description="Display order of the field")
    placeholder: str | None = Field(default=None, max_length=200, description="Placeholder text")
    help_text: str | None = Field(default=None, max_length=500, description="Help text shown below field")
    options: list[str] | None = Field(default=None, description="Options for select/radio fields")
    content: str | None = Field(default=None, description="Static content for heading/paragraph")

    @field_validator("options")
    @classmethod
    def validate_options(cls, v: list[str] | None, info) -> list[str] | None:
        """Validate options are provided for select/radio fields."""
        if info.data.get("type") in ("select", "radio") and not v:
            raise ValueError("Options are required for select and radio field types")
        return v


class FormFieldCreate(FormFieldBase):
    """Schema for creating a new form field."""
    pass


class FormFieldResponse(FormFieldBase):
    """Schema for form field in API responses."""
    pass


# === Template Schemas ===

class ConsentFormTemplateBase(BaseModel):
    """Base schema for consent form template."""

    name: str = Field(..., min_length=1, max_length=200, description="Template name")
    description: str | None = Field(default=None, max_length=2000)
    header_text: str | None = Field(default=None, description="Header/intro text for the form")
    footer_text: str | None = Field(default=None, description="Footer/legal text for the form")
    requires_photo_id: bool = Field(default=False)
    requires_signature: bool = Field(default=True)
    age_requirement: int = Field(default=18, ge=0, le=100)


class ConsentFormTemplateCreate(ConsentFormTemplateBase):
    """Schema for creating a consent form template."""

    fields: list[FormFieldCreate] = Field(default_factory=list, description="Form field definitions")
    is_active: bool = Field(default=True)
    is_default: bool = Field(default=False)


class ConsentFormTemplateUpdate(BaseModel):
    """Schema for updating a consent form template."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    header_text: str | None = None
    footer_text: str | None = None
    requires_photo_id: bool | None = None
    requires_signature: bool | None = None
    age_requirement: int | None = Field(default=None, ge=0, le=100)
    fields: list[FormFieldCreate] | None = None
    is_active: bool | None = None
    is_default: bool | None = None


class ConsentFormTemplateSummary(BaseModel):
    """Summary schema for template listing."""

    id: UUID
    name: str
    description: str | None
    version: int
    is_active: bool
    is_default: bool
    requires_photo_id: bool
    requires_signature: bool
    field_count: int
    use_count: int
    last_used_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ConsentFormTemplateResponse(ConsentFormTemplateBase):
    """Full template response schema."""

    id: UUID
    studio_id: UUID
    version: int
    is_active: bool
    is_default: bool
    fields: list[FormFieldResponse]
    use_count: int
    last_used_at: datetime | None
    created_by_id: UUID | None
    created_at: datetime
    updated_at: datetime


class ConsentFormTemplatesListResponse(BaseModel):
    """Response for template listing endpoint."""

    templates: list[ConsentFormTemplateSummary]
    total: int
    page: int
    page_size: int


# === Submission Schemas ===

class ConsentFormSubmissionCreate(BaseModel):
    """Schema for submitting a consent form."""

    template_id: UUID
    booking_request_id: UUID | None = None

    # Client info
    client_name: str = Field(..., min_length=1, max_length=200)
    client_email: EmailStr
    client_phone: str | None = Field(default=None, max_length=50)
    client_date_of_birth: datetime | None = None

    # Form responses - mapping of field_id to value
    responses: dict[str, Any] = Field(default_factory=dict)

    # Signature (base64 encoded image data)
    signature_data: str | None = None


class PhotoIdUploadResponse(BaseModel):
    """Response after uploading a photo ID."""

    photo_id_url: str
    message: str


class VerifyPhotoIdInput(BaseModel):
    """Input for verifying a photo ID."""

    notes: str | None = Field(default=None, max_length=500)


class VerifyPhotoIdResponse(BaseModel):
    """Response after verifying a photo ID."""

    verified: bool
    verified_at: datetime
    verified_by_id: UUID
    verified_by_name: str


class VoidConsentInput(BaseModel):
    """Input for voiding a consent form."""

    reason: str = Field(..., min_length=1, max_length=1000)


class VoidConsentResponse(BaseModel):
    """Response after voiding a consent form."""

    voided: bool
    voided_at: datetime
    voided_by_id: UUID
    voided_by_name: str
    reason: str


class ConsentSubmissionSummary(BaseModel):
    """Summary schema for submission listing."""

    id: UUID
    template_name: str
    template_version: int
    client_name: str
    client_email: str
    submitted_at: datetime
    has_signature: bool
    has_photo_id: bool
    photo_id_verified: bool
    age_verified: bool
    is_voided: bool
    booking_request_id: UUID | None
    created_at: datetime


class ConsentSubmissionResponse(BaseModel):
    """Full submission response schema."""

    id: UUID
    template_id: UUID | None
    template_name: str
    template_version: int
    template_fields_snapshot: list[FormFieldResponse]

    studio_id: UUID
    booking_request_id: UUID | None

    # Client info
    client_name: str
    client_email: str
    client_phone: str | None
    client_date_of_birth: datetime | None

    # Form data
    responses: dict[str, Any]

    # Signature
    signature_data: str | None
    signature_timestamp: datetime | None

    # Photo ID
    photo_id_url: str | None
    photo_id_verified: bool
    photo_id_verified_at: datetime | None

    # Age verification
    age_verified: bool
    age_at_signing: int | None

    # Submission metadata
    ip_address: str | None
    submitted_at: datetime
    access_token: str

    # Voided status
    is_voided: bool
    voided_at: datetime | None
    voided_reason: str | None

    created_at: datetime


class ConsentSubmissionPublicResponse(BaseModel):
    """Public response for client-facing submission view (via access token)."""

    id: UUID
    template_name: str
    client_name: str
    responses: dict[str, Any]
    signature_timestamp: datetime | None
    submitted_at: datetime
    is_voided: bool


class ConsentSubmissionsListResponse(BaseModel):
    """Response for submission listing endpoint."""

    submissions: list[ConsentSubmissionSummary]
    total: int
    page: int
    page_size: int


# === Audit Log Schemas ===

class ConsentAuditLogResponse(BaseModel):
    """Response schema for audit log entry."""

    id: UUID
    submission_id: UUID
    action: ConsentAuditAction
    performed_by_id: UUID | None
    performed_by_name: str | None
    is_client_access: bool
    ip_address: str | None
    notes: str | None
    created_at: datetime


class ConsentAuditLogsListResponse(BaseModel):
    """Response for audit log listing endpoint."""

    logs: list[ConsentAuditLogResponse]
    total: int
    page: int
    page_size: int


# === Pre-built Template Schemas ===

class PrebuiltTemplateInfo(BaseModel):
    """Info about a pre-built template option."""

    id: str
    name: str
    description: str
    field_count: int


class PrebuiltTemplatesListResponse(BaseModel):
    """Response listing available pre-built templates."""

    templates: list[PrebuiltTemplateInfo]


class CreateFromPrebuiltInput(BaseModel):
    """Input for creating a template from a pre-built option."""

    prebuilt_id: str = Field(..., description="ID of the pre-built template to use")
    name: str | None = Field(default=None, max_length=200, description="Override the default name")
    is_default: bool = Field(default=False)


# === Signing Flow Schemas ===

class StartSigningInput(BaseModel):
    """Input to start the consent form signing flow."""

    template_id: UUID
    booking_request_id: UUID | None = None
    client_email: str | None = None  # Pre-fill if known


class SigningFormResponse(BaseModel):
    """Response with form data for signing."""

    template: ConsentFormTemplateResponse
    booking_request_id: UUID | None
    prefilled_client_name: str | None
    prefilled_client_email: str | None
    prefilled_client_phone: str | None


class SubmitSigningInput(BaseModel):
    """Input for final consent form submission with signature."""

    template_id: UUID
    booking_request_id: UUID | None = None

    client_name: str = Field(..., min_length=1, max_length=200)
    client_email: EmailStr
    client_phone: str | None = Field(default=None, max_length=50)
    client_date_of_birth: datetime | None = None

    responses: dict[str, Any]
    signature_data: str  # Required for final submission

    # Age confirmation
    confirms_of_age: bool = False


class SubmitSigningResponse(BaseModel):
    """Response after submitting a signed consent form."""

    submission_id: UUID
    access_token: str
    message: str
