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
from app.models.message import (
    Conversation,
    ConversationStatus,
    Message,
    MessageChannel,
    MessageDirection,
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
    "Conversation",
    "ConversationStatus",
    "Message",
    "MessageChannel",
    "MessageDirection",
    "PortfolioImage",
    "SoftDeleteMixin",
    "Studio",
    "TattooSize",
    "User",
    "UserRole",
]
