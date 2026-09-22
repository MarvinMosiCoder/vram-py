import LoginForm from "./login-form";
import LoginClock from "./login-clock";

const APP_NAME = "Vram Admin";

const Brand = ({ className = "" }: { className?: string }) => (
  <div className={`relative z-1 flex items-center gap-3 ${className}`.trim()}>
    <span className="flex size-11 flex-none items-center justify-center rounded-xl bg-skin-accent-soft text-lg text-skin-accent">
      <i aria-hidden="true" className="fa fa-shield-halved" />
    </span>
    <div>
      <p className="m-0 text-[11px] uppercase tracking-[0.16em] text-skin-dim">Application Portal</p>
      <p className="m-0 text-lg font-bold text-skin-text">{APP_NAME}</p>
    </div>
  </div>
);

export default function LoginPage() {
  return (
    <div className="login-theme font-body">
      <main className="grid min-h-screen grid-cols-1 bg-skin-bg text-skin-text lg:grid-cols-[minmax(380px,42%)_1fr]">
        <section className="relative hidden flex-col justify-between overflow-hidden border-r border-skin-border bg-[linear-gradient(160deg,var(--panel)_0%,var(--bg)_100%)] p-12 lg:flex before:pointer-events-none before:absolute before:size-120 before:bg-[radial-gradient(circle,var(--app-theme-soft)_0%,transparent_70%)] before:content-['']">
          <Brand />

          <div className="relative z-1 max-w-110">
            <LoginClock />
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
              <i aria-hidden="true" className="fa fa-shield-halved" /> Role-based access control
            </p>
            <p className="flex items-center gap-2.5 text-[13px] text-skin-dim [&_i]:w-4 [&_i]:text-center [&_i]:text-skin-accent">
              <i aria-hidden="true" className="fa fa-layer-group" /> Metadata-driven modules
            </p>
            <p className="flex items-center gap-2.5 text-[13px] text-skin-dim [&_i]:w-4 [&_i]:text-center [&_i]:text-skin-accent">
              <i aria-hidden="true" className="fa fa-gauge-high" /> Live dashboard and sidebar
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

              <LoginForm />

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
