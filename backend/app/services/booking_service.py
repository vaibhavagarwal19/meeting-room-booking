from datetime import datetime, time, timedelta

from sqlalchemy.orm import Session

from ..models.booking import Booking


WORKING_START = time(9, 0)
WORKING_END = time(18, 0)


def validate_booking_time(start_time: time, end_time: time) -> None:
    """
    Validate that a booking has a valid time range
    and stays within working hours.
    """

    if start_time >= end_time:
        raise ValueError("End time must be after start time.")

    if start_time < WORKING_START or end_time > WORKING_END:
        raise ValueError(
            "Bookings must be between 09:00 and 18:00."
        )


def find_conflict(
    db: Session,
    room_id: int,
    booking_date,
    start_time: time,
    end_time: time,
):
    """
    Find an existing booking that overlaps with
    the requested time.

    Two bookings are allowed to touch:
        10:00 - 11:00
        11:00 - 12:00

    because they do not overlap.
    """

    existing_bookings = (
        db.query(Booking)
        .filter(
            Booking.room_id == room_id,
            Booking.date == booking_date,
        )
        .order_by(Booking.start_time)
        .all()
    )

    for booking in existing_bookings:

        # Overlap exists when:
        #
        # new_start < existing_end
        # AND
        # new_end > existing_start
        #
        # This allows back-to-back bookings.
        if (
            start_time < booking.end_time
            and end_time > booking.start_time
        ):
            return booking

    return None


def create_booking(
    db: Session,
    room_id: int,
    title: str,
    booking_date,
    start_time: time,
    end_time: time,
):
    """
    Create a booking after validating time and conflicts.
    """

    validate_booking_time(start_time, end_time)

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

        raise ValueError(
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
    booking_date,
    duration_minutes: int,
):
    """
    Find the earliest available slot for the requested duration.

    Searches:
    1. Before the first booking
    2. Between existing bookings
    3. After the last booking
    """

    if duration_minutes <= 0:
        raise ValueError(
            "Duration must be greater than 0 minutes."
        )

    bookings = (
        db.query(Booking)
        .filter(
            Booking.room_id == room_id,
            Booking.date == booking_date,
        )
        .order_by(Booking.start_time)
        .all()
    )

    current_time = datetime.combine(
        booking_date,
        WORKING_START,
    )

    working_end = datetime.combine(
        booking_date,
        WORKING_END,
    )

    duration = timedelta(minutes=duration_minutes)

    for booking in bookings:

        booking_start = datetime.combine(
            booking_date,
            booking.start_time,
        )

        booking_end = datetime.combine(
            booking_date,
            booking.end_time,
        )

        # Check whether the requested duration fits
        # before this booking.
        if current_time + duration <= booking_start:
            return {
                "start_time": current_time.time(),
                "end_time": (current_time + duration).time(),
            }

        # Move current_time forward if this booking
        # ends later than our current position.
        if booking_end > current_time:
            current_time = booking_end

    # Check the remaining time after the final booking.
    if current_time + duration <= working_end:
        return {
            "start_time": current_time.time(),
            "end_time": (current_time + duration).time(),
        }

    return None