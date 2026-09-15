from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.booking import Booking
from ..models.room import Room
from ..schemas.booking import (
    BookingCreate,
    BookingCreateResponse,
    BookingResponse,
)
from ..services.booking_service import (
    BookingConflictError,
    BookingError,
    create_booking,
    find_next_available_slot,
)


router = APIRouter(
    prefix="/api",
    tags=["Bookings"],
)


@router.get(
    "/bookings",
    response_model=list[BookingResponse],
)
def get_bookings(
    booking_date: date | None = Query(
        default=None,
        alias="date",
    ),
    room_id: int | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(Booking)

    if booking_date is not None:
        query = query.filter(
            Booking.date == booking_date
        )

    if room_id is not None:
        query = query.filter(
            Booking.room_id == room_id
        )

    return (
        query
        .order_by(
            Booking.date,
            Booking.start_time,
            Booking.id,
        )
        .all()
    )


@router.post(
    "/bookings",
    response_model=BookingCreateResponse,
    status_code=201,
)
def create_new_booking(
    data: BookingCreate,
    db: Session = Depends(get_db),
):
    room = (
        db.query(Room)
        .filter(Room.id == data.room_id)
        .first()
    )

    if not room:
        raise HTTPException(
            status_code=404,
            detail="Room not found.",
        )

    try:
        booking = create_booking(
            db=db,
            room_id=data.room_id,
            title=data.title,
            booking_date=data.date,
            start_time=data.start_time,
            end_time=data.end_time,
        )

    except BookingConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        )

    except BookingError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    return {
        "message": "Booking created successfully.",
        "booking": booking,
    }


@router.delete(
    "/bookings/{booking_id}",
)
def cancel_booking(
    booking_id: int,
    db: Session = Depends(get_db),
):
    booking = (
        db.query(Booking)
        .filter(Booking.id == booking_id)
        .first()
    )

    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found.",
        )

    db.delete(booking)
    db.commit()

    return {
        "message": "Booking cancelled successfully."
    }


@router.get(
    "/rooms/{room_id}/next-available",
)
def next_available(
    room_id: int,
    booking_date: date = Query(
        ...,
        alias="date",
    ),
    duration: int = Query(
        ...,
        gt=0,
    ),
    db: Session = Depends(get_db),
):
    room = (
        db.query(Room)
        .filter(Room.id == room_id)
        .first()
    )

    if not room:
        raise HTTPException(
            status_code=404,
            detail="Room not found.",
        )

    result = find_next_available_slot(
        db=db,
        room_id=room_id,
        booking_date=booking_date,
        duration_minutes=duration,
    )

    if result is None:
        return {
            "available": False,
            "message": (
                "No available slot for "
                "the requested duration."
            ),
        }

    return {
        "available": True,
        **result,
    }
