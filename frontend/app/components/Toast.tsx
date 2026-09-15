"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, XCircle, X } from "lucide-react";

type ToastProps = {
  message: string;
  type: "success" | "error";
  onClose: () => void;
};

export default function Toast({
  message,
  type,
  onClose,
}: ToastProps) {
  const isSuccess = type === "success";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 50 }}
        transition={{ duration: 0.2 }}
        className="fixed right-5 top-5 z-[100] flex w-[350px] items-start gap-3 rounded-xl border bg-white p-4 shadow-lg"
      >
        {isSuccess ? (
          <CheckCircle
            className="mt-0.5 shrink-0 text-green-600"
            size={22}
          />
        ) : (
          <XCircle
            className="mt-0.5 shrink-0 text-red-600"
            size={22}
          />
        )}

        <p className="flex-1 text-sm text-gray-700">
          {message}
        </p>

        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700"
        >
          <X size={18} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}