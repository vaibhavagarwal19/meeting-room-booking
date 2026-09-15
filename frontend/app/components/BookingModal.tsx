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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    // Client-side validation
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
        setError(data.detail || "Unable to create booking.");
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

            <p className="mt-1 text-sm text-gray-500">
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
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Start Time
            </label>

            <input
              type="time"
              min="09:00"
              max="18:00"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              End Time
            </label>

            <input
              type="time"
              min="09:00"
              max="18:00"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
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
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2"
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