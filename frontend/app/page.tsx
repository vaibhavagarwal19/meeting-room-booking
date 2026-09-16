"use client";

import BookingModal from "./components/BookingModal";
import Toast from "./components/Toast";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
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

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function todayAsDateValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
}

function errorDetail(data: unknown, fallback: string) {
  const detail = (data as { detail?: unknown })?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: string } | undefined;

    if (typeof first?.msg === "string") {
      return first.msg;
    }
  }

  return fallback;
}

export default function Home() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayAsDateValue);

  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(true);

  const [error, setError] = useState("");

  const [selectedRoom, setSelectedRoom] =
    useState<Room | null>(null);
  const [bookingToCancel, setBookingToCancel] =
    useState<Booking | null>(null);

  const [cancelling, setCancelling] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const [selectedRoomFilter, setSelectedRoomFilter] =
    useState<number | "all">("all");

  const [duration, setDuration] = useState(30);

  const [nextAvailable, setNextAvailable] = useState<{
    roomId: number;
    startTime: string;
    endTime: string;
  } | null>(null);

  const [checkingRoomId, setCheckingRoomId] =
    useState<number | null>(null);

  const bookingsRequestRef = useRef(0);

  const fetchBookings = useCallback(async () => {
    const requestId = bookingsRequestRef.current + 1;

    bookingsRequestRef.current = requestId;

    try {
      const response = await fetch(
        `${API_URL}/bookings?date=${selectedDate}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch bookings.");
      }

      const data = await response.json();

      if (requestId !== bookingsRequestRef.current) {
        return;
      }

      setBookings(data);
    } catch {
      if (requestId !== bookingsRequestRef.current) {
        return;
      }

      setToast({
        message: "Unable to load bookings.",
        type: "error",
      });
    } finally {
      if (requestId === bookingsRequestRef.current) {
        setLoadingBookings(false);
      }
    }
  }, [selectedDate]);

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
          message: errorDetail(
            data,
            "Unable to cancel booking."
          ),
          type: "error",
        });

        return;
      }

      setToast({
        message: data.message,
        type: "success",
      });

      setBookingToCancel(null);
      setNextAvailable(null);

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

  async function checkNextAvailable(roomId: number) {
    try {
      setCheckingRoomId(roomId);
      setNextAvailable(null);

      const response = await fetch(
        `${API_URL}/rooms/${roomId}/next-available?date=${selectedDate}&duration=${duration}`
      );

      const data = await response.json();

      if (!response.ok) {
        setToast({
          message: errorDetail(
            data,
            "Unable to check availability."
          ),
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
      setCheckingRoomId(null);
    }
  }

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

  useEffect(() => {
    async function loadBookings() {
      await fetchBookings();
    }

    loadBookings();
  }, [fetchBookings]);

  function getRoomBookings(roomId: number) {
    return bookings.filter(
      (booking) => booking.room_id === roomId
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Meeting Room Booking
          </h1>

          <p className="mt-2 text-gray-600">
            View and manage meeting room bookings.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div>
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
              onChange={(event) => {
                setLoadingBookings(true);
                setSelectedDate(event.target.value);
                setNextAvailable(null);
              }}
              className="mt-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900"
            />
          </div>

          <div>
            <label
              htmlFor="room-filter"
              className="block text-sm font-medium text-gray-700"
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
              className="mt-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900"
            >
              <option value="all">All Rooms</option>

              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="duration"
              className="block text-sm font-medium text-gray-700"
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
              className="mt-2 w-32 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900"
            />
          </div>
        </div>

        {error && (
          <p className="mt-6 rounded-lg bg-red-50 p-4 text-red-600">
            {error}
          </p>
        )}

        {loadingRooms ? (
          <p className="mt-8 text-gray-600">
            Loading rooms...
          </p>
        ) : rooms.length === 0 ? (
          <p className="mt-8 text-gray-600">
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
              .map((room, index) => {
                const roomBookings = getRoomBookings(room.id);

                return (
                  <motion.div
                    key={room.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.25,
                      delay: index * 0.05,
                    }}
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
                            <motion.div
                              key={booking.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.2 }}
                              className="rounded-lg bg-gray-100 p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {booking.title}
                                  </p>

                                  <p className="mt-1 text-sm text-gray-600">
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

                    <motion.button
                        type="button"
                        onClick={() => setSelectedRoom(room)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="mt-6 w-full rounded-lg bg-black px-4 py-2 text-white hover:bg-gray-800"
                      >
                      Book Room
                    </motion.button>

                    <button
                      type="button"
                      onClick={() =>
                        checkNextAvailable(room.id)
                      }
                      disabled={checkingRoomId === room.id}
                      className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {checkingRoomId === room.id
                        ? "Checking..."
                        : "Find Next Available"}
                    </button>

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

      {selectedRoom && (
        <BookingModal
          room={selectedRoom}
          date={selectedDate}
          onClose={() => setSelectedRoom(null)}
          onBookingCreated={(message) => {
            setNextAvailable(null);
            fetchBookings();

            setToast({
              message,
              type: "success",
            });
          }}
        />
      )}

      <AnimatePresence>
        {toast && (
          <Toast
            key={toast.message}
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </AnimatePresence>
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