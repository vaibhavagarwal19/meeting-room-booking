# Meeting Room Booking

Book meeting rooms by room and date, with overlap detection and a "find me the next free slot" search.

A FastAPI + PostgreSQL backend serving a Next.js frontend.

**Live demo**

| | |
|---|---|
| Frontend | <https://meeting-room-booking-two-pi.vercel.app> |
| API | <https://meeting-room-booking-ai4a.onrender.com> |
| API docs | <https://meeting-room-booking-ai4a.onrender.com/docs> |

> The API is on Render's free tier and sleeps after 15 minutes idle. If the first load looks stuck, give it ~50 seconds to wake up.

---

## Table of contents

- [Project overview](#project-overview)
- [Tech stack](#tech-stack)
- [Features](#features)
- [Project structure](#project-structure)
- [Requirements](#requirements)
- [Backend setup](#backend-setup)
- [Frontend setup](#frontend-setup)
- [Environment variables](#environment-variables)
- [API endpoints](#api-endpoints)
- [Booking conflict logic](#booking-conflict-logic)
- [Next-available logic](#next-available-logic)
- [Tests](#tests)
- [Deployment](#deployment)
- [Incomplete items and known limitations](#incomplete-items-and-known-limitations)

---

## Project overview

A small internal tool for reserving meeting rooms. Pick a date, see what every room is booked
for that day, and claim a free slot. Five rooms (Meeting Room A–E) are seeded automatically on
first startup.

The interesting part is not the CRUD — it is making sure two people cannot book the same room
for the same time, and helping someone who does not care *when* they meet find the earliest gap
that fits.

Both of those rules live in the backend, not the UI, so the API is safe to call directly. The
rules are:

- **Working hours are 09:00–18:00.** Both ends are inclusive: a 09:00–18:00 booking is valid,
  08:59 or 18:01 is not.
- **A room cannot be double-booked.** Any overlap is rejected with `409`.
- **Back-to-back bookings are allowed.** 10:00–11:00 and 11:00–12:00 do not overlap, so both
  are accepted.
- **End time must be after start time.** Zero-length and reversed bookings are rejected.
- **Times are stored to the minute.** Seconds are stripped on the way in, so what the UI shows
  is what the database holds.
- **Concurrent requests cannot double-book.** Booking takes a row lock on the room, so two
  people clicking *Book* at the same instant produce one booking and one `409`.

---

## Tech stack

| Layer | Choice |
|---|---|
| **Backend** | FastAPI 0.141, Python 3.13 |
| **ORM** | SQLAlchemy 2.0 |
| **Validation** | Pydantic v2 + pydantic-settings |
| **Database** | PostgreSQL (SQLite in-memory for tests) |
| **Server** | Uvicorn |
| **Tests** | pytest, httpx |
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript 5 |
| **Styling** | Tailwind CSS 4 |
| **Animation** | Framer Motion |
| **Icons** | lucide-react |
| **Hosting** | Render (API + PostgreSQL), Vercel (frontend) |

---

## Features

**Booking**
- Create a booking with a title, room, date, start and end time
- Overlap detection — conflicting bookings are rejected with the name and time of the booking
  that blocks them, not a generic error
- Cancel a booking, behind a confirmation dialog
- Back-to-back bookings allowed; working hours enforced at 09:00–18:00
- Safe under concurrent requests — a row lock prevents two simultaneous bookings from both
  landing

**Availability**
- Per-room "next available slot" search for any duration from 1 to 540 minutes (the length of
  the working day)
- Gap-filling: the search looks before and between existing bookings, not only after the last
  one

**Browsing**
- Date picker, defaulting to today
- Room grid showing every booking for the selected date
- Filter the view to a single room

**Interface**
- Toast notifications for success and failure
- Loading states per room, so checking one room does not freeze the others
- Animated modals and list transitions
- Stale-response guard — a slow earlier request cannot overwrite a newer one

---

## Project structure

```
meeting-room-booking/
├── backend/
│   ├── app/
│   │   ├── main.py                     app setup, CORS, room seeding
│   │   ├── database.py                 settings, engine, session factory
│   │   ├── models/
│   │   │   ├── room.py                 rooms table
│   │   │   └── booking.py              bookings table + (room_id, date) index
│   │   ├── schemas/
│   │   │   ├── room.py                 room response shape
│   │   │   └── booking.py              booking request/response validation
│   │   ├── routes/
│   │   │   ├── rooms.py                GET /rooms, GET /rooms/{id}/bookings
│   │   │   └── bookings.py             booking CRUD + next-available
│   │   └── services/
│   │       └── booking_service.py      booking rules, conflict check, slot search
│   ├── tests/
│   │   ├── conftest.py                 in-memory SQLite fixtures
│   │   ├── test_bookings.py            rules, overlap, boundaries, cancellation
│   │   └── test_concurrency.py         real-Postgres race test (skipped by default)
│   ├── requirements.txt                backend dependencies
│   └── .env.example
├── frontend/
│   ├── app/
│   │   ├── page.tsx                    room grid, filters, availability search
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── components/
│   │       ├── BookingModal.tsx        create-booking form
│   │       ├── ConfirmModal.tsx        cancellation confirmation
│   │       └── Toast.tsx               success/error notifications
│   ├── public/
│   └── .env.example
├── render.yaml                         Render blueprint (API + database)
└── requirements-dev.txt                test dependencies
```

The booking rules live in `services/booking_service.py`, deliberately separate from the HTTP
layer — routes translate exceptions into status codes and nothing more.

---

## Requirements

- Python 3.13 (3.11+ should work)
- Node.js 22 (18+ should work)
- PostgreSQL running locally

---

## Backend setup

### 1. Database

Create the database. Tables and the five rooms are created automatically when the backend first
starts.

```bash
createdb meeting_booking
```

### 2. Install dependencies

From the repository root:

```bash
python3 -m venv venv
venv/bin/pip install -r backend/requirements.txt
```

### 3. Configure

```bash
cp backend/.env.example backend/.env
```

Then edit `backend/.env` and set `DATABASE_URL` to your local PostgreSQL connection string.

### 4. Run

```bash
cd backend
../venv/bin/uvicorn app.main:app --reload --port 8000
```

Interactive API docs: <http://localhost:8000/docs>

---

## Frontend setup

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>.

`NEXT_PUBLIC_API_URL` must include the `/api` suffix — the frontend appends paths directly to
this value. It is read at **build** time, so changing it means rebuilding, not just restarting.

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | — | PostgreSQL connection string. |
| `ALLOWED_ORIGINS` | no | localhost:3000, 127.0.0.1:3000 and the deployed Vercel domain | Comma-separated origins allowed to call the API. The deployed frontend is in the default list, so the live demo works without setting this; override it if you deploy the frontend somewhere else. Unlisted origins are rejected. |

### Frontend (`frontend/.env.local`)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | yes | — | Base URL of the API, **including** `/api`. e.g. `https://your-service.onrender.com/api` |

### Tests only

| Variable | Required | Purpose |
|---|---|---|
| `TEST_DATABASE_URL` | no | Enables the concurrency test against a real PostgreSQL database. **It drops every table in the database you point it at** — use a throwaway one. |

---

## API endpoints

All endpoints are prefixed with `/api`. Times are `HH:MM:SS`, dates are `YYYY-MM-DD`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | Liveness message |
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
    "date": "2026-09-20",
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
    "date": "2026-09-20",
    "start_time": "10:00:00",
    "end_time": "11:00:00"
  }
}
```

### Cancel a booking

```bash
curl -X DELETE http://localhost:8000/api/bookings/1
```

```json
{ "message": "Booking cancelled successfully." }
```

### Status codes

| Code | Meaning |
|---|---|
| `201` | Booking created |
| `400` | Broke a booking rule (outside working hours, end before start) |
| `404` | Room or booking does not exist |
| `409` | Overlaps an existing booking |
| `422` | Malformed input (bad date, blank title, non-positive duration) |

`400`, `404` and `409` return `{"detail": "a readable sentence"}`. `422` comes from FastAPI's
validation layer and returns `{"detail": [ ... ]}` — **a list of objects, not a string**.
Anything consuming this API has to handle both shapes; the frontend does this in `errorDetail()`.

---

## Booking conflict logic

Two bookings on the same room and date overlap when **each one starts before the other ends**:

```
new.start < existing.end   AND   new.end > existing.start
```

Strict `<` and `>` are what make back-to-back bookings legal. A new 11:00–12:00 booking against
an existing 10:00–11:00 one gives `11:00 < 11:00` → false, so no conflict is reported.

Every overlap shape is caught by that single pair of comparisons:

```
                09:00       10:00       11:00       12:00       13:00
                |           |           |           |           |
existing:                   |=======================|               10:00-12:00

identical:                  |=======================|               conflict
inside:                           |===========|                     conflict
enclosing:            |===================================|         conflict
overlaps start:       |===========|                                 conflict
overlaps end:                                 |===========|         conflict
back-to-back:   |===========|                                       OK - ends exactly at 10:00
back-to-back:                                       |===========|   OK - starts exactly at 12:00
```

In `services/booking_service.py`, `create_booking()` runs three steps in order:

1. **Validate the times** — `start < end`, and the whole booking inside 09:00–18:00. Failures
   raise `BookingError` → `400`.
2. **Lock the room row** — `SELECT id FROM rooms WHERE id = :id FOR UPDATE`. This is the part
   that makes the check safe. Without it, two simultaneous requests could both read "no
   conflict" before either one writes, and both would be inserted. The lock serialises them:
   the second request waits until the first commits, then does its conflict check against a
   database that already contains the first booking. It is held until the transaction ends.
3. **Query for a conflict** — the comparison above, ordered by `start_time`, taking the first
   match. If one exists, the transaction is rolled back (releasing the lock) and
   `BookingConflictError` → `409` is raised with the blocking booking named:

   ```
   Booking conflicts with existing booking 'Team Standup' (10:00 - 11:00).
   ```

The `(room_id, date)` index on `bookings` keeps the conflict query cheap, and locking the *room*
rather than a table means bookings for different rooms never block each other.

`test_concurrency.py` verifies this by firing twelve simultaneous bookings for the same room and
slot and asserting exactly one succeeds.

---

## Next-available logic

`GET /api/rooms/{id}/next-available?date=&duration=` answers "when is the earliest I could get
this room for N minutes today?"

It is a **gap scan**, not a "book after the last meeting" shortcut — it looks before and between
existing bookings, so a half-empty day does not push you to the evening.

`find_next_available_slot()` walks the day once:

1. Load that room's bookings for the date, sorted by start time.
2. Start a cursor at 09:00.
3. For each booking: if the duration fits between the cursor and that booking's start —
   clamped to 18:00, so a slot can never run past the working day — return
   `[cursor, cursor + duration]`. That is the answer, and it is the earliest one because both
   the bookings and the cursor only move forward. Otherwise advance the cursor to that
   booking's end, but only if that moves it forward (a booking fully enclosed by an earlier one
   must not drag the cursor backwards).
4. After the last booking, check the gap between the cursor and 18:00.
5. If nothing fits, return `None`.

Worked example — room 1 already has 10:00–11:00 booked, asking for 60 minutes:

```
            09:00 10:00 11:00                                     18:00
            |     |     |                                         |
room 1:     |-----|=====|-----------------------------------------|
             free booked free
```

The cursor starts at 09:00. `09:00 + 60min = 10:00`, which is not past the 10:00 booking
start, so the gap before the standup fits and becomes the answer.

```bash
curl "http://localhost:8000/api/rooms/1/next-available?date=2026-09-20&duration=60"
```

```json
{ "available": true, "start_time": "09:00:00", "end_time": "10:00:00" }
```

It found the free hour *before* the standup rather than skipping past it.

When no gap in the day fits:

```bash
curl "http://localhost:8000/api/rooms/1/next-available?date=2026-09-20&duration=600"
```

```json
{ "available": false, "message": "No available slot for the requested duration." }
```

Note this is still `200`, not an error — "nothing is free" is a normal answer, and the UI
renders it as a message rather than a failure.

The returned slot is a suggestion, not a hold. Booking it still goes through the full conflict
check, so a slot that someone else takes in the meantime is rejected normally.

---

## Tests

```bash
venv/bin/pip install -r requirements-dev.txt
venv/bin/python -m pytest backend/tests
```

49 tests covering the booking rules, overlap geometry, working-hour boundaries, cancellation,
filtering, and the next-available search. They run against an in-memory SQLite database, so they
need no setup and never touch your real data.

### Concurrency test

One test is skipped by default because it needs a real PostgreSQL database — SQLite has no
`SELECT ... FOR UPDATE`. It fires twelve simultaneous bookings for the same room and slot and
asserts that exactly one succeeds.

```bash
TEST_DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/meeting_booking_test \
  venv/bin/python -m pytest backend/tests/test_concurrency.py
```

> **It drops and recreates every table in the database you point it at.** Use a throwaway
> database, never `meeting_booking`.

---

## Deployment

Backend and database on **Render**, frontend on **Vercel**. Deploy the backend first — the
frontend needs its URL at build time.

### 1. Push to GitHub

Both hosts deploy from a repository.

```bash
git push origin main
```

### 2. Database

Pick one. Whichever you choose, you end up with a connection string to paste into
`DATABASE_URL`. The schema and the five rooms are created automatically on first boot, so there
is no migration step.

<details>
<summary><b>Render PostgreSQL</b> (simplest — the blueprint provisions it for you)</summary>

`render.yaml` already declares the database, so deploying via Blueprint in step 3 creates it and
wires `DATABASE_URL` in automatically. Nothing to do here.

To create one by hand instead: **New → PostgreSQL**, then copy the **Internal Database URL**
(internal is faster and free of egress cost when the API is in the same region).
</details>

<details>
<summary><b>Neon</b></summary>

If you use Neon, create the Render service **manually** (step 3) rather than from the
blueprint — `render.yaml` declares a Render database and would provision one you do not need.

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the pooled connection string from the dashboard.
3. Make sure it ends with `?sslmode=require`.

```
postgresql://USER:PASSWORD@ep-xxx.region.aws.neon.tech/meeting_booking?sslmode=require
```
</details>

<details>
<summary><b>Supabase</b></summary>

As with Neon, create the Render service **manually** (step 3) so the blueprint does not also
provision a Render database.

1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings → Database → Connection string → URI**.
3. Use the **Session pooler** string (port `5432`) and replace `[YOUR-PASSWORD]` with your
   database password.

```
postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-region.pooler.supabase.com:5432/postgres
```
</details>

### 3. Backend → Render

The repository includes `render.yaml`, so the whole service can be provisioned from it.

**Using the blueprint (recommended):**

1. Render Dashboard → **New → Blueprint**.
2. Connect this repository. Render reads `render.yaml` and proposes the web service *and* the
   PostgreSQL database.
3. Apply. `DATABASE_URL` is wired from the database automatically.
4. Leave `ALLOWED_ORIGINS` blank for now — you do not have the Vercel URL yet. Come back in
   step 5.

**Creating the service manually instead:**

| Setting | Value |
|---|---|
| Type | Web Service |
| Runtime | Python 3 |
| Root directory | *(leave blank — the repository root)* |
| Build command | `pip install -r backend/requirements.txt` |
| Start command | `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health check path | `/` |

Then add environment variables: `DATABASE_URL` (from step 2) and `PYTHON_VERSION` = `3.13.3`.

The service must bind `0.0.0.0` and Render's `$PORT` — the default `127.0.0.1:8000` will fail
Render's port scan and the deploy will hang.

Confirm it is up:

```bash
curl https://your-service.onrender.com/
# {"message":"Meeting Room Booking API is running."}
```

Note the URL — you need it next.

### 4. Frontend → Vercel

1. Vercel Dashboard → **Add New → Project**, import this repository.
2. Set **Root Directory** to `frontend`. Vercel then detects Next.js and fills in the build
   settings itself.
3. Add an environment variable:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://your-service.onrender.com/api` |

   Include the `/api` suffix and no trailing slash. This is baked in at build time — if you add
   or change it later you must **redeploy**, not just restart.
4. Deploy, and note the assigned domain.

### 5. Connect the two (do not skip)

Go back to the Render service → **Environment** and set:

```
ALLOWED_ORIGINS=https://your-app.vercel.app
```

No trailing slash, and the scheme must be `https`. Render restarts the service automatically.

Skipping this step produces a site that loads fine but shows "Unable to load bookings" on every
request, because the browser blocks the cross-origin call. If you see that, check the browser
console for a CORS error and re-check this variable first.

### 6. Verify

Open the Vercel URL and confirm:

- the five rooms load
- creating a booking succeeds
- booking the same room and time again is rejected with a conflict message
- **Find next slot** returns a time
- cancelling a booking works

---

## Incomplete items and known limitations

Things deliberately out of scope, or known rough edges — listed so they are not mistaken for
oversights.

**Known gaps in the booking rules**

- **Bookings in the past are accepted.** `POST /api/bookings` with `2020-01-01` succeeds. The
  validation covers working hours, ordering and overlap, but never compares the date to today.
  The date picker makes this awkward to hit by accident, but the API allows it outright. This is
  the one rule I would add first.
- **Zero-duration input is caught late.** Clearing the duration field sends `0`, which the API
  rejects with a `422` that the UI surfaces as a readable message. Correct, but the input should
  refuse the value rather than round-trip it to the server.

**Not built**

- **No authentication or user accounts.** Bookings are anonymous and anyone can cancel anyone
  else's. There is no "my bookings" view and no organiser recorded on a booking. This is the
  largest gap for real use.
- **No editing or rescheduling.** To move a booking you cancel it and create a new one, which
  briefly releases the slot to whoever books first.
- **No recurring bookings.** Every booking is a single occurrence on a single date.
- **No room management.** The five rooms are seeded in `main.py` and there is no API to add,
  rename or remove one. Rooms have only a name — no capacity, floor, or amenities, so there is
  nothing to filter or search by.
- **No email or calendar integration.** No invites, reminders, or `.ics` export.

**Technical debt**

- **No database migrations.** The schema is created with `Base.metadata.create_all()` on
  startup. That is fine for a fresh deploy but cannot alter an existing table — a schema change
  would need Alembic adding first.
- **Timezone-naive.** Dates and times are stored without a timezone and interpreted as local
  wall-clock. Everyone is assumed to be in one office. Users in different timezones would see
  each other's bookings at the wrong hour.
- **Working hours are hardcoded** to 09:00–18:00 in `booking_service.py`, with no per-room or
  per-day override, and no notion of weekends or holidays — Saturday is bookable.
- **`GET /api/bookings` is unpaginated.** It returns every matching row. Harmless at current
  scale, a problem after a few thousand bookings.
- **No rate limiting** on any endpoint.
- **No frontend tests.** Coverage is backend-only; the UI is verified by hand.
- **The concurrency test does not run in CI.** It needs a real PostgreSQL instance, so it is
  skipped unless `TEST_DATABASE_URL` is set. The locking it verifies is therefore unguarded by
  default.
- **No structured logging or error tracking.** Failures surface as stack traces in the Render
  log stream.
- **Modals are not keyboard accessible.** They do not close on Escape, do not trap focus, and
  ignore clicks on the backdrop. Usable with a mouse, awkward with a keyboard, poor with a
  screen reader.
- **The Geist font never renders.** `layout.tsx` loads it, but `globals.css` ends with
  `font-family: Arial, Helvetica, sans-serif`, which overrides it. Cosmetic, and left alone
  because changing it restyles every screen.
- **The app is light-mode only.** The starter's `prefers-color-scheme: dark` block was removed:
  it flipped the text colour to near-white while every panel stayed white, so form fields became
  invisible on machines set to dark mode. Removing it was the fix; a real dark theme was not
  built.

**Hosting caveats**

- **Render's free tier spins down after 15 minutes of inactivity.** The first request afterwards
  takes roughly 50 seconds while the instance restarts, which looks like the app hanging. Paid
  instances do not sleep.
- **Render's free PostgreSQL expires after 30 days** and is then deleted. Export anything worth
  keeping, or use Neon or Supabase, whose free tiers do not expire.
