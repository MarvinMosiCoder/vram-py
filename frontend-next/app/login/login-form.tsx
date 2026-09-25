"use client";

import { useState, type SubmitEvent, CSSProperties } from "react";
import InputLabel from "@/components/form/InputLabel";
import TextInput from "@/components/form/TextInput";
import PrimaryButton from "@/components/button/PrimaryButton";
import { useAuth } from "@/context/authContext";
import { useRouter } from "next/navigation";
import { toast as notify } from "react-toastify";

type CSSPropertiesWithVars = CSSProperties & {
  [key: `--${string}`]: string | number;
};

function validateLogin(email: string, password: string) {
  if (!email.trim()) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return "Please enter a valid email address.";
  }
  if (!password.trim()) return "Password is required.";
  return "";
}

function getApiErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Login failed. Please try again.";
}

function notifyLogin(
  message: string,
  type: "success" | "error"
) {
  const accent =
    type === "error" ? "#e2665a" : "#3ecf8e";

  const style: CSSPropertiesWithVars = {
    "--toastify-icon-color-success": "#3ecf8e",
    "--toastify-icon-color-error": "#e2665a",
    "--toastify-color-progress-success": "#3ecf8e",
    "--toastify-color-progress-error": "#e2665a",

    background: "#171a21",
    color: "#e7e6e1",
    border: "1px solid #262b35",
    borderLeft: `3px solid ${accent}`,
    fontFamily: '"Poppins", system-ui, sans-serif',
    fontSize: "12px",
    minHeight: "36px",
    padding: "10px 15px",
    borderRadius: "6px",
    whiteSpace: "pre-line",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3)",
  };

  return notify(message, {
    type,
    theme: "dark",
    closeButton: false,
    autoClose: 3000,
    hideProgressBar: false,
    style,
  });
}

const LoginLoaderOverlay = () => (
  <div className="fixed inset-0 z-999 flex items-center justify-center bg-[rgba(7,8,10,0.82)] backdrop-blur-[2px]">
    <div className="flex items-center gap-2.5 rounded-full border border-skin-border bg-skin-panel px-5 py-3 text-[13px] font-semibold text-skin-text">
      <span className="size-2 animate-pulse rounded-full bg-skin-accent nth-2:[animation-delay:150ms] nth-3:[animation-delay:300ms]" />
      <span className="size-2 animate-pulse rounded-full bg-skin-accent nth-2:[animation-delay:150ms] nth-3:[animation-delay:300ms]" />
      <span className="size-2 animate-pulse rounded-full bg-skin-accent nth-2:[animation-delay:150ms] nth-3:[animation-delay:300ms]" />
      <span>Signing you in</span>
    </div>
  </div>
);

export default function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const validationError = validateLogin(email, password);
    if (validationError) {
      notifyLogin(validationError, "error");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      notifyLogin("Signed in successfully.", "success");
      router.replace("/dashboard");
    } catch (error) {
      notifyLogin(getApiErrorMessage(error), "error");
      setLoading(false);
    }
  }

  return (
    <>
      {loading && <LoginLoaderOverlay />}
      <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
        <label className="m-0 flex flex-col gap-1.5 text-[13px] text-skin-dim">
          <InputLabel value="Email" />
          <div className="relative [&_input]:pl-8.5">
            <i aria-hidden="true" className="fa fa-envelope pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[13px] text-skin-dim" />
            <TextInput
              type="email"
              name="email"
              required
              value={email}
              placeholder="Enter email"
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>
        </label>

        <label className="m-0 flex flex-col mt-2 gap-1.5 text-[13px] text-skin-dim">
          <InputLabel value="Password"  />
          <div className="relative [&_input]:pl-8.5 [&_input]:pr-10">
            <i aria-hidden="true" className="fa fa-lock pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[13px] text-skin-dim" />
            <TextInput
              type={showPassword ? "text" : "password"}
              name="password"
              required
              value={password}
              placeholder="Enter your password"
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="absolute top-1/2 right-1 m-0 size-7 -translate-y-1/2 cursor-pointer rounded bg-transparent p-0 text-skin-dim hover:bg-skin-border hover:text-skin-text"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              <i aria-hidden="true" className={showPassword ? "fa fa-eye-slash" : "fa fa-eye"} />
            </button>
          </div>
        </label>


        <PrimaryButton className="mt-5.5! w-full! p-2.75! text-sm! enabled:hover:bg-skin-accent-dim enabled:hover:text-skin-text enabled:hover:brightness-100" disabled={loading}>
          {loading ? "Logging in, please wait..." : "Login"}
        </PrimaryButton>
      </form>
    </>
  );
}
