"""SQLAlchemy models package."""

from app.models.artist import ArtistProfile, PortfolioImage
from app.models.availability import ArtistAvailability, ArtistTimeOff
from app.models.base import BaseModel, SoftDeleteMixin
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
    "ArtistAvailability",
    "ArtistProfile",
    "ArtistTimeOff",
    "BaseModel",
    "BookingReferenceImage",
    "BookingRequest",
    "BookingRequestStatus",
    "CommissionRule",
    "CommissionTier",
    "CommissionType",
    "Conversation",
    "ConversationStatus",
    "EarnedCommission",
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
    "TattooSize",
    "TipPaymentMethod",
    "User",
    "UserRole",
]
