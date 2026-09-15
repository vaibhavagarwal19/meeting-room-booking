import os
import sys
from datetime import date as date_type, time as time_type
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

os.environ["DATABASE_URL"] = "sqlite://"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app, seed_rooms
from app.models import Booking


TODAY = "2026-09-15"
TOMORROW = "2026-09-16"


@pytest.fixture
def session_factory():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    Base.metadata.create_all(bind=engine)

    yield sessionmaker(autocommit=False, autoflush=False, bind=engine)

    engine.dispose()


@pytest.fixture
def db(session_factory):
    session = session_factory()

    seed_rooms(session)

    yield session

    session.close()


@pytest.fixture
def client(session_factory, db):
    def override_get_db():
        session = session_factory()

        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def book(client):
    def _book(
        room_id=1,
        title="Standup",
        date=TODAY,
        start_time="10:00",
        end_time="11:00",
    ):
        return client.post(
            "/api/bookings",
            json={
                "room_id": room_id,
                "title": title,
                "date": date,
                "start_time": start_time,
                "end_time": end_time,
            },
        )

    return _book


@pytest.fixture
def raw_booking(db):
    def _raw_booking(start_time, end_time, room_id=1, date=TODAY):
        hour, minute = start_time.split(":")
        end_hour, end_minute = end_time.split(":")

        db.add(
            Booking(
                room_id=room_id,
                title="Legacy",
                date=date_type.fromisoformat(date),
                start_time=time_type(int(hour), int(minute)),
                end_time=time_type(int(end_hour), int(end_minute)),
            )
        )
        db.commit()

    return _raw_booking
