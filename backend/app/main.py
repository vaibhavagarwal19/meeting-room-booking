from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, SessionLocal, engine
from .models import Room
from .routes.bookings import router as bookings_router
from .routes.rooms import router as rooms_router


app = FastAPI(
    title="Meeting Room Booking System",
    version="1.0.0",
)


# Allow the Next.js frontend to communicate
# with the FastAPI backend during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Importing the models before create_all ensures
# SQLAlchemy knows about all database tables.
Base.metadata.create_all(bind=engine)


def seed_rooms():
    """
    Create predefined rooms when the database is empty.
    """

    db = SessionLocal()

    try:
        existing_rooms = db.query(Room).count()

        if existing_rooms == 0:
            rooms = [
                Room(name="Meeting Room A"),
                Room(name="Meeting Room B"),
                Room(name="Meeting Room C"),
                Room(name="Meeting Room D"),
                Room(name="Meeting Room E"),
            ]

            db.add_all(rooms)
            db.commit()

    finally:
        db.close()


seed_rooms()


app.include_router(rooms_router)
app.include_router(bookings_router)


@app.get("/")
def root():
    return {
        "message": "Meeting Room Booking API is running."
    }