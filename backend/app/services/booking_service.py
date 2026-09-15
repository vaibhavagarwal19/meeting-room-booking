from datetime import date as date_type, datetime, time, timedelta

from sqlalchemy.orm import Session

from ..models.booking import Booking
from ..models.room import Room


WORKING_START = time(9, 0)
WORKING_END = time(18, 0)


class BookingError(ValueError):
    pass


class BookingConflictError(BookingError):
    pass


def validate_booking_time(start_time: time, end_time: time) -> None:
    if start_time >= end_time:
        raise BookingError("End time must be after start time.")

    if start_time < WORKING_START or end_time > WORKING_END:
        raise BookingError("Bookings must be between 09:00 and 18:00.")


def find_conflict(
    db: Session,
    room_id: int,
    booking_date: date_type,
    start_time: time,
    end_time: time,
):
    return (
        db.query(Booking)
        .filter(
            Booking.room_id == room_id,
            Booking.date == booking_date,
            Booking.start_time < end_time,
            Booking.end_time > start_time,
        )
        .order_by(Booking.start_time)
        .first()
    )


def create_booking(
    db: Session,
    room_id: int,
    title: str,
    booking_date: date_type,
    start_time: time,
    end_time: time,
):
    validate_booking_time(start_time, end_time)

    db.query(Room.id).filter(Room.id == room_id).with_for_update().first()

    conflict = find_conflict(
        db=db,
        room_id=room_id,
        booking_date=booking_date,
        start_time=start_time,
        end_time=end_time,
    )

    if conflict:
        start = conflict.start_time.strftime("%H:%M")
        end = conflict.end_time.strftime("%H:%M")

        db.rollback()

        raise BookingConflictError(
            f"Booking conflicts with existing booking "
            f"'{conflict.title}' ({start} - {end})."
        )

    booking = Booking(
        room_id=room_id,
        title=title,
        date=booking_date,
        start_time=start_time,
        end_time=end_time,
    )

    db.add(booking)
    db.commit()
    db.refresh(booking)

    return booking


def find_next_available_slot(
    db: Session,
    room_id: int,
    booking_date: date_type,
    duration_minutes: int,
):
    bookings = (
        db.query(Booking)
        .filter(
            Booking.room_id == room_id,
            Booking.date == booking_date,
        )
        .order_by(Booking.start_time)
        .all()
    )

    current_time = datetime.combine(booking_date, WORKING_START)
    working_end = datetime.combine(booking_date, WORKING_END)
    duration = timedelta(minutes=duration_minutes)

    for booking in bookings:
        booking_start = datetime.combine(booking_date, booking.start_time)
        booking_end = datetime.combine(booking_date, booking.end_time)

        if current_time + duration <= min(booking_start, working_end):
            return {
                "start_time": current_time.time(),
                "end_time": (current_time + duration).time(),
            }

        if booking_end > current_time:
            current_time = booking_end

    if current_time + duration <= working_end:
        return {
            "start_time": current_time.time(),
            "end_time": (current_time + duration).time(),
        }

    return None
