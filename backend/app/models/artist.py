"""Artist profile and portfolio models."""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.user import User


class ArtistProfile(BaseModel):
    """Extended profile for users with artist role."""

    __tablename__ = "artist_profiles"

    # One-to-one relationship with User
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    # Bio and specialties
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    specialties: Mapped[list[str]] = mapped_column(
        ARRAY(String(100)),
        default=list,
        nullable=False,
    )

    # Professional info
    years_experience: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hourly_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)  # in cents
    minimum_booking_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Social links
    instagram_handle: Mapped[str | None] = mapped_column(String(100), nullable=True)
    website_url: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="artist_profile")
    portfolio_images: Mapped[list["PortfolioImage"]] = relationship(
        "PortfolioImage",
        back_populates="artist_profile",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="PortfolioImage.display_order",
    )


class PortfolioImage(BaseModel):
    """Portfolio image for artist gallery."""

    __tablename__ = "portfolio_images"

    # Relationship to artist profile
    artist_profile_id: Mapped[UUID] = mapped_column(
        ForeignKey("artist_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Image info
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    thumbnail_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Categorization
    style: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g., "Traditional", "Realism"
    placement: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g., "Arm", "Back"

    # Display order for gallery
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationship
    artist_profile: Mapped["ArtistProfile"] = relationship(
        "ArtistProfile", back_populates="portfolio_images"
    )
