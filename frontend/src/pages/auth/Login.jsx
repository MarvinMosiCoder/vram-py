import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import InputLabel from "../../components/form/InputLabel";
import TextInput from "../../components/form/TextInput";
import PrimaryButton from "../../components/button/PrimaryButton";

const APP_NAME = "Vram Admin";

function validateLogin(email, password) {
  if (!email.trim()) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return "Please enter a valid email address.";
  }
  if (!password.trim()) return "Password is required.";
  return "";
}

function getApiErrorMessage(error) {
  const detail = error.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => item.msg)
      .filter(Boolean)
      .join(", ");
  }

  return "Login failed. Please try again.";
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

const Brand = ({ className = "" }) => (
  <div className={`relative z-1 flex items-center gap-3 ${className}`.trim()}>
    <span className="flex size-11 flex-none items-center justify-center rounded-xl bg-skin-accent-soft text-lg text-skin-accent">
      <i className="fa fa-shield-halved" />
    </span>
    <div>
      <p className="m-0 text-[11px] uppercase tracking-[0.16em] text-skin-dim">Application Portal</p>
      <p className="m-0 text-lg font-bold text-skin-text">{APP_NAME}</p>
    </div>
  </div>
);

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (error.length > 0) {
            const timer = setTimeout(() => setError(''), 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

  async function handleSubmit(e) {
    e.preventDefault();
    const validationError = validateLogin(email, password);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate("/dashboard");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const formattedDate = currentTime.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const formattedTime = currentTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="login-theme font-body">
      {loading && <LoginLoaderOverlay />}
      <main className="grid min-h-screen grid-cols-1 bg-skin-bg text-skin-text lg:grid-cols-[minmax(380px,42%)_1fr]">
        <section className="relative hidden flex-col justify-between overflow-hidden border-r border-skin-border bg-[linear-gradient(160deg,var(--panel)_0%,var(--bg)_100%)] p-12 lg:flex before:pointer-events-none before:absolute before:size-120 before:bg-[radial-gradient(circle,var(--app-theme-soft)_0%,transparent_70%)] before:content-['']">
          <Brand />

          <div className="relative z-1 max-w-110">
            <p className="mb-5 inline-flex rounded-full border border-skin-border bg-skin-bg px-3.5 py-1.75 font-mono text-xs text-skin-dim">
              {formattedDate} — {formattedTime}
            </p>
            <h1 className="mb-3.5 text-[34px] leading-tight text-skin-text">
              Access {APP_NAME} with a cleaner workspace.
            </h1>
            <p className="m-0 max-w-95 text-sm leading-[1.7] text-skin-dim">
              Sign in to reach your dashboard, manage roles and permissions, and
              administer every module from one place.
            </p>
          </div>

          <div className="relative z-1 flex flex-col gap-2.5">
            <p className="flex items-center gap-2.5 text-[13px] text-skin-dim [&_i]:w-4 [&_i]:text-center [&_i]:text-skin-accent">
              <i className="fa fa-shield-halved" /> Role-based access control
            </p>
            <p className="flex items-center gap-2.5 text-[13px] text-skin-dim [&_i]:w-4 [&_i]:text-center [&_i]:text-skin-accent">
              <i className="fa fa-layer-group" /> Metadata-driven modules
            </p>
            <p className="flex items-center gap-2.5 text-[13px] text-skin-dim [&_i]:w-4 [&_i]:text-center [&_i]:text-skin-accent">
              <i className="fa fa-gauge-high" /> Live dashboard and sidebar
            </p>
          </div>
        </section>

        <section className="flex items-center justify-center p-6">
          <div className="w-full max-w-100">
            <Brand className="mb-6 lg:hidden" />

            <div className="w-full max-w-95 rounded-[10px] border border-skin-border bg-skin-panel p-8">
              <p className="mb-2 font-mono text-xs uppercase tracking-[0.08em] text-skin-accent">Welcome back</p>
              <h1 className="mb-1.5 text-[22px]">Sign in to continue</h1>
              <p className="mt-1 text-[13px] text-skin-dim">Use your account credentials.</p>

              <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
                <label className="m-0 flex flex-col gap-1.5 text-[13px] text-skin-dim">
                  <InputLabel value="Email" />
                  <div className="relative [&_input]:pl-8.5">
                    <i className="fa fa-envelope pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[13px] text-skin-dim" />
                    <TextInput
                      type="text"
                      value={email}
                      placeholder="Enter email"
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="username"
                      autoFocus
                    />
                  </div>
                </label>

                <label className="m-0 flex flex-col gap-1.5 text-[13px] text-skin-dim">
                  <InputLabel value="Password"  />
                  <div className="relative [&_input]:pl-8.5 [&_input]:pr-10">
                    <i className="fa fa-lock pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[13px] text-skin-dim" />
                    <TextInput
                      type={showPassword ? "text" : "password"}
                      value={password}
                      placeholder="Enter your password"
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="absolute top-1/2 right-1 m-0 size-7 -translate-y-1/2 cursor-pointer rounded bg-transparent p-0 text-skin-dim hover:bg-skin-border hover:text-skin-text"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      <i className={showPassword ? "fa fa-eye-slash" : "fa fa-eye"} />
                    </button>
                  </div>
                </label>

                {error && (
                    <span className="mt-2 block text-sm text-red-600">
                        <i className="fa fa-warning mr-1" /> {error}
                    </span>
                )}

                <PrimaryButton className="mt-5.5! w-full! p-2.75! text-sm! enabled:hover:bg-skin-accent-dim enabled:hover:text-skin-text enabled:hover:brightness-100" disabled={loading}>
                  {loading ? "Logging in, please wait..." : "Login"}
                </PrimaryButton>
              </form>

              <p className="mt-5 text-center text-xs text-skin-dim">
                Forgot your password? Contact your administrator.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
