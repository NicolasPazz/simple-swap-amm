"use client";
import { toast, Toast } from "react-hot-toast";
import React from "react";

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
  const link = txHash
    ? `https://sepolia.etherscan.io/tx/${txHash}`
    : undefined;
  return toast.custom((t: Toast) => (
    <div
      className={`relative flex flex-col gap-1 p-4 rounded-xl shadow-lg text-base-100 ${colors[type]}`}
    >
      <span className="font-semibold">{message}</span>
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
};
