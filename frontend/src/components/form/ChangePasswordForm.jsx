import React, { useEffect, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, ShieldCheck, XCircle } from 'lucide-react';
import api from '../../api';
import { formatToastMessage, useToast } from '../../context/ToastContext';

// The password fields, strength meter, requirement checks and submit, shared by
// the /change-password page and the forced-change modal. The Laravel original
// copy-pasted these between ChangePassword.jsx and ForceChangePassword.jsx and
// the two have since drifted; one component is the point.
//
// The form does not decide what happens after a successful save. The page signs
// the user out; the modal signs out on a change but not on a waive. So it hands
// the message to `onSuccess` and stops there.

const PasswordField = ({
    label,
    name,
    value,
    onChange,
    placeholder,
    autoComplete,
    disabled,
}) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <div className="space-y-2">
            <label htmlFor={name} className="block text-[13px] font-semibold text-skin-text">
                {label}
            </label>
            <div className="flex min-h-11 items-center rounded-lg border border-skin-border bg-skin-bg px-3 transition focus-within:border-skin-accent focus-within:ring-2 focus-within:ring-skin-accent/20">
                <LockKeyhole className="h-4 w-4 shrink-0 text-skin-dim" />
                <input
                    id={name}
                    type={showPassword ? 'text' : 'password'}
                    value={value}
                    name={name}
                    onChange={onChange}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    disabled={disabled}
                    className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-skin-text outline-none placeholder:text-skin-dim disabled:cursor-not-allowed disabled:opacity-60"
                />
                <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="rounded-md p-1.5 text-skin-dim transition hover:bg-skin-accent-soft hover:text-skin-accent focus-visible:outline-2 focus-visible:outline-skin-accent"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
            </div>
        </div>
    );
};

