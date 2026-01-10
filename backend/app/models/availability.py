"""Artist availability and time-off models."""

from datetime import date, time
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.user import User


class ArtistAvailability(BaseModel):
    """Recurring weekly availability for artists."""

    __tablename__ = "artist_availability"

    # Relationship to user (artist)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Day of week (0=Monday, 6=Sunday)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)

    # Time range
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)

    # Whether this slot is active (allows easy toggling without deleting)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="availability_slots")


class ArtistTimeOff(BaseModel):
    """Time-off periods for artists (vacations, personal days, etc.)."""

    __tablename__ = "artist_time_off"

    # Relationship to user (artist)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Date range for time off
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)

    # Optional reason/notes
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Whether this is an all-day block or allows partial availability
    all_day: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="time_off_periods")
