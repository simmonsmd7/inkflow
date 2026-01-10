"""Availability router for managing artist schedules and time-off."""

import uuid
from datetime import date, datetime, time, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import ArtistAvailability, ArtistTimeOff, User, UserRole
from app.schemas.availability import (
    AvailabilitySlotCreate,
    AvailabilitySlotResponse,
    AvailabilitySlotUpdate,
    BulkAvailabilityUpdate,
    TimeOffCreate,
    TimeOffListResponse,
    TimeOffResponse,
    TimeOffUpdate,
    WeeklySchedule,
)
from app.schemas.user import MessageResponse
from app.services.auth import get_current_user, require_artist_or_owner

router = APIRouter(prefix="/availability", tags=["Availability"])


# Day names for reference
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


@router.get("/me", response_model=WeeklySchedule)
async def get_my_availability(
    current_user: Annotated[User, Depends(require_artist_or_owner)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get the current artist's weekly availability schedule.

    Requires artist or owner role.
    """
    result = await db.execute(
        select(ArtistAvailability)
        .where(ArtistAvailability.user_id == current_user.id)
        .order_by(ArtistAvailability.day_of_week, ArtistAvailability.start_time)
    )
    slots = result.scalars().all()

    return WeeklySchedule(
        slots=[
            AvailabilitySlotResponse(
                id=slot.id,
                user_id=slot.user_id,
                day_of_week=slot.day_of_week,
                start_time=slot.start_time,
                end_time=slot.end_time,
                is_available=slot.is_available,
                created_at=slot.created_at,
                updated_at=slot.updated_at,
            )
            for slot in slots
        ],
        user_id=current_user.id,
    )


@router.put("/me", response_model=WeeklySchedule)
async def update_my_availability(
    schedule_data: BulkAvailabilityUpdate,
    current_user: Annotated[User, Depends(require_artist_or_owner)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Update the current artist's weekly availability schedule.

    Replaces all existing availability slots with the provided ones.
    Requires artist or owner role.
    """
    # Delete existing slots
    await db.execute(
        delete(ArtistAvailability).where(ArtistAvailability.user_id == current_user.id)
    )

    # Create new slots
    new_slots = []
    for slot_data in schedule_data.slots:
        slot = ArtistAvailability(
            user_id=current_user.id,
            day_of_week=slot_data.day_of_week,
            start_time=slot_data.start_time,
            end_time=slot_data.end_time,
            is_available=slot_data.is_available,
        )
        db.add(slot)
        new_slots.append(slot)

    await db.commit()

    # Refresh all slots
    for slot in new_slots:
        await db.refresh(slot)

    return WeeklySchedule(
        slots=[
            AvailabilitySlotResponse(
                id=slot.id,
                user_id=slot.user_id,
                day_of_week=slot.day_of_week,
                start_time=slot.start_time,
                end_time=slot.end_time,
                is_available=slot.is_available,
                created_at=slot.created_at,
                updated_at=slot.updated_at,
            )
            for slot in sorted(new_slots, key=lambda x: (x.day_of_week, x.start_time))
        ],
        user_id=current_user.id,
    )


@router.post("/me/slot", response_model=AvailabilitySlotResponse)
async def add_availability_slot(
    slot_data: AvailabilitySlotCreate,
    current_user: Annotated[User, Depends(require_artist_or_owner)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Add a single availability slot.

    Requires artist or owner role.
    """
    # Check for overlapping slots on the same day
    result = await db.execute(
        select(ArtistAvailability).where(
            ArtistAvailability.user_id == current_user.id,
            ArtistAvailability.day_of_week == slot_data.day_of_week,
        )
    )
    existing_slots = result.scalars().all()

    for existing in existing_slots:
        # Check if times overlap
        if (slot_data.start_time < existing.end_time and
            slot_data.end_time > existing.start_time):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"This slot overlaps with an existing slot on {DAY_NAMES[slot_data.day_of_week]}",
            )

    slot = ArtistAvailability(
        user_id=current_user.id,
        day_of_week=slot_data.day_of_week,
        start_time=slot_data.start_time,
        end_time=slot_data.end_time,
        is_available=slot_data.is_available,
    )
    db.add(slot)
    await db.commit()
    await db.refresh(slot)

    return AvailabilitySlotResponse(
        id=slot.id,
        user_id=slot.user_id,
        day_of_week=slot.day_of_week,
        start_time=slot.start_time,
        end_time=slot.end_time,
        is_available=slot.is_available,
        created_at=slot.created_at,
        updated_at=slot.updated_at,
    )


@router.put("/me/slot/{slot_id}", response_model=AvailabilitySlotResponse)
async def update_availability_slot(
    slot_id: uuid.UUID,
    update_data: AvailabilitySlotUpdate,
    current_user: Annotated[User, Depends(require_artist_or_owner)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Update a single availability slot.

    Requires artist or owner role.
    """
    result = await db.execute(
        select(ArtistAvailability).where(
            ArtistAvailability.id == slot_id,
            ArtistAvailability.user_id == current_user.id,
        )
    )
    slot = result.scalar_one_or_none()

    if not slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability slot not found",
        )

    # Update fields
    data = update_data.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(slot, field, value)

    await db.commit()
    await db.refresh(slot)

    return AvailabilitySlotResponse(
        id=slot.id,
        user_id=slot.user_id,
        day_of_week=slot.day_of_week,
        start_time=slot.start_time,
        end_time=slot.end_time,
        is_available=slot.is_available,
        created_at=slot.created_at,
        updated_at=slot.updated_at,
    )


@router.delete("/me/slot/{slot_id}", response_model=MessageResponse)
async def delete_availability_slot(
    slot_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_artist_or_owner)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Delete a single availability slot.

    Requires artist or owner role.
    """
    result = await db.execute(
        select(ArtistAvailability).where(
            ArtistAvailability.id == slot_id,
            ArtistAvailability.user_id == current_user.id,
        )
    )
    slot = result.scalar_one_or_none()

    if not slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability slot not found",
        )

    await db.delete(slot)
    await db.commit()

    return MessageResponse(message="Availability slot deleted successfully")


# ============= Artist Public Availability (for booking) =============

@router.get("/{artist_id}", response_model=WeeklySchedule)
async def get_artist_availability(
    artist_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get an artist's weekly availability schedule.

    Public endpoint for viewing availability when booking.
    """
    # Verify artist exists and is active
    result = await db.execute(
        select(User).where(
            User.id == artist_id,
            User.role.in_([UserRole.ARTIST, UserRole.OWNER]),
            User.is_active.is_(True),
            User.deleted_at.is_(None),
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artist not found",
        )

    result = await db.execute(
        select(ArtistAvailability)
        .where(
            ArtistAvailability.user_id == artist_id,
            ArtistAvailability.is_available.is_(True),
        )
        .order_by(ArtistAvailability.day_of_week, ArtistAvailability.start_time)
    )
    slots = result.scalars().all()

    return WeeklySchedule(
        slots=[
            AvailabilitySlotResponse(
                id=slot.id,
                user_id=slot.user_id,
                day_of_week=slot.day_of_week,
                start_time=slot.start_time,
                end_time=slot.end_time,
                is_available=slot.is_available,
                created_at=slot.created_at,
                updated_at=slot.updated_at,
            )
            for slot in slots
        ],
        user_id=artist_id,
    )


# ============= Time-Off Management =============

@router.get("/me/time-off", response_model=TimeOffListResponse)
async def get_my_time_off(
    current_user: Annotated[User, Depends(require_artist_or_owner)],
    db: Annotated[AsyncSession, Depends(get_db)],
    upcoming_only: bool = True,
):
    """
    Get the current artist's time-off periods.

    By default, only returns upcoming time-off (from today onwards).
    Set upcoming_only=false to get all time-off including past.
    Requires artist or owner role.
    """
    query = select(ArtistTimeOff).where(ArtistTimeOff.user_id == current_user.id)

    if upcoming_only:
        query = query.where(ArtistTimeOff.end_date >= date.today())

    query = query.order_by(ArtistTimeOff.start_date)

    result = await db.execute(query)
    time_offs = result.scalars().all()

    return TimeOffListResponse(
        time_off=[
            TimeOffResponse(
                id=to.id,
                user_id=to.user_id,
                start_date=to.start_date,
                end_date=to.end_date,
                reason=to.reason,
                notes=to.notes,
                all_day=to.all_day,
                created_at=to.created_at,
                updated_at=to.updated_at,
            )
            for to in time_offs
        ],
        total=len(time_offs),
    )


@router.post("/me/time-off", response_model=TimeOffResponse)
async def add_time_off(
    time_off_data: TimeOffCreate,
    current_user: Annotated[User, Depends(require_artist_or_owner)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Add a time-off period.

    Use this to block off dates for vacations, personal days, etc.
    Requires artist or owner role.
    """
    # Check for overlapping time-off
    result = await db.execute(
        select(ArtistTimeOff).where(
            ArtistTimeOff.user_id == current_user.id,
            ArtistTimeOff.start_date <= time_off_data.end_date,
            ArtistTimeOff.end_date >= time_off_data.start_date,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This time-off period overlaps with an existing one",
        )

    time_off = ArtistTimeOff(
        user_id=current_user.id,
        start_date=time_off_data.start_date,
        end_date=time_off_data.end_date,
        reason=time_off_data.reason,
        notes=time_off_data.notes,
        all_day=time_off_data.all_day,
    )
    db.add(time_off)
    await db.commit()
    await db.refresh(time_off)

    return TimeOffResponse(
        id=time_off.id,
        user_id=time_off.user_id,
        start_date=time_off.start_date,
        end_date=time_off.end_date,
        reason=time_off.reason,
        notes=time_off.notes,
        all_day=time_off.all_day,
        created_at=time_off.created_at,
        updated_at=time_off.updated_at,
    )


@router.put("/me/time-off/{time_off_id}", response_model=TimeOffResponse)
async def update_time_off(
    time_off_id: uuid.UUID,
    update_data: TimeOffUpdate,
    current_user: Annotated[User, Depends(require_artist_or_owner)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Update a time-off period.

    Requires artist or owner role.
    """
    result = await db.execute(
        select(ArtistTimeOff).where(
            ArtistTimeOff.id == time_off_id,
            ArtistTimeOff.user_id == current_user.id,
        )
    )
    time_off = result.scalar_one_or_none()

    if not time_off:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Time-off period not found",
        )

    # Update fields
    data = update_data.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(time_off, field, value)

    await db.commit()
    await db.refresh(time_off)

    return TimeOffResponse(
        id=time_off.id,
        user_id=time_off.user_id,
        start_date=time_off.start_date,
        end_date=time_off.end_date,
        reason=time_off.reason,
        notes=time_off.notes,
        all_day=time_off.all_day,
        created_at=time_off.created_at,
        updated_at=time_off.updated_at,
    )


@router.delete("/me/time-off/{time_off_id}", response_model=MessageResponse)
async def delete_time_off(
    time_off_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_artist_or_owner)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Delete a time-off period.

    Requires artist or owner role.
    """
    result = await db.execute(
        select(ArtistTimeOff).where(
            ArtistTimeOff.id == time_off_id,
            ArtistTimeOff.user_id == current_user.id,
        )
    )
    time_off = result.scalar_one_or_none()

    if not time_off:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Time-off period not found",
        )

    await db.delete(time_off)
    await db.commit()

    return MessageResponse(message="Time-off period deleted successfully")


@router.get("/{artist_id}/time-off", response_model=TimeOffListResponse)
async def get_artist_time_off(
    artist_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get an artist's upcoming time-off periods.

    Public endpoint for checking availability when booking.
    Only returns upcoming time-off (from today onwards).
    """
    # Verify artist exists and is active
    result = await db.execute(
        select(User).where(
            User.id == artist_id,
            User.role.in_([UserRole.ARTIST, UserRole.OWNER]),
            User.is_active.is_(True),
            User.deleted_at.is_(None),
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artist not found",
        )

    result = await db.execute(
        select(ArtistTimeOff)
        .where(
            ArtistTimeOff.user_id == artist_id,
            ArtistTimeOff.end_date >= date.today(),
        )
        .order_by(ArtistTimeOff.start_date)
    )
    time_offs = result.scalars().all()

    return TimeOffListResponse(
        time_off=[
            TimeOffResponse(
                id=to.id,
                user_id=to.user_id,
                start_date=to.start_date,
                end_date=to.end_date,
                reason=to.reason,
                notes=to.notes,
                all_day=to.all_day,
                created_at=to.created_at,
                updated_at=to.updated_at,
            )
            for to in time_offs
        ],
        total=len(time_offs),
    )
