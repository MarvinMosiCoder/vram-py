"use client";

import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import Modal from "@/components/modal/Modal";
import ChangePasswordForm from "@/components/form/ChangePasswordForm";
import { useAuth } from "@/context/authContext";
import { useToast } from "@/context/toastContext";
import useSignOutCountdown from "@/hooks/useSignOutCountdown";
import api from "@/lib/http";

// POST /waive-change-password answers HTTP 200 either way; `status` carries the outcome.
type WaiveResponse = { message: string; status: "success" | "error" };

// The port's stand-in for Laravel's CheckUserForceChangePassword middleware:
// there is no session to redirect on, so the server computes the policy and
// this blocks the app until the password is changed or waived. It is a prompt,
// not enforcement - the token stays valid and the API is reachable around it,
// which is why /waive-change-password re-checks the rules server-side.
export default function ForcePasswordGate() {
  const { user, passwordPolicy, loadPasswordPolicy } = useAuth();
  const { handleToast } = useToast();
  const [waiving, setWaiving] = useState(false);
  const { countdown, signingOut, start } = useSignOutCountdown();

  if (!user || !passwordPolicy?.must_change) {
    return null;
  }

  const handleWaive = async () => {
    setWaiving(true);
    try {
      const { data } = await api.post<WaiveResponse>("/waive-change-password");
      handleToast(data.message, data.status);
      // Re-read rather than assuming: the server decides whether this closes.
      if (data.status === "success") await loadPasswordPolicy();
    } catch {
      handleToast("An error occurred while waiving the password", "error");
    } finally {
      setWaiving(false);
    }
  };

  const waiveReason = passwordPolicy.is_default_password
    ? "You cannot waive while using the default password."
    : !passwordPolicy.can_waive
      ? `No waivers left (${passwordPolicy.waivers_used} of ${passwordPolicy.max_waivers} used).`
      : "";

  return (
    <Modal show dismissible={false} widthClass="max-w-2xl" title="Change your password">
      <p className="m-0 text-[13px] leading-6 text-skin-dim">
        {passwordPolicy.is_default_password
          ? "Your account is still using the default password. Set a new one to continue."
          : "Your password is more than three months old. Set a new one to continue."}
      </p>

      <ChangePasswordForm
        showSidePanel={false}
        disabled={signingOut || waiving}
        onSuccess={start}
        extraActions={
          <button
            type="button"
            onClick={handleWaive}
            disabled={!passwordPolicy.can_waive || waiving || signingOut}
            title={waiveReason || undefined}
            className="inline-flex min-h-10.5 items-center justify-center gap-2 rounded-lg border border-skin-border px-4 py-2 text-[13px] font-semibold text-skin-text transition hover:border-skin-accent hover:bg-skin-accent-soft focus-visible:outline-2 focus-visible:outline-skin-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            {waiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            {waiving ? "Waiving..." : "Waive"}
          </button>
        }
      />

      {waiveReason && <p className="m-0 text-[12px] text-skin-dim">{waiveReason}</p>}
      {countdown !== null && countdown > 0 && (
        <p role="status" aria-live="polite" className="m-0 text-[13px] text-skin-accent">
          Password updated. Signing out in {countdown}...
        </p>
      )}
    </Modal>
  );
}
