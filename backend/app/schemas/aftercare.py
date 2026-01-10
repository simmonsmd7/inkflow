"""Pydantic schemas for aftercare templates and management."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

# Enums as literals
TattooType = Literal[
    "traditional", "fine_line", "blackwork", "watercolor", "realism",
    "neo_traditional", "geometric", "tribal", "dotwork", "script",
    "cover_up", "touch_up", "other"
]

TattooPlacement = Literal[
    "arm_upper", "arm_lower", "arm_inner", "hand", "finger",
    "leg_upper", "leg_lower", "foot", "chest", "back", "ribs",
    "stomach", "neck", "face", "head", "shoulder", "hip", "other"
]

AftercareSentStatus = Literal["pending", "sent", "delivered", "failed"]
FollowUpType = Literal["day_3", "week_1", "week_2", "week_4", "custom"]
FollowUpStatus = Literal["scheduled", "sent", "delivered", "cancelled", "failed"]
HealingIssueSeverity = Literal["minor", "moderate", "concerning", "urgent"]
HealingIssueStatus = Literal["reported", "acknowledged", "in_progress", "resolved", "escalated"]


# === Extra Data Schema ===

class AftercareExtraData(BaseModel):
    """Structured extra data for aftercare templates."""

    days_covered: int | None = Field(default=14, ge=1, le=60)
    key_points: list[str] = Field(default_factory=list)
    products_recommended: list[str] = Field(default_factory=list)
    products_to_avoid: list[str] = Field(default_factory=list)
    warning_signs: list[str] = Field(default_factory=list)


# === Template Schemas ===

class AftercareTemplateBase(BaseModel):
    """Base schema for aftercare template."""

    name: str = Field(..., min_length=1, max_length=200, description="Template name")
    description: str | None = Field(default=None, max_length=2000)
    tattoo_type: TattooType | None = Field(default=None, description="Specific tattoo type this applies to")
    placement: TattooPlacement | None = Field(default=None, description="Body placement this applies to")
    instructions_html: str = Field(..., description="HTML-formatted aftercare instructions")
    instructions_plain: str = Field(..., description="Plain text aftercare instructions")
    extra_data: AftercareExtraData | None = Field(default=None)


class AftercareTemplateCreate(AftercareTemplateBase):
    """Schema for creating an aftercare template."""

    is_active: bool = Field(default=True)
    is_default: bool = Field(default=False)


class AftercareTemplateUpdate(BaseModel):
    """Schema for updating an aftercare template."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    tattoo_type: TattooType | None = None
    placement: TattooPlacement | None = None
    instructions_html: str | None = None
    instructions_plain: str | None = None
    extra_data: AftercareExtraData | None = None
    is_active: bool | None = None
    is_default: bool | None = None


class AftercareTemplateSummary(BaseModel):
    """Summary schema for template listing."""

    id: UUID
    name: str
    description: str | None
    tattoo_type: TattooType | None
    placement: TattooPlacement | None
    is_active: bool
    is_default: bool
    use_count: int
    last_used_at: datetime | None
    created_at: datetime


class AftercareTemplateResponse(AftercareTemplateSummary):
    """Full template response with all details."""

    instructions_html: str
    instructions_plain: str
    extra_data: AftercareExtraData | None
    created_by_id: UUID | None
    updated_at: datetime


# === Aftercare Sent Schemas ===

class AftercareSendInput(BaseModel):
    """Input for sending aftercare instructions."""

    template_id: UUID = Field(..., description="Template to use")
    booking_request_id: UUID | None = Field(default=None, description="Associated booking")
    client_name: str = Field(..., min_length=1, max_length=200)
    client_email: EmailStr
    client_phone: str | None = Field(default=None, max_length=50)
    tattoo_type: TattooType | None = None
    placement: TattooPlacement | None = None
    tattoo_description: str | None = None
    appointment_date: datetime
    send_via: Literal["email", "sms", "both"] = Field(default="email")
    schedule_follow_ups: bool = Field(default=True, description="Schedule automatic follow-up messages")


