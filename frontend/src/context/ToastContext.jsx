import { createContext, useContext } from "react";
import { toast, ToastContainer } from "react-toastify";

// API validation responses may contain arrays or field-to-message objects.
export function formatToastMessage(message) {
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.map(formatToastMessage).filter(Boolean).join("\n");
    if (message && typeof message === "object") {
        return formatToastMessage(message.msg ?? message.message ?? Object.values(message));
    }
    return message == null ? "" : String(message);
}

// Preserve the existing duration and immediate callback contract.
export function showToast(message, messageType = "default", duration = 3000, ...callbacks) {
    const type = messageType === "danger" ? "error" : messageType;
    const content = formatToastMessage(message);
    const id = content ? toast(content, {
        type: ["success", "error", "warning", "info"].includes(type) ? type : "default",
        autoClose: duration,
        style: { whiteSpace: "pre-line" },
    }) : undefined;
    callbacks.forEach((callback) => {
        if (typeof callback === "function") callback();
    });
    return id;
}

const ToastContext = createContext();
const toastContextValue = { handleToast: showToast };

export function ToastProvider({ children }) {
    return (
        <ToastContext.Provider value={toastContextValue}>
            {children}
            <ToastContainer position="top-right" newestOnTop closeOnClick pauseOnHover />
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) throw new Error("useToast must be used within a ToastProvider");
    return context;
}

export function useOptionalToast() {
    return useContext(ToastContext) ?? null;
}
