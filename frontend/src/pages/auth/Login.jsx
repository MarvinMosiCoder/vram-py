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

const LoginLoaderOverlay = () => (
  <div className="login-loading-overlay">
    <div className="login-loading-pill">
      <span className="login-loading-dot" />
      <span className="login-loading-dot" />
      <span className="login-loading-dot" />
      <span>Signing you in</span>
    </div>
  </div>
);

const Brand = ({ className = "" }) => (
  <div className={`login-brand ${className}`.trim()}>
    <span className="login-brand-badge">
      <i className="fa fa-shield-halved" />
    </span>
    <div>
      <p className="login-brand-tag">Application Portal</p>
      <p className="login-brand-name">{APP_NAME}</p>
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
      setError(err.response?.data?.detail || "Login failed. Please try again.");
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
    <>
      {loading && <LoginLoaderOverlay />}
      <main className="login-page">
        <section className="login-hero">
          <Brand />

          <div className="login-hero-body">
            <p className="login-hero-clock">
              {formattedDate} — {formattedTime}
            </p>
            <h1 className="login-hero-headline">
              Access {APP_NAME} with a cleaner workspace.
            </h1>
            <p className="login-hero-desc">
              Sign in to reach your dashboard, manage roles and permissions, and
              administer every module from one place.
            </p>
          </div>

          <div className="login-hero-features">
            <p className="login-hero-feature">
              <i className="fa fa-shield-halved" /> Role-based access control
            </p>
            <p className="login-hero-feature">
              <i className="fa fa-layer-group" /> Metadata-driven modules
            </p>
            <p className="login-hero-feature">
              <i className="fa fa-gauge-high" /> Live dashboard and sidebar
            </p>
          </div>
        </section>

        <section className="login-form-side">
          <div className="login-card">
            <Brand className="login-mobile-brand" />

            <div className="panel">
              <p className="eyebrow">Welcome back</p>
              <h1>Sign in to continue</h1>
              <p className="login-subtext">Use your account credentials.</p>

              <form onSubmit={handleSubmit} noValidate>
                <label className="form-field">
                  <InputLabel value="Email" />
                  <div className="icon-field">
                    <i className="fa fa-envelope field-icon" />
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

                <label className="form-field">
                  <InputLabel value="Password"  />
                  <div className="icon-field password-field">
                    <i className="fa fa-lock field-icon" />
                    <TextInput
                      type={showPassword ? "text" : "password"}
                      value={password}
                      placeholder="Enter your password"
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="password-toggle"
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

                <PrimaryButton disabled={loading}>
                  {loading ? "Logging in, please wait..." : "Login"}
                </PrimaryButton>
              </form>

              <p className="login-forgot-note">
                Forgot your password? Contact your administrator.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
