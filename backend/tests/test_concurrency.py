import os
import threading
from datetime import date, time

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import Booking, Room
from app.services.booking_service import BookingConflictError, create_booking


TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="Set TEST_DATABASE_URL to a disposable database to run concurrency tests.",
)

THREADS = 12
SLOT_DATE = date(2030, 1, 1)


@pytest.fixture
def concurrent_session_factory():
    engine = create_engine(TEST_DATABASE_URL)

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    yield sessionmaker(bind=engine)

    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def test_simultaneous_requests_cannot_double_book_a_room(concurrent_session_factory):
    setup = concurrent_session_factory()
    setup.add(Room(name="Concurrency Room"))
    setup.commit()
    room_id = setup.query(Room.id).scalar()
    setup.close()

    barrier = threading.Barrier(THREADS)
    lock = threading.Lock()
    outcomes = []

    def attempt(index):
        barrier.wait()

        db = concurrent_session_factory()

        try:
            create_booking(
                db=db,
                room_id=room_id,
                title=f"Attempt {index}",
                booking_date=SLOT_DATE,
                start_time=time(10, 0),
                end_time=time(11, 0),
            )
            outcome = "created"
        except BookingConflictError:
            outcome = "conflict"
        finally:
            db.close()

        with lock:
            outcomes.append(outcome)

    threads = [threading.Thread(target=attempt, args=(i,)) for i in range(THREADS)]

    for thread in threads:
        thread.start()

    for thread in threads:
        thread.join()

    verify = concurrent_session_factory()
    stored = verify.query(Booking).count()
    verify.close()

    assert outcomes.count("created") == 1
    assert outcomes.count("conflict") == THREADS - 1
    assert stored == 1