// A met requirement stays emerald rather than taking the role accent: the tick
// reports validation, and a red or amber role colour would read as a failure.
const Requirement = ({ active, children }) => (
    <li className={`flex items-center gap-2 text-[13px] ${active ? 'text-emerald-500' : 'text-skin-dim'}`}>
        {active ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        <span>{children}</span>
    </li>
);

export async function profileErrorMessage(error, fallback) {
    let data = error.response?.data;
    if (data instanceof Blob) {
        try {
            data = JSON.parse(await data.text());
        } catch {
            return fallback;
        }
    }
    return formatToastMessage(data?.detail || data?.errors || data?.message) || fallback;
}

const ChangePasswordForm = ({
    showSidePanel = true,
    extraActions = null,
    disabled = false,
    onSuccess,
}) => {
    const { handleToast } = useToast();
    const [isDisabled, setIsDisabled] = useState(true);
    const [loading, setLoading] = useState(false);
    const [passwordMismatch, setPasswordMismatch] = useState(false);
    const [isExistPassword, setIsExistPassword] = useState([]);
    const [forms, setForms] = useState({
        current_password: '',
        new_password: '',
        confirm_password: '',
    });

    const [activeText, setActiveText] = useState({
        Uppercase: false,
        Length: false,
        Number: false,
        Character: false,
    });
    const strengthLevel = isExistPassword.includes('Excellent')
        ? 3
        : isExistPassword.includes('Strong')
            ? 2
            : isExistPassword.includes('Weak')
                ? 1
                : 0;
    const strengthLabel = ['Not started', 'Weak', 'Strong', 'Excellent'][strengthLevel];
    const strengthTextClass = ['text-skin-dim', 'text-red-500', 'text-amber-500', 'text-emerald-500'][strengthLevel];
    const strengthBarClass = ['bg-skin-border', 'bg-red-500', 'bg-amber-500', 'bg-emerald-500'][strengthLevel];

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isDisabled || disabled) return;
        setLoading(true);
        try {
            const { data } = await api.post('/save-change-password', {
                current_password: forms.current_password,
                new_password: forms.new_password,
                confirm_password: forms.confirm_password,
            });

            if (data.status === 'success') {
                onSuccess?.(data.message);
                return;
            }

            handleToast(data.message, data.status);
        } catch (error) {
            handleToast(
                await profileErrorMessage(error, 'An error occurred while changing the password'),
                'error',
            );
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForms((prevForms) => ({
            ...prevForms,
            [name]: value,
        }));
    };

    useEffect(() => {
        validateInputs();
    }, [forms]);

    const validateInputs = () => {
        let isValid = true;

        const textActive = checkPasswordTextActive(forms.new_password);

        setActiveText({
            Uppercase: textActive.includes('Uppercase'),
            Length: textActive.includes('Length'),
            Number: textActive.includes('Number'),
            Character: textActive.includes('Character'),
        });

        const passwordChecks = {
            weak: false,
            strong: false,
            excellent: false,
        };

        if (forms.new_password) {
            if (forms.new_password.length > 0 && forms.new_password.length < 6) {
                passwordChecks.weak = true;
            }

            const hasLowerCase = /[a-z]/.test(forms.new_password);
            const hasNumber = /\d/.test(forms.new_password);
            if (forms.new_password.length >= 6 && hasLowerCase && hasNumber) {
                passwordChecks.strong = true;
            }

            const hasUpperCase = /[A-Z]/.test(forms.new_password);
            const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>;]/.test(forms.new_password);
            if (forms.new_password.length >= 8 && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar) {
                passwordChecks.excellent = true;
            }
            passwordChecks.weak = true;
        }

        setIsExistPassword(() => {
            const updatedPasswordStates = [];
            if (passwordChecks.weak) {
                updatedPasswordStates.push('Weak');
            }
            if (passwordChecks.strong) {
                updatedPasswordStates.push('Strong');
            }
            if (passwordChecks.excellent) {
                updatedPasswordStates.push('Excellent');
            }
            return updatedPasswordStates;
        });

        if (!passwordChecks.excellent) {
            isValid = false;
        }

        if (forms.new_password !== forms.confirm_password) {
            setPasswordMismatch(true);
            isValid = false;
        } else {
            setPasswordMismatch(false);
        }

        Object.values(forms).forEach((val) => {
            if (!val) {
                isValid = false;
            }
        });

        setIsDisabled(!isValid);
    };

    const checkPasswordTextActive = (password) => {
        const hasUpperCase = /[A-Z]/.test(password);
        const hasNumber = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>;]/.test(password);

        const allCharacters = [];

        if (hasUpperCase) allCharacters.push('Uppercase');
        if (password.length >= 8) allCharacters.push('Length');
        if (hasNumber) allCharacters.push('Number');
        if (hasSpecialChar) allCharacters.push('Character');

        return allCharacters;
    };

    const strengthCard = (
        <div className="rounded-lg border border-skin-border bg-skin-panel p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold text-skin-text">Password strength</span>
                <span className={`text-[13px] font-semibold ${strengthTextClass}`}>{strengthLabel}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-skin-border">
                <div
                    className={`h-full rounded-full transition-all ${strengthBarClass}`}
                    style={{ width: `${(strengthLevel / 3) * 100}%` }}
                />
            </div>
        </div>
    );

    const fields = (
        <div className="grid gap-5">
            <PasswordField
                label="Current password"
                name="current_password"
                value={forms.current_password}
                onChange={handleChange}
                placeholder="Enter current password"
                autoComplete="current-password"
                disabled={disabled}
            />
            <PasswordField
                label="New password"
                name="new_password"
                value={forms.new_password}
                onChange={handleChange}
                placeholder="Enter new password"
                autoComplete="new-password"
                disabled={disabled}
            />

            <ul className="grid gap-2 rounded-lg border border-skin-border bg-skin-bg p-4 sm:grid-cols-2">
                <Requirement active={activeText.Uppercase}>Uppercase letter</Requirement>
                <Requirement active={activeText.Length}>At least 8 characters</Requirement>
                <Requirement active={activeText.Number}>Number</Requirement>
                <Requirement active={activeText.Character}>Special character</Requirement>
            </ul>

            <PasswordField
                label="Confirm new password"
                name="confirm_password"
                value={forms.confirm_password}
                onChange={handleChange}
                placeholder="Confirm new password"
                autoComplete="new-password"
                disabled={disabled}
            />

            {!showSidePanel && strengthCard}

            {passwordMismatch && forms.confirm_password && (
                <div className="flex items-center gap-2 rounded-lg border border-skin-danger/40 bg-skin-danger-soft px-3 py-2 text-[13px] text-skin-danger">
                    <XCircle className="h-4 w-4 shrink-0" />
                    Passwords do not match.
                </div>
            )}

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                {extraActions}
                <button
                    disabled={isDisabled || loading || disabled}
                    type="submit"
                    className="inline-flex min-h-10.5 items-center justify-center gap-2 rounded-lg bg-skin-accent px-4 py-2 text-[13px] font-semibold text-theme-contrast transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-skin-accent disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {loading || disabled ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <KeyRound className="h-4 w-4" />
                    )}
                    {loading ? 'Changing...' : 'Change password'}
                </button>
            </div>
        </div>
    );

    if (!showSidePanel) {
        return <form onSubmit={handleSubmit}>{fields}</form>;
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="grid overflow-hidden rounded-xl border border-skin-border lg:grid-cols-[0.9fr_1.1fr]"
        >
            <section className="flex flex-col justify-between border-b border-skin-border bg-skin-bg p-6 lg:border-b-0 lg:border-r">
                <div>
                    <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-skin-accent-soft text-skin-accent">
                        <ShieldCheck className="h-6 w-6" />
                    </div>
                    <h2 className="m-0 text-xl font-semibold text-skin-text">
                        Keep your admin account protected
                    </h2>
                    <p className="m-0 mt-3 text-[13px] leading-6 text-skin-dim">
                        Use a password that is unique to this account. You will be signed out after a successful update.
                    </p>
                </div>

                <div className="mt-8">{strengthCard}</div>
            </section>

            <section className="bg-skin-panel p-6">{fields}</section>
        </form>
    );
};

export default ChangePasswordForm;
