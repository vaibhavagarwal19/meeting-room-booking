from sqlalchemy import Column, Date, ForeignKey, Index, Integer, String, Time

from ..database import Base


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True)

    room_id = Column(
        Integer,
        ForeignKey("rooms.id"),
        nullable=False,
    )

    title = Column(String(200), nullable=False)
    date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)

    __table_args__ = (
        Index(
            "idx_booking_room_date",
            "room_id",
            "date",
        ),
    )
