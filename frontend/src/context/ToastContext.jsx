import { createContext, useCallback, useContext, useRef, useState } from "react";
import DissapearingToast from "../components/toast/DissapearingToast";

// Ported from the Laravel project's Context/ToastContext.jsx, keeping its
// contract exactly: the context value is an OBJECT
// `{ message, messageType, handleToast }`, and handleToast's signature is
// (message, messageType, duration = 3000, ...callbacks).
//
// That shape matters -- GeneratedModulePage and any wrapper page call
// `const { handleToast } = useToast()`, so returning a bare function here
// would break every caller ported across from the Laravel side.
const ToastContext = createContext();

export function ToastProvider({ children }) {
    const [message, setMessage] = useState("");
    const [messageType, setMessageType] = useState("");
    const timeoutId = useRef(null);

    const handleToast = useCallback((message, messageType, duration = 3000, ...params) => {
        // The original scrolled #app-content into view so a toast raised from
        // halfway down a long table is actually seen. AppContent still carries
        // that id; the optional chaining is because a page rendered outside the
        // shell has no such element.
        document.getElementById("app-content")?.scrollIntoView(true);
        setMessage(message);
        setMessageType(messageType);

        if (timeoutId.current) {
            clearTimeout(timeoutId.current);
        }

        timeoutId.current = setTimeout(() => {
            setMessage("");
            timeoutId.current = null;
        }, duration);

        params.forEach((param) => {
            if (typeof param === "function") {
                param();
            }
        });
    }, []);

    return (
        <ToastContext.Provider value={{ message, messageType, handleToast }}>
            <DissapearingToast type={messageType} message={message} />
            {children}
        </ToastContext.Provider>
    );
}

// Throws outside a provider, same as the original -- a missing provider is a
// wiring mistake worth failing loudly on, not something to paper over.
export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}

// Not in the original. A component that must also work outside the shell
// (GeneratedModulePage renders standalone in a wrapper page) needs to ask
// without throwing, and a hook cannot be called conditionally.
export function useOptionalToast() {
    return useContext(ToastContext) ?? null;
}