class AftercareSentSummary(BaseModel):
    """Summary of sent aftercare instructions."""

    id: UUID
    template_name: str
    client_name: str
    client_email: str
    appointment_date: datetime
    status: AftercareSentStatus
    sent_at: datetime | None
    delivered_at: datetime | None
    view_count: int
    created_at: datetime


class AftercareSentResponse(AftercareSentSummary):
    """Full response for sent aftercare."""

    template_id: UUID | None
    instructions_snapshot: str
    booking_request_id: UUID | None
    artist_id: UUID | None
    client_phone: str | None
    tattoo_type: TattooType | None
    placement: TattooPlacement | None
    tattoo_description: str | None
    sent_via: str
    first_viewed_at: datetime | None
    access_token: str


# === Follow-Up Schemas ===

class FollowUpCreate(BaseModel):
    """Create a custom follow-up message."""

    aftercare_sent_id: UUID
    follow_up_type: FollowUpType = Field(default="custom")
    scheduled_for: datetime
    subject: str = Field(..., max_length=200)
    message_html: str
    message_plain: str
    send_via: Literal["email", "sms"] = Field(default="email")


class FollowUpSummary(BaseModel):
    """Summary of a follow-up message."""

    id: UUID
    aftercare_sent_id: UUID
    follow_up_type: FollowUpType
    scheduled_for: datetime
    status: FollowUpStatus
    sent_at: datetime | None
    created_at: datetime


class FollowUpResponse(FollowUpSummary):
    """Full follow-up response."""

    subject: str
    message_html: str
    message_plain: str
    send_via: str
    delivered_at: datetime | None
    failure_reason: str | None


# === Healing Issue Schemas ===

class HealingIssueCreate(BaseModel):
    """Client-submitted healing issue report."""

    aftercare_sent_id: UUID
    description: str = Field(..., min_length=10, max_length=2000)
    severity: HealingIssueSeverity = Field(default="minor")
    symptoms: list[str] = Field(default_factory=list)
    days_since_appointment: int = Field(..., ge=0)


class HealingIssueUpdate(BaseModel):
    """Staff response to a healing issue."""

    status: HealingIssueStatus | None = None
    staff_notes: str | None = None
    resolution_notes: str | None = None
    touch_up_requested: bool | None = None


class HealingIssueSummary(BaseModel):
    """Summary of a healing issue report."""

    id: UUID
    aftercare_sent_id: UUID
    description: str
    severity: HealingIssueSeverity
    symptoms: list[str]
    days_since_appointment: int
    status: HealingIssueStatus
    created_at: datetime


class HealingIssueResponse(HealingIssueSummary):
    """Full healing issue response."""

    studio_id: UUID
    photo_urls: list[str]
    resolved_at: datetime | None
    resolution_notes: str | None
    responded_by_id: UUID | None
    responded_at: datetime | None
    staff_notes: str | None
    touch_up_requested: bool
    touch_up_booking_id: UUID | None


# === Client Portal Schemas ===

class ClientAftercareView(BaseModel):
    """Aftercare instructions view for client portal."""

    id: UUID
    client_name: str
    appointment_date: datetime
    tattoo_type: TattooType | None
    placement: TattooPlacement | None
    tattoo_description: str | None
    instructions_html: str
    extra_data: AftercareExtraData | None
    follow_ups: list[FollowUpSummary]
    can_report_issue: bool = Field(default=True)


class ReportIssueInput(BaseModel):
    """Input for client to report a healing issue."""

    description: str = Field(..., min_length=10, max_length=2000)
    severity: HealingIssueSeverity = Field(default="minor")
    symptoms: list[str] = Field(default_factory=list)


# === List Response Schemas ===

class AftercareTemplateListResponse(BaseModel):
    """Paginated list of aftercare templates."""

    items: list[AftercareTemplateSummary]
    total: int
    page: int
    page_size: int
    total_pages: int


class AftercareSentListResponse(BaseModel):
    """Paginated list of sent aftercare records."""

    items: list[AftercareSentSummary]
    total: int
    page: int
    page_size: int
    total_pages: int


