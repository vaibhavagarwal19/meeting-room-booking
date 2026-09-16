# Meeting Room Booking

Book meeting rooms by room and date, with overlap detection and a "find me the next free slot" search.

A FastAPI + PostgreSQL backend serving a Next.js frontend.

---

## Booking rules

These are enforced by the backend, so the API is safe to call directly — the UI is not the only thing stopping bad bookings.

- **Working hours are 09:00–18:00.** Both ends are inclusive: a 09:00–18:00 booking is valid, 08:59 or 18:01 is not.
- **A room cannot be double-booked.** Any overlap is rejected with `409`.
- **Back-to-back bookings are allowed.** 10:00–11:00 and 11:00–12:00 do not overlap, so both are accepted.
- **End time must be after start time.** Zero-length and reversed bookings are rejected.
- **Times are stored to the minute.** Seconds are stripped on the way in, so what the UI shows is what the database holds.
- **Concurrent requests cannot double-book.** Booking takes a row lock on the room, so two people clicking *Book* at the same instant produce one booking and one `409` — not two overlapping bookings.

Five rooms (Meeting Room A–E) are created automatically on first startup.

---

## Requirements

- Python 3.13 (3.11+ should work)
- Node.js 22 (18+ should work)
- PostgreSQL running locally

---

## Setup

### 1. Database

Create the database. Tables and the five rooms are created automatically when the backend first starts.

```bash
createdb meeting_booking
```

### 2. Backend

From the repository root:

```bash
python3 -m venv venv
venv/bin/pip install -r requirements.txt
```

Create `backend/.env`:

```
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/meeting_booking
```

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | — | PostgreSQL connection string |
| `ALLOWED_ORIGINS` | no | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated origins allowed to call the API |

Set `ALLOWED_ORIGINS` if you run the frontend on a port other than 3000 — otherwise the browser will block the requests.

Run it:

```bash
cd backend
../venv/bin/uvicorn app.main:app --reload --port 8000
```

Interactive API docs: <http://localhost:8000/docs>

### 3. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

Note the `/api` suffix — the frontend appends paths directly to this value.

```bash
npm run dev
```

Open <http://localhost:3000>.

---

## API

All endpoints are prefixed with `/api`. Times are `HH:MM:SS`, dates are `YYYY-MM-DD`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/rooms` | List all rooms |
| `GET` | `/api/rooms/{room_id}/bookings?date=` | Bookings for one room on one date |
| `GET` | `/api/rooms/{room_id}/next-available?date=&duration=` | Earliest free slot of `duration` minutes |
| `GET` | `/api/bookings?date=&room_id=` | List bookings; both filters optional |
| `POST` | `/api/bookings` | Create a booking |
| `DELETE` | `/api/bookings/{booking_id}` | Cancel a booking |

### Create a booking

```bash
curl -X POST http://localhost:8000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "room_id": 1,
    "title": "Team Standup",
    "date": "2026-09-15",
    "start_time": "10:00",
    "end_time": "11:00"
  }'
```

```json
{
  "message": "Booking created successfully.",
  "booking": {
    "id": 1,
    "room_id": 1,
    "title": "Team Standup",
    "date": "2026-09-15",
    "start_time": "10:00:00",
    "end_time": "11:00:00"
  }
}
```

### Find the next free slot

The search fills gaps, so it looks *before* and *between* existing bookings — not just after the last one. With the 10:00–11:00 booking above already on room 1:

```bash
curl "http://localhost:8000/api/rooms/1/next-available?date=2026-09-15&duration=60"
```

```json
{ "available": true, "start_time": "09:00:00", "end_time": "10:00:00" }
```

It found the free hour before the standup rather than skipping past it. When no gap in the day fits the requested duration:

```bash
curl "http://localhost:8000/api/rooms/1/next-available?date=2026-09-15&duration=600"
```

```json
{ "available": false, "message": "No available slot for the requested duration." }
```

Note that this is still `200`, not an error — "nothing is free" is a normal answer.

### Status codes

| Code | Meaning |
|---|---|
| `201` | Booking created |
| `400` | Broke a booking rule (outside working hours, end before start) |
| `404` | Room or booking does not exist |
| `409` | Overlaps an existing booking |
| `422` | Malformed input (bad date, blank title, non-positive duration) |

`400`, `404` and `409` return `{"detail": "a readable sentence"}`. `422` comes from FastAPI's validation layer and returns `{"detail": [ ... ]}` — **a list of objects, not a string**. Anything consuming this API has to handle both shapes.

---

## Tests

```bash
venv/bin/pip install -r requirements-dev.txt
venv/bin/python -m pytest backend/tests
```

49 tests covering the booking rules, overlap geometry, working-hour boundaries, cancellation, filtering, and the next-available search. They run against an in-memory SQLite database, so they need no setup and never touch your real data.

### Concurrency test

One test is skipped by default because it needs a real PostgreSQL database. It fires twelve simultaneous bookings for the same room and slot and asserts that exactly one succeeds.

```bash
TEST_DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/meeting_booking_test \
  venv/bin/python -m pytest backend/tests/test_concurrency.py
```

> **It drops and recreates every table in the database you point it at.** Use a throwaway database, never `meeting_booking`.

---

## Project layout

```
backend/
  app/
    main.py                     app setup, CORS, room seeding
    database.py                 settings, engine, session
    models/                     SQLAlchemy tables
    schemas/                    request/response validation
    routes/                     HTTP endpoints
    services/booking_service.py booking rules and slot search
  tests/
frontend/
  app/
    page.tsx                    room grid, filters, availability search
    components/                 BookingModal, ConfirmModal, Toast
requirements.txt                backend dependencies
requirements-dev.txt            test dependencies
```

The booking rules live in `services/booking_service.py`, deliberately separate from the HTTP layer — routes translate exceptions into status codes and nothing more.

---

## Stack

**Backend** — FastAPI, SQLAlchemy 2, Pydantic v2, PostgreSQL, pytest
**Frontend** — Next.js 16 (App Router), React 19, Tailwind CSS 4, Framer Motion, lucide-react
