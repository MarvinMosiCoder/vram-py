import { useEffect, useEffectEvent, useRef, useState } from "react";
import { toast as notify, type Id } from "react-toastify";
import { useAuth } from "@/context/authContext";
import { useToast } from "@/context/toastContext";

// Counts down on screen after a password change, then clears the token.
// RequireAuth redirects to /login once `user` becomes null.
//
// Shared by the /change-password page and the forced-change modal, which both
// have to sign the user out after a successful save.
export default function useSignOutCountdown(seconds = 3) {
    const { logout } = useAuth();
    const { handleToast } = useToast();
    const [countdown, setCountdown] = useState<number | null>(null);
    const [message, setMessage] = useState("");
    const toastRef = useRef<Id | null>(null);

    // autoClose off: this effect owns the toast until logout, otherwise it
    // would close on its own partway through the count.
    const start = (text: string) => {
        setMessage(text);
        toastRef.current = handleToast(`${text} Signing out in ${seconds}...`, "success", false) ?? null;
        setCountdown(seconds);
    };

    // An effect event, so `logout` stays out of the deps: AuthProvider rebuilds
    // it on every render, and re-running the effect would restart the pending tick.
    const signOut = useEffectEvent(() => {
        if (toastRef.current !== null) notify.dismiss(toastRef.current);
        logout();
    });

    useEffect(() => {
        if (countdown === null) return;

        if (countdown === 0) {
            signOut();
            return;
        }

        if (toastRef.current !== null) {
            notify.update(toastRef.current, {
                render: `${message} Signing out in ${countdown}...`,
            });
        }

        const timer = setTimeout(() => setCountdown((current) => (current ?? 1) - 1), 1000);
        return () => clearTimeout(timer);
    }, [countdown, message]);

    // An autoClose:false toast would outlive the page it belongs to.
    useEffect(() => () => {
        if (toastRef.current !== null) notify.dismiss(toastRef.current);
    }, []);

    return { countdown, signingOut: countdown !== null, start };
}
