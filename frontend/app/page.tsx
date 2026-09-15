"use client";
import BookingModal from "./components/BookingModal";
import { useEffect, useState } from "react";

type Room = {
  id: number;
  name: string;
};

type Booking = {
  id: number;
  room_id: number;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
};
type SelectedRoom = {
  id: number;
  name: string;
};
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function Home() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState("2026-09-15");

  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(false);

  const [error, setError] = useState("");
  const [selectedRoom, setSelectedRoom] =
    useState<SelectedRoom | null>(null);
  // Fetch rooms once when the page loads
  useEffect(() => {
    async function fetchRooms() {
      try {
        const response = await fetch(`${API_URL}/rooms`);

        if (!response.ok) {
          throw new Error("Failed to fetch rooms.");
        }

        const data = await response.json();
        setRooms(data);
      } catch {
        setError("Unable to load rooms.");
      } finally {
        setLoadingRooms(false);
      }
    }

    fetchRooms();
  }, []);

  // Fetch bookings whenever the selected date changes
  useEffect(() => {
    async function fetchBookings() {
      try {
        setLoadingBookings(true);

        const response = await fetch(
          `${API_URL}/bookings?date=${selectedDate}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch bookings.");
        }

        const data = await response.json();
        setBookings(data);
      } catch {
        setError("Unable to load bookings.");
      } finally {
        setLoadingBookings(false);
      }
    }

    fetchBookings();
  }, [selectedDate]);

  function getRoomBookings(roomId: number) {
    return bookings.filter((booking) => booking.room_id === roomId);
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold text-gray-900">
          Meeting Room Booking
        </h1>

        <p className="mt-2 text-gray-600">
          View and manage meeting room bookings.
        </p>

        {/* Date selector */}
        <div className="mt-8">
          <label
            htmlFor="date"
            className="block text-sm font-medium text-gray-700"
          >
            Select Date
          </label>

          <input
            id="date"
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="mt-2 rounded-lg border border-gray-300 bg-white px-4 py-2"
          />
        </div>

        {error && (
          <p className="mt-6 rounded-lg bg-red-50 p-4 text-red-600">
            {error}
          </p>
        )}

        {/* Rooms */}
        {loadingRooms ? (
          <p className="mt-8 text-gray-600">Loading rooms...</p>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => {
              const roomBookings = getRoomBookings(room.id);

              return (
                <div
                  key={room.id}
                  className="rounded-xl border bg-white p-6 shadow-sm"
                >
                  <h2 className="text-xl font-semibold text-gray-900">
                    {room.name}
                  </h2>

                  <div className="mt-5">
                    {loadingBookings ? (
                      <p className="text-sm text-gray-500">
                        Loading bookings...
                      </p>
                    ) : roomBookings.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        No bookings for this date.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {roomBookings.map((booking) => (
                          <div
                            key={booking.id}
                            className="rounded-lg bg-gray-100 p-3"
                          >
                            <p className="font-medium text-gray-900">
                              {booking.title}
                            </p>

                            <p className="mt-1 text-sm text-gray-600">
                              {booking.start_time.slice(0, 5)} -{" "}
                              {booking.end_time.slice(0, 5)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedRoom(room)}
                    className="mt-6 w-full rounded-lg bg-black px-4 py-2 text-white hover:bg-gray-800"
                  >
                    Book Room
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {selectedRoom && (
        <BookingModal
          room={selectedRoom}
          date={selectedDate}
          onClose={() => setSelectedRoom(null)}
          onBookingCreated={() => {
            window.location.reload();
          }}
        />
      )}
    </main>
  );
}