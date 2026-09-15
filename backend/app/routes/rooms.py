from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.booking import Booking
from ..models.room import Room
from ..schemas.booking import BookingResponse
from ..schemas.room import RoomResponse


router = APIRouter(
    prefix="/api",
    tags=["Rooms"],
)


@router.get(
    "/rooms",
    response_model=list[RoomResponse],
)
def get_rooms(
    db: Session = Depends(get_db),
):
    return (
        db.query(Room)
        .order_by(Room.id)
        .all()
    )


@router.get(
    "/rooms/{room_id}/bookings",
    response_model=list[BookingResponse],
)
def get_room_bookings(
    room_id: int,
    booking_date: date = Query(..., alias="date"),
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

    return (
        db.query(Booking)
        .filter(
            Booking.room_id == room_id,
            Booking.date == booking_date,
        )
        .order_by(
            Booking.start_time,
            Booking.id,
        )
        .all()
    )
