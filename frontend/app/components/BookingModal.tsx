"use client";

import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

type Room = {
  id: number;
  name: string;
};

type BookingModalProps = {
  room: Room;
  date: string;
  onClose: () => void;
  onBookingCreated: (message: string) => void;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const OPENING_MINUTES = 9 * 60;
const CLOSING_MINUTES = 18 * 60;
const SLOT_MINUTES = 30;

function toTimeValue(minutes: number) {
  const hours = Math.floor(minutes / 60);

  return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

const TIME_SLOTS = Array.from(
  { length: (CLOSING_MINUTES - OPENING_MINUTES) / SLOT_MINUTES + 1 },
  (_, index) => toTimeValue(OPENING_MINUTES + index * SLOT_MINUTES)
);

const START_SLOTS = TIME_SLOTS.slice(0, -1);
const END_SLOTS = TIME_SLOTS.slice(1);

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

export default function BookingModal({
  room,
  date,
  onClose,
  onBookingCreated,
}: BookingModalProps) {
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const endSlots = END_SLOTS.filter((slot) => slot > startTime);

  function handleStartTimeChange(value: string) {
    setStartTime(value);

    if (!value) {
      setEndTime("");
      return;
    }

    if (endTime <= value) {
      setEndTime(END_SLOTS.find((slot) => slot > value) ?? "");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    if (!title.trim()) {
      setError("Booking title is required.");
      return;
    }

    if (!startTime || !endTime) {
      setError("Please select start and end time.");
      return;
    }

    if (startTime >= endTime) {
      setError("End time must be after start time.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          room_id: room.id,
          title: title.trim(),
          date,
          start_time: startTime,
          end_time: endTime,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(errorDetail(data, "Unable to create booking."));
        return;
      }

      onBookingCreated(data.message);
      onClose();
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Book Room
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              {room.name} · {date}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Meeting Title
            </label>

            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Team Meeting"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          <div>
            <label
              htmlFor="start-time"
              className="block text-sm font-medium text-gray-700"
            >
              Start Time
            </label>

            <select
              id="start-time"
              value={startTime}
              onChange={(event) => handleStartTimeChange(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
            >
              <option value="">Select a start time</option>

              {START_SLOTS.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="end-time"
              className="block text-sm font-medium text-gray-700"
            >
              End Time
            </label>

            <select
              id="end-time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              disabled={!startTime}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="">
                {startTime ? "Select an end time" : "Select a start time first"}
              </option>

              {endSlots.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
            >
              {loading ? "Booking..." : "Create Booking"}
            </button>
          </div>
        </form>
    
      </motion.div>
</div>
  );
}