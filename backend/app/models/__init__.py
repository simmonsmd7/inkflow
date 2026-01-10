"""SQLAlchemy models package."""

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
from app.models.artist import ArtistProfile, PortfolioImage
from app.models.availability import ArtistAvailability, ArtistTimeOff
from app.models.base import BaseModel, SoftDeleteMixin
from app.models.client import Client
from app.models.booking import (
    BookingReferenceImage,
    BookingRequest,
    BookingRequestStatus,
    TattooSize,
)
from app.models.commission import (
    CommissionRule,
    CommissionTier,
    CommissionType,
    EarnedCommission,
    PayPeriod,
    PayPeriodSchedule,
    PayPeriodStatus,
    TipPaymentMethod,
)
from app.models.consent import (
    ConsentAuditAction,
    ConsentAuditLog,
    ConsentFieldType,
    ConsentFormSubmission,
    ConsentFormTemplate,
)
from app.models.message import (
    Conversation,
    ConversationStatus,
    Message,
    MessageChannel,
    MessageDirection,
    ReplyTemplate,
)
from app.models.studio import Studio
from app.models.user import User, UserRole

__all__ = [
    "AftercareFollowUp",
    "AftercareSent",
    "AftercareSentStatus",
    "AftercareTemplate",
    "ArtistAvailability",
    "ArtistProfile",
    "ArtistTimeOff",
    "BaseModel",
    "BookingReferenceImage",
    "BookingRequest",
    "BookingRequestStatus",
    "Client",
    "CommissionRule",
    "CommissionTier",
    "CommissionType",
    "ConsentAuditAction",
    "ConsentAuditLog",
    "ConsentFieldType",
    "ConsentFormSubmission",
    "ConsentFormTemplate",
    "Conversation",
    "ConversationStatus",
    "EarnedCommission",
    "FollowUpStatus",
    "FollowUpType",
    "HealingIssueReport",
    "HealingIssueSeverity",
    "HealingIssueStatus",
    "Message",
    "MessageChannel",
    "MessageDirection",
    "PayPeriod",
    "PayPeriodSchedule",
    "PayPeriodStatus",
    "PortfolioImage",
    "ReplyTemplate",
    "SoftDeleteMixin",
    "Studio",
    "TattooPlacement",
    "TattooSize",
    "TattooType",
    "TipPaymentMethod",
    "User",
    "UserRole",
]
