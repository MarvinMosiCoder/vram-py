import { useEffect, useRef, useState } from "react";
import { toast as notify } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

// Counts down on screen after a password change, then clears the token.
// ProtectedRoute redirects to /login once `user` becomes null.
//
// Shared by the /change-password page and the forced-change modal, which both
// have to sign the user out after a successful save.
export default function useSignOutCountdown(seconds = 3) {
    const { logout } = useAuth();
    const { handleToast } = useToast();
    const [countdown, setCountdown] = useState(null);
    const [message, setMessage] = useState("");
    const toastRef = useRef(null);

    // autoClose off: this effect owns the toast until logout, otherwise it
    // would close on its own partway through the count.
    const start = (text) => {
        setMessage(text);
        toastRef.current = handleToast(`${text} Signing out in ${seconds}...`, "success", false);
        setCountdown(seconds);
    };

    // `logout` is intentionally out of the deps: AuthProvider rebuilds it on
    // every render, and re-running this effect would restart the pending tick.
    useEffect(() => {
        if (countdown === null) return;

        if (countdown === 0) {
            if (toastRef.current !== null) notify.dismiss(toastRef.current);
            logout();
            return;
        }

        if (toastRef.current !== null) {
            notify.update(toastRef.current, {
                render: `${message} Signing out in ${countdown}...`,
            });
        }

        const timer = setTimeout(() => setCountdown((current) => current - 1), 1000);
        return () => clearTimeout(timer);
    }, [countdown, message]);

    // An autoClose:false toast would outlive the page it belongs to.
    useEffect(() => () => {
        if (toastRef.current !== null) notify.dismiss(toastRef.current);
    }, []);

    return { countdown, signingOut: countdown !== null, start };
}
