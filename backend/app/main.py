from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .database import Base, SessionLocal, engine, settings
from .models import Room
from .routes.bookings import router as bookings_router
from .routes.rooms import router as rooms_router


DEFAULT_ROOM_NAMES = [
    "Meeting Room A",
    "Meeting Room B",
    "Meeting Room C",
    "Meeting Room D",
    "Meeting Room E",
]


def seed_rooms(db: Session) -> None:
    existing = {name for (name,) in db.query(Room.name).all()}

    missing = [
        Room(name=name)
        for name in DEFAULT_ROOM_NAMES
        if name not in existing
    ]

    if not missing:
        return

    db.add_all(missing)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        seed_rooms(db)
    finally:
        db.close()

    yield


app = FastAPI(
    title="Meeting Room Booking System",
    version="1.0.0",
    lifespan=lifespan,
)




allowed_origins = [
    origin.strip()
    for origin in settings.ALLOWED_ORIGINS.split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(rooms_router)
app.include_router(bookings_router)


@app.get("/")
def root():
    return {
        "message": "Meeting Room Booking API is running."
    }
