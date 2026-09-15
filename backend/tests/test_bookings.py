import pytest

from conftest import TODAY, TOMORROW


def test_api_is_up_with_seeded_rooms(client):
    assert client.get("/").status_code == 200

    rooms = client.get("/api/rooms").json()

    assert [room["name"] for room in rooms] == [
        "Meeting Room A",
        "Meeting Room B",
        "Meeting Room C",
        "Meeting Room D",
        "Meeting Room E",
    ]


def test_seeding_twice_does_not_duplicate_rooms(db, client):
    from app.main import seed_rooms

    seed_rooms(db)

    assert len(client.get("/api/rooms").json()) == 5


def test_create_booking(book):
    response = book()

    assert response.status_code == 201

    booking = response.json()["booking"]

    assert booking["id"] > 0
    assert booking["start_time"] == "10:00:00"
    assert booking["end_time"] == "11:00:00"


def test_working_hour_boundaries_are_inclusive(book):
    assert book(start_time="09:00", end_time="18:00").status_code == 201


@pytest.mark.parametrize("start_time,end_time", [("11:00", "11:00"), ("12:00", "11:00")])
def test_end_time_must_be_after_start_time(book, start_time, end_time):
    response = book(start_time=start_time, end_time=end_time)

    assert response.status_code == 400
    assert response.json()["detail"] == "End time must be after start time."


@pytest.mark.parametrize(
    "start_time,end_time",
    [("08:59", "10:00"), ("09:00", "18:01"), ("08:00", "19:00")],
)
def test_bookings_outside_working_hours_are_rejected(book, start_time, end_time):
    response = book(start_time=start_time, end_time=end_time)

    assert response.status_code == 400
    assert response.json()["detail"] == "Bookings must be between 09:00 and 18:00."


def test_seconds_are_stripped_so_display_matches_storage(book):
    booking = book(start_time="10:00:45", end_time="11:00:59").json()["booking"]

    assert booking["start_time"] == "10:00:00"
    assert booking["end_time"] == "11:00:00"


def test_timezone_aware_times_are_rejected(book):
    assert book(start_time="10:00:00+05:30", end_time="11:00:00+05:30").status_code == 422


def test_unknown_room_is_rejected(book):
    response = book(room_id=9999)

    assert response.status_code == 404
    assert response.json()["detail"] == "Room not found."


def test_titles_are_trimmed_and_must_not_be_blank(book):
    assert book(title="  Sprint Review  ").json()["booking"]["title"] == "Sprint Review"
    assert book(title="   ").status_code == 422
    assert book(title="a" * 201).status_code == 422


@pytest.mark.parametrize(
    "field,value",
    [
        ("room_id", 0),
        ("date", "15-09-2026"),
        ("date", "2026-02-30"),
        ("start_time", "25:00"),
        ("end_time", "10:60"),
    ],
)
def test_malformed_fields_are_rejected(book, field, value):
    assert book(**{field: value}).status_code == 422


def test_missing_fields_are_rejected(client):
    assert client.post("/api/bookings", json={"title": "x"}).status_code == 422


@pytest.fixture
def existing(book):
    response = book(title="Existing", start_time="10:00", end_time="11:00")

    assert response.status_code == 201

    return response.json()["booking"]


@pytest.mark.parametrize(
    "start_time,end_time",
    [
        ("10:00", "11:00"),
        ("10:15", "10:45"),
        ("09:00", "12:00"),
        ("10:30", "11:30"),
        ("09:30", "10:30"),
        ("10:59", "11:30"),
    ],
)
def test_overlapping_bookings_are_rejected(existing, book, start_time, end_time):
    response = book(title="New", start_time=start_time, end_time=end_time)

    assert response.status_code == 409
    assert "conflicts with existing booking" in response.json()["detail"]


@pytest.mark.parametrize("start_time,end_time", [("09:00", "10:00"), ("11:00", "12:00")])
def test_back_to_back_bookings_are_allowed(existing, book, start_time, end_time):
    assert book(title="Adjacent", start_time=start_time, end_time=end_time).status_code == 201


def test_conflict_names_the_existing_booking(existing, book):
    response = book(title="New", start_time="10:30", end_time="11:30")

    assert response.json()["detail"] == (
        "Booking conflicts with existing booking 'Existing' (10:00 - 11:00)."
    )


def test_conflicts_are_scoped_to_one_room_and_date(existing, book):
    assert book(room_id=2).status_code == 201
    assert book(date=TOMORROW).status_code == 201


def test_rejected_booking_is_not_saved(existing, client, book):
    book(title="New", start_time="10:30", end_time="11:30")

    bookings = client.get(f"/api/bookings?date={TODAY}").json()

    assert [b["title"] for b in bookings] == ["Existing"]


def test_a_full_day_can_be_booked_back_to_back(book):
    for hour in range(9, 18):
        response = book(
            title=f"Slot {hour}",
            start_time=f"{hour:02d}:00",
            end_time=f"{hour + 1:02d}:00",
        )

        assert response.status_code == 201, response.json()

    assert book(start_time="09:00", end_time="18:00").status_code == 409


def test_cancelling_frees_the_slot(existing, client, book):
    assert book().status_code == 409
    assert client.delete(f"/api/bookings/{existing['id']}").status_code == 200
    assert book().status_code == 201


def test_cancelling_twice_returns_404(client, book):
    booking_id = book().json()["booking"]["id"]

    assert client.delete(f"/api/bookings/{booking_id}").status_code == 200

    response = client.delete(f"/api/bookings/{booking_id}")

    assert response.status_code == 404
    assert response.json()["detail"] == "Booking not found."


