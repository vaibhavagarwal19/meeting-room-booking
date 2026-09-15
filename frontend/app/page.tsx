"use client";

import BookingModal from "./components/BookingModal";
import Toast from "./components/Toast";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import ConfirmModal from "./components/ConfirmModal";
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
  const [bookingToCancel, setBookingToCancel] =
    useState<Booking | null>(null);

  const [cancelling, setCancelling] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Room filter
  const [selectedRoomFilter, setSelectedRoomFilter] =
    useState<number | "all">("all");

  // Duration used for next-available search
  const [duration, setDuration] = useState(30);

  // Stores the next available slot returned by the backend
  const [nextAvailable, setNextAvailable] = useState<{
    roomId: number;
    startTime: string;
    endTime: string;
  } | null>(null);

  const [checkingAvailability, setCheckingAvailability] =
    useState(false);

  // Fetch bookings for the selected date
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
      setToast({
        message: "Unable to load bookings.",
        type: "error",
      });
    } finally {
      setLoadingBookings(false);
    }
  }

  // Cancel an existing booking
  async function handleCancelBooking() {
    if (!bookingToCancel) {
      return;
    }

    try {
      setCancelling(true);

      const response = await fetch(
        `${API_URL}/bookings/${bookingToCancel.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setToast({
          message:
            data.detail || "Unable to cancel booking.",
          type: "error",
        });

        return;
      }

      setToast({
        message: data.message,
        type: "success",
      });

      setBookingToCancel(null);

      await fetchBookings();
    } catch {
      setToast({
        message: "Unable to connect to the server.",
        type: "error",
      });
    } finally {
      setCancelling(false);
    }
  }

  // Find the earliest available slot for a room
  async function checkNextAvailable(roomId: number) {
    try {
      setCheckingAvailability(true);
      setNextAvailable(null);

      const response = await fetch(
        `${API_URL}/rooms/${roomId}/next-available?date=${selectedDate}&duration=${duration}`
      );

      const data = await response.json();

      if (!response.ok) {
        setToast({
          message:
            data.detail || "Unable to check availability.",
          type: "error",
        });

        return;
      }

      if (!data.available) {
        setToast({
          message: data.message,
          type: "error",
        });

        return;
      }

      setNextAvailable({
        roomId,
        startTime: data.start_time.slice(0, 5),
        endTime: data.end_time.slice(0, 5),
      });

      setToast({
        message: `Available from ${data.start_time.slice(
          0,
          5
        )} to ${data.end_time.slice(0, 5)}.`,
        type: "success",
      });
    } catch {
      setToast({
        message: "Unable to connect to the server.",
        type: "error",
      });
    } finally {
      setCheckingAvailability(false);
    }
  }

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
    fetchBookings();
  }, [selectedDate]);

  // Get bookings belonging to a specific room
  function getRoomBookings(roomId: number) {
    return bookings.filter(
      (booking) => booking.room_id === roomId
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-black">
            Meeting Room Booking
          </h1>

          <p className="mt-2 text-black">
            View and manage meeting room bookings.
          </p>
        </div>

        {/* Filters */}
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end">
          {/* Date */}
          <div>
            <label
              htmlFor="date"
              className="block text-sm font-medium text-black"
            >
              Select Date
            </label>

            <input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(event) => {
                setSelectedDate(event.target.value);
                setNextAvailable(null);
              }}
              className="mt-2 rounded-lg border border-gray-300 bg-white px-4 py-2"
            />
          </div>

          {/* Room filter */}
          <div>
            <label
              htmlFor="room-filter"
              className="block text-sm font-medium text-black"
            >
              Filter by Room
            </label>

            <select
              id="room-filter"
              value={selectedRoomFilter}
              onChange={(event) => {
                const value = event.target.value;

                setSelectedRoomFilter(
                  value === "all" ? "all" : Number(value)
                );

                setNextAvailable(null);
              }}
              className="mt-2 rounded-lg border border-gray-300 bg-white px-4 py-2"
            >
              <option value="all">All Rooms</option>

              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>

          {/* Duration */}
          <div>
            <label
              htmlFor="duration"
              className="block text-sm font-medium text-black"
            >
              Duration (minutes)
            </label>

            <input
              id="duration"
              type="number"
              min="1"
              max="540"
              value={duration}
              onChange={(event) => {
                setDuration(Number(event.target.value));
                setNextAvailable(null);
              }}
              className="mt-2 w-32 rounded-lg border border-gray-300 bg-white px-4 py-2"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="mt-6 rounded-lg bg-red-50 p-4 text-red-600">
            {error}
          </p>
        )}

        {/* Rooms */}
        {loadingRooms ? (
          <p className="mt-8 text-black">
            Loading rooms...
          </p>
        ) : rooms.length === 0 ? (
          <p className="mt-8 text-black">
            No rooms available.
          </p>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rooms
              .filter(
                (room) =>
                  selectedRoomFilter === "all" ||
                  room.id === selectedRoomFilter
              )
              .map((room) => {
                const roomBookings = getRoomBookings(room.id);

                return (
                  <motion.div
                    key={room.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.25,
                      delay: room.id * 0.05,
                    }}
                    className="rounded-xl border bg-white p-6 shadow-sm"
                  >
                    {/* Room name */}
                    <h2 className="text-xl font-semibold text-black">
                      {room.name}
                    </h2>

                    {/* Bookings */}
                    <div className="mt-5">
                      {loadingBookings ? (
                        <p className="text-sm text-black">
                          Loading bookings...
                        </p>
                      ) : roomBookings.length === 0 ? (
                        <p className="text-sm text-black">
                          No bookings for this date.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {roomBookings.map((booking) => (
                            <motion.div
                              key={booking.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.2 }}
                              className="rounded-lg bg-gray-100 p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium text-black">
                                    {booking.title}
                                  </p>

                                  <p className="mt-1 text-sm text-black">
                                    {booking.start_time.slice(
                                      0,
                                      5
                                    )}{" "}
                                    -{" "}
                                    {booking.end_time.slice(
                                      0,
                                      5
                                    )}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setBookingToCancel(booking)}
                                  className="text-sm font-medium text-red-600 hover:text-red-800"
                                >
                                  Cancel
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Book Room */}
                    <motion.button
                        type="button"
                        onClick={() => setSelectedRoom(room)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="mt-6 w-full rounded-lg bg-black px-4 py-2 text-white hover:bg-gray-800"
                      >
                      Book Room
                    </motion.button>

                    {/* Next Available */}
                    <button
                      type="button"
                      onClick={() =>
                        checkNextAvailable(room.id)
                      }
                      disabled={checkingAvailability}
                      className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 text-black hover:bg-gray-50 disabled:opacity-50"
                    >
                      {checkingAvailability
                        ? "Checking..."
                        : "Find Next Available"}
                    </button>

                    {/* Next available result */}
                    {nextAvailable?.roomId === room.id && (
                      <div className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">
                        Next available:{" "}
                        <strong>
                          {nextAvailable.startTime} -{" "}
                          {nextAvailable.endTime}
                        </strong>
                      </div>
                    )}
                  </motion.div>
                );
              })}
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {selectedRoom && (
        <BookingModal
          room={selectedRoom}
          date={selectedDate}
          onClose={() => setSelectedRoom(null)}
          onBookingCreated={(message) => {
            fetchBookings();

            setToast({
              message,
              type: "success",
            });
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      {/* Cancellation confirmation */}
      {bookingToCancel && (
        <ConfirmModal
          title="Cancel booking?"
          message={`Are you sure you want to cancel "${bookingToCancel.title}" from ${bookingToCancel.start_time.slice(
            0,
            5
          )} to ${bookingToCancel.end_time.slice(0, 5)}?`}
          onConfirm={handleCancelBooking}
          onCancel={() => setBookingToCancel(null)}
          loading={cancelling}
        />
      )}
    </main>
  );
}