"""Consent form models for digital consent management."""

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, SoftDeleteMixin


class ConsentFieldType(str, enum.Enum):
    """Types of form fields available in consent forms."""

    TEXT = "text"
    TEXTAREA = "textarea"
    CHECKBOX = "checkbox"
    SIGNATURE = "signature"
    DATE = "date"
    SELECT = "select"
    RADIO = "radio"
    PHOTO_ID = "photo_id"
    HEADING = "heading"
    PARAGRAPH = "paragraph"


class ConsentFormTemplate(BaseModel, SoftDeleteMixin):
    """Template for consent forms with configurable fields."""

    __tablename__ = "consent_form_templates"

    # Studio ownership
    studio_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Template info
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Version control
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Form structure - JSON array of field definitions
    # Each field: {
    #   "id": "uuid-string",
    #   "type": "text|textarea|checkbox|signature|date|select|radio|photo_id|heading|paragraph",
    #   "label": "Field Label",
    #   "required": true/false,
    #   "order": 1,
    #   "placeholder": "optional placeholder",
    #   "helpText": "optional help text",
    #   "options": ["option1", "option2"] (for select/radio),
    #   "content": "static content" (for heading/paragraph)
    # }
    fields: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
    )

    # Legal text sections
    header_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    footer_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Settings
    requires_photo_id: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requires_signature: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    age_requirement: Mapped[int] = mapped_column(Integer, default=18, nullable=False)

    # Usage tracking
    use_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Creator tracking
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    studio = relationship("Studio", back_populates="consent_templates")
    created_by = relationship("User", back_populates="created_consent_templates")
    submissions = relationship(
        "ConsentFormSubmission",
        back_populates="template",
        cascade="all, delete-orphan",
    )


class ConsentFormSubmission(BaseModel):
    """Completed consent form submission with signature and audit trail."""

    __tablename__ = "consent_form_submissions"

    # Template reference
    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("consent_form_templates.id", ondelete="SET NULL"),
        nullable=True,  # Keep submission even if template deleted
        index=True,
    )

    # Snapshot of template at time of submission
    template_name: Mapped[str] = mapped_column(String(200), nullable=False)
    template_version: Mapped[int] = mapped_column(Integer, nullable=False)
    template_fields_snapshot: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=False,
    )

    # Studio and booking context
    studio_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    booking_request_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("booking_requests.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Client information
    client_name: Mapped[str] = mapped_column(String(200), nullable=False)
    client_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    client_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    client_date_of_birth: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Form responses - JSON object mapping field IDs to values
    # {
    #   "field-uuid-1": "text response",
    #   "field-uuid-2": true,
    #   "field-uuid-3": "2026-01-15"
    # }
    responses: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )

    # Signature data
    signature_data: Mapped[str | None] = mapped_column(
        Text,  # Base64 encoded signature image
        nullable=True,
    )
    signature_timestamp: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Photo ID (file path, not base64 to save space)
    photo_id_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    photo_id_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    photo_id_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    photo_id_verified_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Age verification
    age_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    age_at_signing: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Submission metadata
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)  # IPv6 max
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Access token for client retrieval
    access_token: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
    )

    # Voided status (if form needs to be invalidated)
    is_voided: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    voided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    voided_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    voided_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    template = relationship("ConsentFormTemplate", back_populates="submissions")
    studio = relationship("Studio", back_populates="consent_submissions")
    booking_request = relationship("BookingRequest", back_populates="consent_submission")
    photo_id_verified_by = relationship(
        "User",
        foreign_keys=[photo_id_verified_by_id],
        back_populates="verified_photo_ids",
    )
    voided_by = relationship(
        "User",
        foreign_keys=[voided_by_id],
        back_populates="voided_consent_forms",
    )
    audit_logs = relationship(
        "ConsentAuditLog",
        back_populates="submission",
        cascade="all, delete-orphan",
    )


class ConsentAuditAction(str, enum.Enum):
    """Types of audit actions for consent forms."""

    CREATED = "created"
    VIEWED = "viewed"
    DOWNLOADED = "downloaded"
    VERIFIED = "verified"
    VOIDED = "voided"
    EXPORTED = "exported"


class ConsentAuditLog(BaseModel):
    """Audit log for consent form access and actions."""

    __tablename__ = "consent_audit_logs"

    submission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("consent_form_submissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    action: Mapped[ConsentAuditAction] = mapped_column(
        Enum(ConsentAuditAction),
        nullable=False,
    )

    # Who performed the action
    performed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    performed_by_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Client access (via token)
    is_client_access: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Context
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    submission = relationship("ConsentFormSubmission", back_populates="audit_logs")
    performed_by = relationship("User", back_populates="consent_audit_logs")
