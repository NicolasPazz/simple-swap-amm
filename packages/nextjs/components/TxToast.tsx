"use client";
import React from "react";
import { toast, Toast } from "react-hot-toast";

/**
 * Custom toast notifications used across the app.
 * Provides a link to the transaction on Etherscan when a hash is supplied.
 */

export type ToastType = "success" | "error" | "loading";

const colors: Record<ToastType, string> = {
  success: "bg-green-500",
  error: "bg-red-500",
  loading: "bg-blue-500",
};

export const txToast = (
  type: ToastType,
  message: string,
  txHash?: string,
) => {
  const link = txHash ? `https://sepolia.etherscan.io/tx/${txHash}` : undefined;
  const icons: Record<ToastType, string> = {
    success: "✔",
    error: "⚠",
    loading: "⏳",
  };
  const id = toast.custom((t: Toast) => (
    <div
      className={`relative flex flex-col gap-1 p-4 rounded-xl shadow-lg text-base-100 ${colors[type]}`}
    >
      <div className="flex items-center gap-2">
        <span>{icons[type]}</span>
        <span className="font-semibold">{message}</span>
      </div>
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="text-xs break-all underline"
        >
          {txHash}
        </a>
      )}
      <button
        className="absolute top-1 right-2 text-base-100"
        onClick={() => toast.dismiss(t.id)}
      >
        ✕
      </button>
    </div>
  ));
  return id;
};
