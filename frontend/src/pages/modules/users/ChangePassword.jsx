import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import ContentPanel from '../../../components/panel/ContentPanel';
import ChangePasswordForm from '../../../components/form/ChangePasswordForm';
import useSignOutCountdown from '../../../hooks/useSignOutCountdown';

const ChangePassword = () => {
    const { countdown, signingOut, start } = useSignOutCountdown();

    return (
        <ContentPanel>
            <div className="font-poppins">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.2em] text-skin-accent">
                            Account security
                        </p>
                        <h1 className="m-0 mt-2 text-2xl font-semibold tracking-tight text-skin-text">
                            Change Password
                        </h1>
                    </div>
                    <Link
                        to="/dashboard"
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-skin-border px-3 text-[13px] font-semibold text-skin-text transition hover:border-skin-accent hover:bg-skin-accent-soft focus-visible:outline-2 focus-visible:outline-skin-accent"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Dashboard
                    </Link>
                </div>

                {countdown > 0 && (
                    <div
                        role="status"
                        aria-live="polite"
                        className="mb-4 flex items-center gap-2 rounded-lg border border-skin-accent/40 bg-skin-accent-soft px-3 py-2 text-[13px] text-skin-accent"
                    >
                        <ShieldCheck className="h-4 w-4 shrink-0" />
                        Password updated. Signing out in {countdown}...
                    </div>
                )}

                <ChangePasswordForm disabled={signingOut} onSuccess={start} />
            </div>
        </ContentPanel>
    );
};

export default ChangePassword;