def test_cancelling_leaves_other_bookings_alone(client, book):
    first = book(title="A", start_time="09:00", end_time="10:00").json()["booking"]
    book(title="B", start_time="10:00", end_time="11:00")

    client.delete(f"/api/bookings/{first['id']}")

    assert [b["title"] for b in client.get("/api/bookings").json()] == ["B"]


def test_listing_is_sorted_by_date_then_start_time(client, book):
    book(title="Late today", start_time="15:00", end_time="16:00")
    book(title="Early today", start_time="09:00", end_time="10:00")
    book(title="Tomorrow", date=TOMORROW, start_time="09:00", end_time="10:00")

    titles = [b["title"] for b in client.get("/api/bookings").json()]

    assert titles == ["Early today", "Late today", "Tomorrow"]


def test_listing_filters(client, book):
    book(title="Wanted", room_id=3, date=TOMORROW)
    book(title="Wrong room", room_id=1, date=TOMORROW)
    book(title="Wrong date", room_id=3, date=TODAY)

    def titles(query):
        return [b["title"] for b in client.get(f"/api/bookings?{query}").json()]

    assert titles(f"date={TOMORROW}") == ["Wanted", "Wrong room"]
    assert titles("room_id=3") == ["Wrong date", "Wanted"]
    assert titles(f"room_id=3&date={TOMORROW}") == ["Wanted"]
    assert titles("date=2030-01-01") == []


def test_room_bookings_endpoint(client, book):
    book(title="Second", room_id=1, start_time="14:00", end_time="15:00")
    book(title="First", room_id=1, start_time="09:00", end_time="10:00")
    book(title="Other room", room_id=2, start_time="09:00", end_time="10:00")

    response = client.get(f"/api/rooms/1/bookings?date={TODAY}")

    assert [b["title"] for b in response.json()] == ["First", "Second"]
    assert client.get("/api/rooms/1/bookings").status_code == 422
    assert client.get(f"/api/rooms/9999/bookings?date={TODAY}").status_code == 404


def next_slot(client, room_id=1, date=TODAY, duration=60):
    return client.get(
        f"/api/rooms/{room_id}/next-available?date={date}&duration={duration}"
    )


def test_next_slot_on_an_empty_day(client):
    assert next_slot(client).json() == {
        "available": True,
        "start_time": "09:00:00",
        "end_time": "10:00:00",
    }


def test_next_slot_can_fill_the_whole_working_day(client):
    body = next_slot(client, duration=540).json()

    assert (body["start_time"], body["end_time"]) == ("09:00:00", "18:00:00")
    assert next_slot(client, duration=541).json()["available"] is False


def test_next_slot_before_the_first_booking(client, book):
    book(start_time="11:00", end_time="12:00")

    body = next_slot(client, duration=120).json()

    assert (body["start_time"], body["end_time"]) == ("09:00:00", "11:00:00")


def test_next_slot_fills_a_gap_that_fits_exactly(client, book):
    book(title="A", start_time="09:00", end_time="12:00")
    book(title="B", start_time="12:30", end_time="18:00")

    body = next_slot(client, duration=30).json()

    assert (body["start_time"], body["end_time"]) == ("12:00:00", "12:30:00")


def test_next_slot_skips_a_gap_one_minute_too_small(client, book):
    book(title="A", start_time="09:00", end_time="12:00")
    book(title="B", start_time="12:30", end_time="14:00")

    body = next_slot(client, duration=31).json()

    assert (body["start_time"], body["end_time"]) == ("14:00:00", "14:31:00")


def test_next_slot_after_the_last_booking(client, book):
    book(start_time="09:00", end_time="17:30")

    body = next_slot(client, duration=30).json()

    assert (body["start_time"], body["end_time"]) == ("17:30:00", "18:00:00")


def test_no_slot_when_the_day_is_full_or_too_tight(client, book):
    book(start_time="09:00", end_time="17:31")

    assert next_slot(client, duration=30).json()["available"] is False
    assert "No available slot" in next_slot(client, duration=30).json()["message"]


def test_next_slot_is_scoped_to_one_room_and_date(client, book):
    book(start_time="09:00", end_time="18:00")

    assert next_slot(client, room_id=2).json()["start_time"] == "09:00:00"
    assert next_slot(client, date="2030-01-01").json()["start_time"] == "09:00:00"


def test_suggested_slot_can_actually_be_booked(client, book):
    book(title="A", start_time="09:00", end_time="10:15")

    body = next_slot(client, duration=45).json()

    response = book(
        title="From suggestion",
        start_time=body["start_time"],
        end_time=body["end_time"],
    )

    assert response.status_code == 201


def test_next_slot_handles_overlapping_rows_written_outside_the_api(client, raw_booking):
    raw_booking(start_time="09:00", end_time="15:00")
    raw_booking(start_time="10:00", end_time="11:00")

    assert next_slot(client).json()["start_time"] == "15:00:00"


def test_next_slot_never_runs_past_closing_time(client, raw_booking):
    raw_booking(start_time="19:00", end_time="20:00")

    assert next_slot(client, duration=600).json()["available"] is False


def test_next_slot_rejects_bad_parameters(client):
    assert next_slot(client, duration=0).status_code == 422
    assert next_slot(client, duration="abc").status_code == 422
    assert next_slot(client, date="not-a-date").status_code == 422
    assert client.get("/api/rooms/1/next-available").status_code == 422
    assert next_slot(client, room_id=9999).status_code == 404