class HealingIssueListResponse(BaseModel):
    """Paginated list of healing issue reports."""

    items: list[HealingIssueSummary]
    total: int
    page: int
    page_size: int
    total_pages: int


# === Follow-Up Management Schemas ===

class FollowUpListResponse(BaseModel):
    """Paginated list of follow-ups."""

    items: list[FollowUpSummary]
    total: int
    page: int
    page_size: int
    total_pages: int


class FollowUpWithClientInfo(FollowUpResponse):
    """Follow-up with client and aftercare context."""

    client_name: str
    client_email: str
    appointment_date: datetime
    studio_name: str | None = None


class PendingFollowUpsResponse(BaseModel):
    """List of pending follow-ups ready to send."""

    items: list[FollowUpWithClientInfo]
    total: int


class ProcessFollowUpsResult(BaseModel):
    """Result of processing scheduled follow-ups."""

    processed: int = Field(description="Number of follow-ups processed")
    sent: int = Field(description="Number successfully sent")
    failed: int = Field(description="Number that failed to send")
    details: list[dict] = Field(default_factory=list, description="Details of each processed follow-up")


class SendFollowUpInput(BaseModel):
    """Input for manually sending a follow-up."""

    send_via: Literal["email", "sms"] | None = Field(default=None, description="Override default send method")


class SendFollowUpResponse(BaseModel):
    """Response after sending a follow-up."""

    id: UUID
    status: FollowUpStatus
    sent_at: datetime | None
    message: str


class CancelFollowUpResponse(BaseModel):
    """Response after cancelling a follow-up."""

    id: UUID
    status: FollowUpStatus
    message: str


class FollowUpUpdate(BaseModel):
    """Update a scheduled follow-up."""

    scheduled_for: datetime | None = None
    subject: str | None = Field(default=None, max_length=200)
    message_html: str | None = None
    message_plain: str | None = None
    send_via: Literal["email", "sms"] | None = None


# === Touch-up Scheduling Schemas ===

class TouchUpRequestInput(BaseModel):
    """Input for requesting a touch-up from a healing issue."""

    preferred_dates: list[str] | None = Field(
        default=None,
        max_length=5,
        description="List of preferred date strings"
    )
    notes: str | None = Field(default=None, max_length=1000)
    contact_preference: Literal["email", "phone", "both"] = Field(default="email")


class TouchUpScheduleInput(BaseModel):
    """Input for staff to schedule a touch-up appointment."""

    scheduled_date: datetime = Field(..., description="Date and time for the touch-up")
    duration_hours: float = Field(default=1.0, ge=0.5, le=8.0)
    artist_id: UUID | None = Field(default=None, description="Assign to specific artist")
    notes: str | None = Field(default=None, max_length=2000)
    send_confirmation: bool = Field(default=True)
    is_free_touch_up: bool = Field(default=True, description="Whether this is a complimentary touch-up")


class TouchUpBookingInfo(BaseModel):
    """Information about a touch-up booking linked to a healing issue."""

    booking_id: UUID
    reference_id: str
    status: str
    scheduled_date: datetime | None
    artist_name: str | None
    is_free_touch_up: bool
    created_at: datetime


class TouchUpResponse(BaseModel):
    """Response after creating/scheduling a touch-up."""

    healing_issue_id: UUID
    booking_id: UUID
    reference_id: str
    message: str
    client_notified: bool


class HealingIssueWithTouchUp(HealingIssueResponse):
    """Healing issue with touch-up booking details."""

    touch_up_booking: TouchUpBookingInfo | None = None


class ClientTouchUpRequestInput(BaseModel):
    """Client-facing input for requesting a touch-up."""

    reason: str = Field(..., min_length=10, max_length=1000, description="Description of why touch-up is needed")
    preferred_dates: list[str] | None = Field(default=None, max_length=5)
    additional_notes: str | None = Field(default=None, max_length=500)


class ClientTouchUpRequestResponse(BaseModel):
    """Response to client's touch-up request."""

    request_id: UUID
    message: str
    studio_name: str
    expected_contact_within: str = Field(default="24-48 hours")
