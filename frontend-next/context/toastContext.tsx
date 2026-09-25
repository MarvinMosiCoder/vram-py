"use client";

import { createContext, useContext, type ReactNode } from "react";

import { toast, ToastContainer, type ToastOptions, type Id } from "react-toastify";

type MessageType =
  | "default"
  | "success"
  | "error"
  | "warning"
  | "info"
  | "danger";

type ToastCallback = () => void;

type ToastContextType = {
  handleToast: (
    message: unknown,
    messageType?: MessageType,
    // false disables autoClose, as react-toastify's own option does.
    duration?: number | false,
    ...callbacks: ToastCallback[]
  ) => Id | undefined;
};

export function formatToastMessage(message: unknown): string {
  if (typeof message === "string") {
    return message;
  }

  if (Array.isArray(message)) {
    return message
      .map(formatToastMessage)
      .filter(Boolean)
      .join("\n");
  }

  if (message && typeof message === "object") {
    const obj = message as Record<string, unknown>;

    return formatToastMessage(
      obj.msg ??
      obj.message ??
      Object.values(obj)
    );
  }

  return message == null ? "" : String(message);
}

export function showToast(
  message: unknown,
  messageType: MessageType = "default",
  duration: number | false = 3000,
  ...callbacks: ToastCallback[]
): Id | undefined {
  const type = messageType === "danger"
    ? "error"
    : messageType;

  const content = formatToastMessage(message);

  const toastType: ToastOptions["type"] =
    ["success", "error", "warning", "info"].includes(type)
      ? type as ToastOptions["type"]
      : "default";

  const id = content
    ? toast(content, {
        type: toastType,
        autoClose: duration,
        style: {
          whiteSpace: "pre-line",
        },
      })
    : undefined;

  callbacks.forEach((callback) => {
    callback();
  });

  return id;
}

const ToastContext =
  createContext<ToastContextType | null>(null);

const toastContextValue: ToastContextType = {
  handleToast: showToast,
};

type ToastProviderProps = {
  children: ReactNode;
};

export function ToastProvider({
  children,
}: ToastProviderProps) {
  return (
    <ToastContext.Provider value={toastContextValue}>
      {children}

      <ToastContainer
        position="top-right"
        newestOnTop
        closeOnClick
        pauseOnHover
      />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error(
      "useToast must be used within a ToastProvider"
    );
  }

  return context;
}

export function useOptionalToast(): ToastContextType | null {
  return useContext(ToastContext);
}