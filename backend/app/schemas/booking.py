from datetime import date, time

from pydantic import BaseModel, ConfigDict, Field, field_validator


class BookingCreate(BaseModel):
    room_id: int
    title: str = Field(min_length=1, max_length=200)
    date: date
    start_time: time
    end_time: time

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Booking title cannot be empty.")

        return value


class BookingResponse(BaseModel):
    id: int
    room_id: int
    title: str
    date: date
    start_time: time
    end_time: time

    model_config = ConfigDict(from_attributes=True)


class BookingCreateResponse(BaseModel):
    message: str
    booking: BookingResponse